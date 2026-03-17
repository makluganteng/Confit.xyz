import { NextRequest } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Redis from "ioredis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Pre-fetch user's challenge IDs for filtering
  const userChallenges = await prisma.challenge.findMany({
    where: { userId: auth.userId, status: "ACTIVE" },
    select: { id: true },
  });
  const userChallengeIds = new Set(userChallenges.map((c) => c.id));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const redis = new Redis(process.env.REDIS_URL!);
      let lastId = "$";
      let aborted = false;

      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      sendEvent("connected", { userId: auth.userId });

      req.signal.addEventListener("abort", () => {
        aborted = true;
        redis.disconnect();
      });

      while (!aborted) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const results = await (redis as any).xread(
            "BLOCK",
            5000,
            "COUNT",
            10,
            "STREAMS",
            "risk-events",
            lastId
          );

          if (results) {
            for (const [, messages] of results) {
              for (const [id, fields] of messages) {
                lastId = id;
                const data = JSON.parse(fields[1]);
                if (data.challenge_id && userChallengeIds.has(data.challenge_id)) {
                  sendEvent("risk-event", data);
                }
              }
            }
          }
        } catch {
          break;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
