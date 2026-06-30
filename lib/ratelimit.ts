// In-memory per-IP rate limiter. This is intentionally simple so the
// whole project runs with zero extra services and zero extra cost.
//
// Honest limitation: this Map lives in a single serverless function
// instance's memory. On Vercel, a burst of traffic can spin up several
// instances in parallel (each gets its own counter), and any instance
// can be recycled at any time (counter resets to zero). In practice
// this means the real-world cap is "roughly N per day, per IP" rather
// than a mathematically exact guarantee — good enough to stop a single
// person from accidentally burning your API budget in one sitting, not
// a hard security boundary.
//
// If you outgrow this: swap the body of checkRateLimit() for calls to
// Upstash Redis (also has a free tier, persists across instances) —
// the function signature below is designed so that's a drop-in change.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 24 * 60 * 60 * 1000;
const FREE_LIMIT = Number(process.env.FREE_ROASTS_PER_DAY) || 3;

// Clear out stale buckets occasionally so memory doesn't grow unbounded
// on a long-lived warm instance.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: FREE_LIMIT - 1, resetAt, limit: FREE_LIMIT };
  }

  if (existing.count >= FREE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, limit: FREE_LIMIT };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: FREE_LIMIT - existing.count,
    resetAt: existing.resetAt,
    limit: FREE_LIMIT,
  };
}
