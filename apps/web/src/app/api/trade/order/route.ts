import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { preTradeRiskCheck } from "@/lib/risk-checks";
import { placeOrder } from "@/lib/pacifica";
import { publishTradeEvent } from "@/lib/redis";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = auth.type === "agent" ? `agent:${auth.agentId}` : `user:${auth.userId}`;
  if (!rateLimit(rateLimitKey, 10).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json();
  const { challengeId, pair, side, size, leverage, orderType, limitPrice } = body;

  if (!challengeId || !pair || !side || !size || !leverage || !orderType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["long", "short"].includes(side)) {
    return NextResponse.json({ error: "Side must be 'long' or 'short'" }, { status: 400 });
  }

  if (!["market", "limit"].includes(orderType)) {
    return NextResponse.json({ error: "orderType must be 'market' or 'limit'" }, { status: 400 });
  }

  if (orderType === "limit" && !limitPrice) {
    return NextResponse.json({ error: "limitPrice required for limit orders" }, { status: 400 });
  }

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const riskCheck = await preTradeRiskCheck(challengeId, size, leverage);
  if (!riskCheck.allowed) {
    const order = await prisma.order.create({
      data: {
        challengeId,
        agentId: auth.type === "agent" ? auth.agentId : null,
        side: side.toUpperCase(),
        pair,
        size,
        leverage,
        orderType: orderType.toUpperCase(),
        limitPrice: limitPrice || null,
        status: "REJECTED",
      },
    });
    return NextResponse.json({ error: riskCheck.reason, order }, { status: 403 });
  }

  const result = await placeOrder({
    subaccountId: challenge.pacificaSubaccountId!,
    pair,
    side,
    size,
    leverage,
    orderType,
    limitPrice,
  });

  const order = await prisma.order.create({
    data: {
      challengeId,
      agentId: auth.type === "agent" ? auth.agentId : null,
      side: side.toUpperCase(),
      pair,
      size,
      leverage,
      orderType: orderType.toUpperCase(),
      limitPrice: limitPrice || null,
      status: result.status === "filled" ? "FILLED" : "PENDING",
      pacificaOrderId: result.orderId,
    },
  });

  await publishTradeEvent({
    challenge_id: challengeId,
    order_id: order.id,
    pair,
    side,
    size,
    leverage,
  });

  return NextResponse.json({ order }, { status: 201 });
}
