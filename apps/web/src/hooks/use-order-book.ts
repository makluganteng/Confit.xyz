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
 * Fetches and polls the real Pacifica order book.
 */
export function useOrderBook(symbol: string, pollMs = 1000) {
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

        // Bids: convert amount to USD, accumulate totals
        let bidTotal = 0;
        const bids: OrderBookLevel[] = rawBids.map((b: any) => {
          const price = parseFloat(b.p);
          const amount = parseFloat(b.a);
          const sizeUsd = price * amount;
          bidTotal += sizeUsd;
          return { price, size: sizeUsd, total: bidTotal };
        });

        // Asks: convert amount to USD, accumulate totals
        // Asks come lowest first (closest to mid)
        let askTotal = 0;
        const asksRaw: OrderBookLevel[] = rawAsks.map((a: any) => {
          const price = parseFloat(a.p);
          const amount = parseFloat(a.a);
          const sizeUsd = price * amount;
          askTotal += sizeUsd;
          return { price, size: sizeUsd, total: askTotal };
        });
        // Reverse asks so highest price is at top, then recalculate totals top-down
        const asks: OrderBookLevel[] = [];
        let runningTotal = 0;
        for (let i = asksRaw.length - 1; i >= 0; i--) {
          runningTotal += asksRaw[i].size;
          asks.push({ price: asksRaw[i].price, size: asksRaw[i].size, total: runningTotal });
        }

        if (active) setBook({ asks, bids });
      } catch { /* ignore fetch errors */ }
    }

    fetchBook();
    const interval = setInterval(fetchBook, pollMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [symbol, pollMs]);

  return book;
}
