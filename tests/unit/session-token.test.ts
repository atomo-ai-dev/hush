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

  // #13: `name in out` saw inherited Object.prototype members, so these cookies were dropped.
  it('keeps cookies named after Object.prototype members', () => {
    const cookies = parseCookies('toString=1; constructor=2');
    expect(Object.hasOwn(cookies, 'toString')).toBe(true);
    expect(Object.hasOwn(cookies, 'constructor')).toBe(true);
    expect(cookies.toString).toBe('1');
    expect(cookies.constructor).toBe('2');
  });

  it('stores __proto__ as an own cookie without touching any prototype', () => {
    const cookies = parseCookies('__proto__=x');
    expect(Object.hasOwn(cookies, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(cookies, '__proto__')?.value).toBe('x');
    expect(Object.getPrototypeOf(cookies)).toBeNull();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('keeps the first occurrence for prototype-named duplicates too', () => {
    const cookies = parseCookies('toString=1; toString=2; __proto__=a; __proto__=b');
    expect(cookies.toString).toBe('1');
    expect(Object.getOwnPropertyDescriptor(cookies, '__proto__')?.value).toBe('a');
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
