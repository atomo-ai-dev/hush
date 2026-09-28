import { ApiError } from './http';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the next hit would be allowed (0 when allowed). */
  retryAfterMs: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

/**
 * In-memory sliding-window limiter: at most `limit` hits per key within any
 * `windowMs` span. Rejected hits are not recorded.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(private readonly opts: RateLimiterOptions) {
    if (opts.limit < 1 || opts.windowMs <= 0) throw new Error('Invalid rate limiter options');
    this.now = opts.now ?? Date.now;
  }

  hit(key: string): RateLimitResult {
    const now = this.now();
    const recent = this.recent(key, now);
    if (recent.length >= this.opts.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: recent[0] + this.opts.windowMs - now };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, remaining: this.opts.limit - recent.length, retryAfterMs: 0 };
  }

  reset(key?: string): void {
    if (key === undefined) this.hits.clear();
    else this.hits.delete(key);
  }

  /** Drops keys whose hits have all expired; call periodically to bound memory. */
  prune(): void {
    const now = this.now();
    for (const key of this.hits.keys()) {
      if (this.recent(key, now).length === 0) this.hits.delete(key);
    }
  }

  get size(): number {
    return this.hits.size;
  }

  private recent(key: string, now: number): number[] {
    const cutoff = now - this.opts.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length === 0) this.hits.delete(key);
    else this.hits.set(key, list);
    return list;
  }
}

export const WRITE_LIMIT = { limit: 5, windowMs: 60_000 } as const;
export const FEEDBACK_LIMIT = { limit: 3, windowMs: 60_000 } as const;
export const ROOM_LIMIT = { limit: 3, windowMs: 60_000 } as const;
export const CHAT_LIMIT = { limit: 10, windowMs: 10_000 } as const;

const LIMITS = {
  write: WRITE_LIMIT,
  feedback: FEEDBACK_LIMIT,
  room: ROOM_LIMIT,
  chat: CHAT_LIMIT,
} as const;

type LimiterName = keyof typeof LIMITS;
type Limiters = Record<LimiterName, SlidingWindowRateLimiter>;

// Shared across route bundles, the WebSocket server and hot reloads within one process.
const globalForLimits = globalThis as unknown as { __hushLimiters?: Limiters };

export function limiters(): Limiters {
  if (!globalForLimits.__hushLimiters) {
    const created = Object.fromEntries(
      Object.entries(LIMITS).map(([name, opts]) => [name, new SlidingWindowRateLimiter(opts)]),
    ) as Limiters;
    setInterval(() => {
      for (const limiter of Object.values(created)) limiter.prune();
    }, 5 * 60_000).unref();
    globalForLimits.__hushLimiters = created;
  }
  return globalForLimits.__hushLimiters;
}

export function resetRateLimits(): void {
  for (const limiter of Object.values(limiters())) limiter.reset();
}

function enforce(limiter: SlidingWindowRateLimiter, key: string, message: string): void {
  const result = limiter.hit(key);
  if (!result.allowed) {
    const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    throw new ApiError(429, 'RATE_LIMITED', `${message} ${seconds}초 후에 다시 시도해 주세요.`, {
      'Retry-After': String(seconds),
    });
  }
}

/** Posts and comments share one budget: 5 per minute per session. */
export function enforceWriteLimit(sessionId: number): void {
  enforce(
    limiters().write,
    `session:${sessionId}`,
    `너무 빠르게 작성하고 있어요. 글과 댓글은 1분에 ${WRITE_LIMIT.limit}개까지 쓸 수 있어요.`,
  );
}

export function enforceFeedbackLimit(sessionId: number): void {
  enforce(limiters().feedback, `session:${sessionId}`, '버그 신고를 너무 자주 보내고 있어요.');
}

export function enforceRoomLimit(sessionId: number): void {
  enforce(limiters().room, `session:${sessionId}`, '채팅방을 너무 많이 만들고 있어요.');
}

/** Chat messages: 10 per 10 seconds per session. */
export function enforceChatLimit(sessionId: number): void {
  enforce(limiters().chat, `session:${sessionId}`, '메시지를 너무 빠르게 보내고 있어요.');
}
