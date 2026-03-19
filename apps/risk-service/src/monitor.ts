import { prisma } from "./db";
import { RedisConsumer } from "./redis-consumer";
import { evaluateRisk, TraderSnapshot } from "./risk-engine";
import {
  handleChallengeFailed,
  handleChallengePassed,
  checkExpiredChallenges,
} from "./challenge-manager";
import { POLL_INTERVAL_MS, SNAPSHOT_PERSIST_INTERVAL_MS } from "./config";

const PACIFICA_API = "https://test-api.pacifica.fi/api/v1";

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

        // Update challenge equity in DB with real Pacifica equity
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

    if (!challenge || challenge.status !== "ACTIVE" || !challenge.walletPublicKey) {
      snapshots.delete(challengeId);
      return;
    }

    const walletPubkey = challenge.walletPublicKey;

    // Fetch REAL data from Pacifica
    let pacificaEquity = Number(challenge.currentEquity);
    let pacificaPositions: { pair: string; side: string; size: number; leverage: number; unrealizedPnl: number }[] = [];

    try {
      const [accountRes, positionsRes] = await Promise.all([
        fetch(`${PACIFICA_API}/account?account=${walletPubkey}`),
        fetch(`${PACIFICA_API}/positions?account=${walletPubkey}`),
      ]);

      const accountJson = await accountRes.json();
      const positionsJson = await positionsRes.json();

      if (accountJson.success && accountJson.data) {
        pacificaEquity = parseFloat(accountJson.data.account_equity);
      }

      if (positionsJson.success && Array.isArray(positionsJson.data)) {
        pacificaPositions = positionsJson.data.map((p: any) => {
          const entryPrice = parseFloat(p.entry_price);
          const amount = parseFloat(p.amount);
          const notionalSize = amount * entryPrice;
          const margin = parseFloat(p.margin) || notionalSize * 0.1;
          const leverage = margin > 0 ? notionalSize / margin : 1;

          // Estimate unrealized PnL from equity vs balance
          // (Pacifica doesn't give per-position PnL directly in this endpoint)
          return {
            pair: `${p.symbol}-PERP`,
            side: p.side === "bid" ? "LONG" : "SHORT",
            size: notionalSize,
            leverage,
            unrealizedPnl: 0, // Will be calculated from equity diff
          };
        });
      }
    } catch (err) {
      console.error(`[Risk] Failed to fetch Pacifica data for ${walletPubkey}:`, err);
      // Fall back to DB data if Pacifica is unreachable
    }

    // Calculate total unrealized PnL from equity difference
    const startingCapital = Number(challenge.startingCapital);
    const totalUnrealizedPnl = pacificaEquity - startingCapital;

    // Distribute PnL across positions proportionally (approximation)
    if (pacificaPositions.length > 0) {
      const pnlPerPosition = totalUnrealizedPnl / pacificaPositions.length;
      pacificaPositions = pacificaPositions.map(p => ({
        ...p,
        unrealizedPnl: pnlPerPosition,
      }));
    }

    // Build daily PnL history from risk snapshots
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSnapshots = await prisma.riskSnapshot.findMany({
      where: { challengeId, timestamp: { gte: oneDayAgo } },
      orderBy: { timestamp: "asc" },
    });

    const dailyPnlHistory = recentSnapshots.map((s: { timestamp: Date; equity: unknown }) => ({
      timestamp: s.timestamp.getTime(),
      pnl: Number(s.equity) - startingCapital,
    }));

    const snapshot: TraderSnapshot = {
      challengeId,
      tier: challenge.tier as any,
      startingCapital,
      currentEquity: pacificaEquity,
      realizedPnl: Number(challenge.realizedPnl),
      dailyPnlHistory,
      positions: pacificaPositions,
    };

    snapshots.set(challengeId, snapshot);

    const violation = evaluateRisk(snapshot);
    if (violation) {
      console.log(`[Risk] VIOLATION: ${violation.eventType} for challenge ${challengeId}`);
      console.log(`[Risk] Equity: $${pacificaEquity.toFixed(2)} / Starting: $${startingCapital} / Drawdown: ${((startingCapital - pacificaEquity) / startingCapital * 100).toFixed(2)}%`);

      await consumer.publishRiskEvent({
        challenge_id: violation.challengeId,
        event_type: violation.eventType,
        details: violation.details,
        action: violation.action,
      });

      if (violation.action === "challenge_failed") {
        console.log(`[Risk] Challenge ${challengeId} FAILED — executing end sequence`);
        await handleChallengeFailed(challengeId);
        snapshots.delete(challengeId);
      } else if (violation.action === "challenge_passed") {
        console.log(`[Risk] Challenge ${challengeId} PASSED — executing end sequence`);
        await handleChallengePassed(challengeId);
        snapshots.delete(challengeId);
      }
    }
  } catch (err) {
    console.error(`Error evaluating ${challengeId}:`, err);
  }
}
