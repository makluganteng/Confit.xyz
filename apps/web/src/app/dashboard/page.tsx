"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChallengeCard, type ChallengeCardProps } from "@/components/challenge-card";
import { RiskMetrics, type RiskMetricsProps } from "@/components/risk-metrics";

// Placeholder static data — will be replaced with live API data in Task 15
const MOCK_CHALLENGE: ChallengeCardProps = {
  tier: "Starter",
  status: "ACTIVE",
  equity: 5_124.5,
  pnlPercent: 2.49,
  profitTargetPercent: 10.0,
  daysRemaining: 22,
};

const MOCK_RISK: RiskMetricsProps = {
  drawdown: {
    label: "Max Drawdown",
    current: 1.8,
    limit: 5.0,
  },
  dailyLoss: {
    label: "Daily Loss",
    current: 0.4,
    limit: 2.0,
  },
};

type Tier = "STARTER" | "PRO";

export default function DashboardPage() {
  const { ready, authenticated } = usePrivy();
  const [selectedTier, setSelectedTier] = useState<Tier>("STARTER");

  // Static flag for MVP — set to true to preview the "active challenge" view
  const hasActiveChallenge = false;

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-zinc-400">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-white">Dashboard</h1>

      {!hasActiveChallenge ? (
        <div className="flex flex-col items-start gap-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Start a Challenge
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Choose a tier and enter a funded trading challenge.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select
              value={selectedTier}
              onValueChange={(value) => setSelectedTier(value as Tier)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STARTER">Starter — $50</SelectItem>
                <SelectItem value="PRO">Pro — $150</SelectItem>
              </SelectContent>
            </Select>

            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
              Enter Challenge
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ChallengeCard {...MOCK_CHALLENGE} />
          <RiskMetrics {...MOCK_RISK} />
        </div>
      )}
    </div>
  );
}
