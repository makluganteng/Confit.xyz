"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ChallengeStatus = "ACTIVE" | "PASSED" | "FAILED";

export interface ChallengeCardProps {
  tier: string;
  status: ChallengeStatus;
  equity: number;
  pnlPercent: number;
  profitTargetPercent: number;
  daysRemaining: number;
}

function statusVariant(
  status: ChallengeStatus
): "default" | "secondary" | "destructive" {
  if (status === "PASSED") return "secondary";
  if (status === "FAILED") return "destructive";
  return "default";
}

function statusLabel(status: ChallengeStatus): string {
  if (status === "PASSED") return "Passed";
  if (status === "FAILED") return "Failed";
  return "Active";
}

export function ChallengeCard({
  tier,
  status,
  equity,
  pnlPercent,
  profitTargetPercent,
  daysRemaining,
}: ChallengeCardProps) {
  const pnlPositive = pnlPercent >= 0;

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{tier}</CardTitle>
          <Badge
            variant={statusVariant(status)}
            className={
              status === "PASSED"
                ? "bg-green-600 text-white border-0"
                : undefined
            }
          >
            {statusLabel(status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide">
            Equity
          </p>
          <p className="text-2xl font-bold text-white">
            ${equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wide">
              PnL
            </p>
            <p
              className={`text-lg font-semibold ${
                pnlPositive ? "text-green-400" : "text-red-400"
              }`}
            >
              {pnlPositive ? "+" : ""}
              {pnlPercent.toFixed(2)}%
            </p>
          </div>

          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wide">
              Profit Target
            </p>
            <p className="text-lg font-semibold text-white">
              {profitTargetPercent.toFixed(2)}%
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide">
            Days Remaining
          </p>
          <p className="text-lg font-semibold text-white">
            {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
