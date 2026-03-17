import { prisma } from "./db";
import { RedisConsumer } from "./redis-consumer";
import { evaluateRisk, TraderSnapshot } from "./risk-engine";
import {
  handleChallengeFailed,
  handleChallengePassed,
  checkExpiredChallenges,
} from "./challenge-manager";
import { POLL_INTERVAL_MS, SNAPSHOT_PERSIST_INTERVAL_MS } from "./config";

const snapshots = new Map<string, TraderSnapshot>();

export async function startMonitor(redisUrl: string) {
  const consumer = new RedisConsumer(redisUrl);

  // Consume trade events (runs in background)
  consumer.consumeTradeEvents(async (data) => {
    console.log(`Trade event: ${data.challenge_id} ${data.side} ${data.pair}`);
    await pollAndEvaluate(data.challenge_id, consumer);
  });

  // Main polling loop — all active challenges in parallel
  setInterval(async () => {
    try {
      const activeChallenges = await prisma.challenge.findMany({
        where: { status: "ACTIVE" },
      });

      await Promise.all(
        activeChallenges.map((c: { id: string }) => pollAndEvaluate(c.id, consumer))
      );
    } catch (err) {
      console.error("Polling loop error:", err);
    }
  }, POLL_INTERVAL_MS);

  // Persist snapshots to DB periodically
  setInterval(async () => {
    try {
      for (const [challengeId, snapshot] of snapshots) {
        const drawdownPct =
          (snapshot.startingCapital - snapshot.currentEquity) /
          snapshot.startingCapital;

        const totalUnrealized = snapshot.positions.reduce(
          (sum, p) => sum + p.unrealizedPnl, 0
        );
        const recentPnl = snapshot.dailyPnlHistory.reduce(
          (sum, h) => sum + h.pnl, 0
        );
        const dailyLossPct = Math.abs(
          Math.min(0, recentPnl + totalUnrealized)
        ) / snapshot.startingCapital;

        await prisma.riskSnapshot.create({
          data: {
            challengeId,
            equity: snapshot.currentEquity,
            drawdownPct: Math.max(0, drawdownPct),
            dailyLossPct,
          },
        });

        await prisma.challenge.update({
          where: { id: challengeId },
          data: { currentEquity: snapshot.currentEquity },
        });
      }
    } catch (err) {
      console.error("Snapshot persist error:", err);
    }
  }, SNAPSHOT_PERSIST_INTERVAL_MS);

  // Check for expired challenges every minute
  setInterval(async () => {
    try {
      await checkExpiredChallenges();
    } catch (err) {
      console.error("Expiry check error:", err);
    }
  }, 60_000);

  console.log("Risk monitoring service started");
}

async function pollAndEvaluate(challengeId: string, consumer: RedisConsumer) {
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || challenge.status !== "ACTIVE") {
      snapshots.delete(challengeId);
      return;
    }

    // TODO: Replace with actual Pacifica data via getSubaccountInfo()
    const positions = await prisma.position.findMany({
      where: { challengeId, status: "OPEN" },
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSnapshots = await prisma.riskSnapshot.findMany({
      where: { challengeId, timestamp: { gte: oneDayAgo } },
      orderBy: { timestamp: "asc" },
    });

    const dailyPnlHistory = recentSnapshots.map((s: { timestamp: Date; equity: unknown }) => ({
      timestamp: s.timestamp.getTime(),
      pnl: Number(s.equity) - Number(challenge.startingCapital),
    }));

    const snapshot: TraderSnapshot = {
      challengeId,
      tier: challenge.tier as any,
      startingCapital: Number(challenge.startingCapital),
      currentEquity: Number(challenge.currentEquity),
      realizedPnl: Number(challenge.realizedPnl),
      dailyPnlHistory,
      positions: positions.map((p: { pair: string; side: string; size: unknown; leverage: unknown; unrealizedPnl: unknown }) => ({
        pair: p.pair,
        side: p.side,
        size: Number(p.size),
        leverage: Number(p.leverage),
        unrealizedPnl: Number(p.unrealizedPnl),
      })),
    };

    snapshots.set(challengeId, snapshot);

    const violation = evaluateRisk(snapshot);
    if (violation) {
      console.log(`VIOLATION: ${violation.eventType} for ${challengeId}`);

      await consumer.publishRiskEvent({
        challenge_id: violation.challengeId,
        event_type: violation.eventType,
        details: violation.details,
        action: violation.action,
      });

      if (violation.action === "challenge_failed") {
        await handleChallengeFailed(challengeId);
        snapshots.delete(challengeId);
      } else if (violation.action === "challenge_passed") {
        await handleChallengePassed(challengeId);
        snapshots.delete(challengeId);
      }
    }
  } catch (err) {
    console.error(`Error evaluating ${challengeId}:`, err);
  }
}
