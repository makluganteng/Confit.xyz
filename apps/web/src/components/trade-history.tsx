"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface Order {
  id: string;
  createdAt: string | Date;
  pair: string;
  side: "long" | "short";
  type: "market" | "limit";
  size: number;
  leverage: number;
  status: "open" | "filled" | "cancelled" | "rejected";
}

interface TradeHistoryProps {
  orders: Order[];
}

const STATUS_STYLES: Record<Order["status"], string> = {
  open: "bg-blue-600/20 text-blue-400 border-blue-700",
  filled: "bg-green-600/20 text-green-400 border-green-700",
  cancelled: "bg-zinc-600/20 text-zinc-400 border-zinc-700",
  rejected: "bg-red-600/20 text-red-400 border-red-700",
};

function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TradeHistory({ orders }: TradeHistoryProps) {
  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
        No trades yet
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableHead className="text-zinc-400">Time</TableHead>
          <TableHead className="text-zinc-400">Pair</TableHead>
          <TableHead className="text-zinc-400">Side</TableHead>
          <TableHead className="text-zinc-400">Type</TableHead>
          <TableHead className="text-zinc-400 text-right">Size</TableHead>
          <TableHead className="text-zinc-400 text-right">Leverage</TableHead>
          <TableHead className="text-zinc-400">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id} className="border-zinc-800 hover:bg-zinc-800/50">
            <TableCell className="text-zinc-400 text-sm whitespace-nowrap">
              {formatDate(order.createdAt)}
            </TableCell>
            <TableCell className="font-medium text-zinc-100">{order.pair}</TableCell>
            <TableCell>
              <Badge
                className={
                  order.side === "long"
                    ? "bg-green-600/20 text-green-400 border-green-700"
                    : "bg-red-600/20 text-red-400 border-red-700"
                }
                variant="outline"
              >
                {order.side === "long" ? "Long" : "Short"}
              </Badge>
            </TableCell>
            <TableCell className="capitalize text-zinc-300">{order.type}</TableCell>
            <TableCell className="text-right text-zinc-100">
              ${order.size.toLocaleString()}
            </TableCell>
            <TableCell className="text-right text-zinc-300">{order.leverage}×</TableCell>
            <TableCell>
              <Badge
                className={STATUS_STYLES[order.status]}
                variant="outline"
              >
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
