import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  tier: string;
  pnl: number;
  returnPct: number;
  status: string;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

function tierVariant(tier: string): string {
  if (tier === "PRO") return "bg-purple-600/20 text-purple-400 border-purple-700";
  return "bg-emerald-600/20 text-emerald-400 border-emerald-700";
}

function statusVariant(status: string): string {
  if (status === "PASSED") return "bg-green-600/20 text-green-400 border-green-700";
  if (status === "FAILED") return "bg-red-600/20 text-red-400 border-red-700";
  return "bg-blue-600/20 text-blue-400 border-blue-700";
}

function statusLabel(status: string): string {
  if (status === "PASSED") return "Passed";
  if (status === "FAILED") return "Failed";
  return "Active";
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
        No active challenges yet
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableHead className="text-zinc-400 w-16">Rank</TableHead>
          <TableHead className="text-zinc-400">Trader</TableHead>
          <TableHead className="text-zinc-400">Tier</TableHead>
          <TableHead className="text-zinc-400 text-right">PnL</TableHead>
          <TableHead className="text-zinc-400 text-right">Return</TableHead>
          <TableHead className="text-zinc-400 text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.rank} className="border-zinc-800 hover:bg-zinc-800/50">
            <TableCell className="text-zinc-400 font-medium">
              #{entry.rank}
            </TableCell>
            <TableCell className="font-mono text-zinc-100">
              {entry.walletAddress}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={tierVariant(entry.tier)}>
                {entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()}
              </Badge>
            </TableCell>
            <TableCell
              className={`text-right font-semibold ${
                entry.pnl >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {entry.pnl >= 0 ? "+" : ""}
              {entry.pnl >= 0
                ? `$${entry.pnl.toFixed(2)}`
                : `-$${Math.abs(entry.pnl).toFixed(2)}`}
            </TableCell>
            <TableCell
              className={`text-right font-semibold ${
                entry.returnPct >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {entry.returnPct >= 0 ? "+" : ""}
              {entry.returnPct.toFixed(2)}%
            </TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className={statusVariant(entry.status)}>
                {statusLabel(entry.status)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
