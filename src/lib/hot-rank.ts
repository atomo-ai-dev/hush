/**
 * "Hot" ranking for board posts: likes and comments, decayed by age.
 *
 * A comment weighs twice a like, and every post starts with one point so a
 * brand-new post without activity still ranks above an old one. The current
 * time is always passed in so ranking stays deterministic.
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

/** Hours since the post was created; a createdAt in the future counts as zero. */
function ageHours(item: Rankable, now: Date): number {
  const age = (now.getTime() - new Date(item.createdAt).getTime()) / HOUR;
  return Math.max(0, age);
}

/** (likes + 2·comments + 1) / (ageHours + 2)^1.5. */
export function hotScore(item: Rankable, now: Date): number {
  const points = item.likes + COMMENT_WEIGHT * item.comments + 1;
  return points / (ageHours(item, now) + 2) ** GRAVITY;
}

/**
 * Highest score first. Ties go to the newer post, then to the larger id.
 * Returns a new array; the input is left untouched.
 */
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

/**
 * True when the score reaches `threshold` and the post is at most
 * `maxAgeHours` old. Both bounds are inclusive.
 */
export function isTrending(
  item: Rankable,
  now: Date,
  threshold: number,
  maxAgeHours: number,
): boolean {
  if (ageHours(item, now) > maxAgeHours) return false;
  return hotScore(item, now) >= threshold;
}
