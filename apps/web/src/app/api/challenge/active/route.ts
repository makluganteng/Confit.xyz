import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const challenge = await prisma.challenge.findFirst({
    where: { userId: auth.userId, status: "ACTIVE" },
    include: {
      riskSnapshots: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });

  if (!challenge) {
    return NextResponse.json({ challenge: null });
  }

  // Don't expose the wallet secret key to the client
  return NextResponse.json({
    challenge: {
      id: challenge.id,
      tier: challenge.tier,
      status: challenge.status,
      walletPublicKey: challenge.walletPublicKey,
      startingCapital: challenge.startingCapital.toString(),
      currentEquity: challenge.currentEquity.toString(),
      realizedPnl: challenge.realizedPnl.toString(),
      profitTargetPct: challenge.profitTargetPct.toString(),
      profitSplitPct: challenge.profitSplitPct.toString(),
      expiresAt: challenge.expiresAt.toISOString(),
      createdAt: challenge.createdAt.toISOString(),
      riskSnapshots: challenge.riskSnapshots.map((s) => ({
        drawdownPct: s.drawdownPct.toString(),
        dailyLossPct: s.dailyLossPct.toString(),
        equity: s.equity.toString(),
      })),
    },
  });
}
