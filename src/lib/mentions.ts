/**
 * @nickname mentions in chat messages and comments.
 *
 * A mention is '@' followed by a name of 2–20 Korean, Latin, digit or '_'
 * characters. The '@' must open the text or follow whitespace, so an email
 * address such as a@b.com is not a mention. A longer run of name characters is
 * cut at twenty, and a one-character name is not a mention at all.
 */
const NAME_CHARS = '[가-힣A-Za-z0-9_]';
const MIN_NAME = 2;
const MAX_NAME = 20;
const MENTION = new RegExp(`(?<=^|\\s)@(${NAME_CHARS}{${MIN_NAME},${MAX_NAME}})`, 'g');

export type Segment = { kind: 'text' | 'mention'; value: string };

/** Mentioned names without the '@', in first-appearance order, without duplicates. */
export function extractMentions(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(MENTION)) {
    const name = match[1];
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Splits text into plain and mention segments for display. Joining the
 * values gives back the original text; mention segments keep their '@'.
 * Empty text gives no segments.
 */
export function segmentMentions(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MENTION)) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, start) });
    }
    segments.push({ kind: 'mention', value: match[0] });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }
  return segments;
}

/** True when `nickname` is mentioned, ignoring case; the whole name must match. */
export function mentions(text: string, nickname: string): boolean {
  const wanted = nickname.toLowerCase();
  return extractMentions(text).some((name) => name.toLowerCase() === wanted);
}
