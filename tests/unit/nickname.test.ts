import { describe, expect, it } from 'vitest';
import { ADJECTIVES, ANIMALS, generateNickname, NICKNAME_PATTERN } from '@/lib/nickname';

function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('generateNickname', () => {
  it('builds "<adjective> <animal> <number>"', () => {
    expect(generateNickname(sequence(0, 0, 0))).toBe(`${ADJECTIVES[0]} ${ANIMALS[0]} 1`);
  });

  it('uses the last entries and caps the number at 99 near rand() → 1', () => {
    const almostOne = 0.999999;
    expect(generateNickname(() => almostOne)).toBe(
      `${ADJECTIVES[ADJECTIVES.length - 1]} ${ANIMALS[ANIMALS.length - 1]} 99`,
    );
  });

  it('always matches the nickname pattern with Math.random', () => {
    for (let i = 0; i < 500; i++) {
      const nickname = generateNickname();
      expect(nickname).toMatch(NICKNAME_PATTERN);
      const n = Number(nickname.split(' ').at(-1));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(99);
    }
  });

  it('produces varied nicknames', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateNickname()));
    expect(seen.size).toBeGreaterThan(150);
  });
});
