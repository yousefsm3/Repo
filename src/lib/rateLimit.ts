/**
 * Minimal in-memory rate limiter for auth endpoints (brute-force protection, spec §13/§43).
 * NOTE: in-memory means it resets per server instance — fine for a single-region
 * deployment at launch, but replace with a Redis-backed limiter (e.g. using the
 * same Redis instance as BullMQ) before scaling to multiple instances.
 */

const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false; // blocked
  }

  entry.count += 1;
  return true;
}
