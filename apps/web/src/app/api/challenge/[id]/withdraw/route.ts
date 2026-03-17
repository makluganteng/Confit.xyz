import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge || challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (challenge.status !== "ACTIVE") {
    return NextResponse.json({ error: "Challenge is not active" }, { status: 400 });
  }

  // TODO: Close all positions on Pacifica, then call Solana withdraw_challenge
  await prisma.challenge.update({
    where: { id },
    data: { status: "FAILED", endedAt: new Date() },
  });

  return NextResponse.json({ message: "Challenge withdrawn", challengeId: id });
}
