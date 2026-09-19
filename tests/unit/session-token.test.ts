import { describe, expect, it } from 'vitest';
import {
  hashSessionToken,
  isValidSessionToken,
  newSessionToken,
  parseCookies,
  SESSION_COOKIE,
  serializeSessionCookie,
  sessionTokenFromCookieHeader,
} from '@/lib/session-token';

describe('session tokens', () => {
  it('generates unique, valid 43-char base64url tokens', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(isValidSessionToken(a)).toBe(true);
    expect(a).toHaveLength(43);
  });

  it('rejects malformed tokens', () => {
    for (const bad of [
      undefined,
      null,
      42,
      '',
      'short',
      `${newSessionToken()}x`,
      `${'a'.repeat(42)}!`,
    ]) {
      expect(isValidSessionToken(bad)).toBe(false);
    }
  });

  it('hashes deterministically without echoing the token', () => {
    const token = newSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
  });
});

describe('parseCookies', () => {
  it('parses multiple cookies and trims whitespace', () => {
    expect(parseCookies('a=1; b = two ;c=%ED%95%9C')).toEqual({ a: '1', b: 'two', c: '한' });
  });

  it('handles empty, quoted and malformed input', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('novalue; x="quoted"; y=%E0%A4%A')).toEqual({ x: 'quoted', y: '%E0%A4%A' });
  });

  it('keeps the first occurrence of a duplicated cookie', () => {
    expect(parseCookies('a=1; a=2')).toEqual({ a: '1' });
  });
});

describe('sessionTokenFromCookieHeader', () => {
  it('returns the token only when it is well-formed', () => {
    const token = newSessionToken();
    expect(sessionTokenFromCookieHeader(`x=1; ${SESSION_COOKIE}=${token}`)).toBe(token);
    expect(sessionTokenFromCookieHeader(`${SESSION_COOKIE}=forged`)).toBeNull();
    expect(sessionTokenFromCookieHeader(null)).toBeNull();
  });
});

describe('serializeSessionCookie', () => {
  it('is httpOnly, lax and long-lived', () => {
    const cookie = serializeSessionCookie('tok');
    expect(cookie).toContain(`${SESSION_COOKIE}=tok`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(cookie).not.toContain('Secure');
    expect(serializeSessionCookie('tok', { secure: true })).toContain('Secure');
  });
});
