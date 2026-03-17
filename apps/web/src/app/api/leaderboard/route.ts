import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const challenges = await prisma.challenge.findMany({
    where: { status: { in: ["ACTIVE", "PASSED"] } },
    include: {
      user: { select: { id: true, walletAddress: true } },
    },
    orderBy: { realizedPnl: "desc" },
    take: 50,
  });

  const leaderboard = challenges.map((c, i) => ({
    rank: i + 1,
    walletAddress: c.user.walletAddress
      ? `${c.user.walletAddress.slice(0, 4)}...${c.user.walletAddress.slice(-4)}`
      : "Anonymous",
    tier: c.tier,
    pnl: Number(c.realizedPnl),
    equity: Number(c.currentEquity),
    startingCapital: Number(c.startingCapital),
    returnPct:
      ((Number(c.currentEquity) - Number(c.startingCapital)) /
        Number(c.startingCapital)) *
      100,
    status: c.status,
  }));

  return NextResponse.json({ leaderboard });
}
