export const ADJECTIVES = [
  '조용한',
  '수줍은',
  '용감한',
  '느긋한',
  '졸린',
  '배고픈',
  '반짝이는',
  '엉뚱한',
  '다정한',
  '씩씩한',
  '신중한',
  '호기심 많은',
  '명랑한',
  '차분한',
  '부지런한',
  '말랑한',
  '푸른',
  '따뜻한',
  '재빠른',
  '유쾌한',
] as const;

export const ANIMALS = [
  '수달',
  '고양이',
  '너구리',
  '여우',
  '다람쥐',
  '펭귄',
  '고슴도치',
  '부엉이',
  '판다',
  '토끼',
  '돌고래',
  '햄스터',
  '코알라',
  '사슴',
  '두루미',
  '해달',
  '알파카',
  '물개',
  '거북이',
  '참새',
] as const;

export const NICKNAME_PATTERN = /^[가-힣 ]+ [가-힣]+ \d{1,2}$/;

/** `rand` must return a float in [0, 1), like Math.random. */
export type RandomSource = () => number;

function pick<T>(items: readonly T[], rand: RandomSource): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

/** Generates a friendly anonymous nickname such as "조용한 수달 42". */
export function generateNickname(rand: RandomSource = Math.random): string {
  const number = 1 + (Math.floor(rand() * 99) % 99);
  return `${pick(ADJECTIVES, rand)} ${pick(ANIMALS, rand)} ${number}`;
}
