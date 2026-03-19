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
  profitSplitPct: string;
  expiresAt: string;
  createdAt: string;
}

interface PacificaAccount {
  accountEquity: string;
  balance: string;
  availableToSpend: string;
  totalMarginUsed: string;
  positionsCount: number;
}

interface PacificaPosition {
  symbol: string;
  pair: string;
  side: string;
  amount: string;
  entryPrice: string;
  liquidationPrice: string;
  funding: string;
}

export default function DashboardPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [selectedTier, setSelectedTier] = useState<Tier>("STARTER");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [pacAccount, setPacAccount] = useState<PacificaAccount | null>(null);
  const [pacPositions, setPacPositions] = useState<PacificaPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      // Fetch challenge + Pacifica account in parallel
      const [challengeRes, pacRes] = await Promise.all([
        fetch("/api/challenge/active", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/trade/pacifica-account", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (challengeRes.ok) {
        const data = await challengeRes.json();
        setChallenge(data.challenge);
      } else {
        setChallenge(null);
      }

      if (pacRes.ok) {
        const pacData = await pacRes.json();
        if (pacData.account) setPacAccount(pacData.account);
        if (pacData.positions) setPacPositions(pacData.positions);
      }
    } catch {
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated) fetchData();
    else setLoading(false);
  }, [authenticated, fetchData]);

  // Poll every 10s when challenge is active
  useEffect(() => {
    if (!authenticated || !challenge) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [authenticated, challenge, fetchData]);

  const enterChallenge = async () => {
    setEntering(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");

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

      await fetchData();
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

  // Compute real values from Pacifica
  const startingCapital = challenge ? Number(challenge.startingCapital) : 0;
  const realEquity = pacAccount ? parseFloat(pacAccount.accountEquity) : startingCapital;
  const pnl = realEquity - startingCapital;
  const pnlPercent = startingCapital > 0 ? (pnl / startingCapital) * 100 : 0;
  const profitTarget = challenge ? Number(challenge.profitTargetPct) * 100 : 8;

  // Drawdown = (peak - current) / peak. For simplicity, peak = startingCapital
  const drawdownPct = startingCapital > 0
    ? Math.max(0, ((startingCapital - realEquity) / startingCapital) * 100)
    : 0;

  // Daily loss — approximate from current session PnL
  const dailyLossPct = pnl < 0 ? Math.abs(pnlPercent) : 0;

  const maxDrawdownLimit = challenge?.tier === "PRO" ? 10 : 10;
  const dailyLossLimit = 5;

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
              This takes ~30 seconds. We&apos;re generating a wallet, depositing funds to Pacifica, and setting up your trading account.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top row: Challenge card + Risk metrics */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ChallengeCard
              tier={challenge.tier}
              status={challenge.status as "ACTIVE" | "PASSED" | "FAILED"}
              equity={realEquity}
              pnlPercent={pnlPercent}
              profitTargetPercent={profitTarget}
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
                current: drawdownPct,
                limit: maxDrawdownLimit,
              }}
              dailyLoss={{
                label: "Daily Loss",
                current: dailyLossPct,
                limit: dailyLossLimit,
              }}
            />
          </div>

          {/* Account details from Pacifica */}
          {pacAccount && (
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Account Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Account Equity", value: `$${parseFloat(pacAccount.accountEquity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                  { label: "Balance", value: `$${parseFloat(pacAccount.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                  { label: "Available", value: `$${parseFloat(pacAccount.availableToSpend).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                  { label: "Margin Used", value: `$${parseFloat(pacAccount.totalMarginUsed).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px] text-[#6b7894] uppercase tracking-wider">{item.label}</p>
                    <p className="font-[family-name:var(--font-mono)] text-sm text-white mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open positions from Pacifica */}
          {pacPositions.length > 0 && (
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                Open Positions ({pacPositions.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-[#6b7894] uppercase tracking-wider">
                      <th className="text-left py-2 pr-4 font-medium">Symbol</th>
                      <th className="text-left py-2 pr-4 font-medium">Side</th>
                      <th className="text-right py-2 pr-4 font-medium">Amount</th>
                      <th className="text-right py-2 pr-4 font-medium">Entry Price</th>
                      <th className="text-right py-2 pr-4 font-medium">Liq Price</th>
                      <th className="text-right py-2 font-medium">Funding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacPositions.map((pos, i) => (
                      <tr key={i} className="border-t border-white/[0.04]">
                        <td className="py-2 pr-4 font-medium text-white">{pos.pair}</td>
                        <td className="py-2 pr-4">
                          <span className={`font-medium ${pos.side === "LONG" ? "text-[#34d399]" : "text-[#f87171]"}`}>
                            {pos.side === "LONG" ? "Long" : "Short"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right font-[family-name:var(--font-mono)] text-white/80">
                          {parseFloat(pos.amount).toFixed(6)}
                        </td>
                        <td className="py-2 pr-4 text-right font-[family-name:var(--font-mono)] text-white/80">
                          ${parseFloat(pos.entryPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 pr-4 text-right font-[family-name:var(--font-mono)] text-white/40">
                          ${parseFloat(pos.liquidationPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2 text-right font-[family-name:var(--font-mono)] ${parseFloat(pos.funding) >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
                          ${parseFloat(pos.funding).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Challenge info */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Challenge Info</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Tier", value: challenge.tier },
                { label: "Starting Capital", value: `$${Number(challenge.startingCapital).toLocaleString()}` },
                { label: "Profit Target", value: `${profitTarget}%` },
                { label: "Profit Split", value: `${Number(challenge.profitSplitPct) * 100}%` },
                { label: "Started", value: new Date(challenge.createdAt).toLocaleDateString() },
                { label: "Expires", value: new Date(challenge.expiresAt).toLocaleDateString() },
                { label: "Realized PnL", value: `$${Number(challenge.realizedPnl).toFixed(2)}` },
                { label: "Wallet", value: challenge.walletPublicKey ? `${challenge.walletPublicKey.slice(0, 6)}...${challenge.walletPublicKey.slice(-4)}` : "--" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] text-[#6b7894] uppercase tracking-wider">{item.label}</p>
                  <p className="font-[family-name:var(--font-mono)] text-sm text-white/80 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
