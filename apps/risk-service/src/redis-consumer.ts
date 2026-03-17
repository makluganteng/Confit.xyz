import Redis from "ioredis";

export class RedisConsumer {
  private redis: Redis;
  private lastId = "0";

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async consumeTradeEvents(
    handler: (data: {
      challenge_id: string;
      order_id: string;
      pair: string;
      side: string;
      size: number;
      leverage: number;
    }) => Promise<void>
  ) {
    while (true) {
      try {
        const results = await (this.redis as any).xread(
          "BLOCK",
          2000,
          "COUNT",
          50,
          "STREAMS",
          "trades",
          this.lastId
        );

        if (results) {
          for (const [, messages] of results) {
            for (const [id, fields] of messages) {
              this.lastId = id;
              const data = JSON.parse(fields[1]);
              await handler(data);
            }
          }
        }
      } catch (err) {
        console.error("Redis consumer error:", err);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  async publishRiskEvent(data: {
    challenge_id: string;
    event_type: string;
    details: Record<string, number>;
    action: string;
  }) {
    await this.redis.xadd(
      "risk-events",
      "*",
      "data",
      JSON.stringify({ ...data, timestamp: new Date().toISOString() })
    );
  }

  async disconnect() {
    await this.redis.disconnect();
  }
}
