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

  // Get real balance from Pacifica before closing
  let withdrawAmount = "0";
  if (challenge.walletPublicKey) {
    try {
      const res = await fetch(`https://test-api.pacifica.fi/api/v1/account?account=${challenge.walletPublicKey}`);
      const json = await res.json();
      if (json.success && json.data) {
        withdrawAmount = json.data.balance;
        // Update DB with real final equity
        await prisma.challenge.update({
          where: { id: challengeId },
          data: { currentEquity: parseFloat(json.data.account_equity) },
        });
      }
    } catch (err) {
      console.error(`[Pacifica] Failed to fetch account for ${challengeId}:`, err);
    }
  }

  // Close all positions and withdraw funds back to treasury
  if (challenge.walletSecretKey) {
    try {
      await closeAllAndWithdraw(challenge.walletSecretKey, withdrawAmount);
    } catch (err) {
      console.error(`[Pacifica] closeAllAndWithdraw failed for ${challengeId}:`, err);
    }
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

  // Get real balance from Pacifica before closing
  let withdrawAmount = "0";
  if (challenge.walletPublicKey) {
    try {
      const res = await fetch(`https://test-api.pacifica.fi/api/v1/account?account=${challenge.walletPublicKey}`);
      const json = await res.json();
      if (json.success && json.data) {
        withdrawAmount = json.data.balance;
        await prisma.challenge.update({
          where: { id: challengeId },
          data: { currentEquity: parseFloat(json.data.account_equity) },
        });
      }
    } catch (err) {
      console.error(`[Pacifica] Failed to fetch account for ${challengeId}:`, err);
    }
  }

  // Close all positions and withdraw funds back to treasury
  if (challenge.walletSecretKey) {
    try {
      await closeAllAndWithdraw(challenge.walletSecretKey, withdrawAmount);
    } catch (err) {
      console.error(`[Pacifica] closeAllAndWithdraw failed for ${challengeId}:`, err);
    }
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
