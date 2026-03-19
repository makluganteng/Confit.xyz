"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type OrderSide = "long" | "short";
type OrderType = "market" | "limit";

interface OrderFormData {
  pair: string;
  side: OrderSide;
  type: OrderType;
  size: number;
  leverage: number;
  limitPrice?: number;
}

interface Position {
  id: string;
  pair: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  margin?: number;
  leverage?: number;
  tp?: number | null;
  sl?: number | null;
}

interface Order {
  id: string;
  pair: string;
  side: "long" | "short";
  size: number;
  leverage: number;
  orderType: string;
  status: string;
  createdAt: string;
  limitPrice?: number;
}

// ── Mock Data ────────────────────────────────────────────────────────────────

const SYMBOLS = [
  { symbol: "SOL", pair: "SOL-PERP", price: 91.07, change: -4.41, volume: 64_700_000, high: 95.32, low: 89.14, funding: 0.0012 },
  { symbol: "BTC", pair: "BTC-PERP", price: 67_243.50, change: 1.23, volume: 1_230_000_000, high: 68_100.00, low: 66_410.00, funding: 0.0008 },
  { symbol: "ETH", pair: "ETH-PERP", price: 3_521.80, change: -0.89, volume: 412_000_000, high: 3_590.00, low: 3_480.00, funding: -0.0003 },
];

function generateOrderBook(midPrice: number) {
  const asks: { price: number; size: number; total: number }[] = [];
  const bids: { price: number; size: number; total: number }[] = [];
  let askTotal = 0;
  let bidTotal = 0;

  for (let i = 10; i >= 1; i--) {
    const spread = midPrice * 0.0003 * i;
    const size = Math.round(Math.random() * 50_000 + 5_000);
    askTotal += size;
    asks.unshift({ price: midPrice + spread, size, total: askTotal });
  }
  // Reverse totals so they accumulate top-down
  let runningAsk = 0;
  for (let i = 0; i < asks.length; i++) {
    runningAsk += asks[i].size;
    asks[i].total = runningAsk;
  }

  for (let i = 1; i <= 10; i++) {
    const spread = midPrice * 0.0003 * i;
    const size = Math.round(Math.random() * 50_000 + 5_000);
    bidTotal += size;
    bids.push({ price: midPrice - spread, size, total: bidTotal });
  }

  return { asks, bids };
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtPrice(n: number, decimals?: number) {
  const d = decimals ?? (n >= 1000 ? 2 : n >= 1 ? 4 : 6);
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtUsd(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPnl(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TradePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Order form state ─────────────────────────────────────────────────────
  const [selectedSymbolIdx, setSelectedSymbolIdx] = useState(0);
  const [symbolDropdownOpen, setSymbolDropdownOpen] = useState(false);
  const [side, setSide] = useState<OrderSide>("long");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [sizeInput, setSizeInput] = useState("");
  const [leverageInput, setLeverageInput] = useState("5");
  const [limitPriceInput, setLimitPriceInput] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpInput, setTpInput] = useState("");
  const [slInput, setSlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  // ── Bottom panel state ───────────────────────────────────────────────────
  const [bottomTab, setBottomTab] = useState<"positions" | "openOrders" | "tradeHistory" | "orderHistory">("positions");

  const currentSymbol = SYMBOLS[selectedSymbolIdx];
  const orderBook = generateOrderBook(currentSymbol.price);

  // ── Data fetching (preserved from original) ──────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const challengeRes = await fetch("/api/challenge/active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (challengeRes.ok) {
        const { challenge } = await challengeRes.json();
        if (challenge) {
          setChallengeId(challenge.id);

          const [posRes, histRes] = await Promise.all([
            fetch(`/api/trade/positions?challengeId=${challenge.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`/api/trade/history?challengeId=${challenge.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          if (posRes.ok) {
            const posData = await posRes.json();
            setPositions(
              posData.positions.map((p: any) => ({
                id: p.id,
                pair: p.pair,
                side: p.side,
                size: Number(p.size),
                entryPrice: Number(p.entryPrice),
                currentPrice: Number(p.currentPrice),
                unrealizedPnl: Number(p.unrealizedPnl),
                margin: p.margin ? Number(p.margin) : undefined,
                leverage: p.leverage ? Number(p.leverage) : undefined,
                tp: p.tp ? Number(p.tp) : null,
                sl: p.sl ? Number(p.sl) : null,
              }))
            );
          }

          if (histRes.ok) {
            const histData = await histRes.json();
            setOrders(
              histData.orders.map((o: any) => ({
                id: o.id,
                pair: o.pair,
                side: o.side,
                size: Number(o.size),
                leverage: Number(o.leverage),
                orderType: o.orderType,
                status: o.status,
                createdAt: o.createdAt,
                limitPrice: o.limitPrice ? Number(o.limitPrice) : undefined,
              }))
            );
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch trading data:", err);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated, fetchData]);

  useEffect(() => {
    if (!authenticated || !challengeId) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [authenticated, challengeId, fetchData]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sizeInput || !leverageInput) return;

    const token = await getAccessToken();
    if (!token || !challengeId) return;

    const orderData: OrderFormData = {
      pair: currentSymbol.pair,
      side,
      type: orderType,
      size: parseFloat(sizeInput),
      leverage: parseFloat(leverageInput),
      ...(orderType === "limit" && limitPriceInput
        ? { limitPrice: parseFloat(limitPriceInput) }
        : {}),
    };

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/trade/order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId,
          pair: orderData.pair,
          side: orderData.side,
          size: orderData.size,
          leverage: orderData.leverage,
          orderType: orderData.type,
          limitPrice: orderData.limitPrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Order failed");
        return;
      }

      await fetchData();
      setSizeInput("");
    } catch {
      setError("Order submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClosePosition(id: string) {
    const token = await getAccessToken();
    if (!token) return;

    setClosingId(id);
    try {
      const res = await fetch(`/api/trade/positions/${id}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to close position");
        return;
      }

      await fetchData();
    } finally {
      setClosingId(null);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + p.unrealizedPnl, 0);
  const totalMargin = positions.reduce((acc, p) => acc + (p.margin ?? 0), 0);
  const accountEquity = 5000 + totalUnrealizedPnl; // Mock starting equity
  const idleBalance = accountEquity - totalMargin;

  // ── Loading / Auth gates ─────────────────────────────────────────────────

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-[#6b7894] text-sm">Please sign in to trade.</p>
      </div>
    );
  }

  if (!challengeId) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-[#6b7894] text-sm">No active challenge found.</p>
          <a href="/dashboard" className="mt-2 block text-xs text-emerald-400 hover:underline">
            Go to Dashboard to start one
          </a>
        </div>
      </div>
    );
  }

  // ── Max total for order book bar width ────────────────────────────────────
  const maxAskTotal = orderBook.asks.length > 0 ? orderBook.asks[orderBook.asks.length - 1].total : 1;
  const maxBidTotal = orderBook.bids.length > 0 ? orderBook.bids[orderBook.bids.length - 1].total : 1;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[#06090f]">
      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-400">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.06] bg-white/[0.02] px-4 py-0 h-10 shrink-0">
        {/* Symbol selector */}
        <div className="relative">
          <button
            onClick={() => setSymbolDropdownOpen(!symbolDropdownOpen)}
            className="flex items-center gap-2 pr-4 border-r border-white/[0.06] mr-4 h-10 text-sm font-semibold text-white hover:text-emerald-400 transition-colors"
          >
            <span className="text-emerald-400">{currentSymbol.symbol}</span>
            <span className="text-white/40">/ USD</span>
            <svg className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {symbolDropdownOpen && (
            <div className="absolute top-full left-0 z-50 mt-0.5 w-40 border border-white/[0.06] bg-[#0c1017] shadow-xl">
              {SYMBOLS.map((s, idx) => (
                <button
                  key={s.symbol}
                  onClick={() => { setSelectedSymbolIdx(idx); setSymbolDropdownOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-white/[0.04] ${
                    idx === selectedSymbolIdx ? "text-emerald-400" : "text-white/70"
                  }`}
                >
                  <span className="font-medium">{s.symbol}-PERP</span>
                  <span className="font-[family-name:var(--font-mono)]">${fmtPrice(s.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mark price */}
        <div className="flex items-center gap-1.5 pr-4 border-r border-white/[0.06] mr-4">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Mark</span>
          <span className={`font-[family-name:var(--font-mono)] text-sm font-semibold ${currentSymbol.change >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
            ${fmtPrice(currentSymbol.price)}
          </span>
        </div>

        {/* 24h change */}
        <div className="flex items-center gap-1.5 pr-4 border-r border-white/[0.06] mr-4">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">24h</span>
          <span className={`font-[family-name:var(--font-mono)] text-xs font-medium ${currentSymbol.change >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
            {currentSymbol.change >= 0 ? "+" : ""}{currentSymbol.change.toFixed(2)}%
          </span>
        </div>

        {/* 24h volume */}
        <div className="flex items-center gap-1.5 pr-4 border-r border-white/[0.06] mr-4">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Vol</span>
          <span className="font-[family-name:var(--font-mono)] text-xs text-white/60">
            {fmtUsd(currentSymbol.volume)}
          </span>
        </div>

        {/* 24h high/low */}
        <div className="flex items-center gap-1.5 pr-4 border-r border-white/[0.06] mr-4">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">High</span>
          <span className="font-[family-name:var(--font-mono)] text-xs text-white/60">
            ${fmtPrice(currentSymbol.high)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 pr-4 border-r border-white/[0.06] mr-4">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Low</span>
          <span className="font-[family-name:var(--font-mono)] text-xs text-white/60">
            ${fmtPrice(currentSymbol.low)}
          </span>
        </div>

        {/* Funding */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Funding</span>
          <span className={`font-[family-name:var(--font-mono)] text-xs ${currentSymbol.funding >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
            {currentSymbol.funding >= 0 ? "+" : ""}{(currentSymbol.funding * 100).toFixed(4)}%
          </span>
        </div>
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Chart Area (left ~60%) ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col border-r border-white/[0.06] min-w-0">
          {/* Chart */}
          <div className="flex-1 flex items-center justify-center bg-white/[0.01] relative">
            {/* Chart toolbar mock */}
            <div className="absolute top-0 left-0 right-0 flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.04]">
              {["1m", "5m", "15m", "1H", "4H", "1D", "1W"].map((tf) => (
                <button
                  key={tf}
                  className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    tf === "15m" ? "text-emerald-400 bg-emerald-400/10" : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {tf}
                </button>
              ))}
              <div className="mx-2 h-3 w-px bg-white/[0.06]" />
              {["Line", "Candle", "Area"].map((ct) => (
                <button
                  key={ct}
                  className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    ct === "Candle" ? "text-white/60" : "text-white/20 hover:text-white/40"
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>
            <div className="text-center">
              <div className="text-[#6b7894] text-xs">TradingView chart</div>
              <div className="text-white/10 text-[10px] mt-1">Integration coming soon</div>
            </div>
          </div>

          {/* ── Bottom Panel (positions / orders / history) ──────────── */}
          <div className="h-[200px] shrink-0 border-t border-white/[0.06] flex flex-col">
            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-white/[0.06] px-0 shrink-0">
              {([
                { key: "positions", label: `Positions (${positions.length})` },
                { key: "openOrders", label: "Open Orders" },
                { key: "tradeHistory", label: `Trade History (${orders.length})` },
                { key: "orderHistory", label: "Order History" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setBottomTab(tab.key)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    bottomTab === tab.key
                      ? "text-white border-emerald-400"
                      : "text-white/30 border-transparent hover:text-white/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Table content */}
            <div className="flex-1 overflow-auto">
              {bottomTab === "positions" && (
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-white/30 uppercase tracking-wider">
                      <th className="text-left py-1.5 px-3 font-medium">Token</th>
                      <th className="text-left py-1.5 px-3 font-medium">Side</th>
                      <th className="text-right py-1.5 px-3 font-medium">Size</th>
                      <th className="text-right py-1.5 px-3 font-medium">Entry</th>
                      <th className="text-right py-1.5 px-3 font-medium">Mark</th>
                      <th className="text-right py-1.5 px-3 font-medium">PnL</th>
                      <th className="text-right py-1.5 px-3 font-medium">Margin</th>
                      <th className="text-right py-1.5 px-3 font-medium">TP / SL</th>
                      <th className="text-right py-1.5 px-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-xs text-white/20">
                          No open positions
                        </td>
                      </tr>
                    ) : (
                      positions.map((pos) => (
                        <tr key={pos.id} className="border-t border-white/[0.03] hover:bg-white/[0.02] text-xs">
                          <td className="py-1.5 px-3 font-medium text-white">{pos.pair}</td>
                          <td className="py-1.5 px-3">
                            <span className={`font-medium ${pos.side === "long" ? "text-[#34d399]" : "text-[#f87171]"}`}>
                              {pos.side === "long" ? "Long" : "Short"}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/80">
                            ${pos.size.toLocaleString()}
                          </td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/80">
                            ${fmtPrice(pos.entryPrice)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/80">
                            ${fmtPrice(pos.currentPrice)}
                          </td>
                          <td className={`py-1.5 px-3 text-right font-[family-name:var(--font-mono)] font-medium ${
                            pos.unrealizedPnl >= 0 ? "text-[#34d399]" : "text-[#f87171]"
                          }`}>
                            {fmtPnl(pos.unrealizedPnl)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/60">
                            {pos.margin ? `$${pos.margin.toFixed(2)}` : "--"}
                          </td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/40 text-[10px]">
                            {pos.tp || pos.sl
                              ? `${pos.tp ? `$${fmtPrice(pos.tp)}` : "--"} / ${pos.sl ? `$${fmtPrice(pos.sl)}` : "--"}`
                              : "--"}
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <button
                              onClick={() => handleClosePosition(pos.id)}
                              disabled={closingId === pos.id}
                              className="px-2 py-0.5 text-[10px] font-medium border border-white/[0.06] text-white/50 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30"
                            >
                              {closingId === pos.id ? "Closing..." : "Close"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {bottomTab === "openOrders" && (
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-white/30 uppercase tracking-wider">
                      <th className="text-left py-1.5 px-3 font-medium">Token</th>
                      <th className="text-left py-1.5 px-3 font-medium">Side</th>
                      <th className="text-left py-1.5 px-3 font-medium">Type</th>
                      <th className="text-right py-1.5 px-3 font-medium">Size</th>
                      <th className="text-right py-1.5 px-3 font-medium">Price</th>
                      <th className="text-right py-1.5 px-3 font-medium">Leverage</th>
                      <th className="text-right py-1.5 px-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter(o => o.status === "open").length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-white/20">
                          No open orders
                        </td>
                      </tr>
                    ) : (
                      orders.filter(o => o.status === "open").map((o) => (
                        <tr key={o.id} className="border-t border-white/[0.03] hover:bg-white/[0.02] text-xs">
                          <td className="py-1.5 px-3 font-medium text-white">{o.pair}</td>
                          <td className="py-1.5 px-3">
                            <span className={`font-medium ${o.side === "long" ? "text-[#34d399]" : "text-[#f87171]"}`}>
                              {o.side === "long" ? "Long" : "Short"}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-white/60 capitalize">{o.orderType}</td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/80">${o.size.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/80">
                            {o.limitPrice ? `$${fmtPrice(o.limitPrice)}` : "Market"}
                          </td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/60">{o.leverage}x</td>
                          <td className="py-1.5 px-3 text-right">
                            <button className="px-2 py-0.5 text-[10px] font-medium border border-white/[0.06] text-white/50 hover:text-[#f87171] hover:border-[#f87171]/30 transition-colors">
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {bottomTab === "tradeHistory" && (
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-white/30 uppercase tracking-wider">
                      <th className="text-left py-1.5 px-3 font-medium">Time</th>
                      <th className="text-left py-1.5 px-3 font-medium">Token</th>
                      <th className="text-left py-1.5 px-3 font-medium">Side</th>
                      <th className="text-left py-1.5 px-3 font-medium">Type</th>
                      <th className="text-right py-1.5 px-3 font-medium">Size</th>
                      <th className="text-right py-1.5 px-3 font-medium">Leverage</th>
                      <th className="text-left py-1.5 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-white/20">
                          No trades yet
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="border-t border-white/[0.03] hover:bg-white/[0.02] text-xs">
                          <td className="py-1.5 px-3 font-[family-name:var(--font-mono)] text-white/40 text-[10px] whitespace-nowrap">
                            {new Date(o.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-1.5 px-3 font-medium text-white">{o.pair}</td>
                          <td className="py-1.5 px-3">
                            <span className={`font-medium ${o.side === "long" ? "text-[#34d399]" : "text-[#f87171]"}`}>
                              {o.side === "long" ? "Long" : "Short"}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-white/60 capitalize">{o.orderType}</td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/80">${o.size.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/60">{o.leverage}x</td>
                          <td className="py-1.5 px-3">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 ${
                              o.status === "filled" ? "text-[#34d399] bg-[#34d399]/10" :
                              o.status === "open" ? "text-blue-400 bg-blue-400/10" :
                              o.status === "cancelled" ? "text-white/30 bg-white/[0.03]" :
                              "text-[#f87171] bg-[#f87171]/10"
                            }`}>
                              {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {bottomTab === "orderHistory" && (
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-white/30 uppercase tracking-wider">
                      <th className="text-left py-1.5 px-3 font-medium">Time</th>
                      <th className="text-left py-1.5 px-3 font-medium">Token</th>
                      <th className="text-left py-1.5 px-3 font-medium">Side</th>
                      <th className="text-left py-1.5 px-3 font-medium">Type</th>
                      <th className="text-right py-1.5 px-3 font-medium">Size</th>
                      <th className="text-right py-1.5 px-3 font-medium">Price</th>
                      <th className="text-left py-1.5 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-white/20">
                          No order history
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="border-t border-white/[0.03] hover:bg-white/[0.02] text-xs">
                          <td className="py-1.5 px-3 font-[family-name:var(--font-mono)] text-white/40 text-[10px] whitespace-nowrap">
                            {new Date(o.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-1.5 px-3 font-medium text-white">{o.pair}</td>
                          <td className="py-1.5 px-3">
                            <span className={`font-medium ${o.side === "long" ? "text-[#34d399]" : "text-[#f87171]"}`}>
                              {o.side === "long" ? "Long" : "Short"}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-white/60 capitalize">{o.orderType}</td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/80">${o.size.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right font-[family-name:var(--font-mono)] text-white/80">
                            {o.limitPrice ? `$${fmtPrice(o.limitPrice)}` : "Market"}
                          </td>
                          <td className="py-1.5 px-3">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 ${
                              o.status === "filled" ? "text-[#34d399] bg-[#34d399]/10" :
                              o.status === "open" ? "text-blue-400 bg-blue-400/10" :
                              o.status === "cancelled" ? "text-white/30 bg-white/[0.03]" :
                              "text-[#f87171] bg-[#f87171]/10"
                            }`}>
                              {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ── Order Book (center ~20%) ──────────────────────────────────── */}
        <div className="w-[240px] shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] shrink-0">
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Order Book</span>
            <div className="flex items-center gap-1">
              {/* Toggle icons (decorative) */}
              <button className="p-0.5 text-white/20 hover:text-white/40">
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="1" y="1" width="10" height="4" rx="0.5" opacity="0.4" />
                  <rect x="1" y="7" width="10" height="4" rx="0.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center px-3 py-1 text-[10px] text-white/20 uppercase tracking-wider shrink-0">
            <span className="flex-1 text-left">Price</span>
            <span className="w-16 text-right">Size</span>
            <span className="w-16 text-right">Total</span>
          </div>

          {/* Asks (red) — top half */}
          <div className="flex-1 flex flex-col justify-end overflow-hidden px-0">
            {orderBook.asks.map((ask, i) => (
              <div key={`ask-${i}`} className="relative flex items-center px-3 py-[2px] text-xs">
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 right-0 bg-[#f87171]/[0.06]"
                  style={{ width: `${(ask.total / maxAskTotal) * 100}%` }}
                />
                <span className="relative flex-1 text-left font-[family-name:var(--font-mono)] text-[#f87171]">
                  {fmtPrice(ask.price)}
                </span>
                <span className="relative w-16 text-right font-[family-name:var(--font-mono)] text-white/50">
                  {fmtUsd(ask.size).replace("$", "")}
                </span>
                <span className="relative w-16 text-right font-[family-name:var(--font-mono)] text-white/30">
                  {fmtUsd(ask.total).replace("$", "")}
                </span>
              </div>
            ))}
          </div>

          {/* Spread / mid price */}
          <div className="flex items-center justify-center px-3 py-1.5 border-y border-white/[0.04] shrink-0">
            <span className={`font-[family-name:var(--font-mono)] text-sm font-bold ${currentSymbol.change >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
              ${fmtPrice(currentSymbol.price)}
            </span>
            <span className="ml-2 text-[10px] text-white/20">
              Spread {((orderBook.asks[orderBook.asks.length - 1]?.price ?? 0) - (orderBook.bids[0]?.price ?? 0)).toFixed(4)}
            </span>
          </div>

          {/* Bids (green) — bottom half */}
          <div className="flex-1 flex flex-col justify-start overflow-hidden px-0">
            {orderBook.bids.map((bid, i) => (
              <div key={`bid-${i}`} className="relative flex items-center px-3 py-[2px] text-xs">
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 right-0 bg-[#34d399]/[0.06]"
                  style={{ width: `${(bid.total / maxBidTotal) * 100}%` }}
                />
                <span className="relative flex-1 text-left font-[family-name:var(--font-mono)] text-[#34d399]">
                  {fmtPrice(bid.price)}
                </span>
                <span className="relative w-16 text-right font-[family-name:var(--font-mono)] text-white/50">
                  {fmtUsd(bid.size).replace("$", "")}
                </span>
                <span className="relative w-16 text-right font-[family-name:var(--font-mono)] text-white/30">
                  {fmtUsd(bid.total).replace("$", "")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Column (Order Form + Account) ───────────────────────── */}
        <div className="w-[280px] shrink-0 flex flex-col overflow-y-auto">
          {/* Order Form */}
          <div className="flex flex-col p-0">
            {/* Buy / Sell tabs */}
            <div className="grid grid-cols-2 shrink-0">
              <button
                onClick={() => setSide("long")}
                className={`py-2.5 text-xs font-semibold transition-colors ${
                  side === "long"
                    ? "bg-[#34d399]/10 text-[#34d399] border-b-2 border-[#34d399]"
                    : "bg-white/[0.02] text-white/30 border-b-2 border-transparent hover:text-white/50"
                }`}
              >
                Buy / Long
              </button>
              <button
                onClick={() => setSide("short")}
                className={`py-2.5 text-xs font-semibold transition-colors ${
                  side === "short"
                    ? "bg-[#f87171]/10 text-[#f87171] border-b-2 border-[#f87171]"
                    : "bg-white/[0.02] text-white/30 border-b-2 border-transparent hover:text-white/50"
                }`}
              >
                Sell / Short
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="px-3 py-3 space-y-3">
              {/* Order type selector */}
              <div className="flex items-center gap-0 bg-white/[0.03] p-0.5">
                {(["market", "limit"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                      orderType === t
                        ? "bg-white/[0.06] text-white"
                        : "text-white/30 hover:text-white/50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Price input (limit only) */}
              {orderType === "limit" && (
                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1">Price (USD)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={limitPriceInput}
                      onChange={(e) => setLimitPriceInput(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-xs font-[family-name:var(--font-mono)] text-white placeholder:text-white/10 focus:outline-none focus:border-white/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/20">USD</span>
                  </div>
                </div>
              )}

              {/* Amount input */}
              <div>
                <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1">Amount (USD)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-xs font-[family-name:var(--font-mono)] text-white placeholder:text-white/10 focus:outline-none focus:border-white/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/20">USD</span>
                </div>
              </div>

              {/* Percentage buttons */}
              <div className="grid grid-cols-4 gap-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setSizeInput(((idleBalance * pct) / 100).toFixed(2))}
                    className="py-1 text-[10px] font-medium bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Leverage input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider">Leverage</label>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-white/60">{leverageInput}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={leverageInput}
                  onChange={(e) => setLeverageInput(e.target.value)}
                  className="w-full h-1 bg-white/[0.06] appearance-none cursor-pointer accent-emerald-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400"
                />
                <div className="flex justify-between mt-0.5">
                  {[1, 5, 10, 25, 50].map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setLeverageInput(String(lv))}
                      className={`text-[9px] font-[family-name:var(--font-mono)] transition-colors ${
                        leverageInput === String(lv) ? "text-emerald-400" : "text-white/20 hover:text-white/40"
                      }`}
                    >
                      {lv}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Reduce Only toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Reduce Only</span>
                <button
                  type="button"
                  onClick={() => setReduceOnly(!reduceOnly)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    reduceOnly ? "bg-emerald-400" : "bg-white/[0.06]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      reduceOnly ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </div>

              {/* TP / SL */}
              <div className="border-t border-white/[0.04] pt-3">
                <span className="block text-[10px] text-white/30 uppercase tracking-wider mb-2">Take Profit / Stop Loss</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-[#34d399]/50 mb-0.5">TP Price</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="--"
                      value={tpInput}
                      onChange={(e) => setTpInput(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 text-[11px] font-[family-name:var(--font-mono)] text-white placeholder:text-white/10 focus:outline-none focus:border-[#34d399]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-[#f87171]/50 mb-0.5">SL Price</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="--"
                      value={slInput}
                      onChange={(e) => setSlInput(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 text-[11px] font-[family-name:var(--font-mono)] text-white placeholder:text-white/10 focus:outline-none focus:border-[#f87171]/30"
                    />
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting || !sizeInput || !leverageInput}
                className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  side === "long"
                    ? "bg-[#34d399] text-[#06090f] hover:bg-[#34d399]/90"
                    : "bg-[#f87171] text-white hover:bg-[#f87171]/90"
                }`}
              >
                {isSubmitting
                  ? "Submitting..."
                  : side === "long"
                    ? `Buy / Long ${currentSymbol.symbol}`
                    : `Sell / Short ${currentSymbol.symbol}`}
              </button>
            </form>
          </div>

          {/* ── Account Info ───────────────────────────────────────────── */}
          <div className="border-t border-white/[0.06] px-3 py-3 mt-auto">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Account</div>
            <div className="space-y-1.5">
              {[
                { label: "Account Equity", value: `$${accountEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-white" },
                { label: "Idle Balance", value: `$${idleBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-white/60" },
                { label: "Unrealized PnL", value: fmtPnl(totalUnrealizedPnl), color: totalUnrealizedPnl >= 0 ? "text-[#34d399]" : "text-[#f87171]" },
                { label: "Total Fees", value: "$0.00", color: "text-white/40" },
                { label: "Margin Used", value: `$${totalMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-white/40" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30">{row.label}</span>
                  <span className={`font-[family-name:var(--font-mono)] text-xs ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
