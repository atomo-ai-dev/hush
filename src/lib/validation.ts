import { z } from 'zod';

import { LIMITS } from './limits';

export { LIMITS, PAGE_SIZE } from './limits';

/** Trimmed, non-blank string with a max length counted in characters (code points). */
function text(label: string, max: number) {
  return z
    .string({ error: `${label}을(를) 입력해 주세요.` })
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { error: `${label}을(를) 입력해 주세요.` })
    .refine((s) => [...s].length <= max, { error: `${label}은(는) ${max}자 이하여야 합니다.` });
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
export const idParam = z.coerce
  .number({ error: '잘못된 주소입니다.' })
  .int({ error: '잘못된 주소입니다.' })
  .positive({ error: '잘못된 주소입니다.' })
  .max(Number.MAX_SAFE_INTEGER, { error: '잘못된 주소입니다.' });

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
