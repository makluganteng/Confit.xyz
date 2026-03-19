"use client";

import { useEffect, useRef, useState } from "react";

export interface SymbolPrice {
  symbol: string;
  mark: number;
  mid: number;
  oracle: number;
  funding: number;
  nextFunding: number;
  openInterest: number;
  volume24h: number;
  yesterdayPrice: number;
}

/**
 * Subscribes to Pacifica's `prices` WebSocket channel.
 * Returns a Map of all symbol prices, updated in real-time.
 */
export function usePacificaWs() {
  const [prices, setPrices] = useState<Map<string, SymbolPrice>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let ws: WebSocket;
    let pingInterval: ReturnType<typeof setInterval>;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      if (dead) return;
      try {
        ws = new WebSocket("wss://test-ws.pacifica.fi/ws");
        wsRef.current = ws;
      } catch {
        return;
      }

      ws.onopen = () => {
        setConnected(true);
        // Subscribe to prices — returns all symbols with mark, mid, oracle, funding, volume
        ws.send(JSON.stringify({ method: "subscribe", params: { source: "prices" } }));
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: "ping" }));
          }
        }, 30_000);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.channel === "prices" && Array.isArray(msg.data)) {
            setPrices((prev) => {
              const next = new Map(prev);
              for (const item of msg.data) {
                next.set(item.symbol, {
                  symbol: item.symbol,
                  mark: parseFloat(item.mark),
                  mid: parseFloat(item.mid),
                  oracle: parseFloat(item.oracle),
                  funding: parseFloat(item.funding),
                  nextFunding: parseFloat(item.next_funding),
                  openInterest: parseFloat(item.open_interest),
                  volume24h: parseFloat(item.volume_24h),
                  yesterdayPrice: parseFloat(item.yesterday_price),
                });
              }
              return next;
            });
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setConnected(false);
        clearInterval(pingInterval);
        if (!dead) reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      dead = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return { prices, connected };
}
