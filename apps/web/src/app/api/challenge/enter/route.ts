import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TIERS } from "@confit/shared/src/tiers";
import { createSubaccount, fundSubaccount } from "@/lib/pacifica";
import { ChallengeTier } from "@prisma/client";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const tier = body.tier as string;

  if (!tier || !["STARTER", "PRO"].includes(tier.toUpperCase())) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const tierKey = tier.toUpperCase() as ChallengeTier;
  const tierConfig = TIERS[tierKey];

  // Check for existing active challenge
  const existing = await prisma.challenge.findFirst({
    where: { userId: auth.userId, status: "ACTIVE" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an active challenge" },
      { status: 409 }
    );
  }

  // TODO: Verify on-chain that entry fee was paid (check Solana tx)
  const txSignature = body.txSignature as string;
  if (!txSignature) {
    return NextResponse.json(
      { error: "Transaction signature required" },
      { status: 400 }
    );
  }

  // Create Pacifica subaccount
  const subaccountId = await createSubaccount(`challenge-${Date.now()}`);
  await fundSubaccount(subaccountId, tierConfig.fundedCapital);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + tierConfig.durationDays);

  const challenge = await prisma.challenge.create({
    data: {
      userId: auth.userId,
      tier: tierKey,
      entryFee: tierConfig.entryFee,
      status: "ACTIVE",
      pacificaSubaccountId: subaccountId,
      startingCapital: tierConfig.fundedCapital,
      currentEquity: tierConfig.fundedCapital,
      realizedPnl: 0,
      profitTargetPct: tierConfig.profitTargetPct,
      profitSplitPct: tierConfig.profitSplitPct,
      expiresAt,
    },
  });

  return NextResponse.json({ challenge }, { status: 201 });
}
