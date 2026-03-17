import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { closePosition } from "@/lib/pacifica";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const position = await prisma.position.findUnique({
    where: { id },
    include: { challenge: true },
  });

  if (!position || position.challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (position.status !== "OPEN") {
    return NextResponse.json({ error: "Position already closed" }, { status: 400 });
  }

  await closePosition(position.challenge.pacificaSubaccountId!, position.pair);

  const updated = await prisma.position.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  return NextResponse.json({ position: updated });
}
