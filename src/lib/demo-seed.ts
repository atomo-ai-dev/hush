import type { Comment, PostDetail, PostPage } from './board';
import type { ChatMessage, Room } from './chat';
import { PAGE_SIZE } from './limits';

/*
 * Fictional sample content for demo mode. Times are minutes before "now" so
 * the board reads as recently active whenever it is viewed.
 */

interface SeedComment {
  nickname: string;
  body: string;
  minutesAgo: number;
}

interface SeedPost {
  id: number;
  title: string;
  body: string;
  nickname: string;
  minutesAgo: number;
  likeCount: number;
  comments: SeedComment[];
}

interface SeedRoom {
  id: number;
  name: string;
  minutesAgo: number;
}

interface SeedMessage {
  id: number;
  roomId: number;
  nickname: string;
  body: string;
  minutesAgo: number;
}

export const DEMO_POSTS: readonly SeedPost[] = [
  {
    id: 8,
    title: '퇴근길 지하철에서 졸다가 종점까지 갔어요',
    body: '눈 떠 보니 처음 보는 역이었어요.\n돌아오는 열차 기다리면서 역 앞 붕어빵 사 먹었는데 그게 오늘 제일 좋았네요.',
    nickname: '졸린 수달',
    minutesAgo: 12,
    likeCount: 14,
    comments: [
      { nickname: '느긋한 펭귄', body: '종점 붕어빵은 국룰이죠 ㅋㅋ', minutesAgo: 9 },
      {
        nickname: '다정한 여우',
        body: '저도 지난주에 똑같이 했어요. 알람 맞춰 두세요!',
        minutesAgo: 5,
      },
    ],
  },
  {
    id: 7,
    title: '자취 3년 차가 추천하는 5분 계란 요리',
    body: '전자레인지용 그릇에 계란 두 개, 우유 한 숟갈, 소금 조금.\n1분 돌리고 한 번 젓고 다시 40초. 밥 위에 올리고 간장 몇 방울이면 끝입니다.',
    nickname: '배고픈 너구리',
    minutesAgo: 47,
    likeCount: 31,
    comments: [
      { nickname: '부지런한 다람쥐', body: '파 송송 넣으면 더 맛있어요', minutesAgo: 40 },
      { nickname: '엉뚱한 고양이', body: '오늘 저녁 메뉴 정해졌다', minutesAgo: 33 },
      { nickname: '배고픈 너구리', body: '치즈 한 장 올려도 좋아요!', minutesAgo: 30 },
    ],
  },
  {
    id: 6,
    title: '동네 도서관 열람실 자리 꿀팁 있나요?',
    body: '시험 기간이라 아침 9시에 가도 자리가 없네요. 다들 몇 시에 가시나요?',
    nickname: '신중한 부엉이',
    minutesAgo: 95,
    likeCount: 4,
    comments: [{ nickname: '씩씩한 판다', body: '개관 20분 전에 줄 서야 해요..', minutesAgo: 88 }],
  },
  {
    id: 5,
    title: '오늘 하늘 사진 찍으신 분',
    body: '노을이 분홍색이랑 보라색 섞여서 진짜 예뻤어요. 다들 보셨어요?',
    nickname: '반짝이는 해달',
    minutesAgo: 180,
    likeCount: 22,
    comments: [],
  },
  {
    id: 4,
    title: '고양이가 키보드 위에서 안 내려와요',
    body: '재택 중인데 회의만 시작하면 노트북 위로 올라옵니다.\n박스를 옆에 두면 된다길래 해 봤는데 박스는 쳐다도 안 보네요.',
    nickname: '수줍은 고양이',
    minutesAgo: 320,
    likeCount: 27,
    comments: [
      {
        nickname: '명랑한 강아지',
        body: '따뜻한 데를 좋아해서 그래요. 담요 깔아 줘 보세요',
        minutesAgo: 300,
      },
      {
        nickname: '차분한 거북이',
        body: '회의에 고양이 출연하면 다들 좋아하지 않나요 ㅎㅎ',
        minutesAgo: 290,
      },
    ],
  },
  {
    id: 3,
    title: '주말에 혼자 갈 만한 산책 코스 추천해 주세요',
    body: '너무 붐비지 않고 한두 시간 걸을 수 있는 곳이면 좋겠어요.',
    nickname: '푸른 사슴',
    minutesAgo: 1440,
    likeCount: 9,
    comments: [
      {
        nickname: '유쾌한 토끼',
        body: '하천 따라 걷는 길이 제일 무난해요. 벤치도 많고요',
        minutesAgo: 1400,
      },
    ],
  },
  {
    id: 2,
    title: '익명이라 하는 말인데 저 사실 민트초코 싫어해요',
    body: '회사에서 다들 좋아해서 말을 못 했어요. 여기서라도 털어놓습니다.',
    nickname: '말랑한 오리',
    minutesAgo: 2900,
    likeCount: 41,
    comments: [
      { nickname: '용감한 햄스터', body: '괜찮아요 여기는 안전합니다', minutesAgo: 2880 },
      { nickname: '따뜻한 곰', body: '저는 좋아하지만 존중합니다', minutesAgo: 2850 },
    ],
  },
  {
    id: 1,
    title: 'Hush 처음 써 봐요. 가입 없이 바로 되네요',
    body: '닉네임이 자동으로 정해지는 게 재밌어요. 제 이름은 호기심 많은 펭귄입니다.',
    nickname: '호기심 많은 펭귄',
    minutesAgo: 5000,
    likeCount: 6,
    comments: [],
  },
];

export const DEMO_ROOMS: readonly SeedRoom[] = [
  { id: 2, name: '점심 메뉴 고르는 방', minutesAgo: 600 },
  { id: 1, name: '오늘 하루 어땠나요', minutesAgo: 3000 },
];

export const DEMO_MESSAGES: readonly SeedMessage[] = [
  { id: 1, roomId: 2, nickname: '배고픈 너구리', body: '오늘 점심 뭐 먹죠', minutesAgo: 34 },
  { id: 2, roomId: 2, nickname: '느긋한 펭귄', body: '비 오니까 칼국수 어때요', minutesAgo: 33 },
  {
    id: 3,
    roomId: 2,
    nickname: '엉뚱한 고양이',
    body: '저는 어제 칼국수 먹어서.. 김치찌개요',
    minutesAgo: 32,
  },
  {
    id: 4,
    roomId: 2,
    nickname: '배고픈 너구리',
    body: '둘 다 파는 분식집 가면 되겠네요 ㅋㅋ',
    minutesAgo: 31,
  },
  {
    id: 5,
    roomId: 2,
    nickname: '다정한 여우',
    body: '거기 12시 넘으면 줄 길어요. 미리 가세요!',
    minutesAgo: 29,
  },
  { id: 6, roomId: 2, nickname: '느긋한 펭귄', body: '좋아요 11시 50분 출발', minutesAgo: 28 },
  { id: 7, roomId: 1, nickname: '졸린 수달', body: '오늘 하루 다들 어땠어요?', minutesAgo: 220 },
  {
    id: 8,
    roomId: 1,
    nickname: '차분한 거북이',
    body: '발표 무사히 끝났어요. 이제 좀 쉬려고요',
    minutesAgo: 215,
  },
  { id: 9, roomId: 1, nickname: '졸린 수달', body: '수고 많으셨어요!', minutesAgo: 214 },
  {
    id: 10,
    roomId: 1,
    nickname: '명랑한 강아지',
    body: '저는 그냥 평범했는데 저녁이 맛있었어요',
    minutesAgo: 200,
  },
];

const at = (minutesAgo: number, now: number) => new Date(now - minutesAgo * 60_000).toISOString();

function toDetail(p: SeedPost, now: number): PostDetail {
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    nickname: p.nickname,
    createdAt: at(p.minutesAgo, now),
    likeCount: p.likeCount,
    commentCount: p.comments.length,
    likedByMe: false,
  };
}

export function seedListPosts(page: number, now = Date.now()): PostPage {
  const sorted = [...DEMO_POSTS].sort((a, b) => a.minutesAgo - b.minutesAgo);
  const offset = (page - 1) * PAGE_SIZE;
  const posts = sorted.slice(offset, offset + PAGE_SIZE).map((p) => {
    const { body: _body, likedByMe: _liked, ...summary } = toDetail(p, now);
    return summary;
  });
  const total = sorted.length;
  return {
    posts,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export function seedGetPost(id: number, now = Date.now()): PostDetail | null {
  const p = DEMO_POSTS.find((x) => x.id === id);
  return p ? toDetail(p, now) : null;
}

export function seedListComments(postId: number, now = Date.now()): Comment[] {
  const p = DEMO_POSTS.find((x) => x.id === postId);
  if (!p) return [];
  return [...p.comments]
    .sort((a, b) => b.minutesAgo - a.minutesAgo)
    .map((c, i) => ({
      id: postId * 100 + i + 1,
      postId,
      body: c.body,
      nickname: c.nickname,
      createdAt: at(c.minutesAgo, now),
    }));
}

function toRoom(r: SeedRoom, now: number): Room {
  const messages = DEMO_MESSAGES.filter((m) => m.roomId === r.id);
  const last = Math.min(...messages.map((m) => m.minutesAgo));
  return {
    id: r.id,
    name: r.name,
    createdAt: at(r.minutesAgo, now),
    messageCount: messages.length,
    lastMessageAt: messages.length > 0 ? at(last, now) : null,
  };
}

export function seedListRooms(now = Date.now()): Room[] {
  const activity = (r: Room) => Date.parse(r.lastMessageAt ?? r.createdAt);
  return DEMO_ROOMS.map((r) => toRoom(r, now)).sort((a, b) => activity(b) - activity(a));
}

export function seedGetRoom(id: number, now = Date.now()): Room | null {
  const r = DEMO_ROOMS.find((x) => x.id === id);
  return r ? toRoom(r, now) : null;
}

export function seedListMessages(roomId: number, limit: number, now = Date.now()): ChatMessage[] {
  return DEMO_MESSAGES.filter((m) => m.roomId === roomId)
    .sort((a, b) => a.id - b.id)
    .slice(-limit)
    .map((m) => ({
      id: m.id,
      roomId: m.roomId,
      nickname: m.nickname,
      body: m.body,
      createdAt: at(m.minutesAgo, now),
    }));
}
