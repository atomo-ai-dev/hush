import { describe, expect, it } from 'vitest';
import { extractMentions, mentions, segmentMentions } from '@/lib/mentions';

describe('extractMentions', () => {
  it('extracts a single mention', () => {
    expect(extractMentions('@alice 안녕하세요')).toEqual(['alice']);
  });

  it('keeps first-appearance order and drops duplicates', () => {
    expect(extractMentions('@bob @alice 그리고 @bob')).toEqual(['bob', 'alice']);
  });

  it('ignores an email address', () => {
    expect(extractMentions('메일은 me@hush.dev 로')).toEqual([]);
  });

  it('ignores a one-character name', () => {
    expect(extractMentions('@a 여기 봐')).toEqual([]);
  });

  it('cuts a name longer than twenty characters at twenty', () => {
    expect(extractMentions(`@${'x'.repeat(25)}`)).toEqual(['x'.repeat(20)]);
  });

  it('accepts Korean names', () => {
    expect(extractMentions('고마워요 @조용한고양이')).toEqual(['조용한고양이']);
  });
});

describe('segmentMentions', () => {
  it('segments join back into the original text', () => {
    const text = '@alice 오늘 @밤올빼미 도 와요?';
    const segments = segmentMentions(text);
    expect(segments.map((s) => s.value).join('')).toBe(text);
    expect(segments.filter((s) => s.kind === 'mention').map((s) => s.value)).toEqual([
      '@alice',
      '@밤올빼미',
    ]);
  });

  it('text without mentions is one text segment', () => {
    expect(segmentMentions('그냥 인사')).toEqual([{ kind: 'text', value: '그냥 인사' }]);
  });
});

describe('mentions', () => {
  it('mentions() ignores case', () => {
    expect(mentions('@Alice 확인 부탁', 'alice')).toBe(true);
  });

  it('mentions() does not match a partial name', () => {
    expect(mentions('@alice 확인 부탁', 'ali')).toBe(false);
  });
});
