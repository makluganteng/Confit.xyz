"use client";

import { useState, useEffect } from "react";

const PACIFICA_API = "https://test-api.pacifica.fi/api/v1";

export interface OrderBookLevel {
  price: number;
  size: number;   // size in USD (price * amount)
  total: number;  // cumulative USD
}

export interface OrderBookData {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
}

/**
 * Aggregate raw order book levels by a given tick size.
 * For bids (descending): floor each price to the nearest tick bucket.
 * For asks (ascending): ceil each price to the nearest tick bucket.
 */
function aggregateLevels(
  levels: { price: number; size: number }[],
  tickSize: number,
  side: "bid" | "ask"
): OrderBookLevel[] {
  const buckets = new Map<number, number>();

  for (const { price, size } of levels) {
    // Round bid prices DOWN to the nearest tick, ask prices UP
    const bucket =
      side === "bid"
        ? Math.floor(price / tickSize) * tickSize
        : Math.ceil(price / tickSize) * tickSize;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + size);
  }

  // Sort: bids descending (highest first), asks ascending (lowest first)
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) =>
    side === "bid" ? b - a : a - b
  );

  let running = 0;
  return sorted.map(([price, size]) => {
    running += size;
    return { price, size, total: running };
  });
}

/**
 * Fetches and polls the real Pacifica order book.
 * Aggregates levels by the given tickSize.
 */
export function useOrderBook(symbol: string, pollMs = 1000, tickSize = 0.05) {
  const [book, setBook] = useState<OrderBookData>({ asks: [], bids: [] });

  useEffect(() => {
    let active = true;

    async function fetchBook() {
      try {
        const res = await fetch(`${PACIFICA_API}/book?symbol=${symbol}`);
        const json = await res.json();

        if (!json.success || !json.data?.l) return;

        const rawBids = json.data.l[0] || [];
        const rawAsks = json.data.l[1] || [];

        // Parse raw levels
        const parsedBids = rawBids.map((b: { p: string; a: string }) => ({
          price: parseFloat(b.p),
          size: parseFloat(b.p) * parseFloat(b.a),
        }));
        const parsedAsks = rawAsks.map((a: { p: string; a: string }) => ({
          price: parseFloat(a.p),
          size: parseFloat(a.p) * parseFloat(a.a),
        }));

        // Aggregate by tick size
        const bids = aggregateLevels(parsedBids, tickSize, "bid");

        // For asks: aggregate, then reverse so highest price is at top
        const asksAscending = aggregateLevels(parsedAsks, tickSize, "ask");
        // Recalculate totals top-down after reversing
        const asksDescending: OrderBookLevel[] = [];
        let runningTotal = 0;
        for (let i = asksAscending.length - 1; i >= 0; i--) {
          runningTotal += asksAscending[i].size;
          asksDescending.push({
            price: asksAscending[i].price,
            size: asksAscending[i].size,
            total: runningTotal,
          });
        }

        if (active) setBook({ asks: asksDescending, bids });
      } catch { /* ignore fetch errors */ }
    }

    fetchBook();
    const interval = setInterval(fetchBook, pollMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [symbol, pollMs, tickSize]);

  return book;
}
