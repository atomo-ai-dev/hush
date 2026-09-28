import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'hush_sid';
/** One year; the cookie is the only thing tying a browser to its nickname. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** 32 random bytes, base64url encoded (43 chars). */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isValidSessionToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/** Only the hash is stored server-side. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Minimal RFC 6265 cookie header parser. Later duplicates do not override earlier ones. */
export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || Object.hasOwn(out, name)) continue;
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export function sessionTokenFromCookieHeader(header: string | null | undefined): string | null {
  const token = parseCookies(header)[SESSION_COOKIE];
  return isValidSessionToken(token) ? token : null;
}

export function serializeSessionCookie(token: string, { secure = false } = {}): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}
