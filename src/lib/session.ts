import { query } from './db';
import { DEMO_VISITOR, isDemoMode } from './demo';
import { ApiError } from './http';
import { generateNickname } from './nickname';
import { hashSessionToken, sessionTokenFromCookieHeader } from './session-token';

export interface Session {
  id: number;
  nickname: string;
}

/**
 * Looks up the session for a cookie token, creating it (with a fresh random
 * nickname) the first time the token is seen.
 */
export async function getOrCreateSession(token: string): Promise<Session> {
  const { rows } = await query<{ id: string; nickname: string }>(
    `INSERT INTO sessions (token_hash, nickname) VALUES ($1, $2)
     ON CONFLICT (token_hash) DO UPDATE SET last_seen_at = now()
     RETURNING id, nickname`,
    [hashSessionToken(token), generateNickname()],
  );
  return { id: Number(rows[0].id), nickname: rows[0].nickname };
}

/** Resolves the caller's session from the request cookie or throws 401. */
export async function requireSession(req: Request): Promise<Session> {
  if (isDemoMode()) return DEMO_VISITOR;
  const token = sessionTokenFromCookieHeader(req.headers.get('cookie'));
  if (!token) {
    throw new ApiError(401, 'NO_SESSION', '세션이 없습니다. 페이지를 새로고침해 주세요.');
  }
  return getOrCreateSession(token);
}
