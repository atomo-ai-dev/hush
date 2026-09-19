import { describe, expect, it } from 'vitest';
import { commentInput, idParam, LIMITS, parsePage, postInput, reportInput } from '@/lib/validation';

describe('reportInput', () => {
  it('accepts posts and comments with an optional reason', () => {
    expect(reportInput.parse({ targetType: 'post', targetId: 3 })).toEqual({
      targetType: 'post',
      targetId: 3,
      reason: null,
    });
    expect(reportInput.parse({ targetType: 'comment', targetId: 1, reason: ' 욕설 ' })).toEqual({
      targetType: 'comment',
      targetId: 1,
      reason: '욕설',
    });
  });

  it.each([
    { targetType: 'user', targetId: 1 },
    { targetType: 'post', targetId: 0 },
    { targetType: 'post', targetId: '1' },
    { targetType: 'post', targetId: 1.5 },
    { targetType: 'post', targetId: 1, reason: 'r'.repeat(201) },
  ])('rejects %j', (input) => {
    expect(reportInput.safeParse(input).success).toBe(false);
  });
});

describe('postInput', () => {
  it('trims title and body', () => {
    expect(postInput.parse({ title: '  안녕  ', body: '\n본문\n' })).toEqual({
      title: '안녕',
      body: '본문',
    });
  });

  it('rejects missing or blank fields with Korean messages', () => {
    expect(postInput.safeParse({ title: '', body: 'x' }).error?.issues[0].message).toBe(
      '제목을(를) 입력해 주세요.',
    );
    expect(postInput.safeParse({ title: 'x', body: '   ' }).error?.issues[0].message).toBe(
      '본문을(를) 입력해 주세요.',
    );
    expect(postInput.safeParse({ title: 'x' }).success).toBe(false);
    expect(postInput.safeParse({ title: 1, body: 'x' }).success).toBe(false);
  });

  it('enforces the title limit at exactly 100 characters', () => {
    expect(postInput.safeParse({ title: 'a'.repeat(LIMITS.postTitle), body: 'x' }).success).toBe(
      true,
    );
    const tooLong = postInput.safeParse({ title: 'a'.repeat(LIMITS.postTitle + 1), body: 'x' });
    expect(tooLong.error?.issues[0].message).toBe('제목은(는) 100자 이하여야 합니다.');
  });

  it('counts characters, not UTF-16 code units (emoji, Hangul)', () => {
    expect(postInput.safeParse({ title: '😀'.repeat(100), body: 'x' }).success).toBe(true);
    expect(postInput.safeParse({ title: '가'.repeat(100), body: 'x' }).success).toBe(true);
  });

  it('enforces the body limit of 5000 characters', () => {
    expect(postInput.safeParse({ title: 't', body: 'b'.repeat(5000) }).success).toBe(true);
    expect(postInput.safeParse({ title: 't', body: 'b'.repeat(5001) }).success).toBe(false);
  });
});

describe('commentInput', () => {
  it('accepts up to 1000 characters and rejects blanks', () => {
    expect(commentInput.safeParse({ body: 'c'.repeat(1000) }).success).toBe(true);
    expect(commentInput.safeParse({ body: 'c'.repeat(1001) }).success).toBe(false);
    expect(commentInput.safeParse({ body: ' \t ' }).success).toBe(false);
  });
});

describe('idParam', () => {
  it('coerces positive integer strings', () => {
    expect(idParam.parse('42')).toBe(42);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '99999999999999999999'])('rejects %j', (raw) => {
    expect(idParam.safeParse(raw).success).toBe(false);
  });
});

describe('parsePage', () => {
  it.each([
    [undefined, 1],
    [null, 1],
    ['', 1],
    ['0', 1],
    ['3', 3],
    ['-2', 1],
    ['abc', 1],
    ['1234567', 1],
    [['4', '5'], 4],
  ])('parsePage(%j) = %i', (raw, expected) => {
    expect(parsePage(raw as string | string[] | null | undefined)).toBe(expected);
  });
});
