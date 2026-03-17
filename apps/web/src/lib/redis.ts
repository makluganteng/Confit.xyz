import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis = globalForRedis.redis || new Redis(process.env.REDIS_URL!);

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export async function publishTradeEvent(data: {
  challenge_id: string;
  order_id: string;
  pair: string;
  side: string;
  size: number;
  leverage: number;
}) {
  await redis.xadd(
    "trades",
    "*",
    "data",
    JSON.stringify({ ...data, timestamp: new Date().toISOString() })
  );
}

export async function publishRiskEvent(data: {
  challenge_id: string;
  event_type: string;
  details: Record<string, number>;
  action: string;
}) {
  await redis.xadd(
    "risk-events",
    "*",
    "data",
    JSON.stringify({ ...data, timestamp: new Date().toISOString() })
  );
}
