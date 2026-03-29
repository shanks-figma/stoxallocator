import React, { useEffect, useMemo, useState, useRef } from "react";
import "./App.css";
import axios from "axios";
import { BrowserRouter, Routes, Route, Link, useParams, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { Trash2, Plus, Minus, IndianRupee, RefreshCw, Shield, CheckCircle, XCircle, AlertCircle, TrendingUp, Wallet, BarChart2, ChevronRight, ChevronUp, ChevronDown, Sun, Moon, Zap, GripVertical } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

function formatINR(num) { if (num === null || num === undefined || isNaN(num)) return "-"; return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(num); }

function computeAdditionalCost(amount, exchange = "NSE", state = "CHANDIGARH") { if (!amount || amount <= 0) return 0; const STT_RATE = 0.001; const EXCHANGE_RATE_NSE = 0.0000297; const EXCHANGE_RATE_BSE = 0.0000275; const STAMP_RATE_DELIVERY = 0.00015; const SEBI_RATE = 10 / 10000000; const BROKERAGE = 0; const DELIVERY_FEE = 10; const stt = amount * STT_RATE; const exch = amount * (exchange === "BSE" ? EXCHANGE_RATE_BSE : EXCHANGE_RATE_NSE); const stamp = amount * STAMP_RATE_DELIVERY; const sebi = amount * SEBI_RATE; const gst = 0.18 * (BROKERAGE + exch + sebi); return BROKERAGE + stt + exch + stamp + sebi + gst + DELIVERY_FEE; }

function chargesBreakdown(amount, exchange = "NSE") { if (!amount || amount <= 0) return { stt: 0, exchange: 0, stamp: 0, sebi: 0, gst: 0, delivery: 10, total: 10 }; const STT_RATE = 0.001; const EXCHANGE_RATE_NSE = 0.0000297; const EXCHANGE_RATE_BSE = 0.0000275; const STAMP_RATE_DELIVERY = 0.00015; const SEBI_RATE = 10 / 10000000; const BROKERAGE = 0; const DELIVERY_FEE = 10; const stt = amount * STT_RATE; const exch = amount * (exchange === "BSE" ? EXCHANGE_RATE_BSE : EXCHANGE_RATE_NSE); const stamp = amount * STAMP_RATE_DELIVERY; const sebi = amount * SEBI_RATE; const gst = 0.18 * (BROKERAGE + exch + sebi); return { stt, exchange: exch, stamp, sebi, gst, delivery: DELIVERY_FEE, total: BROKERAGE + stt + exch + stamp + sebi + gst + DELIVERY_FEE }; }

function useLocalStorageState(key, initialValue) { const [state, setState] = useState(() => { try { const item = window.localStorage.getItem(key); return item ? JSON.parse(item) : initialValue; } catch { return initialValue; } }); useEffect(() => { try { window.localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]); return [state, setState]; }

function Navbar() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const isActive = (path) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">Stox<span className="text-emerald-500 dark:text-emerald-400">Allocator</span></span>
        </Link>

        {/* Nav links + theme toggle */}
        <nav className="flex items-center gap-1">
          <Link to="/">
            <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/") ? "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/50"}`}>
              <Wallet className="h-4 w-4" /> Allocator
            </button>
          </Link>
          <Link to="/order">
            <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/order") ? "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/50"}`}>
              <ChevronRight className="h-4 w-4" /> Order (Exp)
            </button>
          </Link>
          <Link to="/buckets">
            <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/buckets") ? "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/50"}`}>
              <BarChart2 className="h-4 w-4" /> Buckets
            </button>
          </Link>
          <Link to="/admin">
            <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/admin") ? "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/50"}`}>
              <Shield className="h-4 w-4" /> Admin
            </button>
          </Link>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-2 p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </nav>
      </div>
    </header>
  );
}

function AllocatorPage() {
  const [budget, setBudget] = useLocalStorageState("stox_budget", 100000);
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [portfolio, setPortfolio] = useLocalStorageState("stox_portfolio", []);
  const [prices, setPrices] = useState({});
  const [polling, setPolling] = useState(false);
  const api = useMemo(() => axios.create({ baseURL: API_BASE }), []);

  useEffect(() => { let active = true; const fetchResults = async () => { if (!query || query.length < 2) { setResults([]); return; } setSearching(true); try { const { data } = await api.get("/instruments/search", { params: { query, exchange, instrument_type: "EQ", limit: 10 } }); if (active) setResults(data.data || []); } catch (e) { console.error(e); } finally { setSearching(false); } }; const t = setTimeout(fetchResults, 300); return () => { active = false; clearTimeout(t); }; }, [query, exchange, api]);

  useEffect(() => { let timerId; const poll = async () => { try { const keys = portfolio.map(p => p.instrument_key); if (keys.length === 0) return; const { data } = await api.post("/quotes/ltp", { instrument_keys: keys }); setPrices(data.data || {}); } catch (e) { console.error("LTP poll error", e?.response?.data || e.message); } }; poll(); timerId = setInterval(poll, 30000); setPolling(true); return () => { clearInterval(timerId); setPolling(false); }; }, [portfolio, api]);

  const portfolioWithLTP = useMemo(() => {
    const n = portfolio.length;
    const totalWeight = n * (n + 1) / 2;
    return portfolio.map((item, index) => {
      const quote = prices[item.instrument_key];
      const ltp = quote?.last_price ?? item.last_price ?? null;
      const qty = Number(item.qty) || 0;
      const total = ltp ? ltp * qty : 0;
      const additional = total ? computeAdditionalCost(total, exchange) : 0;
      const finalCost = total + additional;
      const weight = n - index;
      const allocatedBudget = totalWeight > 0 ? (weight / totalWeight) * (Number(budget) || 0) : 0;
      return { ...item, ltp, total, additional, finalCost, allocatedBudget };
    });
  }, [portfolio, prices, exchange, budget]);

  const portfolioValue = useMemo(() => portfolioWithLTP.reduce((s, i) => s + (i.total || 0), 0), [portfolioWithLTP]);
  const finalCostTotal = useMemo(() => portfolioWithLTP.reduce((s, i) => s + (i.finalCost || 0), 0), [portfolioWithLTP]);
  const remaining = useMemo(() => (Number(budget) || 0) - finalCostTotal, [budget, finalCostTotal]);
  const progressPct = budget > 0 ? Math.min((finalCostTotal / budget) * 100, 100) : 0;

  const addToPortfolio = (inst) => { const exists = portfolio.find(p => p.instrument_key === inst.instrument_key); if (exists) return; setPortfolio(prev => [...prev, { instrument_key: inst.instrument_key, tradingsymbol: inst.tradingsymbol, name: inst.name, qty: 1, last_price: inst.last_price || null }]); setQuery(""); setResults([]); };
  const removeFromPortfolio = (instrument_key) => { setPortfolio(prev => prev.filter(p => p.instrument_key !== instrument_key)); };
  const updateQty = (instrument_key, qty) => { setPortfolio(prev => prev.map(p => p.instrument_key === instrument_key ? { ...p, qty: Math.max(0, Number(qty) || 0) } : p)); };
  const moveUp = (index) => { if (index === 0) return; setPortfolio(prev => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }); };
  const moveDown = (index) => { setPortfolio(prev => { if (index === prev.length - 1) return prev; const next = [...prev]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; }); };
  const autoAllocate = () => {
    const eligible = portfolioWithLTP.filter(item => item.ltp > 0);
    if (eligible.length === 0) return;
    const n = eligible.length;
    const totalWeight = n * (n + 1) / 2;
    const totalBudget = Number(budget) || 0;

    // Step 1: initial weighted allocation using Math.floor
    const qtys = {};
    let eligibleIndex = 0;
    for (const item of eligible) {
      const weight = n - eligibleIndex;
      eligibleIndex++;
      const allocatedBudget = (weight / totalWeight) * totalBudget;
      qtys[item.instrument_key] = Math.max(0, Math.floor(allocatedBudget / item.ltp));
    }

    // Step 2: greedily fill remaining with the cheapest stock (incl. charges) until nothing fits
    const computeSpent = () => eligible.reduce((s, item) => {
      const qty = qtys[item.instrument_key];
      const total = qty * item.ltp;
      return s + total + computeAdditionalCost(total, exchange);
    }, 0);

    let remaining = totalBudget - computeSpent();
    const sortedByPrice = [...eligible].sort((a, b) => a.ltp - b.ltp);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of sortedByPrice) {
        const curQty = qtys[item.instrument_key];
        const oldTotal = curQty * item.ltp;
        const newTotal = (curQty + 1) * item.ltp;
        const marginalCost = item.ltp
          + computeAdditionalCost(newTotal, exchange)
          - computeAdditionalCost(oldTotal, exchange);
        if (marginalCost <= remaining) {
          qtys[item.instrument_key] += 1;
          remaining -= marginalCost;
          changed = true;
          break;
        }
      }
    }

    setPortfolio(prev => prev.map(item => {
      if (qtys[item.instrument_key] !== undefined) {
        return { ...item, qty: qtys[item.instrument_key] };
      }
      return item;
    }));
  };
  const refreshOnce = async () => { try { const keys = portfolio.map(p => p.instrument_key); if (keys.length === 0) return; const { data } = await api.post("/quotes/ltp", { instrument_keys: keys }); setPrices(data.data || {}); } catch (e) { console.error("Manual refresh error", e?.response?.data || e.message); } };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pt-16">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Allocation Calculator</h1>
          <p className="text-gray-500 dark:text-gray-500 dark:text-slate-400 text-sm mt-1">Build your portfolio and estimate total investment cost</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left — Search + Table */}
          <div className="flex-1 lg:w-3/5 space-y-4">

            {/* Search card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or symbol — RELIANCE, TCS, Infosys…"
                    className="w-full h-11 pl-10 pr-4 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                  className="h-11 w-28 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>

              {/* Search results dropdown */}
              {searching && (
                <div className="mt-3 text-sm text-slate-500">Searching…</div>
              )}
              {results.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.map((r) => (
                    <div
                      key={r.instrument_key}
                      onClick={() => addToPortfolio(r)}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 hover:border-emerald-500/40 rounded-lg cursor-pointer transition-all group"
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{r.tradingsymbol || r.name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[160px]">{r.name}</div>
                      </div>
                      <div className="h-7 w-7 rounded-full bg-slate-700 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                        <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Portfolio table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Stock Portfolio</h2>
                  {portfolio.length > 0 && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">{portfolio.length} stocks</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={autoAllocate}
                    disabled={portfolio.length === 0}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
                    title="Auto-distribute budget by priority"
                  >
                    <Zap className="h-3.5 w-3.5" /> Auto-Allocate
                  </button>
                  <button
                    onClick={() => { if (window.confirm("Clear all stocks from portfolio?")) setPortfolio([]); }}
                    disabled={portfolio.length === 0}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Reset portfolio"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Reset
                  </button>
                </div>
              </div>

              {portfolio.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="h-6 w-6 text-slate-600" />
                  </div>
                  <div className="text-gray-500 dark:text-slate-400 text-sm font-medium">No stocks added yet</div>
                  <div className="text-slate-600 text-xs mt-1">Search above to add stocks to your portfolio</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50">
                        <th className="text-left text-xs text-gray-400 dark:text-slate-500 font-medium px-5 py-3">Stock</th>
                        <th className="w-10 px-3 py-3"></th>
                        <th className="text-center text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Qty</th>
                        <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">LTP</th>
                        <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Value</th>
                        <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="cursor-help underline decoration-dotted">Charges</TooltipTrigger>
                              <TooltipContent className="bg-slate-800 border-slate-700 text-slate-200 text-xs max-w-xs">
                                STT, exchange, stamp (Chandigarh UT), SEBI, GST + ₹20 delivery fee
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </th>
                        <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-5 py-3">Total</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800/60">
                      {portfolioWithLTP.map((row, index) => (
                        <tr key={row.instrument_key} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-gray-900 dark:text-white">{row.tradingsymbol || row.name}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[160px]">{row.name}</div>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-0.5 group">
                              <button
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                className="h-5 w-5 flex items-center justify-center rounded text-gray-300 dark:text-slate-600 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-0 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <GripVertical className="h-4 w-4 text-gray-300 dark:text-slate-600 group-hover:text-gray-400 dark:group-hover:text-slate-500 transition-colors" />
                              <button
                                onClick={() => moveDown(index)}
                                disabled={index === portfolio.length - 1}
                                className="h-5 w-5 flex items-center justify-center rounded text-gray-300 dark:text-slate-600 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-0 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <div className="inline-flex items-center border border-gray-200 dark:border-slate-700 rounded-md overflow-hidden">
                              <button
                                onClick={() => updateQty(row.instrument_key, Math.max(0, Number(row.qty) - 1))}
                                className="h-8 w-7 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors text-base font-medium"
                              >−</button>
                              <input
                                type="number"
                                min="0"
                                value={row.qty}
                                onChange={(e) => updateQty(row.instrument_key, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "ArrowUp") { e.preventDefault(); updateQty(row.instrument_key, Number(row.qty) + 1); }
                                  if (e.key === "ArrowDown") { e.preventDefault(); updateQty(row.instrument_key, Math.max(0, Number(row.qty) - 1)); }
                                }}
                                className="h-8 w-14 text-center text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-inset focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                onClick={() => updateQty(row.instrument_key, Number(row.qty) + 1)}
                                className="h-8 w-7 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors text-base font-medium"
                              >+</button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right text-gray-700 dark:text-slate-300 font-mono text-xs">
                            {row.ltp ? formatINR(row.ltp) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-right text-gray-700 dark:text-slate-300 font-mono text-xs">
                            {formatINR(row.total || 0)}
                          </td>
                          <td className="px-3 py-3.5 text-right text-gray-700 dark:text-slate-300 font-mono text-xs">
                            {formatINR(row.additional || 0)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-emerald-400 font-mono text-xs">
                            {formatINR(row.finalCost || 0)}
                          </td>
                          <td className="px-3 py-3.5">
                            <button
                              onClick={() => removeFromPortfolio(row.instrument_key)}
                              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right — Summary panel */}
          <div className="lg:w-2/5">
            <div className="sticky top-24 space-y-4">

              {/* Budget input */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Total Budget</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="text-slate-400 text-lg font-medium">₹</span>
                  </div>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    placeholder="Enter budget"
                    className="w-full h-14 pl-9 pr-4 bg-slate-800 border border-slate-700 rounded-lg text-2xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="text-center mt-3">
                  <div className="text-3xl font-bold text-white">{formatINR(Number(budget) || 0)}</div>
                  <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Available for investment</div>
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-200 dark:divide-slate-800">
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-sm text-slate-400">Allocated</span>
                  <span className="font-semibold text-gray-900 dark:text-white font-mono">{formatINR(Number(budget) || 0)}</span>
                </div>
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-sm text-slate-400">Invested (incl. charges)</span>
                  <span className="font-semibold text-gray-900 dark:text-white font-mono">{formatINR(finalCostTotal)}</span>
                </div>
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-sm text-slate-400">Remaining</span>
                  <span className={`font-bold text-lg font-mono ${remaining < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {formatINR(remaining)}
                  </span>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Investment Progress</span>
                  <span className={`text-sm font-bold ${progressPct >= 100 ? "text-red-400" : "text-emerald-400"}`}>{Math.round(progressPct)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${remaining < 0 ? "bg-red-500" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {portfolio.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-100 dark:bg-gray-100 dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-white">{portfolio.length}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Stocks</div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-100 dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-white">{formatINR(portfolio.length > 0 ? finalCostTotal / portfolio.length : 0).replace("₹", "₹")}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Avg per stock</div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminPage() {
  const [adminKey, setAdminKey] = useLocalStorageState("admin_key", "");
  const [newToken, setNewToken] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [tokenHistory, setTokenHistory] = useState([]);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const api = useMemo(() => axios.create({ baseURL: API_BASE }), []);

  const checkStatus = async () => { if (!adminKey) { setStatus({ error: "Admin key required" }); return; } setLoading(true); try { const { data } = await api.get("/admin/token/status", { headers: { "x-admin-key": adminKey } }); setStatus(data.data); } catch (e) { setStatus({ error: e?.response?.data?.detail || e.message, status_code: e?.response?.status }); } finally { setLoading(false); } };
  const fetchSchedulerStatus = async () => { if (!adminKey) return; try { const { data } = await api.get("/admin/scheduler/status", { headers: { "x-admin-key": adminKey } }); setSchedulerStatus(data.data); } catch (e) { console.error("Failed to fetch scheduler status:", e); } };
  const saveToken = async () => { if (!adminKey) { setSaveStatus({ type: "error", message: "Admin key required" }); return; } if (!newToken || newToken.length < 20) { setSaveStatus({ type: "error", message: "Valid access token required" }); return; } setLoading(true); setSaveStatus(null); try { await api.post("/admin/upstox-token", { access_token: newToken }, { headers: { "x-admin-key": adminKey } }); setSaveStatus({ type: "success", message: "Token updated successfully!" }); const historyEntry = { timestamp: new Date().toLocaleString(), token_preview: `${newToken.substring(0, 20)}...`, action: "Token Updated" }; setTokenHistory(prev => [historyEntry, ...prev.slice(0, 4)]); setNewToken(""); await checkStatus(); } catch (e) { setSaveStatus({ type: "error", message: e?.response?.data?.detail || e.message }); } finally { setLoading(false); } };
  const testConnection = async () => { setLoading(true); try { const { data } = await api.get("/health"); setSaveStatus({ type: "success", message: `Backend connected — Token: ${data.has_server_token ? "Configured" : "Not configured"}` }); } catch (e) { setSaveStatus({ type: "error", message: "Backend connection failed" }); } finally { setLoading(false); } };
  useEffect(() => { if (adminKey) { checkStatus(); fetchSchedulerStatus(); } }, [adminKey]);

  const StatusIndicator = ({ status }) => {
    if (!status) return <AlertCircle className="h-5 w-5 text-slate-500" />;
    if (status.error) return <XCircle className="h-5 w-5 text-red-400" />;
    if (status.configured && status.valid) return <CheckCircle className="h-5 w-5 text-emerald-400" />;
    if (status.configured && !status.valid) return <XCircle className="h-5 w-5 text-red-400" />;
    return <AlertCircle className="h-5 w-5 text-amber-400" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pt-16">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield className="h-6 w-6 text-emerald-400" /> Admin Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-500 dark:text-slate-400 text-sm mt-1">Manage Upstox API tokens and system configuration</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><StatusIndicator status={status} /> System Status</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-3"><div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Backend</div><div className="text-sm font-semibold text-emerald-400">Connected</div></div>
              <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-3"><div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Token</div><div className={`text-sm font-semibold ${status?.configured && status?.valid ? "text-emerald-400" : status?.configured ? "text-red-400" : "text-slate-500"}`}>{status?.configured ? (status?.valid ? "Valid" : "Expired") : "Not set"}</div></div>
              <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-3"><div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Last Check</div><div className="text-sm font-semibold text-slate-300">{status ? new Date().toLocaleTimeString() : "Never"}</div></div>
            </div>
            {status?.error && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{status.error}</div>}
          </div>

          {schedulerStatus && (
            <div className={`rounded-xl border p-5 ${schedulerStatus.needs_refresh ? "bg-gradient-to-r from-red-900/30 to-orange-900/30 border-red-500/20" : "bg-gradient-to-r from-teal-900/30 to-cyan-900/30 border-teal-500/20"}`}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {schedulerStatus.needs_refresh ? "⚠ Token Refresh Needed" : "Automatic Token Refresh"}
              </h2>
              {schedulerStatus.needs_refresh && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
                  <p className="text-sm text-red-300 font-semibold mb-2">Your Upstox token has expired (auto-checked at 9:00 AM IST)</p>
                  <p className="text-xs text-red-200 mb-3">Click the "Login with Upstox" button below to refresh in seconds</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Scheduler Status</div><div className={`text-sm font-semibold ${schedulerStatus.scheduler_running ? "text-emerald-400" : "text-amber-400"}`}>{schedulerStatus.scheduler_running ? "Running" : "Stopped"}</div></div>
                <div><div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Last Refresh</div><div className="text-sm font-semibold text-slate-300">{schedulerStatus.last_refresh ? new Date(schedulerStatus.last_refresh).toLocaleString() : "Never"}</div></div>
                <div><div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Next Refresh</div><div className="text-sm font-semibold" style={{color: schedulerStatus.needs_refresh ? "#f87171" : "#14b8a6"}}>{schedulerStatus.next_refresh ? new Date(schedulerStatus.next_refresh).toLocaleString() : "Not scheduled"}</div></div>
                <div><div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Status</div><div className={`text-sm font-semibold ${schedulerStatus.refresh_status === "valid" ? "text-emerald-400" : schedulerStatus.refresh_status === "expired" || schedulerStatus.refresh_status === "token_missing" ? "text-red-400" : schedulerStatus.refresh_status === "failed" ? "text-red-400" : "text-slate-400"}`}>{schedulerStatus.refresh_status}</div></div>
              </div>
              {schedulerStatus.error_message && <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">{schedulerStatus.error_message}</div>}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Admin Authentication</h2>
            <label className="block text-xs text-slate-400 mb-2">Admin Key</label>
            <input type="password" placeholder="Enter admin key from backend/.env" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} className="w-full h-10 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3" />
            <div className="flex gap-2">
              <button onClick={checkStatus} disabled={loading || !adminKey} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white rounded-lg disabled:opacity-40 transition-colors">{loading ? "Checking…" : "Check Status"}</button>
              <button onClick={testConnection} disabled={loading} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white rounded-lg disabled:opacity-40 transition-colors">Test Connection</button>
            </div>
          </div>

          {/* OAuth Login — One-click token refresh */}
          <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl border border-emerald-500/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Quick Login (Recommended)
                </h2>
                <p className="text-xs text-slate-400 mt-1">One-click Upstox OAuth — no copy-pasting needed</p>
              </div>
              <a
                href={`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                Login with Upstox
              </a>
            </div>
            {new URLSearchParams(window.location.search).get("auth_success") === "true" && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
                Token updated automatically via OAuth! You're all set.
              </div>
            )}
            {new URLSearchParams(window.location.search).get("auth_error") && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                OAuth failed: {new URLSearchParams(window.location.search).get("auth_error")}. Try manual method below or check your API secret in .env.
              </div>
            )}
          </div>

          {/* Manual Token — Fallback */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Manual Token (Fallback)</h2>
            <p className="text-xs text-slate-500 mb-4">Use this only if OAuth login above doesn't work</p>
            <label className="block text-xs text-slate-400 mb-2">Access Token</label>
            <textarea placeholder="Paste your Upstox access token here…" value={newToken} onChange={(e) => setNewToken(e.target.value)} className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-1" />
            <p className="text-xs text-slate-500 mb-3">Tokens expire daily at 3:30 AM IST</p>
            <button onClick={saveToken} disabled={loading || !adminKey || !newToken} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors">{loading ? "Saving…" : "Update Token"}</button>
            {saveStatus && <div className={`mt-3 p-3 rounded-lg text-sm ${saveStatus.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>{saveStatus.message}</div>}
          </div>

          {tokenHistory.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
              <div className="space-y-2">
                {tokenHistory.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-slate-800 last:border-0">
                    <div><div className="text-sm text-white">{entry.action}</div><div className="text-xs text-slate-500 font-mono">{entry.token_preview}</div></div>
                    <div className="text-xs text-slate-500">{entry.timestamp}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Instructions</h2>
            <ol className="space-y-2 text-sm text-slate-400">
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">1.</span> Enter your admin key from <code className="text-slate-300 bg-slate-800 px-1 rounded">backend/.env</code></li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">2.</span> Get a fresh Upstox access token from your Upstox API console</li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">3.</span> Paste the token and click Update Token</li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">4.</span> Token will be validated and used for all live data calls</li>
              <li className="flex gap-2"><span className="text-amber-400 font-bold">!</span> <span className="text-amber-400">Upstox tokens expire daily and must be refreshed</span></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function BucketsPage() {
  const { editKey, setEditKey } = useEditKey();
  const [name, setName] = useState("");
  const [type, setType] = useState("watchlist");
  const [progressMode, setProgressMode] = useState("baseline");
  const [buckets, setBuckets] = useState([]);
  const [renamingId, setRenamingId] = useState(null);
  const [newName, setNewName] = useState("");
  const api = useMemo(() => axios.create({ baseURL: API_BASE }), []);
  const load = async () => { const { data } = await api.get("/buckets", { params: { scope: "mine" }, headers: editKey ? { "x-edit-key": editKey } : {} }); setBuckets(data.data || []); };
  useEffect(() => { load(); }, []);
  const create = async () => { if (!name.trim()) return; const { data } = await api.post("/buckets", { name, type, progress_mode: progressMode }); const bk = data.data; if (!editKey) setEditKey(bk.edit_key); setName(""); try { await api.post(`/buckets/${bk.id}/baseline`, null, { headers: { "x-edit-key": bk.edit_key } }); } catch (e) {} await load(); };
  const renameBucket = async (bucketId, bucketEditKey) => { if (!newName.trim()) return; try { await api.put(`/buckets/${bucketId}`, { name: newName }, { headers: bucketEditKey ? { "x-edit-key": bucketEditKey } : (editKey ? { "x-edit-key": editKey } : {}) }); setRenamingId(null); setNewName(""); await load(); } catch (e) { alert("Failed to rename: " + (e?.response?.data?.detail || e.message)); } };
  const deleteBucket = async (bucketId, bucketEditKey) => { if (!window.confirm("Delete this bucket? This cannot be undone.")) return; try { await api.delete(`/buckets/${bucketId}`, { headers: bucketEditKey ? { "x-edit-key": bucketEditKey } : (editKey ? { "x-edit-key": editKey } : {}) }); await load(); } catch (e) { alert("Failed to delete: " + (e?.response?.data?.detail || e.message)); } };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pt-16">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buckets</h1>
          <p className="text-gray-500 dark:text-gray-500 dark:text-slate-400 text-sm mt-1">Group stocks into portfolios and track performance</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Create New Bucket</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input placeholder="Bucket name" value={name} onChange={(e) => setName(e.target.value)} className="h-10 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="watchlist">Watchlist</option>
              <option value="allocation">Allocation</option>
            </select>
            <select value={progressMode} onChange={(e) => setProgressMode(e.target.value)} className="h-10 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="baseline">vs Baseline</option>
              <option value="intraday">Intraday</option>
            </select>
            <button onClick={create} className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors">Create Bucket</button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Your Buckets</h2>
          </div>
          {(!buckets || buckets.length === 0) ? (
            <div className="py-16 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3"><BarChart2 className="h-6 w-6 text-slate-600" /></div>
              <div className="text-gray-500 dark:text-slate-400 text-sm">No buckets yet. Create one above.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              {buckets.map((b) => (
                <div key={b.id} className="bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      {renamingId === b.id ? (
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onBlur={() => renameBucket(b.id, b.edit_key)}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameBucket(b.id, b.edit_key); if (e.key === 'Escape') setRenamingId(null); }}
                          autoFocus
                          className="w-full h-8 px-2 bg-slate-700 border border-emerald-500 rounded text-sm text-white focus:outline-none"
                        />
                      ) : (
                        <div onClick={() => { setRenamingId(b.id); setNewName(b.name); }} className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-emerald-400 transition-colors">
                          {b.name}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{b.type} · {b.progress_mode}</div>
                    </div>
                    <button onClick={() => deleteBucket(b.id, b.edit_key)} className="h-7 w-7 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors ml-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Link to={`/buckets/${b.id}`}>
                    <button className="w-full flex items-center justify-center gap-1.5 h-9 bg-slate-700 hover:bg-emerald-600 text-sm text-white rounded-lg transition-colors font-medium">
                      Open <ChevronRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BucketDetailPage() {
  const { id } = useParams();
  const { editKey } = useEditKey();
  const [bucket, setBucket] = useState(null);
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [results, setResults] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [baselineOptions, setBaselineOptions] = useState([]);
  const [activeBaseline, setActiveBaseline] = useState(null);
  const wsRef = useRef(null);
  const api = useMemo(() => axios.create({ baseURL: API_BASE }), []);

  const loadBucket = async () => { const { data } = await api.get(`/buckets/${id}`); setBucket(data.data); };
  const loadMetrics = async () => { const { data } = await api.get(`/buckets/${id}/metrics`); setMetrics(data.data); };
  const loadBaselines = async () => { const { data } = await api.get(`/buckets/${id}/baseline-timestamps`); setBaselineOptions(data.data || []); setActiveBaseline(data.active || null); };
  useEffect(() => { loadBucket(); loadBaselines(); }, [id]);
  useEffect(() => { loadMetrics(); const t = setInterval(loadMetrics, 30000); return () => clearInterval(t); }, [id]);
  useEffect(() => { let active = true; const fetchResults = async () => { if (!query || query.length < 2) { setResults([]); return; } const { data } = await api.get("/instruments/search", { params: { query, exchange, instrument_type: "EQ", limit: 10 } }); if (active) setResults(data.data || []); }; const t = setTimeout(fetchResults, 300); return () => { active = false; clearTimeout(t); }; }, [query, exchange, api]);
  useEffect(() => { if (!bucket) return; const base = (process.env.REACT_APP_BACKEND_URL || "").replace(/^http/, "ws"); const ws = new WebSocket(`${base}/api/ws/quotes`); wsRef.current = ws; ws.onopen = () => { const keys = (bucket.items || []).map(it => it.instrument_key); ws.send(JSON.stringify({ type: "init", instrument_keys: keys, mode: "ltp" })); }; ws.onclose = () => {}; return () => { try { ws.close(); } catch {} }; }, [bucket?.id]);

  const addItem = async (inst) => { const bucketEditKey = bucket?.edit_key || editKey; await api.post(`/buckets/${id}/items`, { instrument_key: inst.instrument_key, tradingsymbol: inst.tradingsymbol, name: inst.name, qty: bucket?.type === "allocation" ? 1 : 0 }, { headers: bucketEditKey ? { "x-edit-key": bucketEditKey } : {} }); await loadBucket(); await loadMetrics(); await loadBaselines(); setQuery(""); setResults([]); try { const ws = wsRef.current; if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "subscribe", instrument_keys: [inst.instrument_key], mode: "ltp" })); } catch {} };
  const updateQty = async (instrument_key, qty) => { const bucketEditKey = bucket?.edit_key || editKey; await api.put(`/buckets/${id}/item-qty`, { instrument_key, qty }, { headers: bucketEditKey ? { "x-edit-key": bucketEditKey } : {} }); await loadMetrics(); await loadBucket(); };
  const setBaseline = async (label) => { const bucketEditKey = bucket?.edit_key || editKey; await api.post(`/buckets/${id}/baseline`, null, { params: label ? { label } : {}, headers: bucketEditKey ? { "x-edit-key": bucketEditKey } : {} }); await loadBucket(); await loadBaselines(); };
  const selectBaseline = async (at) => { const bucketEditKey = bucket?.edit_key || editKey; await api.post(`/buckets/${id}/baseline/select`, { baseline_at: at }, { headers: bucketEditKey ? { "x-edit-key": bucketEditKey } : {} }); await loadBucket(); setActiveBaseline({ at }); };

  const items = bucket?.items || [];
  const m = metrics?.items || [];
  const map = Object.fromEntries(m.map(x => [x.instrument_key, x]));
  const rows = items.map(it => { const info = map[it.instrument_key] || {}; const ltp = info.ltp ?? null; const baseline = it.baseline_price ?? null; const qty = bucket?.type === "allocation" ? Number(it.qty || 0) : 0; const total = ltp && qty ? ltp * qty : 0; let changeAbs = null, changePct = null; if (baseline && ltp) { changeAbs = ltp - baseline; changePct = baseline > 0 ? (changeAbs / baseline) * 100 : null; } return { ...it, ltp, baseline, qty, total, changeAbs, changePct }; });
  const sortedRows = [...rows].sort((a, b) => { const ap = a.changePct ?? -Infinity; const bp = b.changePct ?? -Infinity; return bp - ap; });
  const summary = sortedRows.reduce((acc, r) => { const qty = bucket?.type === "allocation" ? (Number(r.qty || 0)) : 1; const baseVal = r.baseline && qty ? r.baseline * qty : 0; const currVal = r.ltp && qty ? r.ltp * qty : 0; acc.benchmark += baseVal; acc.current += currVal; return acc; }, { benchmark: 0, current: 0 });
  const overallChange = summary.benchmark > 0 ? ((summary.current - summary.benchmark) / summary.benchmark) * 100 : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pt-16">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/buckets" className="hover:text-white transition-colors">Buckets</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-white">{bucket?.name || "Loading…"}</span>
        </div>

        {!bucket ? (
          <div className="text-gray-400 dark:text-slate-500 text-sm py-8">Loading…</div>
        ) : (
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
                <div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Bucket</div>
                <div className="font-bold text-white text-lg">{bucket.name}</div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{bucket.type} · {bucket.progress_mode}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
                <div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Benchmark Value</div>
                <div className="font-bold text-white text-lg font-mono">{formatINR(summary.benchmark)}</div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Current: {formatINR(summary.current)}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
                <div className="text-xs text-gray-400 dark:text-slate-500 mb-1">Overall Change</div>
                <div className={`font-bold text-lg font-mono ${overallChange === null ? "text-slate-500" : overallChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {overallChange !== null ? `${overallChange >= 0 ? "+" : ""}${overallChange.toFixed(2)}%` : "—"}
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatINR(summary.current - summary.benchmark)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Baseline & Actions</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input placeholder="Snapshot label (optional)" id="baseline-label" className="h-9 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
                <button onClick={() => { const label = document.getElementById("baseline-label").value; setBaseline(label); }} className="h-9 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white rounded-lg transition-colors">Set Baseline</button>
                <button onClick={loadMetrics} className="h-9 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white rounded-lg transition-colors flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
                <select className="h-9 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" value={activeBaseline?.at || ""} onChange={(e) => selectBaseline(e.target.value)}>
                  <option value="" disabled>Select snapshot</option>
                  {baselineOptions.map((s) => (<option key={s.at} value={s.at}>{new Date(s.at).toLocaleString()} {s.label ? `· ${s.label}` : ""}</option>))}
                </select>
              </div>
            </div>

            {/* Add stocks */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Add Stocks</h2>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or symbol…" className="w-full h-10 pl-10 pr-4 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <select value={exchange} onChange={(e) => setExchange(e.target.value)} className="h-10 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
              {results.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.map((r) => (
                    <div key={r.instrument_key} onClick={() => addItem(r)} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 hover:border-emerald-500/40 rounded-lg cursor-pointer transition-all group">
                      <div><div className="text-sm font-semibold text-gray-900 dark:text-white">{r.tradingsymbol || r.name}</div><div className="text-xs text-slate-400">{r.name}</div></div>
                      <div className="h-7 w-7 rounded-full bg-slate-700 group-hover:bg-emerald-500 flex items-center justify-center transition-colors"><Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Holdings</h2>
                {sortedRows.length > 0 && <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">{sortedRows.length} stocks</span>}
              </div>
              {sortedRows.length === 0 ? (
                <div className="py-16 text-center"><div className="text-gray-400 dark:text-slate-500 text-sm">No stocks added yet.</div></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50">
                      <th className="text-left text-xs text-gray-400 dark:text-slate-500 font-medium px-5 py-3">Stock</th>
                      {bucket.type === "allocation" && <th className="text-center text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Qty</th>}
                      <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Benchmark</th>
                      <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Current</th>
                      <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Change</th>
                      <th className="px-3 py-3"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800/60">
                      {sortedRows.map((r) => (
                        <tr key={r.instrument_key} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5"><div className="font-semibold text-gray-900 dark:text-white">{r.tradingsymbol || r.name}</div><div className="text-xs text-slate-500">{r.name}</div></td>
                          {bucket.type === "allocation" && <td className="px-3 py-3.5 text-center"><div className="flex items-center justify-center gap-1"><button onClick={() => updateQty(r.instrument_key, Math.max(0, Number(r.qty) - 1))} className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"><Minus className="h-3.5 w-3.5" /></button><input type="text" className="h-7 w-12 text-center text-sm bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" value={r.qty} onChange={(e) => updateQty(r.instrument_key, e.target.value)} onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); updateQty(r.instrument_key, Number(r.qty) + 1); } if (e.key === "ArrowDown") { e.preventDefault(); updateQty(r.instrument_key, Math.max(0, Number(r.qty) - 1)); } }} /><button onClick={() => updateQty(r.instrument_key, Number(r.qty) + 1)} className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"><Plus className="h-3.5 w-3.5" /></button></div></td>}
                          <td className="px-3 py-3.5 text-right text-slate-400 font-mono text-xs">{r.baseline ? formatINR(r.baseline) : "—"}</td>
                          <td className="px-3 py-3.5 text-right text-gray-700 dark:text-slate-300 font-mono text-xs">{r.ltp ? formatINR(r.ltp) : "—"}</td>
                          <td className="px-3 py-3.5 text-right font-mono text-xs">
                            {r.changePct !== null ? (
                              <span className={r.changePct >= 0 ? "text-emerald-400" : "text-red-400"}>
                                {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-3.5">
                            <button onClick={async () => { const bucketEditKey = bucket?.edit_key || editKey; await axios.delete(`${API_BASE}/buckets/${id}/items/${r.instrument_key}`, { headers: bucketEditKey ? { "x-edit-key": bucketEditKey } : {} }); await loadBucket(); await loadMetrics(); await loadBaselines(); }} className="h-7 w-7 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderExperimentPage() {
  const [budget, setBudget] = useLocalStorageState("order_exp_budget", 100000);
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [portfolio, setPortfolio] = useLocalStorageState("order_exp_portfolio", []);
  const [prices, setPrices] = useState({});
  const [polling, setPolling] = useState(false);
  const [orderHistory, setOrderHistory] = useLocalStorageState("order_exp_history", []);
  const [executing, setExecuting] = useState(false);
  const [showChargesBreakdown, setShowChargesBreakdown] = useState(false);
  const api = useMemo(() => axios.create({ baseURL: API_BASE }), []);

  useEffect(() => { let active = true; const fetchResults = async () => { if (!query || query.length < 2) { setResults([]); return; } setSearching(true); try { const { data } = await api.get("/instruments/search", { params: { query, exchange, instrument_type: "EQ", limit: 10 } }); if (active) setResults(data.data || []); } catch (e) { console.error(e); } finally { setSearching(false); } }; const t = setTimeout(fetchResults, 300); return () => { active = false; clearTimeout(t); }; }, [query, exchange, api]);

  useEffect(() => { let timerId; const poll = async () => { try { const keys = portfolio.map(p => p.instrument_key); if (keys.length === 0) return; const { data } = await api.post("/quotes/ltp", { instrument_keys: keys }); setPrices(data.data || {}); } catch (e) { console.error("LTP poll error", e?.response?.data || e.message); } }; poll(); timerId = setInterval(poll, 5000); setPolling(true); return () => { clearInterval(timerId); setPolling(false); }; }, [portfolio, api]);

  const portfolioWithLTP = useMemo(() => portfolio.map(item => { const quote = prices[item.instrument_key]; const ltp = quote?.last_price ?? item.last_price ?? null; const qty = Number(item.qty) || 0; const total = ltp ? ltp * qty : 0; const additional = total ? computeAdditionalCost(total, exchange) : 0; const finalCost = total + additional; return { ...item, ltp, total, additional, finalCost }; }), [portfolio, prices, exchange]);

  const portfolioValue = useMemo(() => portfolioWithLTP.reduce((s, i) => s + (i.total || 0), 0), [portfolioWithLTP]);
  const finalCostTotal = useMemo(() => portfolioWithLTP.reduce((s, i) => s + (i.finalCost || 0), 0), [portfolioWithLTP]);
  const remaining = useMemo(() => (Number(budget) || 0) - finalCostTotal, [budget, finalCostTotal]);
  const totalBrokerage = portfolio.length * 10;

  const addToPortfolio = (inst) => { const exists = portfolio.find(p => p.instrument_key === inst.instrument_key); if (exists) return; setPortfolio(prev => [...prev, { instrument_key: inst.instrument_key, tradingsymbol: inst.tradingsymbol, name: inst.name, qty: 1, last_price: inst.last_price || null }]); setQuery(""); setResults([]); };
  const removeFromPortfolio = (instrument_key) => { setPortfolio(prev => prev.filter(p => p.instrument_key !== instrument_key)); };
  const updateQty = (instrument_key, qty) => { setPortfolio(prev => prev.map(p => p.instrument_key === instrument_key ? { ...p, qty: Math.max(0, Number(qty) || 0) } : p)); };

  const executeAllOrders = async () => {
    if (portfolio.length === 0) {
      alert("Add stocks to your portfolio first");
      return;
    }

    if (finalCostTotal > budget) {
      alert(`Insufficient budget! Need ₹${finalCostTotal.toFixed(2)} but only have ₹${budget}`);
      return;
    }

    const confirmed = window.confirm(`Execute ${portfolio.length} orders?\nTotal cost: ₹${finalCostTotal.toFixed(2)}\nBrokerage: ₹${totalBrokerage}\nRemaining: ₹${remaining.toFixed(2)}`);
    if (!confirmed) return;

    setExecuting(true);
    try {
      // Simulate batch order execution
      const executedOrders = portfolioWithLTP.map((item, idx) => ({
        id: `BATCH-${Date.now()}-${idx}`,
        symbol: item.tradingsymbol,
        name: item.name,
        quantity: item.qty,
        price: item.ltp || item.last_price || 0,
        status: "EXECUTED",
        timestamp: new Date().toLocaleString(),
        value: item.total,
        charges: item.additional || 0,
        finalCost: item.finalCost || 0,
      }));

      // Create bucket with timestamp name
      const now = new Date();
      const bucketName = `Executed - ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const bucketRes = await api.post("/buckets", { name: bucketName });
      const bucketId = bucketRes.data.data?.id;
      const bucketEditKey = bucketRes.data.data?.edit_key;

      if (bucketId && bucketEditKey) {
        // Add each executed order as a bucket item
        for (const order of executedOrders) {
          await api.post(`/buckets/${bucketId}/items`, {
            instrument_key: portfolio.find(p => p.tradingsymbol === order.symbol)?.instrument_key,
            tradingsymbol: order.symbol,
            name: order.name,
            qty: order.quantity,
          }, {
            headers: { "x-edit-key": bucketEditKey }
          });
        }
      }

      setOrderHistory(prev => [...executedOrders, ...prev]);
      setPortfolio([]);
      alert(`✅ ${portfolio.length} orders executed successfully!\nBucket: "${bucketName}"\nTotal: ₹${finalCostTotal.toFixed(2)}`);
    } catch (error) {
      console.error("Batch execution error:", error);
      alert("Failed to execute orders: " + (error?.response?.data?.detail || error.message));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pt-16">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Batch Order Executor</h1>
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full font-medium">EXPERIMENTAL</span>
          </div>
          <p className="text-gray-500 dark:text-gray-500 dark:text-slate-400 text-sm mt-1">Build portfolio & execute all orders at once</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left — Search + Portfolio */}
          <div className="flex-1 lg:w-3/5 space-y-4">

            {/* Search card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or symbol — TCS, INFY, RELIANCE…"
                    className="w-full h-11 pl-10 pr-4 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                  className="h-11 w-28 px-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>

              {/* Search results */}
              {searching && (
                <div className="mt-3 text-sm text-slate-500">Searching…</div>
              )}
              {results.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.map((r) => (
                    <div
                      key={r.instrument_key}
                      onClick={() => addToPortfolio(r)}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 hover:border-emerald-500/40 rounded-lg cursor-pointer transition-all group"
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{r.tradingsymbol}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[160px]">{r.name}</div>
                      </div>
                      <div className="h-7 w-7 rounded-full bg-slate-700 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                        <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Portfolio table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Order Portfolio</h2>
                  {portfolio.length > 0 && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">{portfolio.length} stocks</span>
                  )}
                </div>
              </div>

              {portfolio.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="h-6 w-6 text-slate-600" />
                  </div>
                  <div className="text-gray-500 dark:text-slate-400 text-sm font-medium">No stocks added yet</div>
                  <div className="text-slate-600 text-xs mt-1">Search above to add stocks to your order portfolio</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50">
                        <th className="text-left text-xs text-gray-400 dark:text-slate-500 font-medium px-5 py-3">Stock</th>
                        <th className="text-center text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Qty</th>
                        <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">LTP</th>
                        <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Value</th>
                        <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Charges</th>
                        <th className="text-right text-xs text-gray-400 dark:text-slate-500 font-medium px-3 py-3">Total</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800/60">
                      {portfolioWithLTP.map((row) => (
                        <tr key={row.instrument_key} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-gray-900 dark:text-white">{row.tradingsymbol}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[160px]">{row.name}</div>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateQty(row.instrument_key, Math.max(0, Number(row.qty) - 1))}
                                className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="text"
                                value={row.qty}
                                onChange={(e) => updateQty(row.instrument_key, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "ArrowUp") { e.preventDefault(); updateQty(row.instrument_key, Number(row.qty) + 1); }
                                  if (e.key === "ArrowDown") { e.preventDefault(); updateQty(row.instrument_key, Math.max(0, Number(row.qty) - 1)); }
                                }}
                                className="h-7 w-12 text-center text-sm bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              <button
                                onClick={() => updateQty(row.instrument_key, Number(row.qty) + 1)}
                                className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right text-gray-700 dark:text-slate-300 font-mono text-xs">
                            {row.ltp ? formatINR(row.ltp) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-right text-gray-700 dark:text-slate-300 font-mono text-xs">
                            {formatINR(row.total || 0)}
                          </td>
                          <td className="px-3 py-3.5 text-right text-gray-700 dark:text-slate-300 font-mono text-xs">
                            {formatINR(row.additional || 0)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-emerald-400 font-mono text-xs">
                            {formatINR(row.finalCost || 0)}
                          </td>
                          <td className="px-3 py-3.5">
                            <button
                              onClick={() => removeFromPortfolio(row.instrument_key)}
                              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right — Summary + Execute */}
          <div className="lg:w-2/5">
            <div className="sticky top-24 space-y-4">

              {/* Budget input */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Total Budget</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="text-slate-400 text-lg font-medium">₹</span>
                  </div>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    placeholder="Enter budget"
                    className="w-full h-14 pl-9 pr-4 bg-slate-800 border border-slate-700 rounded-lg text-2xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="text-center mt-3">
                  <div className="text-3xl font-bold text-white">{formatINR(Number(budget) || 0)}</div>
                  <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Available budget</div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-200 dark:divide-slate-800">
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-sm text-slate-400">Portfolio Value</span>
                  <span className="font-semibold text-gray-900 dark:text-white font-mono">{formatINR(portfolioValue)}</span>
                </div>
                <button
                  onClick={() => setShowChargesBreakdown(!showChargesBreakdown)}
                  className="w-full flex justify-between items-center px-5 py-4 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <span className="text-sm text-slate-400">Charges <span className="text-xs text-slate-600 ml-1">{showChargesBreakdown ? "▼" : "▶"}</span></span>
                  <span className="text-amber-400 font-mono">{formatINR(finalCostTotal - portfolioValue)}</span>
                </button>
                {showChargesBreakdown && portfolioValue > 0 && (
                  <div className="bg-slate-800/50 px-5 py-4 space-y-2 text-xs">
                    {(() => {
                      const breakdown = chargesBreakdown(portfolioValue, exchange);
                      return (
                        <>
                          <div className="flex justify-between"><span className="text-slate-500">STT (0.1%)</span><span className="text-gray-700 dark:text-slate-300 font-mono">{formatINR(breakdown.stt)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Exchange Fee</span><span className="text-gray-700 dark:text-slate-300 font-mono">{formatINR(breakdown.exchange)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Stamp Duty (0.015%)</span><span className="text-gray-700 dark:text-slate-300 font-mono">{formatINR(breakdown.stamp)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">SEBI Charges</span><span className="text-gray-700 dark:text-slate-300 font-mono">{formatINR(breakdown.sebi)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">GST (18%)</span><span className="text-gray-700 dark:text-slate-300 font-mono">{formatINR(breakdown.gst)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">API Brokerage ({portfolio.length} × ₹10)</span><span className="text-gray-700 dark:text-slate-300 font-mono">₹{(portfolio.length * 10).toFixed(0)}</span></div>
                          <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between font-semibold"><span className="text-slate-300">Total Charges</span><span className="text-amber-400 font-mono">{formatINR(finalCostTotal - portfolioValue)}</span></div>
                        </>
                      );
                    })()}
                  </div>
                )}
                <div className="flex justify-between items-center px-5 py-4 bg-slate-800/50">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Total Cost</span>
                  <span className="font-bold text-lg text-white font-mono">{formatINR(finalCostTotal)}</span>
                </div>
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-sm text-slate-400">Remaining</span>
                  <span className={`font-bold text-lg font-mono ${remaining < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {formatINR(remaining)}
                  </span>
                </div>
              </div>

              {/* Execute Button */}
              <button
                onClick={executeAllOrders}
                disabled={executing || portfolio.length === 0 || remaining < 0}
                className={`w-full py-4 rounded-lg font-semibold text-gray-900 dark:text-white text-lg transition-all ${
                  executing || portfolio.length === 0 || remaining < 0
                    ? "bg-slate-700 cursor-not-allowed opacity-50"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg"
                }`}
              >
                {executing ? "Executing..." : `Execute ${portfolio.length} Orders`}
              </button>

              {portfolio.length > 0 && remaining < 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="text-sm text-red-400 font-medium">Budget Exceeded</div>
                  <div className="text-xs text-red-300 mt-1">Reduce quantities or increase budget</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order History */}
        {orderHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-white mb-4">Execution History</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orderHistory.slice(0, 12).map((order) => (
                <div key={order.id} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-gray-900 dark:text-white">{order.symbol}</div>
                    <div className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">{order.status}</div>
                  </div>
                  <div className="text-xs text-slate-400 mb-3">{order.timestamp}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Qty:</span>
                      <span className="text-white font-mono">{order.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price:</span>
                      <span className="text-white font-mono">{formatINR(order.price)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-700">
                      <span className="text-slate-400">Total:</span>
                      <span className="text-emerald-400 font-mono font-semibold">{formatINR(order.value)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function useEditKey() { const [editKey, setEditKey] = useLocalStorageState("stox_edit_key", ""); return { editKey, setEditKey }; }

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<AllocatorPage />} />
        <Route path="/order" element={<OrderExperimentPage />} />
        <Route path="/buckets" element={<BucketsPage />} />
        <Route path="/buckets/:id" element={<BucketDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
