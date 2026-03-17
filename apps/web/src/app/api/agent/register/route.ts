import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes, createHash } from "crypto";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth || auth.type !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = body.name as string;

  if (!name || name.length < 1 || name.length > 100) {
    return NextResponse.json({ error: "Name is required (1-100 chars)" }, { status: 400 });
  }

  const apiKey = `confit_${randomBytes(32).toString("hex")}`;
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

  const agent = await prisma.agent.create({
    data: {
      userId: auth.userId,
      name,
      apiKeyHash,
    },
  });

  return NextResponse.json(
    {
      agent: { id: agent.id, name: agent.name },
      apiKey,
    },
    { status: 201 }
  );
}
