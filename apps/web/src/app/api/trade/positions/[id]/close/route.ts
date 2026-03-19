import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChallengeClient } from "@/lib/pacifica";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const position = await prisma.position.findUnique({
    where: { id },
    include: { challenge: true },
  });

  if (!position || position.challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (position.status !== "OPEN") {
    return NextResponse.json({ error: "Position already closed" }, { status: 400 });
  }

  // Close by placing an opposite reduce-only market order
  const client = getChallengeClient(position.challenge.walletSecretKey!);
  const closeSide = position.side === "LONG" ? "ask" : "bid";
  const symbol = position.pair.replace("-PERP", "");
  await client.createMarketOrder({
    symbol,
    amount: Number(position.size).toString(),
    side: closeSide,
    reduceOnly: true,
  });

  // Calculate realized PnL based on current vs entry price
  const currentPrice = Number(position.currentPrice);
  const entryPrice = Number(position.entryPrice);
  const size = Number(position.size);
  const leverage = Number(position.leverage);
  const isLong = position.side === "LONG";
  const priceDiff = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
  const realizedPnl = (priceDiff / entryPrice) * size * leverage;

  const now = new Date();

  // Update position and challenge realized PnL + equity in a transaction
  const [updated] = await prisma.$transaction([
    prisma.position.update({
      where: { id },
      data: { status: "CLOSED", closedAt: now },
    }),
    prisma.challenge.update({
      where: { id: position.challengeId },
      data: {
        realizedPnl: {
          increment: realizedPnl,
        },
        currentEquity: {
          increment: realizedPnl,
        },
      },
    }),
  ]);

  return NextResponse.json({ position: updated });
}
