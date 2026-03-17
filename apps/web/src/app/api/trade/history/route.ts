import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = auth.type === "agent" ? `agent:${auth.agentId}` : `user:${auth.userId}`;
  if (!rateLimit(rateLimitKey, 30).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const challengeId = req.nextUrl.searchParams.get("challengeId");

  const challenge = await prisma.challenge.findFirst({
    where: {
      userId: auth.userId,
      ...(challengeId ? { id: challengeId } : { status: "ACTIVE" }),
    },
  });

  if (!challenge) {
    return NextResponse.json({ orders: [] });
  }

  const orders = await prisma.order.findMany({
    where: { challengeId: challenge.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders });
}
