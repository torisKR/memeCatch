# 밈캐치 (MemeCatch)

> **그 밈, 3초 안에 알려드려요.**
> 요즘 유행하는 밈·유행어·챌린지의 뜻·유래, 그리고 **지금 써도 되는지**까지 알려주는 한국 밈 트렌드 사전.

현재 Rust(Axum) 서버 + 자체 호스팅 PostgreSQL 기반 공개 웹앱을 개발·운영 중이며, 콘텐츠 검수·출처 권리 확인은 공개 출시와 별도의 운영 절차입니다.

**🔗 프로덕션: https://catchmeme.com**

---

## 무엇을 하나요

트렌드에 뒤처졌다고 느끼는 사용자가 밈을 **빠르게 검색하고, 이해하고, 안전하게 쓸 수 있게** 돕습니다. 나무위키·AI 챗봇과 달리 두 가지에 집중합니다:

- **🚦 사용 안전 신호등** — "지금 써도 되는가"를 색+아이콘+텍스트로 (`써도 됨` / `맥락 주의` / `이미 늦음` / `쓰면 위험`). 상황별(직장/친구/자녀/SNS) 가이드까지.
- **🔥 밈 생명 게이지** — 밈의 생애주기(급상승 → 유행 → 식는 중 → 추억)를 불꽃 미터로 시각화.

현재 **1,733개** 밈을 1990~2026년 전 연대에 걸쳐 수록하고 있습니다(유튜브 임베드 648 + 나무위키 출처 269 연결).

## 핵심 기능

| 화면 | 설명 |
|---|---|
| **홈** (`/`) | 검색 히어로 + 오늘의 급상승 + 입문자 큐레이션 |
| **탐색** (`/explore`) | 전체 밈을 카테고리·난이도·생애주기·연도·미디어 필터 + 정렬(급상승/최신/인기/논쟁) + 목록 내 검색 + 무한 스크롤 |
| **검색** (`/search`) | 키워드·**초성**(ㅇㅍㅌ→영포티)·유사어·별칭 검색 |
| **상세** (`/memes/[key]`) | 정답 카드(뜻+신호등) → 유튜브 임베드 → 상황별 사용 가이드 → 관련 밈 → 반응·댓글 |
| **제보** (`/submit`) | 새 밈 제보(실시간 중복 검사, 검수 대기) |
| **MY** (`/my`) | 저장한 밈·내 제보·관심 카테고리·닉네임 |
| **관리자** (`/admin`) | 제보 검수·밈 편집·신고 처리·AI 설명 초안 |

## 기술 스택

- **서버**: Rust · [Axum](https://github.com/tokio-rs/axum)이 모든 페이지(Maud 템플릿, 요청별 렌더)와 API를 답한다 ([`server/`](./server/README.md)). 브라우저 스크립트와 CSS는 `server/ui`(TypeScript·Tailwind CSS v4)에서 빌드해 커밋한다
- **백엔드**: PostgreSQL 16 + pgvector (RLS · RPC, Compose 컨테이너) · 로그인(이메일·카카오·구글·TikTok)은 better-auth와 호환되는 세션·테이블을 서버가 직접 다룬다 · 크론은 `deploy/scheduler`
- **워커**: MPE 미디어 워커(Node.js·TypeScript, `scripts/mpe-media-worker.mjs`, FFmpeg)
- **PWA**: 서버가 서비스 워커(`/sw.js`)와 매니페스트를 직접 답한다
- **배포**: OCI 도쿄 VM의 Docker Compose와 자체 Caddy. Cloudflare가 `catchmeme.com`을 그 원본으로 프록시하고, GitHub Actions가 이미지를 만들어 VM에 배포한다.
- **미디어**: Cloudflare R2 (`/api/media` 프록시) · **메일**: AWS SES

> 어떤 서비스가 무엇을 맡고 **왜 그렇게 정했는지**(특히 "AWS로 옮길까?"에 대한 실측 근거와
> 결정 기록)는 [`docs/architecture.md`](./docs/architecture.md)에 정리돼 있습니다.

### 아키텍처 하이라이트

- **RLS 기본 deny** — 모든 쓰기는 `security definer` RPC 경유(반응·저장·제보·신고·댓글). 서버 관리 컬럼은 클라이언트 쓰기 차단.
- **한국어 검색** — Postgres 기본 파서가 한국어를 못 다뤄, `pg_trgm` + 초성 generated column + 별칭(aliases)으로 구현.
- **트렌드 점수** — `ln(1+x)` 정규화 + 72h 윈도 + 신규 부스트, 스케줄러 일배치(KST 00:30).
- **경로 없는 요청별 다국어 렌더** — 서버가 쿠키·국가·`Accept-Language`로 로케일을 정하고, 같은 로케일로 `<html lang>`, 헤더, 푸터, 하단 내비를 요청마다 렌더합니다. 무거운 공개 데이터 읽기는 서버 안의 짧은 시간 제한 캐시(`server/src/pages/cache.rs`)를 씁니다.

MPE worker는 빈 큐를 만나면 기본 2초에서 최대 30초까지 지수적으로 대기합니다. 작업을 처리하면 다시 2초로 돌아오며, 큐에 작업이 계속 있으면 대기하지 않습니다. `MPE_WORKER_POLL_MS`와 `MPE_WORKER_MAX_IDLE_POLL_MS`로 조정하고 동일한 값으로 고정 간격을 선택할 수 있습니다. 새 작업의 idle 상태 발견 지연은 기본 최대 약 30초이며, 이미 실행 중인 worker에는 재시작 후 적용됩니다.
- **디자인 시스템** — [`DESIGN.md`](./DESIGN.md) 참조. 불꽃 오렌지 브랜드 + 카테고리 소프트 틴트(WCAG AA) + prefers-reduced-motion 존중.

## 로컬 개발

### 사전 요구
- Rust 1.96 · Node.js 22+ · [pnpm](https://pnpm.io) 10 · Docker (로컬 Postgres용)

### 시작하기

```bash
pnpm install

# 로컬 Postgres(pgvector) 기동 후 운영과 같은 순서로 스키마 적용
docker run -d --name memecatch-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16
psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -f deploy/postgres/00-bootstrap.sql
for f in db/migrations/*.sql; do psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -f "$f"; done
psql "postgresql://postgres:postgres@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -f db/seed.sql   # 선택: 개발 픽스처

# 서버 (http://localhost:3000). 환경변수는 server/README.md 참고
(cd server && DATABASE_URL=postgresql://... BETTER_AUTH_SECRET=... cargo run)
```

### 스크립트

```bash
(cd server && cargo test)                 # 서버 시험 (server/scripts/test-db.sh로 시험 DB)
node server/scripts/build-ui.mjs          # server/ui → server/assets (CSS·스크립트), --check는 CI
pnpm exec tsc --noEmit                    # 타입 체크 (워커·스크립트·server/ui/lib)
pnpm lint                                 # 린트
pnpm test                                 # vitest
```

### 출처 수집 파이프라인

원본 영상·이미지 파일은 저장하지 않고 **공식 API 후보 발견 → 메타데이터·임베드 가능 여부 확인 → 운영자 검수(`/admin/sources`) → 링크·임베드만 게시** 순서로 동작합니다.

```bash
# 1) 기존 meme_contents/meme_sources의 URL을 media_sources/meme_media 원장으로 정규화
node scripts/backfill-media-sources.mjs [--dry-run]

# 2) 기존 YouTube/Shorts 출처 일괄 상태 재확인 (videos.list 배치, YOUTUBE_API_KEY 필요)
node scripts/refresh-youtube-sources.mjs [--limit=2000] [--dry-run]

# 3) 출처가 없는 밈을 YouTube Data API로 검색해 검수 큐에 적재 (YOUTUBE_API_KEY 필요)
node scripts/discover-youtube-candidates.mjs [--max=20] [--dry-run]

# 4) TikTok/Instagram oEmbed 수집기의 후보 JSONL을 검수 큐에 적재
node scripts/import-source-candidates.mjs <candidates.jsonl> [--dry-run]

# 5) 미검증 후보 검증 (YouTube videos.list / TikTok·Instagram oEmbed)
node scripts/verify-youtube-pending.mjs [--limit=3000]
node scripts/verify-oembed-sources.mjs [--limit=400]

# 6) `/admin/sources`에서 운영자가 후보를 직접 검수·승인해 게시

# 기존 자동 승인 스크립트는 읽기 전용 점검만 지원 (일일 배치에서는 호출하지 않음)
node scripts/auto-approve-source-candidates.mjs --operator-confirm-auto-approve --dry-run [--limit=2000]
```

`--dry-run` 없는 기존 호출은 확인 플래그가 있어도 DB 연결 전에 실패합니다. 읽기 전용 결과의
`approved`는 기존 출력 호환을 위해 남긴 **문자열 휴리스틱 일치 건수**이며 실제 승인 건수가
아닙니다. 제목·채널명 일치와 임베드 가능만으로 영상의 내용·공식 채널·권리를 확인할 수 없으므로,
실제 게시 여부는 `/admin/sources`에서 개별 검수합니다.

- `media_sources` — 플랫폼 콘텐츠 1건 = 1행(정규 URL·외부 ID·메타데이터·30일 갱신 시한)
- `meme_media` — 밈 ↔ 출처 다대다 + 권리 근거(`rights_basis`)·출처 역할(`source_role`)·검수 상태
- `meme_claims` — 유래·의미 주장과 근거 출처 연결(검증 전 `verified=false`)
- `memes.source_work_year` / `meme_first_seen_year` / `korea_viral_year` / `era_type` — YouTube 업로드 날짜와 밈 발생 연도를 분리
- OCI 스케줄러(`deploy/scheduler/crontab`)가 15분마다 `/api/cron/source-refresh`를 호출합니다. 각 출처는 마지막 확인 후 하루가 지나면 다시 검사하며, 플랫폼별 배치 한도와 재시도로 처리량이 달라질 수 있습니다. 삭제·비공개와 임베드 불가는 공개 임베드에서 제외하고, 제공자의 일시적인 오류는 삭제로 판정하지 않습니다. YouTube 메타데이터 갱신 기한은 30일입니다.

## 환경변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | PostgreSQL 접속 URL (서버 전용) |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | 로그인 세션 서명 비밀값과 공개 기준 URL |
| `NEXT_PUBLIC_COMMUNITY_ENABLED` | 커뮤니티(댓글·반응 공개·랭킹) 플래그. `false`로 시작 |
| `NEXT_PUBLIC_SUBMISSIONS_OPEN` | 제보 기능 on/off |
| `NEXT_PUBLIC_SITE_URL` | 절대 URL 기준(OG·sitemap) |
| `OPENAI_API_KEY` | (선택) 관리자 GPT-5.6 Sol high 검수 초안 생성. 서버 전용 |
| `OPENAI_REVIEW_MODEL` | 사용하지 않음. 관리자 검수는 `gpt-5.6-sol` + `high`로 고정 |
| `OPENAI_REVIEW_BASE_URL` | (선택) OpenAI-compatible 검수 게이트웨이 주소. 기본값 `https://api.openai.com/v1` |
| `R2_ACCOUNT_ID` | (선택) Cloudflare R2 — 제보 이미지 저장소. 서버 전용 |
| `R2_ACCESS_KEY_ID` | (선택) R2 API 토큰 Access Key. 서버 전용 |
| `R2_SECRET_ACCESS_KEY` | (선택) R2 API 토큰 Secret. 서버 전용 |
| `R2_BUCKET` | (선택) R2 버킷 이름 (`memecatch-uploads`) |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | (선택) AdSense 게시자 ID(`ca-pub-…`). 설정 시 스크립트·`/ads.txt`·계정 메타 자동 활성화 |
| `NEXT_PUBLIC_GA_ID` | (선택) GA4 측정 ID(`G-…`). 설정 시 gtag 자동 로드 |
| `YOUTUBE_API_KEY` | (선택) YouTube Data API v3 키 — 출처 후보 발견·메타데이터 재확인. 서버 전용 |
| `CRON_SECRET` | 스케줄러 크론·수동 동기화 요청 인증 비밀값. 서버 전용 |

> R2 4종이 비어 있으면 제보 이미지는 `LOCAL_OBJECT_STORAGE_DIR` 로컬 저장소에 저장됩니다. R2 키는 서버에서만 읽으며(`lib/r2.server.ts`, `server-only`) 클라이언트 번들에 포함되지 않습니다.

## 데이터베이스

SQL 마이그레이션은 `db/migrations/`에 있습니다. 새 DB는 `deploy/postgres/init.sh`가 첫 부팅 때 파일명 순서로 적용하고, 운영 DB에는 새 파일을 `psql -v ON_ERROR_STOP=1 -1 -f`로 직접 적용합니다. 주요 테이블:

- `memes` — 밈 본문(뜻·유래·신호등·생애주기·검수 상태·연도 분리 필드)
- `meme_contents` / `meme_sources` — YouTube·TikTok·Instagram·Facebook·Threads 임베드와 출처 링크
- `media_sources` / `meme_media` / `meme_claims` — 출처 수집 파이프라인 원장(운영자 전용, RLS)
- `meme_submissions` · `reports` · `discussions` · `meme_reactions` · `saved_memes` · `generation_votes`
- `profiles` — 닉네임·역할·관심 카테고리·활용 목적·선호 플랫폼
- `billing_orders` · `billing_subscriptions` · `billing_webhook_events` — 종료된 Plus의 과거 주문·거래/환불 감사 기록(법정 보존용, 접근 권한 판정에는 쓰지 않음)
- `meme_trend_metrics` · `view_events` — 트렌드 집계
- `admin_audit_log` · `job_runs` — 운영 감사·배치 로그

RPC: `search_memes` · `toggle_reaction` · `toggle_save` · `submit_meme` · `post_comment` · `file_report` · `cast_generation_vote` · `increment_view` · `compute_trend_scores`

### 수익 모델: 광고 전용

밈캐치는 모든 기능이 무료인 커뮤니티 사이트이며 수익은 Google AdSense 광고로만 얻습니다. MemeCatch Plus 구독, Unifi Pay·Fairy·Latpeed 결제, Unifi(Kaia) 지갑 로그인은 제거됐습니다. 예전 `/pricing`·`/premium`·`/daily` URL은 홈으로 영구 리다이렉트됩니다. `billing_*` 테이블은 과거 구매 기록 보존을 위해 남겨 두지만 어떤 기능도 이를 읽어 권한을 판정하지 않습니다.

## 콘텐츠 정책

- 원본 영상·이미지는 **무단 저장하지 않고 임베드·링크 중심**으로 제공 (저작권).
- 혐오·비하 소지 밈은 아카이브하되 `쓰면 위험` 신호 + 추천 제외.
- 제보는 검수(pending → 사실 확인 → 저작권 확인 → 공개)를 거칩니다.

## 소셜 로그인 (선택)

카카오·구글 로그인은 better-auth로 동작하며, `KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`·`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`을 설정하면 활성화됩니다(미설정 시 "곧 열려요"로 우아하게 폴백).

## 라이선스

개인 프로젝트. 수익 모델은 광고 전용.

---

🤖 설계·구현: [Claude Code](https://claude.com/claude-code)
