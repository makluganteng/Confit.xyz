import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "./db";
import { createHash } from "crypto";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export type AuthResult =
  | { type: "user"; userId: string }
  | { type: "agent"; userId: string; agentId: string }
  | null;

export async function authenticate(req: Request): Promise<AuthResult> {
  // Check for API key (agent auth)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const hash = createHash("sha256").update(apiKey).digest("hex");
    const agent = await prisma.agent.findFirst({
      where: { apiKeyHash: hash, status: "ACTIVE" },
    });
    if (agent) {
      return { type: "agent", userId: agent.userId, agentId: agent.id };
    }
    return null;
  }

  // Check for Privy token (human auth)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice(7);
    const claims = await privy.verifyAuthToken(token);
    // Upsert user on first login
    const user = await prisma.user.upsert({
      where: { privyId: claims.userId },
      update: {},
      create: {
        privyId: claims.userId,
        walletAddress: null,
      },
    });
    return { type: "user", userId: user.id };
  } catch {
    return null;
  }
}
