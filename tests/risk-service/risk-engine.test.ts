import { evaluateRisk, TraderSnapshot } from "../../apps/risk-service/src/risk-engine";

function makeSnapshot(overrides: Partial<TraderSnapshot> = {}): TraderSnapshot {
  return {
    challengeId: "test-challenge-1",
    tier: "STARTER",
    startingCapital: 5000,
    currentEquity: 5000,
    realizedPnl: 0,
    dailyPnlHistory: [],
    positions: [],
    ...overrides,
  };
}

describe("Risk Engine", () => {
  test("returns null when no violations", () => {
    const result = evaluateRisk(makeSnapshot());
    expect(result).toBeNull();
  });

  test("detects max drawdown breach", () => {
    const result = evaluateRisk(
      makeSnapshot({ currentEquity: 4400 })
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("drawdown_breach");
    expect(result!.action).toBe("challenge_failed");
  });

  test("does not trigger at drawdown below limit", () => {
    const result = evaluateRisk(
      makeSnapshot({ currentEquity: 4550 })
    );
    expect(result).toBeNull();
  });

  test("detects daily loss breach", () => {
    const result = evaluateRisk(
      makeSnapshot({
        dailyPnlHistory: [
          { timestamp: Date.now() - 1000, pnl: -200 },
        ],
        positions: [
          { pair: "SOL-PERP", side: "long", size: 100, leverage: 5, unrealizedPnl: -100 },
        ],
      })
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("daily_loss_breach");
    expect(result!.action).toBe("trades_blocked");
  });

  test("detects position size breach", () => {
    const result = evaluateRisk(
      makeSnapshot({
        positions: [
          { pair: "SOL-PERP", side: "long", size: 200, leverage: 10, unrealizedPnl: 0 },
        ],
      })
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("position_size_breach");
  });

  test("detects leverage breach for STARTER tier", () => {
    const result = evaluateRisk(
      makeSnapshot({
        tier: "STARTER",
        positions: [
          { pair: "SOL-PERP", side: "long", size: 10, leverage: 15, unrealizedPnl: 0 },
        ],
      })
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("leverage_breach");
  });

  test("allows valid leverage for PRO tier", () => {
    const result = evaluateRisk(
      makeSnapshot({
        tier: "PRO",
        startingCapital: 10000,
        currentEquity: 10000,
        positions: [
          { pair: "SOL-PERP", side: "long", size: 10, leverage: 15, unrealizedPnl: 0 },
        ],
      })
    );
    expect(result).toBeNull();
  });

  test("detects profit target reached", () => {
    const result = evaluateRisk(
      makeSnapshot({ currentEquity: 5450 })
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("profit_target_reached");
    expect(result!.action).toBe("challenge_passed");
  });

  test("priority: drawdown checked before daily loss", () => {
    const result = evaluateRisk(
      makeSnapshot({
        currentEquity: 4400,
        dailyPnlHistory: [{ timestamp: Date.now(), pnl: -600 }],
      })
    );
    expect(result!.eventType).toBe("drawdown_breach");
  });
});
