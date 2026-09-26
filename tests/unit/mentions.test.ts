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

  it('accepts a mention after a tab or a newline', () => {
    expect(extractMentions('확인\n@bob\t@carol')).toEqual(['bob', 'carol']);
  });
});

describe('segmentMentions', () => {
  it('segments join back into the original text', () => {
    const text = '@alice 오늘 @밤올빼미 도 와요?';
    expect(
      segmentMentions(text)
        .map((s) => s.value)
        .join(''),
    ).toBe(text);
  });

  it('splits mentions and the text between them', () => {
    expect(segmentMentions('@alice 오늘 @밤올빼미 도 와요?')).toEqual([
      { kind: 'mention', value: '@alice' },
      { kind: 'text', value: ' 오늘 ' },
      { kind: 'mention', value: '@밤올빼미' },
      { kind: 'text', value: ' 도 와요?' },
    ]);
  });

  it('text ending with a mention has no empty trailing segment', () => {
    expect(segmentMentions('안녕 @alice')).toEqual([
      { kind: 'text', value: '안녕 ' },
      { kind: 'mention', value: '@alice' },
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

  it('mentions() matches an uppercase nickname against lowercase text', () => {
    expect(mentions('@alice 확인 부탁', 'ALICE')).toBe(true);
  });

  it('mentions() does not match a partial name', () => {
    expect(mentions('@alice 확인 부탁', 'ali')).toBe(false);
  });
});
