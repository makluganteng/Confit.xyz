import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TIERS } from "@confit/shared/src/tiers";
import { setupChallengeWallet } from "@/lib/pacifica";
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

  // TODO: Verify entry fee payment on-chain (check Solana tx signature)
  // For MVP, we trust the client sends a valid tx
  const txSignature = body.txSignature as string;
  if (!txSignature) {
    return NextResponse.json(
      { error: "Transaction signature required" },
      { status: 400 }
    );
  }

  try {
    // Setup the challenge wallet on Pacifica:
    // 1. Generate fresh keypair
    // 2. Transfer USDC from treasury
    // 3. Deposit to Pacifica vault
    // 4. Claim referral
    // 5. Set leverage
    const wallet = await setupChallengeWallet(
      tierConfig.fundedCapital,
      tierConfig.maxLeverage
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + tierConfig.durationDays);

    const challenge = await prisma.challenge.create({
      data: {
        userId: auth.userId,
        tier: tierKey,
        entryFee: tierConfig.entryFee,
        status: "ACTIVE",
        walletPublicKey: wallet.walletPublicKey,
        walletSecretKey: wallet.walletSecretKey, // TODO: Encrypt in production
        startingCapital: tierConfig.fundedCapital,
        currentEquity: tierConfig.fundedCapital,
        realizedPnl: 0,
        profitTargetPct: tierConfig.profitTargetPct,
        profitSplitPct: tierConfig.profitSplitPct,
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        challenge: {
          id: challenge.id,
          tier: challenge.tier,
          status: challenge.status,
          walletPublicKey: challenge.walletPublicKey,
          startingCapital: Number(challenge.startingCapital),
          expiresAt: challenge.expiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Challenge Enter] Failed:", error);
    return NextResponse.json(
      { error: "Failed to setup challenge. Please try again." },
      { status: 500 }
    );
  }
}
