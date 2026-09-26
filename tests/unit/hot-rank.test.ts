import { describe, expect, it } from 'vitest';
import { hotScore, isTrending, type Rankable, rankHot } from '@/lib/hot-rank';

const now = new Date('2026-09-25T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const post = (over: Partial<Rankable>): Rankable => ({
  id: 1,
  likes: 0,
  comments: 0,
  createdAt: hoursAgo(0),
  ...over,
});

describe('hotScore', () => {
  it('scores a brand-new post with no activity', () => {
    expect(hotScore(post({}), now)).toBeCloseTo(0.353553, 5);
  });

  it('a comment weighs twice a like', () => {
    const liked = hotScore(post({ likes: 2 }), now);
    expect(hotScore(post({ comments: 1 }), now)).toBeCloseTo(liked, 10);
  });

  it('the score falls as the post ages', () => {
    expect(hotScore(post({ likes: 10, createdAt: hoursAgo(2) }), now)).toBeCloseTo(1.375, 10);
    expect(hotScore(post({ likes: 10, createdAt: hoursAgo(7) }), now)).toBeCloseTo(11 / 27, 10);
  });

  it('a future createdAt counts as age zero', () => {
    const future = post({ likes: 3, createdAt: hoursAgo(-5) });
    expect(hotScore(future, now)).toBeCloseTo(4 / 2 ** 1.5, 10);
  });
});

describe('rankHot', () => {
  it('rankHot orders by score', () => {
    const items = [post({ id: 1 }), post({ id: 2, likes: 5 }), post({ id: 3, likes: 2 })];
    expect(rankHot(items, now).map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it('rankHot breaks a score tie by the newer post', () => {
    const older = post({ id: 1, likes: 26, createdAt: hoursAgo(7) });
    const newer = post({ id: 2, likes: 7, createdAt: hoursAgo(2) });
    expect(rankHot([older, newer], now).map((p) => p.id)).toEqual([2, 1]);
  });

  it('rankHot breaks a full tie by the larger id', () => {
    const items = [post({ id: 4 }), post({ id: 9 }), post({ id: 6 })];
    expect(rankHot(items, now).map((p) => p.id)).toEqual([9, 6, 4]);
  });

  it('rankHot leaves the input array untouched', () => {
    const items = [post({ id: 1 }), post({ id: 2, likes: 5 })];
    const ranked = rankHot(items, now);
    expect(items.map((p) => p.id)).toEqual([1, 2]);
    expect(ranked).not.toBe(items);
  });
});

describe('isTrending', () => {
  it('isTrending is true exactly at the threshold', () => {
    expect(isTrending(post({ likes: 7, createdAt: hoursAgo(2) }), now, 1, 24)).toBe(true);
  });

  it('isTrending is true at exactly maxAgeHours', () => {
    const old = post({ likes: 10_000, createdAt: hoursAgo(24) });
    expect(isTrending(old, now, 1, 24)).toBe(true);
  });

  it('isTrending is false past maxAgeHours', () => {
    const old = post({ likes: 10_000, createdAt: hoursAgo(25) });
    expect(isTrending(old, now, 1, 24)).toBe(false);
  });
});
