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

## 테스트

- 단위 테스트: `tests/unit` — DB 불필요.
- 통합 테스트: `tests/integration` — `DATABASE_URL_TEST`(기본 `postgres://postgres:hush@localhost:5433/hush_test`)
  데이터베이스를 자동 생성하고 마이그레이션한 뒤 실행한다. DB에 연결할 수 없으면 경고를 출력하고 **건너뛴다**
  (`REQUIRE_DB=1`이면 실패 처리 — CI에서 사용).

## 구조

```
app/            Next.js App Router (페이지 + /api 라우트)
src/lib/        도메인·데이터 계층 (db, 검증, 세션, 저장소 함수)
migrations/     순번 SQL 마이그레이션
scripts/        마이그레이션 실행기
server.ts       커스텀 서버 (Next 요청 처리 + WebSocket)
tests/          unit / integration
```
