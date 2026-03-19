import requests
import sys
import json
import websocket
import threading
import time
from datetime import datetime

class StoxAllocatorAPITester:
    def __init__(self, base_url="https://stocksmart-13.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.admin_key = "b9e2d6a4-9b8d-4d48-9e9c-8a6d3cfae123"  # From backend/.env
        self.access_token = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIzSEJMNDciLCJqdGkiOiI2OGI1NGM3MmJkNTNmMTBmYTFkN2FkMGMiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaWF0IjoxNzU2NzEyMDUwLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3NTY3NjQwMDB9.CLbCQ_5hx0_zzcRvThwouXko_zNLc0qTHyOh_ieDxng"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_bucket_id = None
        self.test_bucket_edit_key = None
        self.ws_messages = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_base}/{endpoint}" if not endpoint.startswith('http') else endpoint
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, params=params, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, params=params, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, params=params, timeout=30)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
                    return True, response_data
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        if success and isinstance(response, dict):
            if response.get('message'):
                print(f"   ✓ Root message: {response.get('message')}")
                return True
        return False

    def test_health_endpoint(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        if success and isinstance(response, dict):
            if response.get('status') == 'ok':
                print("   ✓ Health status is 'ok'")
                has_token = response.get('has_server_token', False)
                print(f"   ✓ Server token configured: {has_token}")
                return True
            else:
                print(f"   ✗ Health status is '{response.get('status')}', expected 'ok'")
        return False

    def test_admin_token_status(self):
        """Test admin token status endpoint"""
        headers = {"x-admin-key": self.admin_key}
        success, response = self.run_test(
            "Admin Token Status",
            "GET",
            "admin/token/status",
            200,
            headers=headers
        )
        if success and isinstance(response, dict):
            data = response.get('data', {})
            configured = data.get('configured', False)
            valid = data.get('valid', False)
            print(f"   ✓ Token configured: {configured}")
            print(f"   ✓ Token valid: {valid}")
            return configured and valid
        return False

    def test_admin_set_token(self):
        """Test admin set token endpoint"""
        headers = {"x-admin-key": self.admin_key}
        success, response = self.run_test(
            "Admin Set Token",
            "POST",
            "admin/upstox-token",
            200,
            data={"access_token": self.access_token},
            headers=headers
        )
        if success and isinstance(response, dict):
            if response.get('status') == 'success':
                print("   ✓ Token set successfully")
                return True
        return False

    def test_instruments_search(self):
        """Test instruments search endpoint"""
        success, response = self.run_test(
            "Instruments Search (RELIANCE)",
            "GET",
            "instruments/search",
            200,
            params={"query": "RELIANCE", "exchange": "NSE", "limit": 5}
        )
        if success and isinstance(response, dict):
            count = response.get('count', 0)
            data = response.get('data', [])
            print(f"   Found {count} instruments")
            
            if count > 0 and len(data) > 0:
                first_instrument = data[0]
                if 'instrument_key' in first_instrument:
                    print(f"   ✓ First instrument key: {first_instrument['instrument_key']}")
                    return True, first_instrument['instrument_key']
                else:
                    print("   ✗ No instrument_key in response")
            else:
                print("   ✗ No instruments found")
        return False, None

    def test_quotes_ltp(self, instrument_key=None):
        """Test LTP quotes endpoint"""
        # Use a known instrument key if not provided
        test_key = instrument_key or "NSE_EQ|INE002A01018"  # Reliance
        
        success, response = self.run_test(
            "LTP Quotes",
            "POST",
            "quotes/ltp",
            200,
            data={"instrument_keys": [test_key]}
        )
        
        if success and isinstance(response, dict):
            status = response.get('status')
            data = response.get('data', {})
            
            print(f"   Response status: {status}")
            print(f"   Data keys: {list(data.keys())}")
            
            if status == 'success' and data:
                # Check if we have any quote data
                for key, quote_data in data.items():
                    last_price = quote_data.get('last_price')
                    if last_price and isinstance(last_price, (int, float)):
                        print(f"   ✓ LTP for {key}: ₹{last_price}")
                        return True
                print("   ✗ No valid last_price found in response")
            else:
                print(f"   ✗ Invalid response status or empty data")
        return False

    def test_create_bucket(self):
        """Test bucket creation"""
        bucket_data = {
            "name": "Test Portfolio",
            "type": "portfolio",
            "progress_mode": "baseline",
            "items": [
                {
                    "instrument_key": "NSE_EQ|INE002A01018",
                    "tradingsymbol": "RELIANCE",
                    "name": "Reliance Industries Ltd",
                    "qty": 10
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Bucket",
            "POST",
            "buckets",
            200,
            data=bucket_data
        )
        
        if success and isinstance(response, dict):
            if response.get('status') == 'success':
                data = response.get('data', {})
                bucket_id = data.get('id')
                edit_key = data.get('edit_key')
                if bucket_id and edit_key:
                    self.test_bucket_id = bucket_id
                    self.test_bucket_edit_key = edit_key
                    print(f"   ✓ Bucket created with ID: {bucket_id}")
                    return True
        return False

    def test_get_bucket(self):
        """Test get bucket"""
        if not self.test_bucket_id:
            print("   ✗ No bucket ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Bucket",
            "GET",
            f"buckets/{self.test_bucket_id}",
            200
        )
        
        if success and isinstance(response, dict):
            if response.get('status') == 'success':
                data = response.get('data', {})
                if data.get('id') == self.test_bucket_id:
                    print(f"   ✓ Retrieved bucket: {data.get('name')}")
                    return True
        return False

    def test_set_baseline(self):
        """Test set baseline for bucket"""
        if not self.test_bucket_id or not self.test_bucket_edit_key:
            print("   ✗ No bucket ID or edit key available for testing")
            return False
            
        headers = {"x-edit-key": self.test_bucket_edit_key}
        success, response = self.run_test(
            "Set Baseline",
            "POST",
            f"buckets/{self.test_bucket_id}/baseline",
            200,
            headers=headers,
            params={"label": "Test Baseline"}
        )
        
        if success and isinstance(response, dict):
            if response.get('status') == 'success':
                print("   ✓ Baseline set successfully")
                return True
        return False

    def test_bucket_metrics(self):
        """Test bucket metrics"""
        if not self.test_bucket_id:
            print("   ✗ No bucket ID available for testing")
            return False
            
        success, response = self.run_test(
            "Bucket Metrics",
            "GET",
            f"buckets/{self.test_bucket_id}/metrics",
            200
        )
        
        if success and isinstance(response, dict):
            if response.get('status') == 'success':
                data = response.get('data', {})
                items = data.get('items', [])
                summary = data.get('summary', {})
                print(f"   ✓ Metrics retrieved - {len(items)} items, total value: ₹{summary.get('total_value', 0)}")
                return True
        return False

    def test_websocket_connection(self):
        """Test WebSocket connection"""
        ws_url = f"wss://stocksmart-13.preview.emergentagent.com/api/ws/quotes"
        
        def on_message(ws, message):
            try:
                data = json.loads(message)
                self.ws_messages.append(data)
                print(f"   📨 WS Message: {data.get('type', 'unknown')}")
            except:
                pass

        def on_error(ws, error):
            print(f"   ❌ WS Error: {error}")

        def on_close(ws, close_status_code, close_msg):
            print("   🔌 WS Connection closed")

        def on_open(ws):
            print("   🔗 WS Connection opened")
            # Send init message
            init_msg = {
                "type": "init",
                "instrument_keys": ["NSE_EQ|INE002A01018"]
            }
            ws.send(json.dumps(init_msg))
            
            # Send ping after a short delay
            def send_ping():
                time.sleep(2)
                ping_msg = {"type": "ping"}
                ws.send(json.dumps(ping_msg))
                time.sleep(3)
                ws.close()
            
            threading.Thread(target=send_ping).start()

        try:
            print(f"\n🔍 Testing WebSocket Connection...")
            print(f"   URL: {ws_url}")
            
            self.tests_run += 1
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Run WebSocket in a separate thread with timeout
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            ws_thread.join(timeout=10)
            
            if len(self.ws_messages) > 0:
                self.tests_passed += 1
                print("✅ Passed - WebSocket communication successful")
                return True
            else:
                print("❌ Failed - No WebSocket messages received")
                return False
                
        except Exception as e:
            print(f"❌ Failed - WebSocket error: {str(e)}")
            return False

    def cleanup_test_bucket(self):
        """Clean up test bucket"""
        if self.test_bucket_id and self.test_bucket_edit_key:
            headers = {"x-edit-key": self.test_bucket_edit_key}
            try:
                response = requests.delete(
                    f"{self.api_base}/buckets/{self.test_bucket_id}",
                    headers=headers,
                    timeout=10
                )
                if response.status_code == 200:
                    print("   🧹 Test bucket cleaned up")
            except:
                pass

def main():
    print("🚀 Starting StoxAllocator Backend API Tests")
    print("=" * 60)
    
    tester = StoxAllocatorAPITester()
    
    # Core API Health Tests
    print("\n📋 CORE API HEALTH TESTS")
    print("-" * 30)
    root_ok = tester.test_root_endpoint()
    health_ok = tester.test_health_endpoint()
    
    # Token Management Tests
    print("\n🔐 TOKEN MANAGEMENT TESTS")
    print("-" * 30)
    token_set_ok = tester.test_admin_set_token()
    token_status_ok = tester.test_admin_token_status()
    
    # Upstox Integration Tests
    print("\n📈 UPSTOX INTEGRATION TESTS")
    print("-" * 30)
    search_ok, instrument_key = tester.test_instruments_search()
    ltp_ok = tester.test_quotes_ltp(instrument_key)
    
    # Buckets Feature Tests
    print("\n🪣 BUCKETS FEATURE TESTS")
    print("-" * 30)
    create_bucket_ok = tester.test_create_bucket()
    get_bucket_ok = tester.test_get_bucket()
    baseline_ok = tester.test_set_baseline()
    metrics_ok = tester.test_bucket_metrics()
    
    # WebSocket Tests
    print("\n🔌 WEBSOCKET TESTS")
    print("-" * 30)
    ws_ok = tester.test_websocket_connection()
    
    # Cleanup
    tester.cleanup_test_bucket()
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    # Detailed results
    print("\n📋 Test Summary:")
    print(f"   Core API Health: {'✅' if root_ok and health_ok else '❌'}")
    print(f"   Token Management: {'✅' if token_set_ok and token_status_ok else '❌'}")
    print(f"   Upstox Integration: {'✅' if search_ok and ltp_ok else '❌'}")
    print(f"   Buckets Feature: {'✅' if create_bucket_ok and get_bucket_ok and baseline_ok and metrics_ok else '❌'}")
    print(f"   WebSocket: {'✅' if ws_ok else '❌'}")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 All backend tests passed!")
        return 0
    else:
        print(f"\n❌ {tester.tests_run - tester.tests_passed} backend tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())