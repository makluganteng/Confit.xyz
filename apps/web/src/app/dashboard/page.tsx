"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChallengeCard } from "@/components/challenge-card";
import { RiskMetrics } from "@/components/risk-metrics";

type Tier = "STARTER" | "PRO";

interface Challenge {
  id: string;
  tier: string;
  status: string;
  walletPublicKey: string | null;
  startingCapital: string;
  currentEquity: string;
  realizedPnl: string;
  profitTargetPct: string;
  expiresAt: string;
  createdAt: string;
  riskSnapshots?: { drawdownPct: string; dailyLossPct: string }[];
}

export default function DashboardPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [selectedTier, setSelectedTier] = useState<Tier>("STARTER");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenge = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      // Fetch user's active challenge
      const res = await fetch("/api/challenge/active", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setChallenge(data.challenge);
      } else {
        setChallenge(null);
      }
    } catch {
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated) fetchChallenge();
    else setLoading(false);
  }, [authenticated, fetchChallenge]);

  const enterChallenge = async () => {
    setEntering(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");

      // For MVP, we pass a dummy txSignature — entry fee payment will be wired later
      const res = await fetch("/api/challenge/enter", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tier: selectedTier,
          txSignature: "testnet-skip",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to enter challenge");
        return;
      }

      // Refresh challenge data
      await fetchChallenge();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setEntering(false);
    }
  };

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-[#6b7894]">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-[#6b7894]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-white">Dashboard</h1>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!challenge ? (
        <div className="glass-card flex flex-col items-start gap-6 rounded-xl p-8">
          <div>
            <h2 className="text-xl font-semibold text-white">Start a Challenge</h2>
            <p className="mt-1 text-sm text-[#6b7894]">
              Choose a tier and enter a funded trading challenge on Pacifica.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select
              value={selectedTier}
              onValueChange={(v) => v && setSelectedTier(v as Tier)}
            >
              <SelectTrigger className="w-48 border-white/10 bg-white/[0.03]">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STARTER">Starter — $50 → $5K</SelectItem>
                <SelectItem value="PRO">Pro — $100 → $10K</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={enterChallenge}
              disabled={entering}
              className="glow-btn border-0 text-[#06090f] font-semibold"
            >
              {entering ? "Setting up wallet..." : "Enter Challenge"}
            </Button>
          </div>

          {entering && (
            <p className="text-xs text-[#6b7894]">
              This takes ~30 seconds. We're generating a wallet, depositing funds to Pacifica, and setting up your trading account.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ChallengeCard
            tier={challenge.tier}
            status={challenge.status as "ACTIVE" | "PASSED" | "FAILED"}
            equity={Number(challenge.currentEquity)}
            pnlPercent={
              ((Number(challenge.currentEquity) - Number(challenge.startingCapital)) /
                Number(challenge.startingCapital)) *
              100
            }
            profitTargetPercent={Number(challenge.profitTargetPct) * 100}
            daysRemaining={Math.max(
              0,
              Math.ceil(
                (new Date(challenge.expiresAt).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            )}
          />
          <RiskMetrics
            drawdown={{
              label: "Max Drawdown",
              current: Number(challenge.riskSnapshots?.[0]?.drawdownPct ?? 0) * 100,
              limit: challenge.tier === "STARTER" ? 10 : 10,
            }}
            dailyLoss={{
              label: "Daily Loss",
              current: Number(challenge.riskSnapshots?.[0]?.dailyLossPct ?? 0) * 100,
              limit: 5,
            }}
          />

          {challenge.walletPublicKey && (
            <div className="glass-card col-span-full rounded-xl p-4">
              <p className="text-xs text-[#6b7894]">
                Challenge wallet:{" "}
                <span className="font-[family-name:var(--font-mono)] text-white/60">
                  {challenge.walletPublicKey}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
