"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type OrderSide = "long" | "short";
export type OrderType = "market" | "limit";

export interface OrderFormData {
  pair: string;
  side: OrderSide;
  type: OrderType;
  size: number;
  leverage: number;
  limitPrice?: number;
}

interface OrderFormProps {
  onSubmit: (order: OrderFormData) => Promise<void>;
}

export function OrderForm({ onSubmit }: OrderFormProps) {
  const [side, setSide] = useState<OrderSide>("long");
  const [pair, setPair] = useState("SOL-PERP");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!size || !leverage) return;

    const order: OrderFormData = {
      pair,
      side,
      type: orderType,
      size: parseFloat(size),
      leverage: parseFloat(leverage),
      ...(orderType === "limit" && limitPrice
        ? { limitPrice: parseFloat(limitPrice) }
        : {}),
    };

    setIsSubmitting(true);
    try {
      await onSubmit(order);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-100">
          Place Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Long / Short toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-800 p-1">
            <button
              type="button"
              onClick={() => setSide("long")}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                side === "long"
                  ? "bg-green-600 text-white"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              Long
            </button>
            <button
              type="button"
              onClick={() => setSide("short")}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                side === "short"
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              Short
            </button>
          </div>

          {/* Pair selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Pair</Label>
            <Select value={pair} onValueChange={(v) => v !== null && setPair(v)}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="SOL-PERP">SOL-PERP</SelectItem>
                <SelectItem value="BTC-PERP">BTC-PERP</SelectItem>
                <SelectItem value="ETH-PERP">ETH-PERP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Order type */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Order Type</Label>
            <Select
              value={orderType}
              onValueChange={(v) => setOrderType(v as OrderType)}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <Label htmlFor="size" className="text-xs text-zinc-400">
              Size (USD)
            </Label>
            <Input
              id="size"
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Leverage */}
          <div className="space-y-1.5">
            <Label htmlFor="leverage" className="text-xs text-zinc-400">
              Leverage (×)
            </Label>
            <Input
              id="leverage"
              type="number"
              min="1"
              max="50"
              step="1"
              placeholder="1"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Limit price — only shown for limit orders */}
          {orderType === "limit" && (
            <div className="space-y-1.5">
              <Label htmlFor="limitPrice" className="text-xs text-zinc-400">
                Limit Price (USD)
              </Label>
              <Input
                id="limitPrice"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSubmitting || !size || !leverage}
            className={`w-full font-semibold transition-colors ${
              side === "long"
                ? "bg-green-600 hover:bg-green-700 text-white disabled:bg-green-900"
                : "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-900"
            }`}
          >
            {isSubmitting
              ? "Submitting…"
              : `${side === "long" ? "Long" : "Short"} ${pair}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
