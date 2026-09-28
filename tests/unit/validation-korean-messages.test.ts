import { describe, expect, it } from 'vitest';
import {
  chatMessageInput,
  commentInput,
  feedbackInput,
  postInput,
  reportInput,
  roomInput,
} from '@/lib/validation';

describe('validation schemas: non-object inputs with Korean messages', () => {
  it('postInput returns Korean message for non-object inputs', () => {
    expect(postInput.safeParse(null).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(postInput.safeParse([]).error?.issues[0].message).toBe('요청 형식이 올바르지 않습니다.');
    expect(postInput.safeParse('x').error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
  });

  it('commentInput returns Korean message for non-object inputs', () => {
    expect(commentInput.safeParse(null).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(commentInput.safeParse([]).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(commentInput.safeParse('x').error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
  });

  it('reportInput returns Korean message for non-object inputs', () => {
    expect(reportInput.safeParse(null).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(reportInput.safeParse([]).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(reportInput.safeParse('x').error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
  });

  it('reportInput.reason returns Korean message for non-string values', () => {
    const result = reportInput.safeParse({ targetType: 'post', targetId: 1, reason: 5 });
    expect(result.error?.issues[0].message).toBe('신고 사유가 올바르지 않습니다.');
  });

  it('feedbackInput returns Korean message for non-object inputs', () => {
    expect(feedbackInput.safeParse(null).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(feedbackInput.safeParse([]).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(feedbackInput.safeParse('x').error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
  });

  it('feedbackInput.pageUrl returns Korean message for non-string values', () => {
    const result = feedbackInput.safeParse({ message: 'test', pageUrl: 5 });
    expect(result.error?.issues[0].message).toBe('페이지 주소가 올바르지 않습니다.');
  });

  it('roomInput returns Korean message for non-object inputs', () => {
    expect(roomInput.safeParse(null).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(roomInput.safeParse([]).error?.issues[0].message).toBe('요청 형식이 올바르지 않습니다.');
    expect(roomInput.safeParse('x').error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
  });

  it('chatMessageInput returns Korean message for non-object inputs', () => {
    expect(chatMessageInput.safeParse(null).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(chatMessageInput.safeParse([]).error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
    expect(chatMessageInput.safeParse('x').error?.issues[0].message).toBe(
      '요청 형식이 올바르지 않습니다.',
    );
  });
});
