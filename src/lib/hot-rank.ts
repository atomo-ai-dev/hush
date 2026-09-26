/**
 * "Hot" ranking for board posts: likes and comments, decayed by age.
 * The current time is passed in so ranking stays deterministic.
 */
const HOUR = 3_600_000;
const COMMENT_WEIGHT = 2;
const GRAVITY = 1.5;

export interface Rankable {
  id: number;
  likes: number;
  comments: number;
  /** ISO timestamp. */
  createdAt: string;
}

function ageHours(item: Rankable, now: Date): number {
  const age = (now.getTime() - new Date(item.createdAt).getTime()) / HOUR;
  return Math.max(0, age);
}

/** Activity score that decays as the post ages. */
export function hotScore(item: Rankable, now: Date): number {
  const points = item.likes + COMMENT_WEIGHT * item.comments + 1;
  return points / (ageHours(item, now) + 2) ** GRAVITY;
}

/** Posts ordered hottest first, as a new array. */
export function rankHot<T extends Rankable>(items: readonly T[], now: Date): T[] {
  const scored = items.map((item) => ({
    item,
    score: hotScore(item, now),
    time: new Date(item.createdAt).getTime(),
  }));
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.time !== b.time) return b.time - a.time;
    return b.item.id - a.item.id;
  });
  return scored.map(({ item }) => item);
}

/** Whether a post is hot enough and recent enough to show as trending. */
export function isTrending(
  item: Rankable,
  now: Date,
  threshold: number,
  maxAgeHours: number,
): boolean {
  if (ageHours(item, now) > maxAgeHours) return false;
  return hotScore(item, now) >= threshold;
}
