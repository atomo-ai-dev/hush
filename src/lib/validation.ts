import { z } from 'zod';

import { LIMITS } from './limits';

export { LIMITS, PAGE_SIZE } from './limits';

/**
 * Appends the Korean particle that fits the word's last syllable:
 * `withParticle('제목', '을', '를')` → "제목을", `withParticle('메시지', '을', '를')` → "메시지를".
 */
export function withParticle(word: string, afterConsonant: string, afterVowel: string): string {
  const code = word.charCodeAt(word.length - 1);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  const hasFinalConsonant = isHangulSyllable && (code - 0xac00) % 28 !== 0;
  return `${word}${hasFinalConsonant ? afterConsonant : afterVowel}`;
}

/** Trimmed, non-blank string with a max length counted in characters (code points). */
function text(label: string, max: number) {
  const required = `${withParticle(label, '을', '를')} 입력해 주세요.`;
  return z
    .string({ error: required })
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { error: required })
    .refine((s) => [...s].length <= max, {
      error: `${withParticle(label, '은', '는')} ${max}자 이하여야 합니다.`,
    });
}

export const postInput = z.object({
  title: text('제목', LIMITS.postTitle),
  body: text('본문', LIMITS.postBody),
});
export type PostInput = z.infer<typeof postInput>;

export const commentInput = z.object({
  body: text('댓글', LIMITS.comment),
});
export type CommentInput = z.infer<typeof commentInput>;

/** Positive integer id from a route segment such as "/posts/42". */
export const idParam = z
  .string({ error: '잘못된 주소입니다.' })
  .refine((s) => /^[1-9]\d*$/.test(s), { error: '잘못된 주소입니다.' })
  .pipe(
    z.coerce
      .number({ error: '잘못된 주소입니다.' })
      .int({ error: '잘못된 주소입니다.' })
      .positive({ error: '잘못된 주소입니다.' })
      .max(Number.MAX_SAFE_INTEGER, { error: '잘못된 주소입니다.' })
  );

/** 1-based page number; missing or garbage values fall back to page 1. */
export function parsePage(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1;
  return Math.max(1, Number(raw));
}

export const reportInput = z.object({
  targetType: z.enum(['post', 'comment'], { error: '신고 대상이 올바르지 않습니다.' }),
  targetId: z
    .number({ error: '신고 대상이 올바르지 않습니다.' })
    .int({ error: '신고 대상이 올바르지 않습니다.' })
    .positive({ error: '신고 대상이 올바르지 않습니다.' })
    .max(Number.MAX_SAFE_INTEGER, { error: '신고 대상이 올바르지 않습니다.' }),
  reason: z
    .string()
    .trim()
    .max(200, { error: '신고 사유는 200자 이하여야 합니다.' })
    .nullish()
    .transform((s) => s || null),
});
export type ReportInput = z.infer<typeof reportInput>;

export const feedbackInput = z.object({
  message: text('내용', LIMITS.feedback),
  pageUrl: z
    .string()
    .trim()
    .max(500, { error: '페이지 주소가 너무 깁니다.' })
    .nullish()
    .transform((s) => s || null),
});
export type FeedbackInput = z.infer<typeof feedbackInput>;

export const roomInput = z.object({
  name: text('방 이름', LIMITS.roomName),
});
export type RoomInput = z.infer<typeof roomInput>;

/** A chat message sent over the WebSocket: `{ "type": "message", "body": "..." }`. */
export const chatMessageInput = z.object({
  type: z.literal('message', { error: '알 수 없는 메시지 형식입니다.' }),
  body: text('메시지', LIMITS.chatMessage),
});
export type ChatMessageInput = z.infer<typeof chatMessageInput>;
