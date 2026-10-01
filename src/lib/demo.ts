import type { Session } from './session';

/**
 * Read-only demo mode (HUSH_DEMO=1) for hosting Hush as a plain Next.js app
 * with no Postgres and no WebSocket server: reads come from a checked-in seed
 * and every write is refused with 403.
 */
export function isDemoMode(): boolean {
  return process.env.HUSH_DEMO === '1';
}

export const DEMO_BANNER = '시연용 읽기 전용 화면입니다. 글쓰기와 실시간 채팅은 꺼져 있습니다.';

export const DEMO_READ_ONLY_MESSAGE = '시연용 읽기 전용 화면이라 글쓰기가 꺼져 있습니다.';

// There is no session cookie without the custom server; id 0 never matches a seed row.
export const DEMO_VISITOR: Session = { id: 0, nickname: '구경하는 손님' };
