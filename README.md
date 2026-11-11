# 밈캐치 (MemeCatch)

> **그 밈, 3초 안에 알려드려요.**
> 요즘 유행하는 밈·유행어·챌린지의 뜻·유래, 그리고 **지금 써도 되는지**까지 알려주는 한국 밈 트렌드 사전.

현재 Next.js/Supabase 기반 공개 웹앱을 개발·운영 중이며, 콘텐츠 검수·출처 권리 확인·결제 제공자 설정은 공개 출시와 별도의 운영 절차입니다.

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

- **프론트엔드**: Next.js 16 (App Router, 요청별 SSR) · React 19 · TypeScript · Tailwind CSS v4 · [motion](https://motion.dev) (framer-motion)
- **백엔드**: Supabase (PostgreSQL · RLS · Auth · Storage · pg_cron)
- **PWA**: Serwist (서비스 워커, 정적 자산 캐시, 설치 가능)
- **배포**: Vercel (GitHub 연동 자동 배포)
- **미디어**: Cloudflare R2 (`/api/media` 프록시) · **결제**: Unifi Pay Direct · Fairy · **메일**: AWS SES

> 어떤 서비스가 무엇을 맡고 **왜 그렇게 정했는지**(특히 "AWS로 옮길까?"에 대한 실측 근거와
> 결정 기록)는 [`docs/architecture.md`](./docs/architecture.md)에 정리돼 있습니다.

### 아키텍처 하이라이트

- **RLS 기본 deny** — 모든 쓰기는 `security definer` RPC 경유(반응·저장·제보·신고·댓글). 서버 관리 컬럼은 클라이언트 쓰기 차단.
- **한국어 검색** — Postgres 기본 파서가 한국어를 못 다뤄, `pg_trgm` + 초성 generated column + 별칭(aliases)으로 구현.
- **트렌드 점수** — `ln(1+x)` 정규화 + 72h 윈도 + 신규 부스트, `pg_cron` 일배치(KST 00:30).
- **경로 없는 요청별 다국어 SSR** — Proxy가 쿠키·국가·`Accept-Language`를 검증해 요청 헤더로 전달하고, root layout이 같은 로케일로 `<html lang>`, 헤더, 푸터, 하단 내비를 SSR합니다. 이 선택은 locale-prefixed URL 대신 문서 페이지의 Full Route Cache/ISR을 의도적으로 포기합니다. 서비스 워커도 문서 내비게이션과 클라이언트 전환·refresh·prefetch의 RSC payload를 `NetworkOnly`로 처리해 URL이 같은 다른 로케일·세션의 응답을 재사용하지 않으며, 정적 자산·API·미디어 캐시는 유지합니다. 공개 데이터 쿼리는 계속 쿠키 없는 `createStaticClient`를 사용하고, 별도 정적/재검증 Route Handler와 명시된 데이터 캐시는 유지합니다. 탐색 플랫폼 수량은 RLS를 유지하는 `get_social_platform_counts` 집계 RPC의 익명 GET 응답만 300초 캐시하며, 관리자 공개 상태 변경·출처 승인 때 즉시 만료합니다. 로그인·일반 행 조회·다른 RPC는 이 캐시에 들어가지 않습니다.

MPE worker는 빈 큐를 만나면 기본 2초에서 최대 30초까지 지수적으로 대기합니다. 작업을 처리하면 다시 2초로 돌아오며, 큐에 작업이 계속 있으면 대기하지 않습니다. `MPE_WORKER_POLL_MS`와 `MPE_WORKER_MAX_IDLE_POLL_MS`로 조정하고 동일한 값으로 고정 간격을 선택할 수 있습니다. 새 작업의 idle 상태 발견 지연은 기본 최대 약 30초이며, 이미 실행 중인 worker에는 재시작 후 적용됩니다.
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

# 환경변수 — .env.local은 사용하지 않고 dev/prod를 물리적으로 분리
cp .env.example .env.development  # supabase start의 로컬 값만 채우기

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

# 예외적 수동 운영자 작업(일일 배치에서는 호출하지 않음)
node scripts/auto-approve-source-candidates.mjs --operator-confirm-auto-approve [--dry-run] [--limit=2000]
```

- `media_sources` — 플랫폼 콘텐츠 1건 = 1행(정규 URL·외부 ID·메타데이터·30일 갱신 시한)
- `meme_media` — 밈 ↔ 출처 다대다 + 권리 근거(`rights_basis`)·출처 역할(`source_role`)·검수 상태
- `meme_claims` — 유래·의미 주장과 근거 출처 연결(검증 전 `verified=false`)
- `memes.source_work_year` / `meme_first_seen_year` / `korea_viral_year` / `era_type` — YouTube 업로드 날짜와 밈 발생 연도를 분리
- Vercel Cron `0 17 * * *` → `/api/cron/source-refresh`가 삭제·비공개·임베드 불가를 7일 주기로 확인하고 공개 임베드를 자동으로 내립니다(`meme_contents.availability='dead'`). YouTube 메타데이터는 30일 안에 갱신됩니다.

## 환경변수

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon(publishable) 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 service_role 키 (배치·관리·시드) |
| `UNIFI_PAY_API_KEY` / `UNIFI_PAY_API_SECRET` | Unifi Pay Direct 결제 링크 발급·거래 재검증용 서버 비밀값 |
| `UNIFI_PAY_STORE_ID` | Unifi Pay 판매자 스토어 ID |
| `UNIFI_PAY_CALLBACK_BASE_URL` | Unifi 콘솔 허용 목록에 등록한 HTTPS 콜백 기준 URL |
| `UNIFI_PAY_ITEM_PRICE` | Plus 30일권 주문 금액. 기본값 `10` USD |
| `UNIFI_PAY_CHECKOUT_ENABLED` | 신규 checkout 전용 서버 플래그. 공백 제거 후 정확히 `true`일 때만 허용 |
| `FAIRY_PLUS_ENABLED` | 한국 Fairy 후원 Plus 경로. 공백 제거 후 정확히 `true`일 때만 허용 |
| `FAIRY_PROJECT_SLUG` | Fairy 프로젝트 슬러그 (`fairy.hada.io/@…`) |
| `FAIRY_WEBHOOK_SECRET` | Fairy `payment.completed` 웹훅 HMAC 비밀값. 서버 전용 |
| `FAIRY_PLUS_MIN_AMOUNT_KRW` | Plus 30일을 부여하는 최소 후원 금액(원). 정수 |
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
| `CRON_SECRET` | Vercel Cron 및 수동 동기화 요청 인증 비밀값. 서버 전용 |

> R2 4종이 비어 있으면 제보 이미지는 Supabase Storage(`meme-uploads`)에 저장됩니다. R2 키는 서버에서만 읽으며(`lib/r2.server.ts`, `server-only`) 클라이언트 번들에 포함되지 않습니다.

## 데이터베이스

Supabase 마이그레이션은 `supabase/migrations/`에 있습니다. 주요 테이블:

- `memes` — 밈 본문(뜻·유래·신호등·생애주기·검수 상태·연도 분리 필드)
- `meme_contents` / `meme_sources` — YouTube·TikTok·Instagram·Facebook·Threads 임베드와 출처 링크
- `media_sources` / `meme_media` / `meme_claims` — 출처 수집 파이프라인 원장(운영자 전용, RLS)
- `meme_submissions` · `reports` · `discussions` · `meme_reactions` · `saved_memes` · `generation_votes`
- `profiles` — 닉네임·역할·관심 카테고리·활용 목적·선호 플랫폼
- `billing_orders` · `billing_subscriptions` · `billing_webhook_events` — 결제 주문 상태·Plus 권한·거래/환불 감사 기록
- `meme_trend_metrics` · `view_events` — 트렌드 집계
- `admin_audit_log` · `job_runs` — 운영 감사·배치 로그

RPC: `search_memes` · `toggle_reaction` · `toggle_save` · `submit_meme` · `post_comment` · `file_report` · `cast_generation_vote` · `increment_view` · `compute_trend_scores`

### MemeCatch Plus / Unifi Pay · Fairy

한국에서 카드·간편결제로 Plus를 받으려면 Fairy 후원을 사용합니다. Unifi Pay는 Kaia USDT 경로입니다. 두 경로 모두 웹훅을 `catchmeme.com`에서 검증한 뒤에만 권한을 부여합니다.

**Fairy (한국 접근 경로)**

1. 로그인한 사용자가 `/pricing`에서 계정을 연결하면 Fairy 후원 링크가 발급됩니다.
2. 최소 금액 이상의 후원이 완료되면 `https://catchmeme.com/api/billing/fairy/webhook`이 서명된 `payment.completed` 이벤트를 확인합니다.
3. 연결된 계정에 Plus 30일을 부여합니다. 일반 후원 링크(계정 미연결)는 Plus로 자동 전환되지 않습니다.

**Unifi Pay Direct (USDT)**

1. 서버가 로그인 사용자 기준으로 `$10 USD` PENDING 주문과 고유 `requestId`를 먼저 생성합니다.
2. Unifi Pay 결제 링크를 발급해 `providerLinkId`를 주문에 연결합니다. 구매자는 Unifi Wallet의 Kaia USDT로 결제합니다.
3. `https://catchmeme.com/api/billing/unifi/webhook`은 알림 본문을 신뢰하지 않고 HMAC 인증된 상태 조회 API로 상점·금액·통화·거래 ID를 다시 검증합니다.
4. 확인된 `transactionId`를 한 번만 반영해 기존 잔여기간 뒤로 Plus 30일을 연장합니다. 환불은 Unifi 콘솔에서 수동 처리한 뒤 service-role 정산 RPC로 원거래 권한과 감사 기록을 함께 갱신합니다.

리다이렉트 쿼리나 브라우저 상태만으로 Plus 권한을 부여하지 않습니다. Unifi Pay·Fairy API 비밀값은 Vercel 서버 환경변수에만 저장하며 저장소에 커밋하지 않습니다.
`UNIFI_PAY_CHECKOUT_ENABLED`가 없거나 `false`이면 신규 Unifi 주문만 차단합니다. 기존 주문의 웹훅 검증과 환불 정산은 계속 동작해야 하며 이 플래그를 읽지 않습니다. `FAIRY_PLUS_ENABLED`가 `true`가 아니면 Fairy 후원 경로를 열지 않습니다. 과거 Latpeed 라우트·테이블은 이전 결제 감사와 호환을 위한 legacy 경로이지 신규 결제의 기준이 아닙니다.

## 콘텐츠 정책

- 원본 영상·이미지는 **무단 저장하지 않고 임베드·링크 중심**으로 제공 (저작권).
- 혐오·비하 소지 밈은 아카이브하되 `쓰면 위험` 신호 + 추천 제외.
- 제보는 검수(pending → 사실 확인 → 저작권 확인 → 공개)를 거칩니다.

## 소셜 로그인 (선택)

카카오·구글 로그인은 코드에 준비돼 있으며, Supabase 대시보드 → Authentication → Providers에서 OAuth를 활성화하면 동작합니다(미설정 시 "곧 열려요"로 우아하게 폴백).

## 라이선스

개인 프로젝트. 수익 모델은 광고·제휴·후원과 MemeCatch Plus 구독.

---

🤖 설계·구현: [Claude Code](https://claude.com/claude-code)
