import { ApiError } from './http';

/**
 * Default list; override with HUSH_BANNED_WORDS="word1,word2" (replaces the
 * defaults). Matching is case-insensitive substring matching after Unicode
 * NFKC normalization, so full-width letters (ＦＵＣＫ) are caught too.
 */
export const DEFAULT_BANNED_WORDS = [
  '시발',
  '씨발',
  '병신',
  '좆',
  '개새끼',
  'fuck',
  'shit',
  'bitch',
] as const;

function normalize(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('en-US');
}

export interface BannedWordFilter {
  /** Returns the first banned word found in any of the texts, or null. */
  find(...texts: string[]): string | null;
  readonly words: readonly string[];
}

export function createBannedWordFilter(words: readonly string[]): BannedWordFilter {
  const normalized = [...new Set(words.map((w) => normalize(w.trim())).filter(Boolean))];
  return {
    words: normalized,
    find(...texts) {
      for (const text of texts) {
        const haystack = normalize(text);
        const hit = normalized.find((w) => haystack.includes(w));
        if (hit) return hit;
      }
      return null;
    },
  };
}

export function parseBannedWordList(raw: string | undefined): readonly string[] {
  if (raw === undefined || raw.trim() === '') return DEFAULT_BANNED_WORDS;
  return raw.split(',');
}

let filter: BannedWordFilter | null = null;

export function bannedWordFilter(): BannedWordFilter {
  filter ??= createBannedWordFilter(parseBannedWordList(process.env.HUSH_BANNED_WORDS));
  return filter;
}

/** Throws a 400 when any text contains a banned word. */
export function assertNoBannedWords(...texts: string[]): void {
  const hit = bannedWordFilter().find(...texts);
  if (hit) {
    throw new ApiError(400, 'BANNED_WORD', `사용할 수 없는 단어가 포함되어 있어요: "${hit}"`);
  }
}
