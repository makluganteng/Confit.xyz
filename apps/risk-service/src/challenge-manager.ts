import { prisma } from "./db";

export async function handleChallengeFailed(challengeId: string) {
  console.log(`Challenge ${challengeId} FAILED — executing end sequence`);

  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: "FAILED", endedAt: new Date() },
  });

  // TODO: Close all positions on Pacifica (closeAllPositions)
  // TODO: Call Solana program fail_challenge (callFailChallenge)

  console.log(`Challenge ${challengeId} fail sequence complete`);
}

export async function handleChallengePassed(challengeId: string) {
  console.log(`Challenge ${challengeId} PASSED — executing end sequence`);

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) return;

  // TODO: Close all positions on Pacifica (closeAllPositions)
  // TODO: Wait for settlement, get final realized PnL
  // TODO: Call Solana program pass_challenge with realized PnL

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
