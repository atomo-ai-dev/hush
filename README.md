# Hush

익명채팅 게시판. **Atomo의 레퍼런스 앱(시험장)** — Atomo 에이전트가 유지보수하는 *대상* 저장소.

- 기능 범위(MVP): 익명 닉네임, 방·실시간 채팅(WebSocket 커스텀 서버), 게시판(글·댓글·추천), 금칙어·신고 숨김, 도배 방지, 피드백 API·에러 로그
- 스택: Next.js 16 (App Router, 커스텀 서버) + Postgres 16 (`pg`), Tailwind 4, Vitest(단위·통합), Biome
- 계획: `~/ax/doc/Atomo_개발계획서_v1.1.md` §4.1, 운영: `v2.0`

## 로컬 실행

요구 사항: Node 22, pnpm 12 (`corepack enable`), Docker.

```bash
# 1) Postgres (호스트 5433 포트)
docker run -d --name hush-pg -e POSTGRES_PASSWORD=hush -e POSTGRES_DB=hush -p 5433:5432 postgres:16-alpine

# 2) 의존성 + 환경변수
pnpm install
cp .env.example .env        # 기본값 그대로면 생략 가능 (코드 기본값과 같음)

# 3) 스키마
pnpm db:migrate

# 4) 개발 서버 (커스텀 서버, http://localhost:4620)
pnpm dev
```

프로덕션 모드: `pnpm build && pnpm start` (같은 포트 4620, `PORT`로 변경).

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | `server.ts` 커스텀 서버(Next + WebSocket)를 개발 모드로 실행 |
| `pnpm build` / `pnpm start` | 프로덕션 빌드 / 실행 |
| `pnpm db:migrate` | `migrations/NNN_*.sql` 중 미적용분을 순서대로 적용 (`DATABASE_URL`) |
| `pnpm test` | 단위 + 통합 테스트 (`test:unit`, `test:integration` 따로 실행 가능) |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | Biome 검사 / 자동 수정 |
| `pnpm smoke [baseUrl]` | 실행 중인 서버(기본 `http://localhost:4620`)에 대한 E2E 스모크 (게시판·신고·도배·채팅) |

## 환경변수

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:hush@localhost:5433/hush` | 앱 DB |
| `DATABASE_URL_TEST` | `…/hush_test` | 통합 테스트 DB |
| `PORT` | `4620` | 커스텀 서버 포트 |
| `HUSH_BANNED_WORDS` | 내장 목록 | 쉼표 구분 금칙어 (대소문자 무시, 설정 시 내장 목록 대체) |
| `HUSH_INTERNAL_TOKEN` | (없음 → 비활성) | `/api/_errors` 내부 에러 로그 API 토큰 (`x-hush-internal-token` 헤더) |

## API 요약

| 메서드 · 경로 | 설명 |
| --- | --- |
| `GET /api/me` | 내 익명 닉네임 |
| `GET /api/posts?page=N` | 글 목록 (최신순, 20개씩, 숨김 제외) |
| `POST /api/posts` | 글 작성 `{title ≤100, body ≤5000}` |
| `GET /api/posts/:id` | 글 + 댓글 |
| `POST /api/posts/:id/comments` | 댓글 `{body ≤1000}` |
| `POST /api/posts/:id/like` | 추천 토글 (세션당 1회) |
| `POST /api/reports` | 신고 `{targetType: post\|comment, targetId}` — 서로 다른 세션 3회면 숨김 |
| `POST /api/feedback` | 버그 신고 `{message ≤2000, pageUrl?}` |
| `GET/POST /api/_errors` | 내부 에러 로그 조회/기록 (토큰 필요) |
| `GET /api/rooms` · `POST /api/rooms` | 채팅방 목록 / 생성 `{name ≤40}` (세션당 1분 3개) |
| `GET /api/rooms/:id` | 채팅방 + 최근 메시지 50개 |

글·댓글은 세션당 1분에 5개까지(초과 시 `429` + `Retry-After`), 금칙어가 있으면 `400 BANNED_WORD`.
처리되지 않은 API 예외는 `error_logs` 테이블에 기록되고 클라이언트에는 일반 500 메시지만 간다.

## 실시간 채팅 (WebSocket)

`server.ts`가 `ws://<host>/ws/chat?roomId=N` 업그레이드를 직접 처리한다 (세션 쿠키 필수, 다른 Origin 거부).

- 접속 시 서버 → `{"type":"history","room":{…},"messages":[최근 50개]}`, 이후 `{"type":"presence","count":N}`
- 클라이언트 → `{"type":"message","body":"…"}` (공백만/500자 초과/금칙어/10초 10개 초과는 `{"type":"error",code,message}`)
- 저장 후 같은 방 전원에게 `{"type":"message","message":{id,roomId,nickname,body,createdAt}}`

## 테스트

- 단위 테스트: `tests/unit` — DB 불필요.
- 통합 테스트: `tests/integration` — `DATABASE_URL_TEST`(기본 `postgres://postgres:hush@localhost:5433/hush_test`)
  데이터베이스를 자동 생성하고 마이그레이션한 뒤 실행한다. DB에 연결할 수 없으면 경고를 출력하고 **건너뛴다**
  (`REQUIRE_DB=1`이면 실패 처리 — CI에서 사용).

## 구조

```
app/            Next.js App Router (페이지 + /api 라우트)
src/lib/        도메인·데이터 계층 (db, 검증, 세션, 저장소 함수)
src/server/     WebSocket 채팅 서버
src/components/ 클라이언트 컴포넌트
migrations/     순번 SQL 마이그레이션
scripts/        마이그레이션 실행기, 스모크 테스트
server.ts       커스텀 서버 (Next 요청 처리 + WebSocket)
tests/          unit / integration
```
