"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface Position {
  id: string;
  pair: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
}

interface PositionsTableProps {
  positions: Position[];
  onClose: (id: string) => Promise<void>;
}

export function PositionsTable({ positions, onClose }: PositionsTableProps) {
  const [closingId, setClosingId] = useState<string | null>(null);

  async function handleClose(id: string) {
    setClosingId(id);
    try {
      await onClose(id);
    } finally {
      setClosingId(null);
    }
  }

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
        No open positions
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableHead className="text-zinc-400">Pair</TableHead>
          <TableHead className="text-zinc-400">Side</TableHead>
          <TableHead className="text-zinc-400 text-right">Size</TableHead>
          <TableHead className="text-zinc-400 text-right">Entry Price</TableHead>
          <TableHead className="text-zinc-400 text-right">Current Price</TableHead>
          <TableHead className="text-zinc-400 text-right">PnL</TableHead>
          <TableHead className="text-zinc-400 text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((pos) => (
          <TableRow key={pos.id} className="border-zinc-800 hover:bg-zinc-800/50">
            <TableCell className="font-medium text-zinc-100">{pos.pair}</TableCell>
            <TableCell>
              <Badge
                className={
                  pos.side === "long"
                    ? "bg-green-600/20 text-green-400 border-green-700"
                    : "bg-red-600/20 text-red-400 border-red-700"
                }
                variant="outline"
              >
                {pos.side === "long" ? "Long" : "Short"}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-zinc-100">
              ${pos.size.toLocaleString()}
            </TableCell>
            <TableCell className="text-right text-zinc-100">
              ${pos.entryPrice.toLocaleString()}
            </TableCell>
            <TableCell className="text-right text-zinc-100">
              ${pos.currentPrice.toLocaleString()}
            </TableCell>
            <TableCell
              className={`text-right font-semibold ${
                pos.pnl >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {pos.pnl >= 0 ? "+" : ""}
              {pos.pnl >= 0
                ? `$${pos.pnl.toFixed(2)}`
                : `-$${Math.abs(pos.pnl).toFixed(2)}`}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="outline"
                disabled={closingId === pos.id}
                onClick={() => handleClose(pos.id)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              >
                {closingId === pos.id ? "Closing…" : "Close"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
