// Mock Prisma before importing the module under test
jest.mock("../../apps/web/src/lib/db", () => ({
  prisma: {
    challenge: {
      findUnique: jest.fn(),
    },
    riskSnapshot: {
      findFirst: jest.fn(),
    },
  },
}));

import { preTradeRiskCheck } from "../../apps/web/src/lib/risk-checks";
import { prisma } from "../../apps/web/src/lib/db";

const mockPrisma = prisma as unknown as {
  challenge: { findUnique: jest.Mock };
  riskSnapshot: { findFirst: jest.Mock };
};

function makeChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "challenge-1",
    status: "ACTIVE",
    tier: "STARTER",
    startingCapital: 5000,
    currentEquity: 5000,
    positions: [],
    ...overrides,
  };
}

describe("preTradeRiskCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no risk snapshots
    mockPrisma.riskSnapshot.findFirst.mockResolvedValue(null);
  });

  test("returns allowed:false if challenge not found", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(null);

    const result = await preTradeRiskCheck("nonexistent", 100, 5);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Challenge is not active");
  });

  test("returns allowed:false if challenge is not active", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(
      makeChallenge({ status: "FAILED" })
    );

    const result = await preTradeRiskCheck("challenge-1", 100, 5);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Challenge is not active");
  });

  test("returns allowed:false if leverage exceeds tier max (STARTER: 10x)", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(makeChallenge());

    const result = await preTradeRiskCheck("challenge-1", 100, 15);

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/leverage/i);
    expect(result.reason).toMatch(/15x/);
  });

  test("returns allowed:false if position value exceeds limit", async () => {
    // STARTER: startingCapital=5000, positionSizeLimitPct=0.30, max=1500
    // size=200, leverage=10 → positionValue=2000 > 1500
    mockPrisma.challenge.findUnique.mockResolvedValue(makeChallenge());

    const result = await preTradeRiskCheck("challenge-1", 200, 10);

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/position value/i);
  });

  test("returns allowed:false if daily loss limit reached", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(makeChallenge());
    // STARTER dailyLossLimitPct = 0.05 (5%)
    mockPrisma.riskSnapshot.findFirst.mockResolvedValue({
      challengeId: "challenge-1",
      dailyLossPct: 0.05,
      timestamp: new Date(),
    });

    const result = await preTradeRiskCheck("challenge-1", 10, 2);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Daily loss limit reached");
  });

  test("returns allowed:false if max drawdown reached", async () => {
    // STARTER maxDrawdownPct = 0.10 (10%)
    // startingCapital=5000, currentEquity=4500 → drawdown = 500/5000 = 0.10 >= 0.10
    mockPrisma.challenge.findUnique.mockResolvedValue(
      makeChallenge({ currentEquity: 4500 })
    );

    const result = await preTradeRiskCheck("challenge-1", 10, 2);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Max drawdown reached");
  });

  test("returns allowed:true when all checks pass", async () => {
    // Healthy challenge: no drawdown, within leverage, within position size
    mockPrisma.challenge.findUnique.mockResolvedValue(makeChallenge());
    // size=50, leverage=5 → positionValue=250, max=1500 ✓
    // leverage=5 <= 10 ✓
    // no snapshot → no daily loss ✓
    // drawdown=0 ✓

    const result = await preTradeRiskCheck("challenge-1", 50, 5);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
