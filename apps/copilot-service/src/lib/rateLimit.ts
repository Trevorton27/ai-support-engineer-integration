// Simple in-memory token-bucket rate limiter.
// Good enough for single-instance deployments. For multi-instance, swap the
// `store` for Redis/Upstash.

import { ApiError } from './apiResponse';

type Bucket = {
  tokens: number;
  lastRefill: number;
};

type Policy = {
  capacity: number; // max tokens
  refillPerSec: number; // tokens added per second
};

const DEFAULT_POLICY: Policy = {
  capacity: 30, // 30 requests
  refillPerSec: 30 / 60, // refills over 60s
};

const store = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  policy: Policy = DEFAULT_POLICY,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const existing = store.get(key);

  let bucket: Bucket;
  if (!existing) {
    bucket = { tokens: policy.capacity, lastRefill: now };
  } else {
    const elapsedSec = (now - existing.lastRefill) / 1000;
    const refilled = Math.min(
      policy.capacity,
      existing.tokens + elapsedSec * policy.refillPerSec,
    );
    bucket = { tokens: refilled, lastRefill: now };
  }

  if (bucket.tokens < 1) {
    const needed = 1 - bucket.tokens;
    const retryAfterMs = Math.ceil((needed / policy.refillPerSec) * 1000);
    store.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  bucket.tokens -= 1;
  store.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    retryAfterMs: 0,
  };
}

// Helper for route handlers: throws ApiError on limit exceeded.
export function enforceRateLimit(key: string, policy?: Policy) {
  const result = checkRateLimit(key, policy);
  if (!result.allowed) {
    throw new ApiError(
      429,
      'rate_limit_exceeded',
      `Too many requests. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s.`,
    );
  }
  return result;
}

// Test-only: clear the store.
export function __resetRateLimitStore() {
  store.clear();
}
