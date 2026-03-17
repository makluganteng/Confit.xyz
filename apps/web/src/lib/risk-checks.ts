import { prisma } from "./db";
import { TIERS } from "@confit/shared/src/tiers";

interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export async function preTradeRiskCheck(
  challengeId: string,
  size: number,
  leverage: number
): Promise<RiskCheckResult> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { positions: { where: { status: "OPEN" } } },
  });

  if (!challenge || challenge.status !== "ACTIVE") {
    return { allowed: false, reason: "Challenge is not active" };
  }

  const tier = TIERS[challenge.tier];

  // Check leverage cap
  if (leverage > tier.maxLeverage) {
    return {
      allowed: false,
      reason: `Leverage ${leverage}x exceeds max ${tier.maxLeverage}x`,
    };
  }

  // Check position size limit (30% of capital)
  const positionValue = size * leverage;
  const maxPositionValue = Number(challenge.startingCapital) * tier.positionSizeLimitPct;
  if (positionValue > maxPositionValue) {
    return {
      allowed: false,
      reason: `Position value $${positionValue} exceeds limit $${maxPositionValue}`,
    };
  }

  // Check daily loss limit
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const latestSnapshot = await prisma.riskSnapshot.findFirst({
    where: { challengeId, timestamp: { gte: oneDayAgo } },
    orderBy: { timestamp: "desc" },
  });

  if (latestSnapshot && Number(latestSnapshot.dailyLossPct) >= tier.dailyLossLimitPct) {
    return { allowed: false, reason: "Daily loss limit reached" };
  }

  // Check max drawdown
  const equity = Number(challenge.currentEquity);
  const startingCapital = Number(challenge.startingCapital);
  const drawdownPct = (startingCapital - equity) / startingCapital;

  if (drawdownPct >= tier.maxDrawdownPct) {
    return { allowed: false, reason: "Max drawdown reached" };
  }

  return { allowed: true };
}
