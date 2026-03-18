import { rateLimit } from "../../apps/web/src/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    // Reset the module's internal state between tests by re-importing
    // We use jest.isolateModules or manipulate time instead
    jest.useFakeTimers();
    // Reset Date.now to a fixed point
    jest.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("first request is allowed", () => {
    const result = rateLimit("user-first-request-test", 5);
    expect(result.allowed).toBe(true);
  });

  test("requests within limit are allowed", () => {
    const key = "user-within-limit";
    const maxPerSecond = 3;

    const results = [
      rateLimit(key, maxPerSecond),
      rateLimit(key, maxPerSecond),
      rateLimit(key, maxPerSecond),
    ];

    for (const r of results) {
      expect(r.allowed).toBe(true);
    }
  });

  test("requests exceeding limit are denied", () => {
    const key = "user-exceeds-limit";
    const maxPerSecond = 2;

    // First two should pass
    expect(rateLimit(key, maxPerSecond).allowed).toBe(true);
    expect(rateLimit(key, maxPerSecond).allowed).toBe(true);
    // Third should be denied
    expect(rateLimit(key, maxPerSecond).allowed).toBe(false);
  });

  test("tokens refill over time", () => {
    const key = "user-refill-test";
    const maxPerSecond = 1;

    // Use up the token
    expect(rateLimit(key, maxPerSecond).allowed).toBe(true);
    // Immediately denied
    expect(rateLimit(key, maxPerSecond).allowed).toBe(false);

    // Advance time by 1 second to refill
    jest.advanceTimersByTime(1000);

    // Now should be allowed again
    expect(rateLimit(key, maxPerSecond).allowed).toBe(true);
  });

  test("different keys are tracked independently", () => {
    const maxPerSecond = 1;

    // Exhaust key1
    expect(rateLimit("independent-key1", maxPerSecond).allowed).toBe(true);
    expect(rateLimit("independent-key1", maxPerSecond).allowed).toBe(false);

    // key2 should still be allowed (fresh bucket)
    expect(rateLimit("independent-key2", maxPerSecond).allowed).toBe(true);
  });
});
