import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelOrder } from "@/lib/pacifica";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { challenge: true },
  });

  if (!order || order.challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending orders can be cancelled" }, { status: 400 });
  }

  await cancelOrder(order.challenge.walletSecretKey!, order.pair, order.pacificaOrderId!);

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ order: updated });
}
