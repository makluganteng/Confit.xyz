"use client";

import { useEffect, useRef, useState } from "react";

interface TradingChartProps {
  symbol: string;
  basePrice: number;
  timeframe?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CandleSeries = any;

const TF_MAP: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1d",
};

const TF_LOOKBACK_MS: Record<string, number> = {
  "1m": 4 * 60 * 60 * 1000,
  "5m": 12 * 60 * 60 * 1000,
  "15m": 2 * 24 * 60 * 60 * 1000,
  "1H": 7 * 24 * 60 * 60 * 1000,
  "4H": 30 * 24 * 60 * 60 * 1000,
  "1D": 90 * 24 * 60 * 60 * 1000,
  "1W": 365 * 24 * 60 * 60 * 1000,
};

const PACIFICA_API = "https://test-api.pacifica.fi/api/v1";

export default function TradingChart({ symbol, timeframe = "15m" }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);
  const candleSeriesRef = useRef<CandleSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const outer = containerRef.current;
    if (!outer) return;

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    let ro: ResizeObserver | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    // Create a dedicated wrapper div for the chart — avoids React DOM conflicts
    const wrapper = document.createElement("div");
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    outer.appendChild(wrapper);
    chartWrapperRef.current = wrapper;

    async function init() {
      const lc = await import("lightweight-charts");
      if (cancelled) return;

      const interval = TF_MAP[timeframe] ?? "15m";
      const lookback = TF_LOOKBACK_MS[timeframe] ?? 2 * 24 * 60 * 60 * 1000;
      const startTime = Date.now() - lookback;

      try {
        const url = `${PACIFICA_API}/kline?symbol=${symbol}&interval=${interval}&start_time=${startTime}`;
        const res = await fetch(url);
        const json = await res.json();

        if (cancelled) return;

        if (!json.success || !json.data?.length) {
          setError("No chart data available");
          setLoading(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candles = json.data.map((c: any) => ({
          time: Math.floor(c.t / 1000),
          open: parseFloat(c.o),
          high: parseFloat(c.h),
          low: parseFloat(c.l),
          close: parseFloat(c.c),
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const volumes = json.data.map((c: any) => ({
          time: Math.floor(c.t / 1000),
          value: parseFloat(c.v),
          color:
            parseFloat(c.c) >= parseFloat(c.o)
              ? "rgba(52, 211, 153, 0.4)"
              : "rgba(248, 113, 113, 0.4)",
        }));

        if (cancelled) return;

        chart = lc.createChart(wrapper, {
          layout: {
            background: { color: "#06090f" },
            textColor: "rgba(255,255,255,0.35)",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
          },
          grid: {
            vertLines: { color: "rgba(255,255,255,0.03)" },
            horzLines: { color: "rgba(255,255,255,0.03)" },
          },
          crosshair: {
            mode: lc.CrosshairMode.Normal,
            vertLine: { color: "rgba(255,255,255,0.15)", labelBackgroundColor: "#0c1017" },
            horzLine: { color: "rgba(255,255,255,0.15)", labelBackgroundColor: "#0c1017" },
          },
          rightPriceScale: {
            borderColor: "rgba(255,255,255,0.06)",
            textColor: "rgba(255,255,255,0.35)",
          },
          timeScale: {
            borderColor: "rgba(255,255,255,0.06)",
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: { mouseWheel: true, pressedMouseMove: true },
          handleScale: { mouseWheel: true, pinch: true },
          width: wrapper.clientWidth,
          height: wrapper.clientHeight,
        });

        const candleSeries = chart.addSeries(lc.CandlestickSeries, {
          upColor: "#34d399",
          downColor: "#f87171",
          borderUpColor: "#34d399",
          borderDownColor: "#f87171",
          wickUpColor: "rgba(52, 211, 153, 0.6)",
          wickDownColor: "rgba(248, 113, 113, 0.6)",
          priceLineVisible: true,
          priceLineColor: "rgba(255,255,255,0.2)",
          priceLineWidth: 1,
        });

        const volumeSeries = chart.addSeries(lc.HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candleSeries.setData(candles as any[]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        volumeSeries.setData(volumes as any[]);

        chart.timeScale().fitContent();

        // Store candleSeries ref so polling can access it
        candleSeriesRef.current = candleSeries;

        ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (chart) {
              chart.applyOptions({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
              });
            }
          }
        });
        ro.observe(wrapper);

        // Poll for the latest candle every 30s and update chart
        const apiInterval = TF_MAP[timeframe] ?? "15m";
        pollInterval = setInterval(async () => {
          if (cancelled || !candleSeriesRef.current) return;
          try {
            // Fetch just the most recent candle (last 2 intervals to catch the current open bar)
            const now = Date.now();
            const tfMs: Record<string, number> = {
              "1m": 60_000, "5m": 300_000, "15m": 900_000,
              "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
            };
            const barMs = tfMs[apiInterval] ?? 900_000;
            const recentStart = now - barMs * 3;
            const pollUrl = `${PACIFICA_API}/kline?symbol=${symbol}&interval=${apiInterval}&start_time=${recentStart}`;
            const pollRes = await fetch(pollUrl);
            const pollJson = await pollRes.json();
            if (!pollJson.success || !pollJson.data?.length) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const latestRaw = pollJson.data[pollJson.data.length - 1] as any;
            const latestCandle = {
              time: Math.floor(latestRaw.t / 1000),
              open: parseFloat(latestRaw.o),
              high: parseFloat(latestRaw.h),
              low: parseFloat(latestRaw.l),
              close: parseFloat(latestRaw.c),
            };
            if (!cancelled && candleSeriesRef.current) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              candleSeriesRef.current.update(latestCandle as any);
            }
          } catch { /* ignore poll errors */ }
        }, 30_000);

        setLoading(false);
        setError(null);
      } catch (err) {
        console.error("Chart fetch error:", err);
        if (!cancelled) {
          setError("Failed to load chart");
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      candleSeriesRef.current = null;
      ro?.disconnect();
      if (chart) {
        try { chart.remove(); } catch { /* ignore */ }
        chart = null;
      }
      // Remove the wrapper div we created
      if (wrapper.parentNode === outer) {
        outer.removeChild(wrapper);
      }
      chartWrapperRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}
    >
      {(loading || error) && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/20 pointer-events-none z-10">
          {error ?? "Loading chart..."}
        </div>
      )}
    </div>
  );
}
