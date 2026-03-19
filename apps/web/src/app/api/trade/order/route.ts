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
    walletSecretKey: challenge.walletSecretKey!,
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

  // If market order filled immediately, create a position record
  if (result.status === "filled") {
    // Get the fill price (use limit price or fetch current price)
    let fillPrice = limitPrice;
    if (!fillPrice) {
      try {
        const klineRes = await fetch(
          `https://test-api.pacifica.fi/api/v1/kline?symbol=${pair.replace("-PERP", "")}&interval=1m&start_time=${Date.now() - 120000}`
        );
        const klineJson = await klineRes.json();
        if (klineJson.success && klineJson.data?.length > 0) {
          fillPrice = parseFloat(klineJson.data[klineJson.data.length - 1].c);
        }
      } catch { /* use 0 as fallback */ }
    }
    fillPrice = fillPrice || 0;

    // Check if there's an existing open position for same pair + side
    const existingPosition = await prisma.position.findFirst({
      where: {
        challengeId,
        pair,
        side: side.toUpperCase() as any,
        status: "OPEN",
      },
    });

    if (existingPosition) {
      // Add to existing position (average entry price)
      const existingSize = Number(existingPosition.size);
      const existingEntry = Number(existingPosition.entryPrice);
      const newSize = existingSize + size;
      const avgEntry = (existingEntry * existingSize + fillPrice * size) / newSize;

      await prisma.position.update({
        where: { id: existingPosition.id },
        data: {
          size: newSize,
          entryPrice: avgEntry,
          currentPrice: fillPrice,
          leverage,
        },
      });
    } else {
      // Create new position
      await prisma.position.create({
        data: {
          challengeId,
          pair,
          side: side.toUpperCase() as any,
          size,
          leverage,
          entryPrice: fillPrice,
          currentPrice: fillPrice,
          unrealizedPnl: 0,
          status: "OPEN",
        },
      });
    }
  }

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
