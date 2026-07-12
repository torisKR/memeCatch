# 밈캐치 (MemeCatch)

> **그 밈, 3초 안에 알려드려요.**
> 요즘 유행하는 밈·유행어·챌린지의 뜻·유래, 그리고 **지금 써도 되는지**까지 알려주는 한국 밈 트렌드 사전.

**🔗 프로덕션: https://memecatch.vercel.app**

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

- **프론트엔드**: Next.js 16 (App Router, ISR) · React 19 · TypeScript · Tailwind CSS v4 · [motion](https://motion.dev) (framer-motion)
- **백엔드**: Supabase (PostgreSQL · RLS · Auth · Storage · pg_cron)
- **PWA**: Serwist (서비스 워커, 오프라인 셸, 설치 가능)
- **배포**: Vercel (GitHub 연동 자동 배포)

### 아키텍처 하이라이트

- **RLS 기본 deny** — 모든 쓰기는 `security definer` RPC 경유(반응·저장·제보·신고·댓글). 서버 관리 컬럼은 클라이언트 쓰기 차단.
- **한국어 검색** — Postgres 기본 파서가 한국어를 못 다뤄, `pg_trgm` + 초성 generated column + 별칭(aliases)으로 구현.
- **트렌드 점수** — `ln(1+x)` 정규화 + 72h 윈도 + 신규 부스트, `pg_cron` 일배치(KST 00:30).
- **ISR + 정적 헤더** — 상세/홈은 ISR로 캐시(쿠키 미사용 `createStaticClient`), 세션은 클라이언트에서 조회해 `DYNAMIC_SERVER_USAGE` 회피.
- **디자인 시스템** — [`DESIGN.md`](./DESIGN.md) 참조. 불꽃 오렌지 브랜드 + 카테고리 소프트 틴트(WCAG AA) + prefers-reduced-motion 존중.

## 로컬 개발

### 사전 요구
- Node.js 20+ · [pnpm](https://pnpm.io) · Docker (로컬 Supabase용)

### 시작하기

```bash
pnpm install

# 로컬 Supabase 스택 기동 (Docker 필요)
supabase start
supabase db reset          # 스키마 마이그레이션 적용

# 환경변수 — supabase start 출력값으로 .env.local 작성
cp .env.example .env.local  # NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY 채우기

pnpm dev                    # http://localhost:3000
```

### 스크립트

```bash
pnpm dev               # 개발 서버 (Turbopack)
pnpm build             # 프로덕션 빌드 (webpack — Serwist PWA)
pnpm start             # 프로덕션 서버
pnpm exec tsc --noEmit # 타입 체크
pnpm exec eslint .     # 린트
```

> **참고**: `pnpm build`는 `--webpack`를 씁니다(Serwist가 Turbopack과 충돌). 개발(`pnpm dev`)은 Turbopack입니다.

### 애드픽 핫딜 동기화 운영

프로덕션에서는 Vercel Cron이 `0 21 * * *`에 `/api/cron/adpick-hotdeals`를 호출합니다. Vercel Cron 스케줄은 UTC 기준이며, 매일 21:00 UTC에 예약된 작업은 한국 시간으로 다음 날 06:00 KST에 해당합니다. Hobby 플랜에서는 예약된 일일 작업이 06:00:00–06:59:59 KST (21:00:00–21:59:59 UTC) 사이에 실행될 수 있습니다. 실패한 작업을 Vercel이 자동으로 재시도하지 않습니다.

Vercel 프로젝트 환경변수에 `ADPICK_AFFILIATE_ID`와 `CRON_SECRET`을 설정하세요. 두 값은 서버 전용 비밀값이므로 실제 값을 저장소에 커밋하거나 `NEXT_PUBLIC_` 접두사로 클라이언트에 노출하지 않습니다.

로컬 서버를 실행한 뒤 같은 `CRON_SECRET`을 셸 환경변수로 설정하고 다음 명령으로 수동 실행할 수 있습니다.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/adpick-hotdeals
```

## 환경변수

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon(publishable) 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 service_role 키 (배치·관리·시드) |
| `NEXT_PUBLIC_COMMUNITY_ENABLED` | 커뮤니티(댓글·반응 공개·랭킹) 플래그. `false`로 시작 |
| `NEXT_PUBLIC_SUBMISSIONS_OPEN` | 제보 기능 on/off |
| `NEXT_PUBLIC_SITE_URL` | 절대 URL 기준(OG·sitemap) |
| `ANTHROPIC_API_KEY` | (선택) 관리자 AI 설명 초안 생성 |
| `R2_ACCOUNT_ID` | (선택) Cloudflare R2 — 제보 이미지 저장소. 서버 전용 |
| `R2_ACCESS_KEY_ID` | (선택) R2 API 토큰 Access Key. 서버 전용 |
| `R2_SECRET_ACCESS_KEY` | (선택) R2 API 토큰 Secret. 서버 전용 |
| `R2_BUCKET` | (선택) R2 버킷 이름 (`memecatch-uploads`) |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | (선택) AdSense 게시자 ID(`ca-pub-…`). 설정 시 스크립트·`/ads.txt`·계정 메타 자동 활성화 |
| `NEXT_PUBLIC_GA_ID` | (선택) GA4 측정 ID(`G-…`). 설정 시 gtag 자동 로드 |
| `ADPICK_AFFILIATE_ID` | 애드픽 ShoppingMate 제휴 ID. 서버 전용 |
| `CRON_SECRET` | Vercel Cron 및 수동 동기화 요청 인증 비밀값. 서버 전용 |

> R2 4종이 비어 있으면 제보 이미지는 Supabase Storage(`meme-uploads`)에 저장됩니다. R2 키는 서버에서만 읽으며(`lib/r2.server.ts`, `server-only`) 클라이언트 번들에 포함되지 않습니다.

## 데이터베이스

Supabase 마이그레이션은 `supabase/migrations/`에 있습니다. 주요 테이블:

- `memes` — 밈 본문(뜻·유래·신호등·생애주기·검수 상태)
- `meme_contents` / `meme_sources` — YouTube·TikTok·Instagram·Facebook·Threads 임베드와 출처 링크
- `meme_submissions` · `reports` · `discussions` · `meme_reactions` · `saved_memes` · `generation_votes`
- `profiles` — 닉네임·역할·관심 카테고리
- `meme_trend_metrics` · `view_events` — 트렌드 집계
- `admin_audit_log` · `job_runs` — 운영 감사·배치 로그

RPC: `search_memes` · `toggle_reaction` · `toggle_save` · `submit_meme` · `post_comment` · `file_report` · `cast_generation_vote` · `increment_view` · `compute_trend_scores`

## 콘텐츠 정책

- 원본 영상·이미지는 **무단 저장하지 않고 임베드·링크 중심**으로 제공 (저작권).
- 혐오·비하 소지 밈은 아카이브하되 `쓰면 위험` 신호 + 추천 제외.
- 제보는 검수(pending → 사실 확인 → 저작권 확인 → 공개)를 거칩니다.

## 소셜 로그인 (선택)

카카오·구글 로그인은 코드에 준비돼 있으며, Supabase 대시보드 → Authentication → Providers에서 OAuth를 활성화하면 동작합니다(미설정 시 "곧 열려요"로 우아하게 폴백).

## 라이선스

개인 프로젝트. 수익 모델은 광고·후원.

---

🤖 설계·구현: [Claude Code](https://claude.com/claude-code)
