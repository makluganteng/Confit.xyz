// Mock ioredis before importing
const mockXadd = jest.fn();
const mockXread = jest.fn();
const mockDisconnect = jest.fn();

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    xadd: mockXadd,
    xread: mockXread,
    disconnect: mockDisconnect,
  }));
});

import { RedisConsumer } from "../../apps/risk-service/src/redis-consumer";

describe("RedisConsumer", () => {
  let consumer: RedisConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockXadd.mockResolvedValue("1234567890-0");
    consumer = new RedisConsumer("redis://localhost:6379");
  });

  test("publishRiskEvent calls xadd with correct stream name", async () => {
    await consumer.publishRiskEvent({
      challenge_id: "challenge-1",
      event_type: "drawdown_breach",
      details: { drawdownPct: 0.12 },
      action: "challenge_failed",
    });

    expect(mockXadd).toHaveBeenCalledTimes(1);
    const args = mockXadd.mock.calls[0];
    expect(args[0]).toBe("risk-events");
  });

  test("publishRiskEvent passes '*' as the ID argument to xadd", async () => {
    await consumer.publishRiskEvent({
      challenge_id: "challenge-2",
      event_type: "daily_loss_breach",
      details: { dailyLossPct: 0.06 },
      action: "trades_blocked",
    });

    const args = mockXadd.mock.calls[0];
    expect(args[1]).toBe("*");
  });

  test("published data is JSON serialized in the 'data' field", async () => {
    await consumer.publishRiskEvent({
      challenge_id: "challenge-3",
      event_type: "leverage_breach",
      details: { leverage: 15 },
      action: "trades_blocked",
    });

    const args = mockXadd.mock.calls[0];
    // args: [stream, id, field, value]
    expect(args[2]).toBe("data");
    const parsed = JSON.parse(args[3]);
    expect(parsed.challenge_id).toBe("challenge-3");
    expect(parsed.event_type).toBe("leverage_breach");
    expect(parsed.action).toBe("trades_blocked");
    expect(parsed.details).toEqual({ leverage: 15 });
  });

  test("published data includes timestamp", async () => {
    await consumer.publishRiskEvent({
      challenge_id: "challenge-4",
      event_type: "profit_target_reached",
      details: {},
      action: "challenge_passed",
    });

    const args = mockXadd.mock.calls[0];
    const parsed = JSON.parse(args[3]);
    expect(parsed.timestamp).toBeDefined();
    // Should be an ISO string
    expect(typeof parsed.timestamp).toBe("string");
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });
});
