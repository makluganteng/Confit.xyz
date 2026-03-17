"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderForm, type OrderFormData } from "@/components/order-form";
import { PositionsTable, type Position } from "@/components/positions-table";
import { TradeHistory, type Order } from "@/components/trade-history";

// MVP: empty arrays — will be wired to API in Task 15
const POSITIONS: Position[] = [];
const ORDERS: Order[] = [];

export default function TradePage() {
  const { ready, authenticated } = usePrivy();

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-zinc-500 text-sm">Please connect your wallet to trade.</p>
      </div>
    );
  }

  async function handleOrderSubmit(order: OrderFormData): Promise<void> {
    // TODO (Task 15): wire to POST /api/trade
    console.log("Order submitted:", order);
  }

  async function handleClosePosition(id: string): Promise<void> {
    // TODO (Task 15): wire to DELETE /api/trade/:id
    console.log("Close position:", id);
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column — Order form */}
        <div className="lg:col-span-1">
          <OrderForm onSubmit={handleOrderSubmit} />
        </div>

        {/* Right 2 columns — Chart + Positions/History */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Chart placeholder */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Price Chart
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-500">
                TradingView chart will be integrated here
              </div>
            </CardContent>
          </Card>

          {/* Positions + History tabs */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-4">
              <Tabs defaultValue="positions">
                <TabsList className="bg-zinc-800 text-zinc-400">
                  <TabsTrigger
                    value="positions"
                    className="data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
                  >
                    Open Positions
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
                  >
                    Trade History
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="positions" className="mt-4">
                  <PositionsTable
                    positions={POSITIONS}
                    onClose={handleClosePosition}
                  />
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                  <TradeHistory orders={ORDERS} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
