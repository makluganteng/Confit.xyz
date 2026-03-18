"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderForm, type OrderFormData } from "@/components/order-form";
import { PositionsTable, type Position } from "@/components/positions-table";
import { TradeHistory, type Order } from "@/components/trade-history";

export default function TradePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      // Get active challenge
      const challengeRes = await fetch("/api/challenge/active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (challengeRes.ok) {
        const { challenge } = await challengeRes.json();
        if (challenge) {
          setChallengeId(challenge.id);

          // Fetch positions and history
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

  // Poll for updates every 5 seconds
  useEffect(() => {
    if (!authenticated || !challengeId) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [authenticated, challengeId, fetchData]);

  async function handleOrderSubmit(order: OrderFormData): Promise<void> {
    setError(null);
    const token = await getAccessToken();
    if (!token || !challengeId) return;

    const res = await fetch("/api/trade/order", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        challengeId,
        pair: order.pair,
        side: order.side,
        size: order.size,
        leverage: order.leverage,
        orderType: order.type,
        limitPrice: order.limitPrice,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Order failed");
      return;
    }

    // Refresh data
    await fetchData();
  }

  async function handleClosePosition(id: string): Promise<void> {
    const token = await getAccessToken();
    if (!token) return;

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
  }

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-[#6b7894]">Please sign in to trade.</p>
      </div>
    );
  }

  if (!challengeId) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-[#6b7894]">No active challenge found.</p>
          <a href="/dashboard" className="mt-2 block text-sm text-emerald-400 hover:underline">
            Go to Dashboard to start one
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">
            x
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Order Form */}
        <div className="lg:col-span-1">
          <OrderForm onSubmit={handleOrderSubmit} />
        </div>

        {/* Chart + Positions/History */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="glass-card border-white/[0.06]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white/80">Price Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-[#6b7894]">
                TradingView chart integration coming soon
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/[0.06]">
            <CardContent className="pt-4">
              <Tabs defaultValue="positions">
                <TabsList className="bg-white/[0.04]">
                  <TabsTrigger
                    value="positions"
                    className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white"
                  >
                    Positions ({positions.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white"
                  >
                    History ({orders.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="positions" className="mt-4">
                  <PositionsTable positions={positions} onClose={handleClosePosition} />
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                  <TradeHistory orders={orders} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
