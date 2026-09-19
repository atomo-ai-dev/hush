import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBannedWordFilter,
  DEFAULT_BANNED_WORDS,
  parseBannedWordList,
} from '@/lib/banned-words';

describe('createBannedWordFilter', () => {
  const filter = createBannedWordFilter(['badword', '나쁜말']);

  it('returns null for clean text', () => {
    expect(filter.find('안녕하세요, 좋은 하루!')).toBeNull();
    expect(filter.find('')).toBeNull();
  });

  it('matches case-insensitively as a substring', () => {
    expect(filter.find('this is a BadWord!')).toBe('badword');
    expect(filter.find('xxBADWORDxx')).toBe('badword');
    expect(filter.find('그건 나쁜말이야')).toBe('나쁜말');
  });

  it('normalizes full-width characters (NFKC)', () => {
    expect(filter.find('ｂａｄｗｏｒｄ')).toBe('badword');
  });

  it('checks every text it is given', () => {
    expect(filter.find('clean title', 'dirty badword body')).toBe('badword');
  });

  it('ignores blank and duplicate configured words', () => {
    const f = createBannedWordFilter([' Spam ', '', '  ', 'spam']);
    expect(f.words).toEqual(['spam']);
    expect(f.find('SPAM here')).toBe('spam');
    expect(f.find('   ')).toBeNull();
  });
});

describe('parseBannedWordList', () => {
  it('uses the defaults when unset or empty', () => {
    expect(parseBannedWordList(undefined)).toBe(DEFAULT_BANNED_WORDS);
    expect(parseBannedWordList('  ')).toBe(DEFAULT_BANNED_WORDS);
  });

  it('splits a comma separated list', () => {
    expect(parseBannedWordList('a,b , c')).toEqual(['a', 'b ', ' c']);
  });
});

describe('assertNoBannedWords (env configured)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reads HUSH_BANNED_WORDS and throws a 400 ApiError on a hit', async () => {
    vi.stubEnv('HUSH_BANNED_WORDS', 'foo,바보');
    vi.resetModules();
    const { assertNoBannedWords } = await import('@/lib/banned-words');
    expect(() => assertNoBannedWords('hello')).not.toThrow();
    expect(() => assertNoBannedWords('FOO bar')).toThrow(
      expect.objectContaining({ status: 400, code: 'BANNED_WORD' }),
    );
    expect(() => assertNoBannedWords('ok', '바보야')).toThrow(/바보/);
  });

  it('uses the default list when the env var is not set', async () => {
    vi.stubEnv('HUSH_BANNED_WORDS', '');
    vi.resetModules();
    const { assertNoBannedWords } = await import('@/lib/banned-words');
    expect(() => assertNoBannedWords('what the FUCK')).toThrow(/fuck/);
  });
});
