import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  enforceRateLimit,
  __resetRateLimitStore,
} from '../rateLimit';
import { ApiError } from '../apiResponse';

describe('rateLimit', () => {
  beforeEach(() => __resetRateLimitStore());

  it('allows requests within capacity', () => {
    const policy = { capacity: 3, refillPerSec: 0 };
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit('user:a', policy);
      expect(r.allowed).toBe(true);
    }
  });

  it('blocks requests exceeding capacity', () => {
    const policy = { capacity: 2, refillPerSec: 0 };
    checkRateLimit('user:b', policy);
    checkRateLimit('user:b', policy);
    const r = checkRateLimit('user:b', policy);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it('separates buckets by key', () => {
    const policy = { capacity: 1, refillPerSec: 0 };
    expect(checkRateLimit('user:a', policy).allowed).toBe(true);
    expect(checkRateLimit('user:b', policy).allowed).toBe(true);
    expect(checkRateLimit('user:a', policy).allowed).toBe(false);
  });

  it('enforceRateLimit throws ApiError when exceeded', () => {
    const policy = { capacity: 1, refillPerSec: 0 };
    enforceRateLimit('user:c', policy);
    expect(() => enforceRateLimit('user:c', policy)).toThrow(ApiError);
  });

  it('refills over time', async () => {
    const policy = { capacity: 1, refillPerSec: 100 };
    enforceRateLimit('user:d', policy);
    await new Promise((r) => setTimeout(r, 20));
    // enough refill for another request
    expect(checkRateLimit('user:d', policy).allowed).toBe(true);
  });
});
