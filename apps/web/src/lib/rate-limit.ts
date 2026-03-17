const tokenBuckets = new Map<string, { tokens: number; lastRefill: number }>();

export function rateLimit(
  key: string,
  maxPerSecond: number
): { allowed: boolean } {
  const now = Date.now();
  let bucket = tokenBuckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxPerSecond, lastRefill: now };
    tokenBuckets.set(key, bucket);
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(maxPerSecond, bucket.tokens + elapsed * maxPerSecond);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return { allowed: false };
  }

  bucket.tokens -= 1;
  return { allowed: true };
}
