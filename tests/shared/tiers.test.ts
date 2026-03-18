import { TIERS, TierConfig } from "../../packages/shared/src/tiers";

describe("TIERS config", () => {
  test("STARTER tier has correct entry fee and funded capital", () => {
    expect(TIERS.STARTER.entryFee).toBe(50);
    expect(TIERS.STARTER.fundedCapital).toBe(5000);
  });

  test("PRO tier has correct entry fee and funded capital", () => {
    expect(TIERS.PRO.entryFee).toBe(100);
    expect(TIERS.PRO.fundedCapital).toBe(10000);
  });

  test("both tiers have all required fields", () => {
    const requiredFields: (keyof TierConfig)[] = [
      "entryFee",
      "fundedCapital",
      "maxDrawdownPct",
      "dailyLossLimitPct",
      "maxLeverage",
      "positionSizeLimitPct",
      "profitTargetPct",
      "profitSplitPct",
      "durationDays",
    ];

    for (const tier of [TIERS.STARTER, TIERS.PRO]) {
      for (const field of requiredFields) {
        expect(tier[field]).toBeDefined();
      }
    }
  });

  test("profit target is 0.08 (8%) for both tiers", () => {
    expect(TIERS.STARTER.profitTargetPct).toBe(0.08);
    expect(TIERS.PRO.profitTargetPct).toBe(0.08);
  });

  test("profit split is 0.80 (80%) for both tiers", () => {
    expect(TIERS.STARTER.profitSplitPct).toBe(0.80);
    expect(TIERS.PRO.profitSplitPct).toBe(0.80);
  });

  test("duration is 30 days for both tiers", () => {
    expect(TIERS.STARTER.durationDays).toBe(30);
    expect(TIERS.PRO.durationDays).toBe(30);
  });

  test("STARTER max leverage is 10", () => {
    expect(TIERS.STARTER.maxLeverage).toBe(10);
  });

  test("PRO max leverage is 20", () => {
    expect(TIERS.PRO.maxLeverage).toBe(20);
  });
});
