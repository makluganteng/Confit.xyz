import { TIERS } from "./config";

export interface TraderSnapshot {
  challengeId: string;
  tier: keyof typeof TIERS;
  startingCapital: number;
  currentEquity: number;
  realizedPnl: number;
  dailyPnlHistory: { timestamp: number; pnl: number }[];
  positions: {
    pair: string;
    side: string;
    size: number;
    leverage: number;
    unrealizedPnl: number;
  }[];
}

export interface RiskViolation {
  challengeId: string;
  eventType: string;
  details: Record<string, number>;
  action: string;
}

export function evaluateRisk(snapshot: TraderSnapshot): RiskViolation | null {
  const tier = TIERS[snapshot.tier];

  // 1. Max drawdown check
  const drawdownPct =
    (snapshot.startingCapital - snapshot.currentEquity) / snapshot.startingCapital;

  if (drawdownPct >= tier.maxDrawdownPct) {
    return {
      challengeId: snapshot.challengeId,
      eventType: "drawdown_breach",
      details: { current_value: drawdownPct, limit: tier.maxDrawdownPct },
      action: "challenge_failed",
    };
  }

  // 2. Daily loss limit check (rolling 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentPnl = snapshot.dailyPnlHistory
    .filter((h) => h.timestamp >= oneDayAgo)
    .reduce((sum, h) => sum + h.pnl, 0);

  const totalUnrealized = snapshot.positions.reduce(
    (sum, p) => sum + p.unrealizedPnl, 0
  );

  const dailyLossPct =
    Math.abs(Math.min(0, recentPnl + totalUnrealized)) / snapshot.startingCapital;

  if (dailyLossPct >= tier.dailyLossLimitPct) {
    return {
      challengeId: snapshot.challengeId,
      eventType: "daily_loss_breach",
      details: { current_value: dailyLossPct, limit: tier.dailyLossLimitPct },
      action: "trades_blocked",
    };
  }

  // 3. Position size limit check
  for (const pos of snapshot.positions) {
    const positionValue = pos.size * pos.leverage;
    const maxValue = snapshot.startingCapital * tier.positionSizeLimitPct;
    if (positionValue > maxValue) {
      return {
        challengeId: snapshot.challengeId,
        eventType: "position_size_breach",
        details: { current_value: positionValue, limit: maxValue },
        action: "positions_closed",
      };
    }
  }

  // 4. Leverage check
  for (const pos of snapshot.positions) {
    if (pos.leverage > tier.maxLeverage) {
      return {
        challengeId: snapshot.challengeId,
        eventType: "leverage_breach",
        details: { current_value: pos.leverage, limit: tier.maxLeverage },
        action: "positions_closed",
      };
    }
  }

  // 5. Profit target check
  const profitPct =
    (snapshot.currentEquity - snapshot.startingCapital) / snapshot.startingCapital;

  if (profitPct >= tier.profitTargetPct) {
    return {
      challengeId: snapshot.challengeId,
      eventType: "profit_target_reached",
      details: { current_value: profitPct, target: tier.profitTargetPct },
      action: "challenge_passed",
    };
  }

  return null;
}
