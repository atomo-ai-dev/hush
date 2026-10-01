import { cookies } from 'next/headers';
import { isDemoMode } from './demo';
import { getOrCreateSession, type Session } from './session';
import { isValidSessionToken, SESSION_COOKIE } from './session-token';

/**
 * Session for server components. The custom server guarantees the cookie on
 * page requests; returns null only if it is missing or malformed.
 */
export async function getCurrentSession(): Promise<Session | null> {
  if (isDemoMode()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return isValidSessionToken(token) ? getOrCreateSession(token) : null;
}
