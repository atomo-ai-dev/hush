import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/http';
import {
  CHAT_LIMIT,
  enforceChatLimit,
  enforceFeedbackLimit,
  enforceRoomLimit,
  enforceWriteLimit,
  ROOM_LIMIT,
  resetRateLimits,
  SlidingWindowRateLimiter,
  WRITE_LIMIT,
} from '@/lib/rate-limit';

describe('room and chat limits', () => {
  beforeEach(resetRateLimits);

  it('limits room creation and chat messages on independent budgets', () => {
    for (let i = 0; i < ROOM_LIMIT.limit; i++) enforceRoomLimit(3);
    expect(() => enforceRoomLimit(3)).toThrow(expect.objectContaining({ status: 429 }));

    for (let i = 0; i < CHAT_LIMIT.limit; i++) enforceChatLimit(3);
    expect(() => enforceChatLimit(3)).toThrow(/메시지를 너무 빠르게/);
    expect(() => enforceWriteLimit(3)).not.toThrow();
  });
});

function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('SlidingWindowRateLimiter', () => {
  it('allows up to `limit` hits per window and reports what remains', () => {
    const c = clock();
    const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 1000, now: c.now });
    expect(limiter.hit('a')).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
    expect(limiter.hit('a').remaining).toBe(1);
    expect(limiter.hit('a').remaining).toBe(0);
    expect(limiter.hit('a')).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1000 });
  });

  it('slides: capacity returns as the oldest hit expires', () => {
    const c = clock();
    const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1000, now: c.now });
    limiter.hit('a');
    c.advance(400);
    limiter.hit('a');
    c.advance(300);
    expect(limiter.hit('a')).toMatchObject({ allowed: false, retryAfterMs: 300 });
    c.advance(300); // first hit is now exactly windowMs old → expired
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
  });

  it('does not record rejected hits', () => {
    const c = clock();
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    limiter.hit('a');
    for (let i = 0; i < 10; i++) {
      c.advance(50);
      limiter.hit('a');
    }
    c.advance(500); // 1000ms after the only recorded hit
    expect(limiter.hit('a').allowed).toBe(true);
  });

  it('keeps keys independent', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000, now: clock().now });
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('b').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
  });

  it('resets one key or all keys', () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000, now: clock().now });
    limiter.hit('a');
    limiter.hit('b');
    limiter.reset('a');
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('b').allowed).toBe(false);
    limiter.reset();
    expect(limiter.hit('b').allowed).toBe(true);
  });

  it('prunes expired keys', () => {
    const c = clock();
    const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000, now: c.now });
    limiter.hit('a');
    limiter.hit('b');
    c.advance(600);
    limiter.hit('b');
    c.advance(500);
    limiter.prune();
    expect(limiter.size).toBe(1);
  });

  it('rejects nonsensical options', () => {
    expect(() => new SlidingWindowRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
    expect(() => new SlidingWindowRateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe('enforceWriteLimit', () => {
  beforeEach(resetRateLimits);

  it('allows 5 writes per session per minute, then throws 429 with Retry-After', () => {
    for (let i = 0; i < WRITE_LIMIT.limit; i++) enforceWriteLimit(1);
    let error: unknown;
    try {
      enforceWriteLimit(1);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(429);
    expect(apiError.code).toBe('RATE_LIMITED');
    expect(apiError.message).toContain('1분에 5개');
    expect(Number(apiError.headers['Retry-After'])).toBeGreaterThanOrEqual(1);
    expect(Number(apiError.headers['Retry-After'])).toBeLessThanOrEqual(60);

    // Another session is unaffected.
    expect(() => enforceWriteLimit(2)).not.toThrow();
  });

  it('keeps feedback on a separate budget', () => {
    for (let i = 0; i < WRITE_LIMIT.limit; i++) enforceWriteLimit(7);
    expect(() => enforceFeedbackLimit(7)).not.toThrow();
  });
});
