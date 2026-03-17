export interface TierConfig {
  entryFee: number;
  fundedCapital: number;
  maxDrawdownPct: number;
  dailyLossLimitPct: number;
  maxLeverage: number;
  positionSizeLimitPct: number;
  profitTargetPct: number;
  profitSplitPct: number;
  durationDays: number;
}

export const TIERS: Record<string, TierConfig> = {
  STARTER: {
    entryFee: 50,
    fundedCapital: 5000,
    maxDrawdownPct: 0.10,
    dailyLossLimitPct: 0.05,
    maxLeverage: 10,
    positionSizeLimitPct: 0.30,
    profitTargetPct: 0.08,
    profitSplitPct: 0.80,
    durationDays: 30,
  },
  PRO: {
    entryFee: 100,
    fundedCapital: 10000,
    maxDrawdownPct: 0.10,
    dailyLossLimitPct: 0.05,
    maxLeverage: 20,
    positionSizeLimitPct: 0.30,
    profitTargetPct: 0.08,
    profitSplitPct: 0.80,
    durationDays: 30,
  },
};
