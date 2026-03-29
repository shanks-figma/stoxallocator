from fastapi import FastAPI, APIRouter, HTTPException, Query, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import gzip
import json
import re
import asyncio
import base64
import random
import string
from urllib.parse import urlparse, parse_qs
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pyotp

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="StoxAllocator API")
api_router = APIRouter(prefix="/api")

UPSTOX_BASE_URL = "https://api.upstox.com/v2"
INSTRUMENTS_URLS = {
    "complete": "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz",
    "NSE": "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz",
    "BSE": "https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz",
}
MAX_BATCH = 500

# ===== Token Store (Option A) =====
class TokenUpdate(BaseModel):
    access_token: str

class TokenStore:
    _token: Optional[str] = None

    @classmethod
    async def load_from_db(cls):
        doc = await db.config.find_one({"id": "upstox_token"})
        if doc and doc.get("token"):
            cls._token = doc.get("token")

    @classmethod
    async def set_token(cls, token: str):
        cls._token = token
        await db.config.update_one({"id": "upstox_token"}, {"$set": {"id": "upstox_token", "token": token, "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)

    @classmethod
    def get_token(cls) -> Optional[str]:
        if cls._token and len(cls._token) > 10:
            return cls._token
        # fallback to env if present
        env_t = os.environ.get("UPSTOX_ACCESS_TOKEN")
        return env_t if env_t and len(env_t) > 10 else None


# Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class Instrument(BaseModel):
    instrument_key: str
    exchange_token: Optional[str] = None
    tradingsymbol: Optional[str] = Field(None, alias="trading_symbol")
    name: Optional[str] = None
    last_price: Optional[float] = None
    expiry: Optional[int] = None  # Unix timestamp in milliseconds
    strike_price: Optional[float] = Field(None, alias="strike_price")
    tick_size: Optional[float] = None
    lot_size: Optional[int] = None
    instrument_type: Optional[str] = None
    exchange: Optional[str] = None

    class Config:
        populate_by_name = True  # Allow both field name and alias

class InstrumentSearchRequest(BaseModel):
    query: str
    exchange: Optional[str] = None
    instrument_type: Optional[str] = None
    limit: int = 50

class QuoteRequest(BaseModel):
    instrument_keys: List[str]

# Buckets (truncated here - unchanged sections kept)
class BaselineHistoryEntry(BaseModel):
    at: str
    price: float
    label: Optional[str] = None

class BucketItem(BaseModel):
    instrument_key: str
    tradingsymbol: Optional[str] = None
    name: Optional[str] = None
    qty: Optional[float] = 0
    baseline_price: Optional[float] = None
    baseline_at: Optional[str] = None
    baseline_history: List[BaselineHistoryEntry] = Field(default_factory=list)

class Bucket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str = Field(default="watchlist")
    progress_mode: str = Field(default="baseline")
    edit_key: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[BucketItem] = Field(default_factory=list)
    baseline_snapshots: List[Dict[str, Optional[str]]] = Field(default_factory=list)
    active_baseline_at: Optional[str] = None
    active_baseline_label: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ===== helpers =====

def _clean_mongo(doc: Dict[str, Any]) -> Dict[str, Any]:
    if doc is None:
        return doc
    if isinstance(doc, dict) and doc.get("_id") is not None:
        doc = dict(doc)
        doc.pop("_id", None)
    return doc


def _validate_instrument_key(key: str) -> bool:
    return bool(re.match(r'^[A-Z_]+\|[A-Z0-9]+$', key))

# In-memory cache for instruments
_instruments_cache: Dict[str, List[Instrument]] = {}
_instruments_updated_at: Dict[str, datetime] = {}

async def _download_instruments(exchange: str = "complete") -> List[Instrument]:
    url = INSTRUMENTS_URLS.get(exchange, INSTRUMENTS_URLS["complete"])
    async with httpx.AsyncClient(timeout=40.0) as session:
        resp = await session.get(url)
        resp.raise_for_status()
        raw = gzip.decompress(resp.content)
        data = json.loads(raw.decode("utf-8"))
        instruments: List[Instrument] = []
        for item in data:
            try:
                instruments.append(Instrument(**item))
            except Exception:
                continue
        _instruments_cache[exchange] = instruments
        _instruments_updated_at[exchange] = datetime.now(timezone.utc)
        return instruments

async def _get_instruments(exchange: str = "complete") -> List[Instrument]:
    needs_refresh = False
    if exchange not in _instruments_cache:
        needs_refresh = True
    else:
        updated_at = _instruments_updated_at.get(exchange)
        if not updated_at or (datetime.now(timezone.utc) - updated_at) > timedelta(hours=24):
            needs_refresh = True
    if needs_refresh:
        return await _download_instruments(exchange)
    return _instruments_cache[exchange]

@api_router.get("/")
async def root():
    return {"message": "StoxAllocator backend is live"}

@api_router.get("/health")
async def health():
    # token status
    token = TokenStore.get_token()
    return {"status": "ok", "has_server_token": bool(token), "timestamp": datetime.now(timezone.utc).isoformat()}

# ===== Admin: Token management =====
@api_router.post("/admin/upstox-token")
async def admin_set_token(payload: TokenUpdate, x_admin_key: Optional[str] = Header(None)):
    admin_key = os.environ.get("ADMIN_KEY")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")
    if not payload.access_token or len(payload.access_token) < 10:
        raise HTTPException(status_code=400, detail="Invalid token")
    await TokenStore.set_token(payload.access_token)
    return {"status": "success"}

@api_router.get("/admin/token/status")
async def admin_token_status(x_admin_key: Optional[str] = Header(None)):
    admin_key = os.environ.get("ADMIN_KEY")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")
    token = TokenStore.get_token()
    if not token:
        return {"status": "success", "data": {"configured": False}}
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    ok = False
    try:
        async with httpx.AsyncClient(timeout=8.0) as session:
            # Cheap validate via feed authorize
            resp = await session.get(f"{UPSTOX_BASE_URL}/feed/market-data-feed/authorize", headers=headers)
            ok = resp.status_code == 200
    except Exception as e:
        return {"status": "success", "data": {"configured": True, "valid": False, "error": str(e)}}
    return {"status": "success", "data": {"configured": True, "valid": ok}}

@api_router.get("/admin/scheduler/status")
async def scheduler_status(x_admin_key: Optional[str] = Header(None)):
    """Get the status of the automatic token refresh scheduler"""
    admin_key = os.environ.get("ADMIN_KEY")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")

    refresh_status = await db.config.find_one({"id": "token_refresh_status"})
    next_run = None

    if scheduler.running:
        job = scheduler.get_job("upstox_token_refresh")
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()

    return {
        "status": "success",
        "data": {
            "scheduler_running": scheduler.running,
            "last_refresh": refresh_status.get("last_refresh") if refresh_status else None,
            "next_refresh": next_run,
            "refresh_status": refresh_status.get("status") if refresh_status else "not_started",
            "error_message": refresh_status.get("error_message") if refresh_status else None,
            "needs_refresh": refresh_status.get("needs_refresh", False) if refresh_status else False
        }
    }

# ===== OAuth: Upstox Login Flow =====
UPSTOX_AUTH_URL    = "https://api.upstox.com/v2/login/authorization/dialog"
UPSTOX_TOKEN_URL   = "https://api.upstox.com/v2/login/authorization/token"
UPSTOX_SERVICE_URL = "https://service.upstox.com"


def _request_id() -> str:
    return "WPRO-" + "".join(random.choices(string.ascii_letters + string.digits, k=10))


def _browser_headers() -> dict:
    return {
        "accept": "*/*",
        "content-type": "application/json",
        "origin": "https://login.upstox.com",
        "referer": "https://login.upstox.com/",
        "user-agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "x-device-details": "platform=WEB|osName=Mac OS/10.15.7|osVersion=10.15.7|appName=chrome|appVersion=131.0.0.0",
        "x-request-id": _request_id(),
    }


async def upstox_headless_login() -> str:
    """
    Fully automated Upstox login using mobile + PIN + TOTP.
    Flow: auth-dialog → OTP generate → TOTP verify → PIN 2FA → OAuth authorize → token exchange
    Returns a fresh access_token string on success.
    Raises RuntimeError with a human-readable message on failure.
    """
    mobile       = os.environ.get("UPSTOX_MOBILE", "").strip()
    pin          = os.environ.get("UPSTOX_PIN", "").strip()
    totp_secret  = os.environ.get("UPSTOX_TOTP_SECRET", "").strip()
    api_key      = os.environ.get("UPSTOX_API_KEY", "").strip()
    api_secret   = os.environ.get("UPSTOX_API_SECRET", "").strip()
    redirect_uri = os.environ.get("UPSTOX_REDIRECT_URI", "http://localhost:8001/api/auth/callback").strip()

    missing = [k for k, v in [
        ("UPSTOX_MOBILE", mobile), ("UPSTOX_PIN", pin),
        ("UPSTOX_TOTP_SECRET", totp_secret), ("UPSTOX_API_KEY", api_key),
        ("UPSTOX_API_SECRET", api_secret),
    ] if not v or v.startswith("your_")]
    if missing:
        raise RuntimeError(f"Missing / placeholder .env values: {', '.join(missing)}")

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as session:

        # ── Step 1: auth dialog → extract userId ───────────────────────────
        r1 = await session.get(
            UPSTOX_AUTH_URL,
            params={"response_type": "code", "client_id": api_key, "redirect_uri": redirect_uri},
        )
        final_params = parse_qs(urlparse(str(r1.url)).query)
        user_id = (final_params.get("user_id") or final_params.get("userId") or final_params.get("userid") or [None])[0]
        if not user_id:
            raise RuntimeError(f"Could not extract userId from auth dialog redirect: {r1.url}")
        logger.info(f"Auto-login step 1 (userId) ✓ — {user_id}")

        # ── Step 2: generate OTP/TOTP request ──────────────────────────────
        r2 = await session.post(
            f"{UPSTOX_SERVICE_URL}/login/open/v6/auth/1fa/otp/generate",
            json={"data": {"mobileNumber": mobile, "userId": user_id}},
            headers=_browser_headers(),
        )
        if r2.status_code != 200:
            raise RuntimeError(f"OTP generate failed ({r2.status_code}): {r2.text}")
        validate_otp_token = r2.json().get("data", {}).get("validateOTPToken", "")
        if not validate_otp_token:
            raise RuntimeError(f"No validateOTPToken in OTP generate response: {r2.text}")
        logger.info("Auto-login step 2 (OTP generate) ✓")

        # ── Step 3: verify TOTP ─────────────────────────────────────────────
        totp_code = pyotp.TOTP(totp_secret).now()
        r3 = await session.post(
            f"{UPSTOX_SERVICE_URL}/login/open/v4/auth/1fa/otp-totp/verify",
            json={"data": {"otp": totp_code, "validateOtpToken": validate_otp_token}},
            headers=_browser_headers(),
        )
        if r3.status_code != 200:
            raise RuntimeError(f"TOTP verify failed ({r3.status_code}): {r3.text}")
        logger.info("Auto-login step 3 (TOTP) ✓")

        # ── Step 4: submit PIN (base64-encoded) ─────────────────────────────
        pin_b64 = base64.b64encode(pin.encode()).decode()
        r4 = await session.post(
            f"{UPSTOX_SERVICE_URL}/login/open/v3/auth/2fa",
            params={
                "client_id": api_key,
                "redirect_uri": "https://api-v2.upstox.com/login/authorization/redirect",
            },
            json={"data": {"twoFAMethod": "SECRET_PIN", "inputText": pin_b64}},
            headers=_browser_headers(),
        )
        if r4.status_code != 200:
            raise RuntimeError(f"PIN 2FA failed ({r4.status_code}): {r4.text}")
        logger.info("Auto-login step 4 (PIN) ✓")

        # ── Step 5: OAuth authorize → get auth code ─────────────────────────
        r5 = await session.post(
            f"{UPSTOX_SERVICE_URL}/login/v2/oauth/authorize",
            params={
                "client_id": api_key,
                "redirect_uri": "https://api-v2.upstox.com/login/authorization/redirect",
                "requestId": _request_id(),
                "response_type": "code",
            },
            json={"data": {"userOAuthApproval": True}},
            headers=_browser_headers(),
        )
        if r5.status_code != 200:
            raise RuntimeError(f"OAuth authorize failed ({r5.status_code}): {r5.text}")
        redirect_url = r5.json().get("data", {}).get("redirectUri", "")
        auth_code = parse_qs(urlparse(redirect_url).query).get("code", [None])[0]
        if not auth_code:
            raise RuntimeError(f"No auth code in OAuth authorize response: {r5.text}")
        logger.info("Auto-login step 5 (OAuth) ✓")

        # ── Step 6: exchange auth code for access token ─────────────────────
        r6 = await session.post(
            UPSTOX_TOKEN_URL,
            data={
                "code": auth_code,
                "client_id": api_key,
                "client_secret": api_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        )
        if r6.status_code != 200:
            raise RuntimeError(f"Token exchange failed ({r6.status_code}): {r6.text}")
        access_token = r6.json().get("access_token", "")
        if not access_token:
            raise RuntimeError(f"No access_token in token-exchange response: {r6.text}")
        logger.info("Auto-login step 6 (token exchange) ✓")

        return access_token

@api_router.get("/auth/login")
async def auth_login():
    """Redirect user to Upstox OAuth login page."""
    api_key = os.environ.get("UPSTOX_API_KEY")
    redirect_uri = os.environ.get("UPSTOX_REDIRECT_URI", "http://localhost:8001/api/auth/callback")
    if not api_key:
        raise HTTPException(status_code=500, detail="UPSTOX_API_KEY not configured in .env")
    auth_url = (
        f"{UPSTOX_AUTH_URL}"
        f"?response_type=code"
        f"&client_id={api_key}"
        f"&redirect_uri={redirect_uri}"
    )
    return RedirectResponse(url=auth_url)

@api_router.get("/auth/callback")
async def auth_callback(code: str = Query(None), error: str = Query(None)):
    """Receive OAuth callback from Upstox, exchange code for access token."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    if error:
        return RedirectResponse(url=f"{frontend_url}/admin?auth_error={error}")
    if not code:
        return RedirectResponse(url=f"{frontend_url}/admin?auth_error=no_code")

    api_key = os.environ.get("UPSTOX_API_KEY")
    api_secret = os.environ.get("UPSTOX_API_SECRET")
    redirect_uri = os.environ.get("UPSTOX_REDIRECT_URI", "http://localhost:8001/api/auth/callback")

    if not api_secret:
        return RedirectResponse(url=f"{frontend_url}/admin?auth_error=no_api_secret_configured")

    # Exchange authorization code for access token
    try:
        async with httpx.AsyncClient(timeout=15.0) as session:
            resp = await session.post(
                UPSTOX_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": api_key,
                    "client_secret": api_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"}
            )

            if resp.status_code != 200:
                detail = resp.text
                logger.error(f"OAuth token exchange failed: {resp.status_code} — {detail}")
                return RedirectResponse(url=f"{frontend_url}/admin?auth_error=token_exchange_failed")

            token_data = resp.json()
            access_token = token_data.get("access_token")

            if not access_token:
                return RedirectResponse(url=f"{frontend_url}/admin?auth_error=no_token_in_response")

            # Auto-save the token!
            await TokenStore.set_token(access_token)
            logger.info("OAuth: access token saved successfully via OAuth flow")

            return RedirectResponse(url=f"{frontend_url}/admin?auth_success=true")

    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return RedirectResponse(url=f"{frontend_url}/admin?auth_error=exception")

@api_router.get("/auth/status")
async def auth_status():
    """Check if OAuth is configured (API secret present)."""
    api_key = os.environ.get("UPSTOX_API_KEY")
    api_secret = os.environ.get("UPSTOX_API_SECRET")
    redirect_uri = os.environ.get("UPSTOX_REDIRECT_URI")
    mobile = os.environ.get("UPSTOX_MOBILE", "")
    pin = os.environ.get("UPSTOX_PIN", "")
    totp_secret = os.environ.get("UPSTOX_TOTP_SECRET", "")
    auto_login_ready = bool(
        mobile and not mobile.startswith("your_") and
        pin and not pin.startswith("your_") and
        totp_secret
    )
    return {
        "status": "success",
        "data": {
            "oauth_configured": bool(api_key and api_secret),
            "has_api_key": bool(api_key),
            "has_api_secret": bool(api_secret),
            "redirect_uri": redirect_uri or "not set",
            "auto_login_ready": auto_login_ready,
        }
    }


@api_router.post("/auth/auto-login")
async def trigger_auto_login(x_admin_key: str = Header(None)):
    """
    Headless auto-login: mobile → PIN → TOTP → access token.
    Saves the token automatically. Protected by admin key.
    """
    admin_key = os.environ.get("ADMIN_KEY")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")

    try:
        access_token = await upstox_headless_login()
        await TokenStore.set_token(access_token)
        logger.info("Auto-login: token saved successfully")
        return {"status": "success", "message": "Logged in and token saved successfully"}
    except RuntimeError as e:
        logger.error(f"Auto-login failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Auto-login unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Auto-login failed unexpectedly")


# ===== core headers using server token =====
async def _upstox_headers() -> Dict[str, str]:
    token = TokenStore.get_token()
    if not token or len(token) < 10:
        raise HTTPException(status_code=500, detail="Server Upstox token not configured")
    headers = {"Accept": "application/json", "Authorization": f"Bearer {token}"}
    api_key = os.environ.get("UPSTOX_API_KEY")
    if api_key:
        headers["x-api-key"] = api_key
    return headers

# ===== Endpoints (quotes/instruments unchanged signature but ignore client token) =====
@api_router.get("/instruments/search")
async def search_instruments(query: str = Query(..., min_length=2), exchange: Optional[str] = Query(None, pattern=r"^(NSE|BSE)$"), instrument_type: Optional[str] = None, limit: int = Query(50, ge=1, le=200)):
    ex_key = exchange if exchange else "complete"
    instruments = await _get_instruments(ex_key)
    uq = query.upper()
    results: List[Instrument] = []
    exact_matches = []  # Trading symbol exact matches (highest priority)
    prefix_matches = []  # Trading symbol prefix matches
    other_matches = []   # Name matches

    for inst in instruments:
        sym = (inst.tradingsymbol or "").upper()
        nm = (inst.name or "").upper()

        if instrument_type and (inst.instrument_type != instrument_type):
            continue

        # Priority 1: Exact symbol match (e.g., "TCS" matches "TCS" exactly)
        if sym == uq:
            exact_matches.append(inst)
        # Priority 2: Symbol starts with query (e.g., "REL" matches "RELIANCE")
        elif sym.startswith(uq):
            prefix_matches.append(inst)
        # Priority 3: Symbol contains query (e.g., "LI" matches "RELIANCE")
        elif uq in sym:
            prefix_matches.append(inst)
        # Priority 4: Name contains query (e.g., "RELIANCE INDUSTRIES")
        elif uq in nm:
            other_matches.append(inst)

    # Combine results in priority order
    results = exact_matches + prefix_matches + other_matches
    results = results[:limit]

    return {"status": "success", "count": len(results), "data": [r.dict() for r in results]}

class QuotePayload(BaseModel):
    instrument_keys: List[str]

@api_router.post("/quotes/ltp")
async def quotes_ltp(payload: QuotePayload):
    if not payload.instrument_keys:
        return {"status": "success", "data": {}}
    keys = [k for k in payload.instrument_keys if _validate_instrument_key(k)]
    if len(keys) == 0:
        raise HTTPException(status_code=400, detail="No valid instrument_keys provided")
    if len(keys) > MAX_BATCH:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_BATCH} instruments allowed per request")
    headers = await _upstox_headers()
    params = {"instrument_key": ",".join(keys)}
    async with httpx.AsyncClient(timeout=15.0) as session:
        resp = await session.get(f"{UPSTOX_BASE_URL}/market-quote/ltp", headers=headers, params=params)
        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=resp.status_code, detail=detail)
        raw = resp.json().get("data", {})
        normalized = {}
        try:
            for k, v in raw.items():
                token_key = v.get("instrument_token") or k
                normalized[token_key] = v
        except Exception:
            normalized = raw
        return {"status": "success", "data": normalized, "timestamp": datetime.now(timezone.utc).isoformat()}

# ===== Buckets endpoints =====

class BucketCreate(BaseModel):
    name: str
    type: str = "watchlist"
    progress_mode: str = "baseline"
    items: List[BucketItem] = Field(default_factory=list)

@api_router.post("/buckets")
async def create_bucket(bucket: BucketCreate):
    bucket_data = Bucket(
        name=bucket.name,
        type=bucket.type,
        progress_mode=bucket.progress_mode,
        items=bucket.items
    )
    doc = bucket_data.dict()
    await db.buckets.insert_one(doc)
    return {"status": "success", "data": _clean_mongo(doc)}

@api_router.get("/buckets")
async def list_buckets():
    cursor = db.buckets.find({})
    buckets = []
    async for doc in cursor:
        buckets.append(_clean_mongo(doc))
    return {"status": "success", "data": buckets}

@api_router.get("/buckets/{bucket_id}")
async def get_bucket(bucket_id: str):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    return {"status": "success", "data": _clean_mongo(doc)}

@api_router.put("/buckets/{bucket_id}")
async def update_bucket(bucket_id: str, bucket: BucketCreate, x_edit_key: Optional[str] = Header(None)):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    if not x_edit_key or x_edit_key != doc.get("edit_key"):
        raise HTTPException(status_code=403, detail="Forbidden: invalid edit key")
    
    update_data = {
        "name": bucket.name,
        "type": bucket.type,
        "progress_mode": bucket.progress_mode,
        "items": [item.dict() for item in bucket.items],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.buckets.update_one({"id": bucket_id}, {"$set": update_data})
    updated_doc = await db.buckets.find_one({"id": bucket_id})
    return {"status": "success", "data": _clean_mongo(updated_doc)}

@api_router.delete("/buckets/{bucket_id}")
async def delete_bucket(bucket_id: str, x_edit_key: Optional[str] = Header(None)):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    if not x_edit_key or x_edit_key != doc.get("edit_key"):
        raise HTTPException(status_code=403, detail="Forbidden: invalid edit key")
    
    await db.buckets.delete_one({"id": bucket_id})
    return {"status": "success"}

@api_router.post("/buckets/{bucket_id}/baseline")
async def set_baseline(bucket_id: str, x_edit_key: Optional[str] = Header(None), label: Optional[str] = Query(None)):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    # require edit key
    if not x_edit_key or x_edit_key != doc.get("edit_key"):
        raise HTTPException(status_code=403, detail="Forbidden: invalid edit key")
    items = doc.get("items", [])
    if not items:
        return {"status": "success"}
    keys = [it.get("instrument_key") for it in items if _validate_instrument_key(it.get("instrument_key", ""))]
    if not keys:
        return {"status": "success"}
    headers = await _upstox_headers()
    params = {"instrument_key": ",".join(keys)}
    async with httpx.AsyncClient(timeout=15.0) as session:
        resp = await session.get(f"{UPSTOX_BASE_URL}/market-quote/ltp", headers=headers, params=params)
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        raw = resp.json().get("data", {})
    lut: Dict[str, Any] = {}
    for rk, rv in raw.items():
        lut[rk] = rv
        tok = rv.get("instrument_token")
        if tok:
            lut[tok] = rv
    now_iso = datetime.now(timezone.utc).isoformat()
    updated_items = []
    for it in items:
        k = it.get("instrument_key")
        q = lut.get(k) or {}
        if isinstance(q, dict) and q.get("last_price") is not None:
            price = float(q.get("last_price"))
            it["baseline_price"] = price
            it["baseline_at"] = now_iso
            hist = it.get("baseline_history") or []
            hist.append({"at": now_iso, "price": price, "label": label})
            it["baseline_history"] = hist
        updated_items.append(it)
    snapshots = doc.get("baseline_snapshots") or []
    snapshots.append({"at": now_iso, "label": label})
    await db.buckets.update_one({"id": bucket_id}, {"$set": {"items": updated_items, "baseline_snapshots": snapshots, "active_baseline_at": now_iso, "active_baseline_label": label, "updated_at": now_iso}})
    return {"status": "success"}

@api_router.get("/buckets/{bucket_id}/baseline-timestamps")
async def get_baseline_timestamps(bucket_id: str):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    snapshots = doc.get("baseline_snapshots", [])
    active_baseline = {
        "at": doc.get("active_baseline_at"),
        "label": doc.get("active_baseline_label")
    }
    
    return {
        "status": "success", 
        "data": snapshots,
        "active": active_baseline
    }

@api_router.post("/buckets/{bucket_id}/baseline/select")
async def select_baseline(bucket_id: str, baseline_data: dict, x_edit_key: Optional[str] = Header(None)):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    # require edit key
    if not x_edit_key or x_edit_key != doc.get("edit_key"):
        raise HTTPException(status_code=403, detail="Forbidden: invalid edit key")
    
    baseline_at = baseline_data.get("baseline_at")
    if not baseline_at:
        raise HTTPException(status_code=400, detail="baseline_at is required")
    
    # Find the corresponding snapshot
    snapshots = doc.get("baseline_snapshots", [])
    selected_snapshot = None
    for snapshot in snapshots:
        if snapshot.get("at") == baseline_at:
            selected_snapshot = snapshot
            break
    
    if not selected_snapshot:
        raise HTTPException(status_code=404, detail="Baseline snapshot not found")
    
    # Update bucket with new active baseline
    await db.buckets.update_one(
        {"id": bucket_id}, 
        {"$set": {
            "active_baseline_at": baseline_at,
            "active_baseline_label": selected_snapshot.get("label"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success"}

@api_router.post("/buckets/{bucket_id}/items")
async def add_item_to_bucket(bucket_id: str, item_data: dict, x_edit_key: Optional[str] = Header(None)):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    # require edit key
    if not x_edit_key or x_edit_key != doc.get("edit_key"):
        raise HTTPException(status_code=403, detail="Forbidden: invalid edit key")
    
    instrument_key = item_data.get("instrument_key")
    if not instrument_key or not _validate_instrument_key(instrument_key):
        raise HTTPException(status_code=400, detail="Valid instrument_key is required")
    
    # Check if item already exists
    items = doc.get("items", [])
    for item in items:
        if item.get("instrument_key") == instrument_key:
            raise HTTPException(status_code=409, detail="Item already exists in bucket")
    
    # Create new item
    new_item = {
        "instrument_key": instrument_key,
        "tradingsymbol": item_data.get("tradingsymbol"),
        "name": item_data.get("name"),
        "qty": float(item_data.get("qty", 0)),
        "baseline_price": None,
        "baseline_at": None,
        "baseline_history": []
    }
    
    items.append(new_item)
    
    await db.buckets.update_one(
        {"id": bucket_id}, 
        {"$set": {
            "items": items,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success"}

@api_router.put("/buckets/{bucket_id}/item-qty")
async def update_item_quantity(bucket_id: str, qty_data: dict, x_edit_key: Optional[str] = Header(None)):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    # require edit key
    if not x_edit_key or x_edit_key != doc.get("edit_key"):
        raise HTTPException(status_code=403, detail="Forbidden: invalid edit key")
    
    instrument_key = qty_data.get("instrument_key")
    qty = qty_data.get("qty")
    
    if not instrument_key:
        raise HTTPException(status_code=400, detail="instrument_key is required")
    
    items = doc.get("items", [])
    updated = False
    
    for item in items:
        if item.get("instrument_key") == instrument_key:
            item["qty"] = float(qty) if qty is not None else 0
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found in bucket")
    
    await db.buckets.update_one(
        {"id": bucket_id}, 
        {"$set": {
            "items": items,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success"}

@api_router.delete("/buckets/{bucket_id}/items/{instrument_key}")
async def delete_item_from_bucket(bucket_id: str, instrument_key: str, x_edit_key: Optional[str] = Header(None)):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    
    # require edit key
    if not x_edit_key or x_edit_key != doc.get("edit_key"):
        raise HTTPException(status_code=403, detail="Forbidden: invalid edit key")
    
    items = doc.get("items", [])
    original_length = len(items)
    
    # Remove the item
    items = [item for item in items if item.get("instrument_key") != instrument_key]
    
    if len(items) == original_length:
        raise HTTPException(status_code=404, detail="Item not found in bucket")
    
    await db.buckets.update_one(
        {"id": bucket_id}, 
        {"$set": {
            "items": items,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success"}

@api_router.get("/buckets/{bucket_id}/metrics")
async def bucket_metrics(bucket_id: str):
    doc = await db.buckets.find_one({"id": bucket_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Bucket not found")
    items = doc.get("items", [])
    if not items:
        return {"status": "success", "data": {"items": [], "summary": {}}}
    keys = [it.get("instrument_key") for it in items if _validate_instrument_key(it.get("instrument_key", ""))]
    headers = await _upstox_headers()
    async def fetch_ltp_map(session: httpx.AsyncClient, keys_list: List[str]) -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        BATCH = 50
        for i in range(0, len(keys_list), BATCH):
            batch = keys_list[i:i+BATCH]
            r = await session.get(f"{UPSTOX_BASE_URL}/market-quote/ltp", headers=headers, params={"instrument_key": ",".join(batch)})
            if r.status_code == 200:
                raw = r.json().get("data", {})
                for rk, rv in raw.items():
                    out[rk] = rv
                    tok = rv.get("instrument_token")
                    if tok:
                        out[tok] = rv
        return out
    async with httpx.AsyncClient(timeout=20.0) as session:
        ltp_data = await fetch_ltp_map(session, keys)
    results = []
    total_value = 0.0
    for it in items:
        k = it.get("instrument_key")
        q = ltp_data.get(k) or {}
        ltp = q.get("last_price")
        qty = float(it.get("qty") or 0)
        val = (ltp or 0) * qty
        total_value += val
        baseline = it.get("baseline_price")
        change_pct = None
        if baseline and baseline > 0 and ltp is not None:
            change_pct = (ltp - baseline) / baseline
        results.append({"instrument_key": k, "tradingsymbol": it.get("tradingsymbol"), "name": it.get("name"), "qty": qty, "ltp": ltp, "baseline_price": baseline, "progress_pct": change_pct})
    summary = {"total_value": total_value, "count": len(results), "progress_mode": doc.get("progress_mode"), "type": doc.get("type")}
    return {"status": "success", "data": {"items": results, "summary": summary}}

# ===== Shared Price Cache & Upstox Stream Manager =====
# Instead of per-client polling, we maintain a SINGLE global price cache
# that is updated by one background loop. All frontend WS clients read from this cache.

class SharedPriceCache:
    """Global price store — one source of truth for all clients."""
    def __init__(self):
        self._prices: Dict[str, Dict[str, Any]] = {}  # instrument_key -> {last_price, timestamp, ...}
        self._subscribed_keys: Set[str] = set()        # union of all client subscriptions
        self._clients: Dict[str, "WSClientState"] = {} # client_id -> WSClientState
        self._poll_task: Optional[asyncio.Task] = None
        self._running = False
        self._lock = asyncio.Lock()

    def get_price(self, instrument_key: str) -> Optional[Dict[str, Any]]:
        return self._prices.get(instrument_key)

    def get_all_prices(self) -> Dict[str, Dict[str, Any]]:
        return dict(self._prices)

    async def register_client(self, client_id: str, client: "WSClientState"):
        async with self._lock:
            self._clients[client_id] = client
            self._subscribed_keys.update(client.instrument_keys)
            if not self._running:
                self._start_polling()

    async def unregister_client(self, client_id: str):
        async with self._lock:
            self._clients.pop(client_id, None)
            # Recompute subscribed keys from remaining clients
            self._subscribed_keys = set()
            for c in self._clients.values():
                self._subscribed_keys.update(c.instrument_keys)
            # Stop polling if no clients
            if not self._clients and self._poll_task:
                self._running = False
                self._poll_task.cancel()
                self._poll_task = None

    async def update_subscriptions(self):
        """Recompute the union of all client subscriptions."""
        async with self._lock:
            self._subscribed_keys = set()
            for c in self._clients.values():
                self._subscribed_keys.update(c.instrument_keys)

    def _start_polling(self):
        self._running = True
        self._poll_task = asyncio.ensure_future(self._poll_loop())

    async def _poll_loop(self):
        """Single shared loop: fetch prices once, push to ALL clients."""
        logger.info("SharedPriceCache: poll loop started")
        while self._running:
            try:
                if not self._subscribed_keys:
                    await asyncio.sleep(1)
                    continue

                token = TokenStore.get_token()
                if not token:
                    await asyncio.sleep(3)
                    continue

                headers = {"Accept": "application/json", "Authorization": f"Bearer {token}"}
                api_key = os.environ.get("UPSTOX_API_KEY")
                if api_key:
                    headers["x-api-key"] = api_key

                keys_list = list(self._subscribed_keys)
                now_iso = datetime.now(timezone.utc).isoformat()

                # Batch in groups of 50 for efficiency
                async with httpx.AsyncClient(timeout=10.0) as session:
                    for i in range(0, len(keys_list), 50):
                        batch = keys_list[i:i+50]
                        try:
                            resp = await session.get(
                                f"{UPSTOX_BASE_URL}/market-quote/ltp",
                                headers=headers,
                                params={"instrument_key": ",".join(batch)}
                            )
                            if resp.status_code == 200:
                                data = resp.json().get("data", {})
                                for _, v in data.items():
                                    token_key = v.get("instrument_token")
                                    ltp = v.get("last_price")
                                    if token_key and ltp is not None:
                                        self._prices[token_key] = {
                                            "last_price": ltp,
                                            "instrument_token": token_key,
                                            "timestamp": now_iso
                                        }
                        except Exception as e:
                            logger.warning(f"SharedPriceCache batch error: {e}")

                # Fan out to all connected clients
                dead_clients = []
                for client_id, client in list(self._clients.items()):
                    try:
                        updates = []
                        for key in client.instrument_keys:
                            price_data = self._prices.get(key)
                            if price_data:
                                updates.append(price_data)
                        if updates:
                            await client.websocket.send_text(json.dumps({
                                "type": "market_data_batch",
                                "data": updates,
                                "timestamp": now_iso
                            }))
                    except Exception:
                        dead_clients.append(client_id)

                # Cleanup dead clients
                for cid in dead_clients:
                    await self.unregister_client(cid)

                # Poll every 1 second (single shared call vs N calls before)
                await asyncio.sleep(1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"SharedPriceCache poll error: {e}")
                await asyncio.sleep(2)

        logger.info("SharedPriceCache: poll loop stopped")


# Global singleton
price_cache = SharedPriceCache()


class WSClientState:
    def __init__(self, websocket: WebSocket, instrument_keys: Optional[Set[str]] = None):
        self.websocket = websocket
        self.instrument_keys: Set[str] = instrument_keys or set()
        self.client_id: str = str(uuid.uuid4())


@api_router.websocket("/ws/quotes")
async def quotes_websocket(ws: WebSocket):
    await ws.accept()
    client_state: Optional[WSClientState] = None
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            typ = msg.get("type")
            if typ == "init":
                keys = set(k for k in (msg.get("instrument_keys") or []) if _validate_instrument_key(k))
                client_state = WSClientState(ws, keys)
                await price_cache.register_client(client_state.client_id, client_state)
                await ws.send_text(json.dumps({"type": "init_success", "subscribed": len(keys)}))
            elif typ == "subscribe" and client_state:
                new_keys = [k for k in (msg.get("instrument_keys") or []) if _validate_instrument_key(k)]
                client_state.instrument_keys.update(new_keys)
                await price_cache.update_subscriptions()
                await ws.send_text(json.dumps({"type": "subscribed", "keys": new_keys}))
            elif typ == "unsubscribe" and client_state:
                rem_keys = [k for k in (msg.get("instrument_keys") or []) if _validate_instrument_key(k)]
                for k in rem_keys:
                    client_state.instrument_keys.discard(k)
                await price_cache.update_subscriptions()
            elif typ == "ping":
                await ws.send_text(json.dumps({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()}))
            else:
                await ws.send_text(json.dumps({"type": "error", "message": "Unknown message type"}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass
    finally:
        if client_state:
            await price_cache.unregister_client(client_state.client_id)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===== Token Refresh Scheduler =====
scheduler = AsyncIOScheduler()

class TokenRefreshStatus(BaseModel):
    last_refresh: Optional[str] = None
    next_refresh: Optional[str] = None
    status: str = "pending"
    error_message: Optional[str] = None

async def refresh_upstox_token():
    """
    Daily job at 9:00 AM IST:
    1. If auto-login credentials are configured → headless login, save fresh token.
    2. Otherwise → validate existing token and flag if expired.
    """
    now = datetime.now(timezone.utc).isoformat()
    try:
        mobile = os.environ.get("UPSTOX_MOBILE", "")
        pin    = os.environ.get("UPSTOX_PIN", "")
        totp   = os.environ.get("UPSTOX_TOTP_SECRET", "")
        auto_login_ready = bool(
            mobile and not mobile.startswith("your_") and
            pin and not pin.startswith("your_") and
            totp
        )

        if auto_login_ready:
            # ── Auto-login path ────────────────────────────────────────────
            logger.info("Scheduler: running headless auto-login...")
            try:
                access_token = await upstox_headless_login()
                await TokenStore.set_token(access_token)
                logger.info("Scheduler: auto-login succeeded, token saved ✓")
                await db.config.update_one(
                    {"id": "token_refresh_status"},
                    {"$set": {
                        "id": "token_refresh_status",
                        "last_refresh": now,
                        "status": "auto_login_success",
                        "error_message": None,
                        "needs_refresh": False,
                    }},
                    upsert=True,
                )
            except Exception as login_err:
                logger.error(f"Scheduler: auto-login failed: {login_err}")
                await db.config.update_one(
                    {"id": "token_refresh_status"},
                    {"$set": {
                        "id": "token_refresh_status",
                        "last_refresh": now,
                        "status": "auto_login_failed",
                        "error_message": str(login_err),
                        "needs_refresh": True,
                    }},
                    upsert=True,
                )
            return

        # ── Manual-token validation path ───────────────────────────────────
        logger.info("Scheduler: auto-login not configured, checking existing token...")
        current_token = TokenStore.get_token()

        if not current_token:
            logger.warning("No token found - fill UPSTOX_MOBILE and UPSTOX_PIN in .env for auto-login")
            await db.config.update_one(
                {"id": "token_refresh_status"},
                {"$set": {
                    "id": "token_refresh_status",
                    "last_refresh": now,
                    "status": "token_missing",
                    "error_message": "No token available. Fill UPSTOX_MOBILE & UPSTOX_PIN in .env to enable auto-login.",
                    "needs_refresh": True,
                }},
                upsert=True,
            )
            return

        try:
            async with httpx.AsyncClient(timeout=10.0) as session:
                resp = await session.get(
                    f"{UPSTOX_BASE_URL}/user/profile",
                    headers={"Authorization": f"Bearer {current_token}"}
                )
                if resp.status_code == 200:
                    logger.info("✓ Token is still valid")
                    await db.config.update_one(
                        {"id": "token_refresh_status"},
                        {"$set": {
                            "id": "token_refresh_status",
                            "last_refresh": now,
                            "status": "valid",
                            "error_message": None,
                            "needs_refresh": False,
                        }},
                        upsert=True,
                    )
                    return
                if resp.status_code in [401, 403]:
                    logger.warning("⚠ Token expired - fill UPSTOX_MOBILE & UPSTOX_PIN in .env for auto-login")
                    await db.config.update_one(
                        {"id": "token_refresh_status"},
                        {"$set": {
                            "id": "token_refresh_status",
                            "last_refresh": now,
                            "status": "expired",
                            "error_message": "Token expired. Fill UPSTOX_MOBILE & UPSTOX_PIN in .env to enable auto-login.",
                            "needs_refresh": True,
                        }},
                        upsert=True,
                    )
                    return
                raise ValueError(f"Unexpected status: {resp.status_code}")
        except Exception as check_error:
            logger.error(f"Token check failed: {check_error}")
            await db.config.update_one(
                {"id": "token_refresh_status"},
                {"$set": {
                    "id": "token_refresh_status",
                    "last_refresh": now,
                    "status": "check_failed",
                    "error_message": str(check_error),
                }},
                upsert=True,
            )

    except Exception as e:
        logger.error(f"Daily token job failed: {e}")
        await db.config.update_one(
            {"id": "token_refresh_status"},
            {"$set": {
                "id": "token_refresh_status",
                "status": "failed",
                "error_message": str(e),
                "last_attempt": now,
            }},
            upsert=True,
        )

@app.on_event("startup")
async def on_startup():
    await TokenStore.load_from_db()

    # Start token refresh scheduler (9:00 AM IST = 3:30 AM UTC)
    scheduler.add_job(
        refresh_upstox_token,
        CronTrigger(hour=3, minute=30, timezone="UTC"),  # 9:00 AM IST
        id="upstox_token_refresh",
        name="Upstox Token Refresh",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Token refresh scheduler started - will run daily at 9:00 AM IST")

@app.on_event("shutdown")
async def shutdown_db_client():
    if scheduler.running:
        scheduler.shutdown()
    client.close()