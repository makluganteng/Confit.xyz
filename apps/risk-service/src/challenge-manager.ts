import { prisma } from "./db";
import { closeAllAndWithdraw } from "./pacifica-actions";

export async function handleChallengeFailed(challengeId: string) {
  console.log(`Challenge ${challengeId} FAILED — executing end sequence`);

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    console.error(`Challenge ${challengeId} not found`);
    return;
  }

  // Close all positions and withdraw funds back to treasury
  if (challenge.walletSecretKey) {
    const equity = challenge.currentEquity?.toString() ?? "0";
    try {
      await closeAllAndWithdraw(challenge.walletSecretKey, equity);
    } catch (err) {
      console.error(`[Pacifica] closeAllAndWithdraw failed for ${challengeId}:`, err);
    }
  } else {
    console.warn(`Challenge ${challengeId} has no walletSecretKey, skipping withdrawal`);
  }

  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: "FAILED", endedAt: new Date() },
  });

  console.log(`Challenge ${challengeId} fail sequence complete`);
}

export async function handleChallengePassed(challengeId: string) {
  console.log(`Challenge ${challengeId} PASSED — executing end sequence`);

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) return;

  // Close all positions and withdraw funds back to treasury
  if (challenge.walletSecretKey) {
    const equity = challenge.currentEquity?.toString() ?? "0";
    try {
      await closeAllAndWithdraw(challenge.walletSecretKey, equity);
    } catch (err) {
      console.error(`[Pacifica] closeAllAndWithdraw failed for ${challengeId}:`, err);
    }
  } else {
    console.warn(`Challenge ${challengeId} has no walletSecretKey, skipping withdrawal`);
  }

  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: "PASSED", endedAt: new Date() },
  });

  console.log(`Challenge ${challengeId} pass sequence complete`);
}

export async function checkExpiredChallenges() {
  const expired = await prisma.challenge.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: new Date() },
    },
  });

  for (const challenge of expired) {
    console.log(`Challenge ${challenge.id} expired`);
    await handleChallengeFailed(challenge.id);
  }
}
