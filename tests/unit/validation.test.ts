import { describe, expect, it } from 'vitest';
import {
  chatMessageInput,
  commentInput,
  feedbackInput,
  idParam,
  LIMITS,
  parsePage,
  postInput,
  reportInput,
  roomInput,
  withParticle,
} from '@/lib/validation';

describe('withParticle', () => {
  it.each([
    ['제목', '제목을'],
    ['본문', '본문을'],
    ['댓글', '댓글을'],
    ['방 이름', '방 이름을'],
    ['메시지', '메시지를'],
    ['내용', '내용을'],
    ['ABC', 'ABC를'],
  ])('%s → %s', (word, expected) => {
    expect(withParticle(word, '을', '를')).toBe(expected);
  });

  it('picks 은/는 the same way', () => {
    expect(withParticle('제목', '은', '는')).toBe('제목은');
    expect(withParticle('메시지', '은', '는')).toBe('메시지는');
  });
});

describe('roomInput', () => {
  it('trims and limits room names to 40 characters', () => {
    expect(roomInput.parse({ name: '  잡담방 ' })).toEqual({ name: '잡담방' });
    expect(roomInput.safeParse({ name: '방'.repeat(40) }).success).toBe(true);
    expect(roomInput.safeParse({ name: '방'.repeat(41) }).success).toBe(false);
    expect(roomInput.safeParse({ name: '   ' }).success).toBe(false);
  });
});

describe('chatMessageInput', () => {
  it('accepts a trimmed message of up to 500 characters', () => {
    expect(chatMessageInput.parse({ type: 'message', body: ' 안녕 ' })).toEqual({
      type: 'message',
      body: '안녕',
    });
    expect(chatMessageInput.safeParse({ type: 'message', body: 'a'.repeat(500) }).success).toBe(
      true,
    );
    expect(chatMessageInput.safeParse({ type: 'message', body: 'a'.repeat(501) }).success).toBe(
      false,
    );
  });

  it.each([
    { type: 'message', body: '' },
    { type: 'message', body: ' \n\t　' },
    { type: 'message' },
    { type: 'typing', body: 'hi' },
    { body: 'hi' },
  ])('rejects %j', (input) => {
    expect(chatMessageInput.safeParse(input).success).toBe(false);
  });
});

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

  // #12: the reason is counted in code points like every other field, so an emoji is one character.
  it.each([150, 200])('accepts a reason of %i emoji', (n) => {
    const reason = '😀'.repeat(n);
    expect(reportInput.parse({ targetType: 'post', targetId: 1, reason }).reason).toBe(reason);
  });

  it('rejects a reason of 201 emoji with the same message', () => {
    const result = reportInput.safeParse({
      targetType: 'post',
      targetId: 1,
      reason: '😀'.repeat(201),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('신고 사유는 200자 이하여야 합니다.');
  });

  it('turns a blank reason into null', () => {
    expect(reportInput.parse({ targetType: 'post', targetId: 1, reason: ' \n\t ' }).reason).toBe(
      null,
    );
  });
});

describe('feedbackInput', () => {
  it('requires a non-blank message up to 2000 characters', () => {
    expect(feedbackInput.parse({ message: ' 버튼이 안 눌려요 ' })).toEqual({
      message: '버튼이 안 눌려요',
      pageUrl: null,
    });
    expect(feedbackInput.safeParse({ message: '' }).success).toBe(false);
    expect(feedbackInput.safeParse({ message: 'm'.repeat(2001) }).success).toBe(false);
    expect(feedbackInput.safeParse({ message: 'm', pageUrl: 'u'.repeat(501) }).success).toBe(false);
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
      '제목을 입력해 주세요.',
    );
    expect(postInput.safeParse({ title: 'x', body: '   ' }).error?.issues[0].message).toBe(
      '본문을 입력해 주세요.',
    );
    expect(postInput.safeParse({ title: 'x' }).success).toBe(false);
    expect(postInput.safeParse({ title: 1, body: 'x' }).success).toBe(false);
  });

  it('enforces the title limit at exactly 100 characters', () => {
    expect(postInput.safeParse({ title: 'a'.repeat(LIMITS.postTitle), body: 'x' }).success).toBe(
      true,
    );
    const tooLong = postInput.safeParse({ title: 'a'.repeat(LIMITS.postTitle + 1), body: 'x' });
    expect(tooLong.error?.issues[0].message).toBe('제목은 100자 이하여야 합니다.');
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

  it.each([
    '0',
    '-1',
    '1.5',
    'abc',
    '',
    '99999999999999999999',
    '0x2A',
    '4e1',
    ' 42 ',
    '+42',
    '42.0',
  ])('rejects %j', (raw) => {
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
