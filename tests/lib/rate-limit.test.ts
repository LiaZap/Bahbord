import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

describe('lib/rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows calls inside the limit', () => {
    // Use a unique key per test so global Map state from prior tests does not leak.
    const key = 'allow-' + Math.random();
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, 5, 1000);
      expect(r.ok).toBe(true);
      expect(r.retryAfter).toBeUndefined();
    }
  });

  it('blocks once limit is exceeded and returns retryAfter (seconds)', () => {
    const key = 'block-' + Math.random();
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeTypeOf('number');
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it('resets the bucket after the window passes', () => {
    const key = 'reset-' + Math.random();
    for (let i = 0; i < 2; i++) {
      expect(checkRateLimit(key, 2, 1000).ok).toBe(true);
    }
    expect(checkRateLimit(key, 2, 1000).ok).toBe(false);

    // Advance past the window — bucket resets.
    vi.advanceTimersByTime(1500);
    const after = checkRateLimit(key, 2, 1000);
    expect(after.ok).toBe(true);
    expect(after.retryAfter).toBeUndefined();
  });

  it('different keys are tracked independently', () => {
    const k1 = 'sep-a-' + Math.random();
    const k2 = 'sep-b-' + Math.random();
    expect(checkRateLimit(k1, 1, 60_000).ok).toBe(true);
    expect(checkRateLimit(k1, 1, 60_000).ok).toBe(false);
    // k2 is fresh — must succeed.
    expect(checkRateLimit(k2, 1, 60_000).ok).toBe(true);
  });

  it('uses default limit (60) and window (60_000) when not specified', () => {
    const key = 'default-' + Math.random();
    for (let i = 0; i < 60; i++) {
      expect(checkRateLimit(key).ok).toBe(true);
    }
    expect(checkRateLimit(key).ok).toBe(false);
  });

  it('retryAfter shrinks as time advances within the window', () => {
    const key = 'retry-' + Math.random();
    expect(checkRateLimit(key, 1, 10_000).ok).toBe(true);
    const r1 = checkRateLimit(key, 1, 10_000);
    expect(r1.ok).toBe(false);
    const initialRetry = r1.retryAfter ?? 0;
    vi.advanceTimersByTime(5000);
    const r2 = checkRateLimit(key, 1, 10_000);
    expect(r2.ok).toBe(false);
    expect(r2.retryAfter).toBeLessThan(initialRetry);
  });
});
