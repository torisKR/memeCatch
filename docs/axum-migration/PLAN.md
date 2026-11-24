# Next.js → Axum(Rust) 전환 계획

작성 2026-11-23. 기준 커밋 `origin/main` f7e1aa61b.

## 1. 전환 가능 여부

**가능하다. 단, "프레임워크 교체"가 아니라 단계적 이관이다.**

Axum은 HTTP 서버 프레임워크라서 React 서버 컴포넌트를 렌더링하지 못한다. Next.js가 맡은 일은 두 가지로 나뉘고, 이관 난이도가 다르다.

| 영역 | 현재 규모 | Axum 이관 |
| --- | --- | --- |
| 서버 계층 (라우트 핸들러 53개, `proxy.ts`, DB·R2·인증·크론) | `lib` 6.6만 줄 중 서버 로직, DB 호출 `.from()` 254곳·`.rpc()` 86곳 | 가능. 라우트 단위로 옮길 수 있다 |
| 화면 계층 (페이지 66개, 클라이언트 컴포넌트 121개, `components` 4.2만 줄) | RSC·ISR·`generateMetadata` 22곳·Serwist PWA·`next/og` 5곳 | Axum만으로는 불가. Rust 템플릿/Leptos로 전부 다시 쓰거나 Next를 렌더러로 남겨야 한다 |

한 번에 갈아엎는 방식은 권하지 않는다. 비테스트 TS/TSX 8.9만 줄과 테스트 5.2만 줄을 다시 쓰는 일이고, 이 사이트는 색인·AdSense가 SSR 결과에 걸려 있어 화면 회귀의 비용이 크다.

**채택한 방식: 스트랭글러 퍼사드.** Axum이 지금 Next가 쓰는 `app:3000` 자리를 차지하고, 이관이 끝난 경로만 직접 응답하며 나머지는 내부의 Next로 그대로 흘려보낸다. 경로 하나씩 옮기고, 문제가 생기면 환경변수로 그 경로만 Next로 되돌린다.

```
Cloudflare ─► Caddy ─► Axum (:3000) ─┬─ 이관된 경로: Rust가 직접 응답
                                      └─ 그 외: Next standalone (:3001, 내부 전용)
```

## 2. 깨지면 안 되는 계약

### DB (자체 Postgres 16 + pgvector, OCI VM)

- 스키마 변경 없음. 이 전환은 `db/migrations/`에 파일을 추가하지 않는다. (추가하면 자동배포 에이전트가 배포를 거부한다.)
- 같은 로그인 롤 `memecatch`, 같은 `DATABASE_URL`.
- 모든 쿼리는 `lib/db/pool.ts`의 `withIdentity`와 같은 트랜잭션 전처리를 거친다: `app.user_id`·`app.db_role`·`app.is_anonymous`·`request.jwt.claims`·`statement_timeout` 설정 → `set local role anon|authenticated|service_role` → `set local search_path to public, extensions`. RLS 정책이 이 값에 의존한다.
- 연결 예산: Postgres `max_connections=30`이고, 그중 3개는 슈퍼유저 몫이다(`superuser_reserved_connections` 기본값, 이 저장소는 바꾸지 않는다). 로그인 롤 `memecatch`와 `memecatch_backup`은 슈퍼유저가 아니므로 쓸 수 있는 것은 **27개**다. 설정상 최대치:

  | 쓰는 것 | 최대 | 노는 연결이 닫히기까지 |
  | --- | --- | --- |
  | Next(`app`, Axum을 켜면 `next`) | 10: `getPool` 8 + `getDeadlinePool` 2(`lib/db/pool.ts`) | 10초(node-pg 기본값), 데드라인 5초 |
  | Axum(`app`) | 12: 메인 `AXUM_DB_POOL_MAX` 4 + 데드라인 2 + `/api/db/query`의 계획 풀 6(18절) | 메인 10분(sqlx 기본값), 데드라인 5초, 계획 5초(R9 리뷰2 N3) |
  | `mpe-worker` | 10: 같은 `lib/db/pool.ts`(`lib/db/admin.ts` → `withIdentity` → `getPool`) | Next와 같다 |
  | `backup` | 1: `pg_dump`(`memecatch_backup`), 크론으로 돌 때만 | 끝나면 |

  풀은 모두 쓸 때 열린다. 최대치를 그대로 더하면 Axum을 켜기 전 21(Next 10 + 워커 10 + 백업 1), 켠 뒤 33(Axum 12를 더해)으로 이미 27을 넘는다. 배포가 이전·새 컨테이너를 함께 돌리는 동안은 더 많다: Axum을 켤 때는 이전 `app`(Next)과 새 `next`가 최대 1분쯤 함께 돌고(`docs/oci-setup.md`), Next 둘과 Axum 둘이 함께 도는 최악이면 10 × 2 + 12 × 2 + 10 + 1 = 55다. 실제로는 워커가 한 번에 한두 개, 계획 풀은 그 경로에 부하가 있을 때만 쓴다. 두 번째 리뷰의 추정으로 부하 중 배포는 Next 8 + 8, Axum 10~12, 워커 1~2, 백업 1 = 28~33이다. 27을 넘으면 Postgres가 새 연결을 `53300`으로 거절한다: Next의 쿼리는 오류, Axum은 연결을 5초 기다린 뒤 실패(데드라인 풀은 1.5초)한다. 이미 열린 연결은 그대로 쓴다. 계획 풀은 놀면 5초 뒤 닫히지만, Axum 메인 풀은 10분 남는다. 그래서 `/api/db/query`를 켜기 전에(단계 5b) 이 셋 중 하나를 정한다: `max_connections`를 올린다(놀고 있는 백엔드는 하나 5~10 MB, 계획 풀 백엔드는 18절의 메모리 예산), 풀 최대치를 줄인다(예: 워커의 풀), 배포가 겹치는 동안의 거절을 받아들인다.
- better-auth 테이블(`user`·`session`·`account`·`verification`)은 Rust에서 읽기만 한다. 로그인·가입·OAuth 엔드포인트(`/api/auth/*`)는 마지막 단계까지 Next에 둔다.

### Cloudflare

- 엣지는 건드리지 않는다. DNS·프록시·Caddy 설정·`CLOUDFLARE_TRUSTED_PROXIES`·`CF-Connecting-IP` 처리는 그대로다. Axum이 같은 호스트·포트를 쓰므로 Caddy에서 보면 바뀐 것이 없다.
- Axum은 `Host`·`X-Forwarded-*`·`CF-*` 헤더를 수정 없이 Next로 넘긴다. (`proxy.ts`의 www→apex 리디렉션과 `lib/rate-limit.ts`가 이 값을 읽는다.)
- CDN 캐시 헤더(`s-maxage`, `stale-while-revalidate`)와 보안 헤더(HSTS·CSP·`X-MemeCatch-Release-Sha`)는 Rust가 직접 응답하는 경로에서도 `next.config.ts`와 같은 값으로 낸다. 릴리스 헤더는 배포 검증에 쓰인다.
- R2: 같은 버킷·같은 키 규칙(`<bucket>/<name>`, 세그먼트별 퍼센트 인코딩)·같은 SigV4(`region=auto`, `service=s3`). 서명 URL(`/api/media/signed`)의 HMAC 형식(`"<key>:<exp>"` → hex)이 양쪽에서 서로 검증된다.
- 배포 경로(Cloudflare Tunnel + Access 서비스 토큰 → VM 에이전트), 백업 컨테이너(R2 백업 버킷), 스케줄러(`http://app:3000/api/cron/*`)는 변경하지 않는다.

### 운영

- `main`에 합쳐도 운영 동작은 바뀌지 않는다. Axum은 VM의 `MEMECATCH_AXUM=1`로만 켜진다(단계 5a). 값이 없으면 배포 계획·명령·컨테이너가 플래그가 생기기 전과 같다.
- 운영 전환(VM에서 플래그를 켜는 일, 단계 5b)은 사용자 승인 후 별도 작업으로 한다.
- 경로별 되돌리기: `AXUM_DISABLED_ROUTES=<경로 id,...>`에 적힌 경로는 Axum이 처리하지 않고 Next로 넘긴다. 재배포 없이 컨테이너 재시작으로 적용된다. 없는 id를 적으면 Axum이 시작을 거부하고 유효한 id를 출력한다(오타로 되돌리기가 조용히 실패하는 일을 막는다).
- **켜고 끄는 것은 플래그로만 한다.** 방법은 `docs/oci-setup.md`의 "Axum in front of Next". 컴포즈 파일을 손으로 지정해 올리지 않는다: 플래그 없이 도는 다음 배포가 `app`을 Next로 되돌리고 `next` 컨테이너를 지운다(Next가 둘 남지 않는다).

## 3. 단계

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 0 | Axum 크레이트, Next로의 스트리밍 리버스 프록시, DB 신원 계층, 헬스체크, 패리티 하네스, Docker·CI | 완료. `torisKR/axum-foundation` `561dbde26` |
| 1 | R2/객체 저장소 + `/api/media/signed`, better-auth 세션 판독·운영자·크론 가드, 공개 읽기 경로 1차 | 완료. `torisKR/axum-foundation` `6365dcfbf` (병합 T2 `496b2e6f0`, T3 `a0c156bc4`, T4 `15cd5cddc`) |
| 2 | 나머지 공개 읽기 경로(llms.txt, 피드, oembed, 탐색 미리보기, 밈 카드, 퀴즈) | 진행 중. R1: llms.txt·피드 6개와 탐색 미리보기 완료, oembed는 프록시(6절) |
| 3 | 크론 경로, 미디어 업로드·MPE 업로드(R2 쓰기), 분석 이벤트, 운영자 API | 진행 중. R3: 미디어 읽기·업로드·MPE API(8절). R4: 크론 넷과 작은 운영자 API 둘(10절). 트렌드 펄스·출처 새로고침 실행·출처 수집·MCP 이벤트는 Next에 남겼다. R9: `/api/db/query`(18절) |
| 4 | `proxy.ts` 로직(www 리디렉션, 로케일, 정규 URL 리디렉션, 소프트 404, 인증 게이트)을 Axum 미들웨어로 | 대기 |
| 5a | 배포 스크립트와 에이전트가 `MEMECATCH_AXUM=1`일 때 Axum 구성을 배포한다(기본은 꺼짐). 컴포즈 파일 목록에 `docker-compose.axum.yml` 추가, `next`를 먼저 올려 health를 기다린 뒤 `app` 교체, 두 컨테이너의 health로 게이트, 두 이미지에 같은 `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`, 서버 이미지 빌드와 디스크 확인, CI `server` 확인, 두 이미지 스냅샷·롤백. 5절 "단계 5a 결과" 참조 | 완료. `torisKR/axum-deploy` |
| 5b | 운영 전환: VM의 `.env`에 `MEMECATCH_AXUM=1`을 넣고 수동 재배포. 5절 "단계 5b에서 확인할 것" 참조 | 사용자 승인 필요 |
| 6 | `/api/auth/*`(better-auth)를 Rust로 | 진행 중. 순서와 시험 항목은 [`UI-PLAN.md`](./UI-PLAN.md) 4절 "인증". A1(10절: 세션·로그아웃), A2(12절: 이메일 로그인·가입·인증·재설정), A3(17절: Google·Kakao). TikTok은 남았다 |
| 7 | 화면 계층을 Rust로 | 옮기기로 결정. 방식(Maud 템플릿 + 작은 스크립트), 묶음 순서, 파일럿 두 페이지의 결과는 [`UI-PLAN.md`](./UI-PLAN.md). B0(모든 페이지가 쓰는 틀: 헤더·메뉴·언어 선택·계정 메뉴·하단 내비·챗봇·설치 안내·이동 표시·검색 단축키·푸터·저장 진입점, i18n 생성, 크기 상한 캐시, 브라우저 동작 게이트) 완료, 페이지는 아직 하나도 켜지 않았다. 페이지는 `AXUM_PILOT_ROUTES`로 켠다(아래 경로 표). 나머지 묶음은 대기 |

Rust로 옮기기 어려운 부분: `next/og`(Satori) OG 이미지 5개 경로, `@huggingface/transformers`(onnxruntime) 임베딩 경로 2개, better-auth. 이들은 대체 구현을 정하기 전까지 Next에 둔다.

## 4. 보드

머지 게이트 공통: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`(Docker Postgres 통합 테스트 포함) 통과, 기존 파일은 허용 목록 밖 무변경, 운영 자격증명·운영 호스트 미사용.

| 카드 | 제목 | 선행 | 범위 | 수락 기준 |
| --- | --- | --- | --- | --- |
| T1 | 기반: 크레이트·프록시·DB 신원·헬스·하네스·Docker·CI | 없음 | `server/**`, `Dockerfile.server`, `docker-compose.axum.yml`, `.dockerignore`, `.gitignore`, `.github/workflows/ci.yml`(별도 job 추가만), `scripts/env-manifest.json`, `docs/axum-migration/**` | 프록시가 경로·쿼리·한글·헤더·스트리밍을 그대로 전달, `withIdentity` 동치 테스트, `/api/health` 동치, 이미지 빌드, 실제 Next를 Axum 뒤에 두고 스모크 |
| T2 | 객체 저장소(R2 SigV4 + 로컬 폴백) + `/api/media/signed` | T1 | `server/src/storage.rs`, `server/src/routes/media.rs`, 해당 테스트 | TS가 만든 서명 URL을 Rust가 검증하고 그 반대도 성립, S3 호환 서버(MinIO) 대상 PUT/GET/DELETE/List 테스트, 경로 응답 동치 |
| T3 | 인증: better-auth 세션 쿠키 판독, 운영자 검사, 크론 가드 | T1 | `server/src/auth.rs`, 해당 테스트 | 실제 better-auth가 발급한 쿠키를 Rust가 같은 사용자로 해석, 변조·만료 쿠키 거부, `is_operator` 동치, 크론 Bearer 상수시간 비교 |
| T4 | 공개 경로 1차: `/robots.txt`, `/api/random-meme`, `/memes/random`, `/api/csp-report`, `/api/daily-quiz` | T1 | `server/src/routes/public.rs`(+하위 모듈), 해당 테스트 | 각 경로가 Next와 상태·헤더·본문 동치(무작위 경로는 구조·후보 집합 동치). 동치를 증명하지 못한 경로는 프록시로 남기고 보고 |
| T5 | 통합: T2~T4 브랜치를 기반 브랜치에 합치고 전체 게이트 재실행 | T2, T3, T4 | 통합 브랜치 | 전체 게이트 통과, 충돌 해소 기록 |

상태는 Orca Run의 Task 목록이 원본이다(`orca orchestration task-list`).

## 5. 단계 0·1 결과

브랜치 `torisKR/axum-foundation`에 커밋되어 있다. 푸시하지 않았고 `main`에 합치지 않았다. 독립 리뷰(T6)의 지적은 T7에서 반영했다: 제한기 키와 버킷 상한, 서명 미디어 스트리밍, 로컬 저장소에서 못 찾은 객체는 Next로, 헬스가 Next도 확인, 없는 경로 id 거부, 비밀값을 TypeScript와 같은 방식으로, 업스트림 응답 헤더 2,000개.

### Axum이 직접 응답하는 경로

`AXUM_DISABLED_ROUTES`에 id를 적으면 그 경로는 Next로 돌아간다. 표에 없는 메서드는 지금도 Next가 응답한다.

| 경로 id | 경로 | 메서드 | 비고 |
| --- | --- | --- | --- |
| `health` | `/api/health` | `GET`, `HEAD` | DB 확인과 Next 자신의 `/api/health`(2xx)가 모두 3초 안에 통과해야 `{"ok":true}`. Next 확인은 Next가 없어질 때 함께 없앤다 |
| `media-signed` | `/api/media/signed` | `GET`, `HEAD` | 객체를 스트림으로 내보낸다. 로컬 디스크 저장소에서 객체를 못 찾으면 Next로 넘기고, R2에서는 404를 직접 낸다 |
| `robots` | `/robots.txt` | `GET`, `HEAD` | 시작할 때 `NEXT_PUBLIC_SITE_URL`로 한 번 렌더링. www 호스트 요청은 Next로 넘긴다 |
| `memes-random` | `/memes/random` | `GET`, `HEAD` | `NEXT_PUBLIC_SITE_URL`이 절대 URL이 아니면 등록하지 않는다. www 호스트 요청은 Next로 넘긴다 |
| `random-meme` | `/api/random-meme` | `GET`, `HEAD` | |
| `csp-report` | `/api/csp-report` | `POST` | 분당 60회 제한의 카운터는 프로세스별이다. 키는 IP 주소이거나 `unknown`이고 버킷은 최대 10,000개다 |
| `daily-quiz` | `/api/daily-quiz` | `GET`, `HEAD` | |
| `page-about` | `/about` | `GET`, `HEAD` | 페이지. `AXUM_PILOT_ROUTES`(쉼표로 나눈 페이지 경로 id, 모든 페이지의 스위치로 이 이름을 그대로 쓴다. 차이 73)에 적어야 켜진다(기본은 Next). `AXUM_DISABLED_ROUTES`가 이긴다. 페이지가 아닌 id나 없는 id를 적으면 시작을 거부한다. 문서 요청만 답하고 `RSC` 요청과 www 호스트는 Next로 넘긴다 |
| `page-meme` | `/memes/{key}` | `GET`, `HEAD` | 페이지, 위와 같다. "유래" 절까지만 그린다. 미디어·번역·자체 제작·편집 밈과 DB 조회 실패는 Next로 넘긴다 |
| `page-assets` | `/_axum/{file}`, `/_axum/frame/{locale}` | `GET`, `HEAD` | 페이지의 스타일시트와 스크립트(파일 이름에 내용 해시가 들어간다), 그리고 언어 선택이 제자리에서 바꿀 때 받는 다른 언어의 틀(JSON, 프로세스에 1시간·최대 4 MB 보관) |
| `page-contact`, `page-editorial`, `page-privacy`, `page-terms` | `/contact`, `/editorial`, `/privacy`, `/terms` | `GET`, `HEAD` | 페이지(B1), 위와 같다. Next가 빌드 때 만든 문서라 `Cache-Control: s-maxage=31536000`을 그대로 낸다 |
| `page-guides`, `page-guide` | `/guides`, `/guides/{slug}` | `GET`, `HEAD` | 페이지(B1). 글은 `lib/guides.ts`를 `server/i18n/guides.json`으로 내보낸 것. 없는 slug는 Next로 넘긴다 |
| `page-offline`, `page-missing-meme` | `/offline`, `/missing-public-meme` | `GET`, `HEAD` | 페이지(B1). 앞은 서비스 워커의 오프라인 화면, 뒤는 없는 밈의 404 문서 |
| `page-retired-products` | `/retired-products`, `/products/...`, `/go/products/...`(접두사 없이와 `/en`·`/ja`·`/zh`·`/zh-tw` 아래), `/admin/creator-products/...` | `GET`, `HEAD` | 페이지(B1). `proxy.ts`의 `retiredProductDecision`대로 410 문서·308·빈 404. 끝 슬래시, 파일 이름, `/en/products...`(`next.config.ts`의 리디렉션)는 Next로 넘긴다 |
| `page-originals`, `page-original-edition` | `/originals`, `/originals/edition/{slug}` | `GET`, `HEAD` | 페이지(B2). 글은 `lib/editorial-originals.ts`를 `server/i18n/originals.json`으로 내보낸 것. 작품 이미지는 Next의 `/_next/image`를 그대로 쓴다. 없는 slug는 Next로 넘긴다(Next는 200·noindex로 답한다) |
| `page-memes` | `/memes` | `GET`, `HEAD` | 페이지(B2). 사이트맵이 싣는 한국어 밈 전체를 가나다순(ICU4X `icu_collator` 2.4, 차이 B2-2)으로 100개씩. 목록은 프로세스에 5분 보관하고 `/about`의 문서 수도 같은 목록을 센다. `?page=1`, 쪽 번호가 아닌 값, 끝을 넘는 쪽, 목록을 못 읽은 경우는 Next로 넘긴다 |
| `page-collections`, `page-collection` | `/collections`, `/collections/{slug}` | `GET`, `HEAD` | 페이지(B2). 모음은 `lib/collections.ts`를 `server/i18n/collections.json`으로 내보낸 것. 목록마다 프로세스에 5분 보관(최대 2 MB). 없는 slug와 읽기 실패는 Next로 넘긴다 |
| `page-weekly`, `page-timeline`, `page-slang` | `/weekly`, `/timeline`, `/slang` | `GET`, `HEAD` | 페이지(B2). 주간 결산은 요청마다 읽고, 연표는 프로세스에 5분 보관한다. 읽기 실패는 Next처럼 빈 화면이다 |
| `llms` | `/llms.txt` | `GET`, `HEAD` | 요청마다 승인·색인 가능 밈 전체를 1,000행씩 읽어 세고 트렌드 상위 15개를 싣는다. 랭킹 링크 여부는 프로세스에 60초 보관한다. www 호스트 요청은 Next로 넘긴다 |
| `llms-full` | `/llms-full.txt` | `GET`, `HEAD` | 같은 읽기, 상위 400개. www 호스트 요청은 Next로 넘긴다 |
| `feed` | `/feed.xml` | `GET`, `HEAD` | 최근 게시 30개. www 호스트 요청은 Next로 넘긴다 |
| `feed-updated` | `/feed/updated.xml` | `GET`, `HEAD` | 최근 수정 30개. www 호스트 요청은 Next로 넘긴다 |
| `llms-localized` | `/en/llms.txt`, `/ja/llms.txt`, `/zh/llms.txt`, `/zh-tw/llms.txt` | `GET`, `HEAD` | 번역 로케일 넷의 고정 경로만 등록한다. 다른 접두사(`/ko/llms.txt` 등)는 Next가 답한다(404). www 호스트 요청은 Next로 넘긴다 |
| `llms-full-localized` | `/en/llms-full.txt`, `/ja/llms-full.txt`, `/zh/llms-full.txt`, `/zh-tw/llms-full.txt` | `GET`, `HEAD` | 위와 같다 |
| `explore-previews` | `/api/explore/previews` | `POST` | Next도 `POST`만 답한다. 데드라인 풀(연결 2개, 문장 1.5초)로 익명 롤과 `service_role`이 한 번씩 읽는다. 동시에 4개까지, 4초 안에 못 끝내면 503. 제한기(전체 분당 1,200, 주소별 분당 120)는 프로세스별이다 |
| `quiz` | `/api/quiz` | `GET`, `HEAD` | `set`이 있으면 Next와 바이트 단위로 같다. 없으면 호출마다 무작위라 구조와 출제 가능한 밈 집합이 같다 |
| `meme-cards` | `/api/meme-cards` | `GET`, `HEAD` | |
| `meme-card` | `/api/meme-cards/{id}` | `GET`, `HEAD` | id 세그먼트에 `%`가 있으면 Next로 넘긴다. Next가 세그먼트를 먼저 디코딩하고 `%ff` 같은 값에는 직접 500을 낸다 |
| `meme-cards-collection` | `/api/meme-cards/collection` | `GET`, `HEAD` | 로그인한 사용자의 카드. 비로그인은 401 |
| `meme-cards-claim` | `/api/meme-cards/claim` | `POST` | `NEXT_PUBLIC_SITE_URL`이 절대 URL이 아니면 등록하지 않는다. `Origin`이 사이트 origin이 아닌 요청은 Next로 넘긴다(7절 발견 2) |
| `memes-view` | `/api/memes/view` | `POST` | `MEMECATCH_SIGNING_SECRET`이 없거나 `NEXT_PUBLIC_SITE_URL`이 절대 URL이 아니면 등록하지 않는다. `Origin` 규칙은 위와 같다 |
| `analytics-events` | `/api/analytics/events` | `POST` | 위와 같다 |
| `media-object` | `/api/media/{...path}` | `GET`, `HEAD` | 업로드(`meme-uploads/`)는 저장소를 읽기 전에 소유자인지, 승인된 제보에 첨부됐는지 판정한다. 객체는 스트림으로 내보낸다. 로컬 저장소에서 못 찾으면 Next로 넘긴다(8절). Next에서처럼 `/api/media/signed`는 이 경로가 아니다: `media-signed`를 끄면 Next가 답한다 |
| `mpe-job` | `/api/mpe/jobs/{id}` | `GET`, `HEAD` | 로그인한 사용자 신원으로 읽는다(RLS). 끝난 렌더에는 60초 서명 URL |
| `mpe-renders` | `/api/mpe/renders` | `POST` | TypeScript와 같은 문장을 보내 같은 400을 낸다(8절 TypeScript 동작 1) |
| `mpe-uploads` | `/api/mpe/uploads` | `POST` | R2 값 네 개가 있을 때만 등록한다. 로컬 저장소에서는 Next가 답한다(8절) |
| `upload` | `/api/upload` | `POST` | 위와 같다 |
| `admin-mpe-candidates` | `/api/admin/mpe-candidates` | `GET`, `HEAD` | 운영자만. `POST`는 아래 `admin-mpe-candidates-post` |
| `admin-mpe-candidates-post` | `/api/admin/mpe-candidates` | `POST` | 운영자만. 후보 생성·매칭·근거 초안. TypeScript처럼 마지막 저장 호출(`replace_mpe_candidate_matches`·`replace_mpe_candidate_evidence`)이 함수를 찾지 못해 500으로 끝난다(10절 TypeScript 동작 1). 같은 경로의 `GET`과 따로 되돌릴 수 있다 |
| `meme-studio` | `/api/meme-studio` | `POST` | 모델을 부르지 않는 템플릿 세 개. 주소별 시간당 10회 제한은 프로세스별이다 |
| `admin-meme-studio` | `/api/admin/meme-studio` | `POST` | 운영자만. `BEDROCK_MEME_STUDIO_ENABLED=true`일 때만 등록한다(아니면 Next가 답한다). 평생 예산을 먼저 예약하고 AWS Bedrock(Converse)을 부른다. 자격 증명은 환경 변수만 읽는다(9절) |
| `memes-semantic-search` | `/api/memes/semantic-search` | `POST` | 의미 검색 경로가 쓸 수 없을 때만 등록한다(꺼짐, 또는 쓸 수 있는 `MEME_EMBEDDING_URL`이 없음. 운영이 이 경우다). 그러면 답은 언제나 키워드 검색(`search_memes` + 큐레이션 카드)이고 이유는 `disabled`나 `model_unavailable`이다. 임베딩 URL이 있으면 Next가 답한다 |
| `memes-chat` | `/api/memes/chat` | `POST` | `memes-semantic-search`와 같은 조건에서만 등록한다. 키워드 검색으로 찾은 공개 기록의 요약을 내고, `OPENROUTER_API_KEY`가 있으면 그 기록을 인용하는 답을 OpenRouter에 묻는다(운영은 키가 없어 요약이다). `Accept: application/x-ndjson`이면 진행 줄과 결과를 스트림으로 낸다. 주소별 10분 5회·전체 1분 20회 제한과 답 캐시는 프로세스별이다 |
| `mcp` | `/api/mcp` | `POST`, `GET`, `HEAD` | ChatGPT 커넥터의 공개 MCP 서버(JSON-RPC, SSE 없음). 도구 셋은 `https://catchmeme.com/llms-full.txt`를 읽어 5분 보관한다. `tools/call` 제한(전체 분당 1,200, 주소별 분당 120)은 프로세스별이다. `GET`은 405와 `Allow: POST`(14절) |
| `mcp-operator` | `/api/mcp-operator` | `GET`, `HEAD` | 운영 이벤트 서버의 인증 요구(401, `WWW-Authenticate`). 상태 키와 상관없이 등록한다 |
| `mcp-operator-post` | `/api/mcp-operator` | `POST` | `MCP_EVENT_STATE_KEY`가 없을 때만 등록한다(운영이 이 경우다). Origin 검사 뒤 언제나 JSON-RPC -32603이다(14절). 키가 있으면 Next가 답한다 |
| `mcp-oauth-authorize` | `/api/mcp-operator/oauth/authorize` | `GET`, `HEAD`, `POST` | 위와 같은 조건. 요청 검사, ChatGPT 클라이언트 메타데이터(1시간 보관), 운영자 세션 뒤 503. 8,000바이트가 넘는 요청 대상은 Next로 넘긴다(차이 R6-2) |
| `mcp-oauth-token` | `/api/mcp-operator/oauth/token` | `POST` | 위와 같은 조건. 언제나 503 `server_error` |
| `mcp-oauth-metadata` | `/.well-known/oauth-authorization-server` | `GET`, `HEAD` | 고정 JSON. `proxy.ts`처럼 `Content-Language: ko`를 붙이고 www 호스트 요청은 Next로 넘긴다 |
| `mcp-resource-metadata` | `/.well-known/oauth-protected-resource/api/mcp-operator` | `GET`, `HEAD` | 위와 같다 |
| `mcp-github` | `/api/mcp-operator/github` | `POST` | `MCP_EVENT_STATE_KEY`가 없을 때만 등록한다. 서명(`MCP_GITHUB_WEBHOOK_SECRET`, 받은 바이트 그대로, 상수 시간 비교)과 페이로드를 검사한 뒤 무시하거나 503 |
| `mcp-events-cron` | `/api/cron/mcp-events` | `GET`, `HEAD` | 위와 같은 조건. `Bearer <MCP_EVENT_RETRY_TOKEN>`이나 `Bearer <CRON_SECRET>`(통째로, 상수 시간 비교)가 아니면 401, 맞으면 503(14절 발견 1) |
| `growth-baseline` | `/api/cron/growth-baseline` | `GET`, `HEAD` | 크론 bearer. `capture_growth_funnel_baseline()`을 `service_role`로 한 번 부른다. 실패는 본문 없는 500 |
| `saved-state-emails` | `/api/cron/saved-state-emails` | `GET`, `HEAD` | 크론 bearer. 저장 상태 메일 10건을 동시에 `PLUS_DIGEST_DELIVERY_URL`(https만)로 보낸다. `NEXT_PUBLIC_SITE_URL`이 절대 URL이 아니면 등록하지 않는다 |
| `source-refresh` | `/api/cron/source-refresh` | `POST` | 크론 bearer. 카탈로그 캐시 만료를 Next에 맡긴다(11절 "Next의 캐시"). `GET`(새로고침 실행)은 Next가 답한다(15절) |
| `trend-pulse` | `/api/cron/trend-pulse` | `GET`, `HEAD` | 크론 bearer. 트렌드 점수, 설정된 레이더 커넥터(X, Threads, Instagram), 두 팬아웃을 `service_role`로 돌리고 끝에서 카탈로그 캐시 만료를 Next에 맡긴다(15절) |
| `instagram-video-cache` | `/api/admin/instagram-video-verification/revalidate` | `POST` | 운영자. 분당 30회(주소별, 프로세스별). 캐시 만료는 Next에 맡긴다. `CRON_SECRET`이 없거나 `NEXT_PUBLIC_SITE_URL`이 절대 URL이 아니면 등록하지 않는다. `Origin`이 사이트 origin이 아닌 요청은 Next로 넘긴다 |
| `adpick-hotdeals` | `/api/cron/adpick-hotdeals` | `GET`, `HEAD`, `POST` | 은퇴한 상품 API: 410 `{"error":"gone"}`, `X-Robots-Tag: noindex` |
| `creator-products` | `/api/creator-products`, `/api/creator-products/{...}` | `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE` | 위와 같다. 끝에 `/`가 붙은 경로는 Next의 리디렉션이다 |
| `auth-get-session` | `/api/auth/get-session` | `GET` | better-auth 1.7.20의 `getSession`: 세션 읽기, 하루 지난 세션 연장, 만료 세션 삭제(12절). `HEAD`, 쿼리 문자열, `RSC` 헤더가 있는 요청은 Next가 답한다 |
| `auth-sign-out` | `/api/auth/sign-out` | `POST` | 쿼리 문자열이 없고 본문이 `callbackURL`·`disableRedirect`·`state`·`redirectTo`·`errorCallbackURL`·`newUserCallbackURL` 없는 JSON 객체일 때만(화면이 보내는 `{}`). 다른 요청, 나머지 `/api/auth/*`는 Next가 답한다(12절) |
| `db-query` | `/api/db/query` | `POST` | 브라우저의 쿼리 계획을 호출자 신원으로 실행한다(18절). `CRON_SECRET`이 없거나 `NEXT_PUBLIC_SITE_URL`이 절대 URL이 아니면 등록하지 않는다(영상 확인 뒤 캐시 만료를 Next에 맡기므로). `Origin`이 사이트 origin이 아닌 요청은 Next로 넘긴다. 제한기와 동시 실행 상한(6)은 프로세스별이다 |
| `auth-sign-in-email` | `/api/auth/sign-in/email` | `POST` | better-auth의 `signInEmail`: bcrypt·scrypt 검증, 인증 안 된 주소 403, 세션과 쿠키(16절). 본문이 `email`·`password`(문자열)와 선택 `rememberMe`(불리언)뿐인 JSON 객체일 때만. 나머지는 Next가 답한다 |
| `auth-sign-up-email` | `/api/auth/sign-up/email` | `POST` | `signUpEmail`: 예약 도메인 400, 있는 주소도 같은 답, 인증 메일, `syncAuthUser`(16절). 본문이 `name`·`email`·`password`와 선택 `rememberMe`뿐일 때만 |
| `auth-verify-email` | `/api/auth/verify-email` | `GET` | `verifyEmail`: 인증 메일의 링크. 쿼리가 `token`과 일반 경로 `callbackURL`뿐일 때만. `HEAD`·`RSC`·다른 쿼리는 Next가 답한다(16절) |
| `auth-request-password-reset` | `/api/auth/request-password-reset` | `POST` | `requestPasswordReset`: 주소가 있든 없든 같은 답, 재설정 메일(16절). `redirectTo`는 없거나 일반 경로일 때만 |
| `auth-reset-password` | `/api/auth/reset-password` | `POST` | `resetPassword`: 한 번만 쓰는 토큰, 새 scrypt 해시(16절). 쿼리 없이 `newPassword`·`token`일 때만 |
| `auth-oauth` | `/api/auth/sign-in/social`, `/api/auth/callback/google`, `/api/auth/callback/kakao` | `POST`, `GET`, `GET` | Google·Kakao 로그인의 시작과 콜백(17절). 세 경로가 id 하나를 쓴다: 끄면 셋 다 Next로 간다. 시작은 앱이 보내는 모양의 본문(`provider`, 믿는 `callbackURL`, 선택 `errorCallbackURL`·`newUserCallbackURL`·`disableRedirect`)일 때만, 콜백은 `GET`이고 이 서버가 끝내는 state일 때만 |

`/api/memes/{id}/view`는 옮기지 않았다(7절 참조). 요청 대상에 ASCII가 아닌 바이트가 있으면 위 일곱 경로는 Next로 넘긴다. Next는 그런 요청에 경로를 실행하기 전에 400을 낸다.

인증 추출자(`RequestIdentity`·`SignedInUser`·`Operator`·`CronAuthorized`·`CronAuthorizedTrimmed`)와 객체 저장소(`state.storage`)는 만들어졌고, 이를 쓰는 경로는 단계 2·3에서 붙는다. 크론 가드가 둘인 이유: 크론 경로 넷(`trend-pulse`·`source-refresh`·`growth-baseline`·`saved-state-emails`)은 `CRON_SECRET`을 그대로 비교하고 `meme-embeddings`는 trim한 뒤 비교한다.

### 계획을 바꾸는 발견

1. **Next는 빌드할 때 값을 고정한다.** 응답 헤더(CSP, `X-MemeCatch-Release-Sha`), `/robots.txt` 본문, `/memes/random`의 `Location`이 `next build` 시점의 `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`로 정해진다. Axum은 시작할 때 읽으므로 Next 이미지를 빌드한 값과 같은 값으로 실행해야 한다. `CSP_ENFORCE`·`CSP_REPORT_URI`는 Next 이미지가 그 값 없이 빌드되므로 Axum에 넘기지 않는다. 단계 5a에서 두 이미지가 같은 빌드 인자로 빌드되고, Axum 컨테이너는 그 값을 이미지 환경에서 읽는다.
2. **`proxy.ts`는 `/api` 밖의 네이티브 경로에도 적용된다.** `/memes/random`에는 `Content-Language: ko`가 붙고, `/robots.txt`와 `/memes/random`은 www 호스트에서 301이 먼저 나간다. 단계 4 전까지는 `/api` 밖 경로를 옮길 때마다 그 경로가 `Content-Language`를 직접 내고 www 호스트 요청을 Next로 넘겨야 한다. `/api` 경로는 `proxy.ts` 매처 밖이라 해당 없다.
3. **Rust는 세션을 읽기만 하고 연장하지 않는다.** better-auth의 `getSession`은 하루 넘게 연장되지 않은 세션을 7일로 늘리고 쿠키를 다시 낸다. 페이지와 `/api/auth/get-session`이 Next에 있는 동안은 차이가 드러나지 않는다. 단계 6에서 그 엔드포인트를 옮기거나, Rust 경로만 부르는 클라이언트가 생기면 연장을 Rust에 구현해야 한다.
4. **세션 쿠키 이름은 `NODE_ENV`를 따른다.** `production`이거나 비어 있으면 `__Secure-better-auth.session_token`만, 그 밖의 값이면 `better-auth.session_token`만 읽는다. `docker-compose.axum.yml`은 `NODE_ENV: production`을 넘기고, 평문 HTTP로 로컬 실행할 때는 `NODE_ENV=development`가 필요하다.
5. **TypeScript `readSignedObject`는 서명된 `../x` 키로 저장소 루트 밖의 파일을 읽는다.** 서명 비밀을 가진 쪽만 만들 수 있는 URL이고 앱은 그런 키에 서명하지 않는다. 이 전환에서 TypeScript는 고치지 않았다. Rust는 정리된 키를 읽으므로 그런 URL의 응답만 다르다. TypeScript 수정은 별도 과제로 남아 있다.
6. **Next는 라우트 핸들러 본문을 chunked로 보내고 `HEAD`에도 길이를 붙이지 않는다.** `Routes::add`가 설치하는 계층이 모든 네이티브 경로에 같은 동작을 주므로, 새 경로는 따로 할 일이 없다.
7. **DB가 연결을 거부할 때 Axum은 쿼리 하나당 최대 5초를 기다린다.** Next는 1초 안에 같은 응답을 낸다. 메인 풀의 연결 대기 한도를 30초에서 5초로 줄인 결과이고, 그 대가로 빈 연결을 5초 넘게 기다린 요청은 실패한다(node-pg 풀은 계속 기다린다). 메인 풀 크기(`AXUM_DB_POOL_MAX`, 기본 4)를 정할 때 함께 봐야 한다.
8. **R2 없이 로컬 디스크 저장소를 쓰면 두 컨테이너가 객체를 공유하지 않는다.** 기본 컴포즈 파일은 객체 디렉터리에 볼륨을 두지 않아 Next가 자기 컨테이너 안에 쓰고, Axum 컨테이너는 그 파일을 보지 못한다. 그래서 로컬 저장소일 때 `/api/media/signed`는 자기 디스크에서 못 찾은 객체를 Next에 넘긴다(볼륨은 건드리지 않았다). R2 값 네 개가 설정되면 두 서버가 같은 버킷을 읽으므로 해당 없다. 단계 3에서 업로드를 Rust로 옮기면 쓰는 쪽에 같은 문제가 생기므로, 그 전에 로컬 저장소의 공유 방식을 정해야 한다.
9. **Axum이 앞에 서면 헬스체크가 Next를 가려 버린다.** `app` 컨테이너의 컴포즈 헬스체크와 배포 스크립트의 게이트는 `/api/health`를 묻는데, 이 경로를 Axum이 DB만 보고 답하면 Next가 죽어 있어도 통과한다. 그래서 Axum의 헬스는 Next의 `/api/health`도 확인한다.
10. **Axum 컨테이너의 메모리는 256 MB다.** Next(2,816 MB)가 버티는 입력을 Axum은 버티지 못할 수 있다. 클라이언트가 고르는 값을 키로 쓰는 맵에는 상한을 두고, 객체나 본문은 통째로 메모리에 올리지 않는다. 새 경로를 옮길 때마다 같은 점검이 필요하다.

### 단계 5a 결과

`scripts/deploy-oci.sh`와 배포 에이전트가 `MEMECATCH_AXUM`을 읽는다. 켜고 끄는 방법, 측정값, 롤백은 `docs/oci-setup.md`의 "Axum in front of Next"에 있다. 운영 VM에는 접속하지 않았고, 아래는 이 저장소와 격리된 Docker 데몬(Docker 29.10.0, Compose 5.7.1)에서 확인한 것이다.

- [x] `scripts/deploy-oci.sh`: 플래그가 켜지면 컴포즈 파일 목록에 `docker-compose.axum.yml`을 더하고, `next`를 먼저 올려 health를 기다린 뒤 `app`을 바꾸고, 두 컨테이너가 모두 healthy여야 게이트를 통과한다. 플래그가 꺼져 있으면 `DEPLOY_OCI_PRINT_PLAN=1` 출력이 이전 스크립트와 바이트 단위로 같고, 남아 있는 `next` 컨테이너만 지운다.
- [x] 두 이미지의 값 일치: `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`과 파일럿 페이지가 쓰는 `NEXT_PUBLIC_GA_ID`·`NEXT_PUBLIC_ADSENSE_CLIENT`는 두 Dockerfile의 빌드 인자이고 이미지 환경에 남는다. 에이전트가 Next 이미지와 똑같은 빌드 인자(`RELEASE_SHA`와 `deploy/build.env` 전체)로 서버 이미지를 빌드하므로 `.env`의 낡은 값이 끼어들지 않는다. CI `server` 작업이 같은 인자로 이미지를 빌드하고 네 값이 이미지 환경에 있는지 확인한다.
- [x] 리허설(`origin/main` `bcaf5351e` 위에 이 브랜치): 플래그 꺼짐(이전 에이전트가 이 변경을 담은 커밋을 배포) → 켜짐 → 켠 채 두 번째 커밋 → 꺼짐 → 끈 채 세 번째 커밋 → 다시 켬 → Next가 healthy가 되지 않는 커밋(켠 채, 끈 채 각각). 플래그가 켜진 단계마다 패리티 하네스 104개 대상이 모두 일치했고, 끈 뒤 Next 컨테이너는 하나였고, 실패한 배포는 이전 이미지 쌍으로 돌아갔다. 여유가 4,000 MB에 못 미친 실행 하나는 디스크 확인이 실제로 거부했다(3,935 MB, 아무것도 바뀌지 않음).
- [x] 사이트가 답하지 않는 시간(Caddy를 지난 `GET /`가 200이 아닌 시간): 새 커밋 배포가 지금(플래그 꺼짐)은 10.6초·4.2초, 플래그를 켜면 2.1초(`next`가 다시 뜨는 동안). 지금의 창은 Next 기동만이 아니라 `docker compose up -d`가 `app`과 워커를 한 묶음으로 바꾸면서 워커가 멈출 때까지 `app`을 시작하지 않아서 생긴다. 플래그가 켜지면 스크립트가 `next`를, 이어서 `app`을 따로 바꾼다. 켜기는 0초·0.2초, 끄기는 0.4초이고 롤백 직후처럼 워커 이미지도 바뀌면 지금의 경로 그대로 10.9초. Next가 healthy가 되지 않는 커밋은 켠 채 132초, 끈 채 144초 동안 답하지 않다가 롤백됐다.
- [x] Compose 버전: VM은 v5.7.0이다. `!override`·`!reset`·`extends`는 v5.5.0에서 렌더링되고 v5.7.1에서 배포까지 됐다.
- [x] `cpus`: 0.25는 DB를 쓰는 네이티브 경로에서 Next 혼자 버티는 요청률에 스로틀됐다(`/api/random-meme` 607 req/s에서 주기의 25%·p99 73 ms, `/api/health` 45%). 0.30은 1~2%, 0.35는 0%여서 0.35로 올렸다. 페이지 프록시는 Next의 최대 요청률에서 0.05 CPU 이하를 쓰고 스로틀되지 않는다.
- [x] 종료 시간: `docker stop`은 유휴 0.12초, 부하 중 0.17초다. 요청을 일부만 보낸 연결이 하나라도 있으면 유예 10초를 다 쓰고 강제 종료된다(10.2초, 종료 코드 137). 그동안 `app`에는 리스너가 없다. 줄이려면 `stop_grace_period`를 짧게 하거나 서버에 종료 기한을 둔다. 정하지 않았다.
- [x] 서버 이미지 빌드: 캐시 없이 2 CPU에서 128초, 디스크 1,738 MB(전부 빌드 캐시로 남는다). `server/src`만 바뀌면 28초·39 MB, `server/`가 그대로면 1초·0 MB. 에이전트는 Docker 데이터 디렉터리의 여유가 `AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB`(기본 4000) 미만이면 아무것도 바꾸기 전에 배포를 거부한다.
- [x] CI: `deploy` 작업이 `server` 작업을 기다리고, 플래그가 켜진 에이전트는 `check`와 `server` 실행을 모두 확인한다. `server` 작업이 `Dockerfile.server`를 빌드한다.

### 단계 5b에서 확인할 것

VM에서만 확인할 수 있어 남긴 것. 전환하는 사람이 본다.

- 에이전트 교체. 이 변경이 담긴 릴리스가 배포되고 실행 중인 에이전트가 그 버전이어야 한다(`cmp /var/lib/memecatch-autodeploy/bin/autodeploy.sh /opt/memecatch/deploy/autodeploy/autodeploy.sh`). 그 전에 플래그를 켜면 이전 에이전트가 `server` 확인도 디스크 확인도 없이 배포한다.
- 디스크. VM의 여유는 5.7 GB였다. 첫 서버 이미지 빌드가 1.7 GB를 빌드 캐시에 남긴다. 그 뒤 여유가 4,000 MB 아래에 자리 잡으면 배포가 거부되므로, Docker의 캐시 정리가 얼마를 되돌려 주는지 첫 배포 뒤에 본다. 에이전트 사용자가 `docker info`의 `DockerRootDir`에 `df`를 할 수 있는지도 본다.
- VM의 Compose v5.7.0으로 `docker compose -f docker-compose.yml -f docker-compose.own-caddy.yml -f docker-compose.axum.yml config`가 렌더링되는지.
- 전환하는 동안의 메모리와 연결. 최대 1분쯤 이전 `app`(Next)과 새 `next`가 함께 돈다: 한도 2,816 MB 둘, 연결 풀 최대 10개 둘. 그 뒤의 연결 예산은 2절(27개 중 Next 10, Axum 12, 워커 10, 백업 1이 최대치)이고, `/api/db/query`를 켜기 전에 거기 적은 셋 중 하나를 정한다.
- `service_role`의 `user`·`session` 읽기 권한. Rust의 세션 조회는 `service_role`로 돈다(better-auth는 로그인 롤로 돈다). 이 권한은 마이그레이션이 아니라 Next가 실행 중에 부여한다(`lib/auth/server.ts`). 권한이 없으면 세션 쿠키가 있는 요청은 전부 503이 된다(열리지 않고 닫힌다). 다음에 마이그레이션이 허용될 때 권한을 마이그레이션으로 옮기는 것이 낫다.
- 환경변수. Axum 컨테이너는 `docker-compose.axum.yml`에 적힌 것만 받는다. 서버가 읽는 변수는 모두 받는다: `.env`에서 `DATABASE_URL`(비밀번호), `BETTER_AUTH_SECRET`, `CRON_SECRET`, `MEMECATCH_SIGNING_SECRET`, `OBJECT_SIGNING_SECRET`, `R2_*` 넷, `LOCAL_OBJECT_STORAGE_DIR`, `ADSENSE_AUTO_ADS_ENABLED`, `MEME_SEMANTIC_SEARCH_ENABLED`·`MEME_EMBEDDING_URL`, `MEME_CHAT_GENERATION_ENABLED`·`MEME_CHAT_PROVIDER`, `OPENROUTER_API_KEY`·`OPENROUTER_BASE_URL`·`OPENROUTER_MPE_MODEL`, `AXUM_DB_POOL_MAX`·`AXUM_DISABLED_ROUTES`·`AXUM_PILOT_ROUTES`; 이미지에서 `RELEASE_SHA`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_ADSENSE_CLIENT`. `CSP_ENFORCE`·`CSP_REPORT_URI`는 일부러 넘기지 않는다(5절 발견 1). `docker-compose.yml`이 Next에만 주는 나머지(`BETTER_AUTH_URL`, OAuth 클라이언트 `GOOGLE_*`·`KAKAO_*`·`TIKTOK_*`, `AWS_*`·`BEDROCK_*`, `GA4_*`, 채팅의 로컬 프록시 변수 `MEME_CHAT_API_KEY`·`MEME_CHAT_BASE_URL`·`MEME_CHAT_MODEL`과 `MEME_EMBEDDING_RUNTIME`·`MEME_EMBEDDING_API_KEY`·`MEME_EMBEDDING_REINDEX_ENABLED`, `META_*`·`THREADS_ACCESS_TOKEN`·`X_API_BEARER_TOKEN`·`YOUTUBE_API_KEY`·`RADAR_*`, `MCP_*`, `OPENAI_*`, `PLUS_DIGEST_*`, `AUTH_EMAIL_WEBHOOK`, `NEXT_PUBLIC_COMMUNITY_ENABLED`·`NEXT_PUBLIC_SUBMISSIONS_OPEN`)는 아직 Next에 있는 경로가 읽는다. 경로를 옮길 때마다 그 경로가 읽는 변수를 더한다. 빠뜨리면 `server/tests/compose_env.rs`가 실패한다.
- R2. 리허설은 R2 값 없이 로컬 저장소로 돌았다. 운영은 값 네 개가 설정되어 있으므로 전환 뒤 `/api/media/signed`를 실제 서명 URL로 확인한다.
- Cloudflare를 지난 릴리스 헤더. 에이전트는 `https://catchmeme.com/`의 `X-MemeCatch-Release-Sha`로 배포를 확인한다. 리허설은 Caddy까지만 지났다.
- 종료 유예. 느린 업로드가 걸려 있는 동안 배포하면 `app` 교체가 최대 10초 걸린다(위 "종료 시간").
- R2용 루트 인증서. Mozilla 루트가 바이너리에 컴파일되어 있어 이미지를 다시 빌드할 때만 갱신된다(`webpki-roots`). 의존성 갱신 때 함께 올린다.

### Next와 남은 차이

"수용"은 결정했거나 의도한 차이, "미해결"은 누군가 결정하거나 손봐야 하는 것.

| # | 차이 | 상태 |
| --- | --- | --- |
| 1 | CSP 제한기의 키. IP 주소가 아닌 `X-Forwarded-For` 첫 항목(또는 `X-Real-IP`)은 전부 `unknown` 버킷을 함께 쓴다. Next는 그 문자열마다 버킷을 따로 둔다 | 수용 |
| 2 | CSP 제한기의 버킷은 최대 10,000개. 가득 찬 동안 버킷이 없는 새 클라이언트는 제한 초과로 처리된다. Next에는 상한이 없다 | 수용 |
| 3 | 제한기 카운터는 프로세스별이라 전환 시점에 0에서 시작하고 Next와 공유되지 않는다 | 수용 |
| 4 | `/api/media/signed`는 스트림으로 보낸다. 응답이 시작된 뒤의 실패(R2 연결 끊김 등)는 본문이 중간에 끊기는 것으로 나타난다. Next는 전부 읽은 뒤 보내므로 오류 상태로 답한다 | 수용 |
| 5 | 로컬 저장소에서 못 찾은 객체는 Next가 답한다. Next가 내려가 있으면 404가 아니라 502다 | 수용 |
| 6 | `/api/health`는 Next의 헬스도 확인한다. Next가 응답하지 않으면 3초 뒤 503이다 | 수용 |
| 7 | DB가 연결을 거부하면 쿼리당 5초 뒤에 답한다(`/api/random-meme` 10초, 헬스 3초). Next는 0.5초 안. 상태와 본문은 같다 | 수용 |
| 8 | 빈 연결을 5초 넘게 기다린 요청은 실패한다. node-pg 풀은 계속 기다린다 | 수용 |
| 9 | 세션을 읽기만 하고 연장·삭제하지 않는다. `/api/auth/get-session`이 Next에 있는 동안은 영향 없다 | 지금은 수용, 단계 6에서 미해결 |
| 10 | 빈 `NODE_ENV`를 운영으로 본다(`__Secure-` 쿠키). Next의 `=== "production"`은 그렇지 않다 | 수용 |
| 11 | 운영자 확인 중 DB 오류: Rust는 503, `proxy.ts`는 "운영자 아님". 둘 다 거부한다. 아직 쓰는 경로가 없다 | 수용 |
| 12 | 공백뿐인 `BETTER_AUTH_SECRET`은 시작할 때 거부한다. Next는 그 값을 그대로 쓴다 | 수용 |
| 13 | `BETTER_AUTH_SECRETS`(better-auth의 교체 목록)를 읽지 않는다. 컴포즈는 `BETTER_AUTH_SECRET`만 넘긴다 | 미해결, 지금은 영향 없음 |
| 14 | 크론 가드의 401 본문은 `UNAUTHORIZED` 하나다. `growth-baseline`과 `mcp-events`는 다른 본문을 내고 `mcp-events`는 `MCP_EVENT_RETRY_TOKEN`도 받는다. 네이티브 크론 경로는 아직 없다 | 단계 3에서 미해결 |
| 15 | 서명된 `../x` 키: TypeScript는 저장소 루트 밖을 읽고 Rust는 정리된 키를 읽는다 | Rust는 수용, TypeScript 수정은 미해결 |
| 16 | 서명된 `a//b`·`a/b/` 키는 Rust에서 `a/b`를 읽는다. 앱이 서명하지 않는 키다 | 수용 |
| 17 | R2 `list`: Rust는 `<Contents>` 안의 순서와 무관하게 읽는다. TypeScript는 `<Key>`가 먼저여야 한다 | 수용 |
| 18 | 2^128을 넘는 16진 `exp`는 JavaScript에서는 숫자, Rust에서는 거부 | 수용 |
| 19 | 실패한 R2 `DELETE`를 Rust는 경고로 남기고 TypeScript는 남기지 않는다 | 수용 |
| 20 | CSP 리포트 로그: `serde_json`은 `JSON.parse`가 받는 입력 셋(짝 없는 서로게이트 이스케이프, `1e999`, 128단 넘는 중첩)을 거부한다. 응답은 어느 쪽이든 204 | 수용 |
| 21 | 퀴즈 마스킹의 대소문자 접기는 Rust의 유니코드 표, Node는 ICU. 한쪽에만 있는 대소문자 쌍에서만 다를 수 있다. 시험하지 않았다 | 수용 |
| 22 | 제한기 키에서 IPv6 피어 주소의 표기. 두 서버 모두 IPv4로 듣는다 | 수용 |
| 23 | 로그 줄 형식(`tracing` 접두). `[CSP-VIOLATION] …` 본문은 같다 | 수용 |
| 24 | 네이티브 응답은 Axum이 Next 빌드의 `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`로 돌고 `CSP_ENFORCE`·`CSP_REPORT_URI`가 없을 때만 같다 | 수용. 단계 5a에서 두 이미지가 같은 값으로 빌드된다 |
| 25 | 헤더가 100개를 넘는 요청은 431. Node는 2,000개까지 받는다. `axum::serve`에 설정이 없어 고치려면 hyper 연결 루프를 직접 써야 한다(하지 않기로 했다) | 수용 |
| 26 | 요청 헤더를 읽는 시간 제한이 없다. Node는 60초 뒤 끊는다. Caddy 말고 다른 것이 3000 포트에 닿을 때만 문제다 | 수용 |
| 27 | UTF-8이 아닌 요청 대상은 hyper가 400으로 답한다 | 수용 |
| 28 | `/llms.txt`의 「오늘의 랭킹」 링크 여부를 Axum이 따로 60초 보관한다. Next는 같은 판정을 랭킹 페이지·사이트맵과 한 변수로 함께 쓴다. 카탈로그가 바뀐 뒤 1분 안에는 두 서버의 답이 다를 수 있다 | 수용 |
| 29 | 그 판정에 Next는 「컴백」 목록도 읽지만 결과에 영향이 없어 Axum은 읽지 않는다(쿼리 하나 적다) | 수용 |
| 30 | 로케일 llms: Next는 색인 가능 밈 id 집합을 Data Cache에 1시간 두고 카탈로그 수정 때 비운다. Axum은 요청마다 다시 읽는다. 실리는 밈은 양쪽 다 현재 행으로 다시 검사하므로, 최근 1시간 안에 색인 가능해진 밈이 Axum에 먼저 실리는 것만 다르다. 요청당 DB 부하는 `/llms.txt`와 같은 수준(전체 후보 스캔)이다 | 수용 |
| 31 | Next의 Data Cache에 남은 id 집합이 있으면 Next는 그 읽기가 실패해도 목록을 낸다. Axum은 읽기가 실패하면 빈 목록을 낸다(둘 다 200) | 수용 |
| 32 | JSON 안의 타임스탬프 문자열을 Axum은 항상 UTC로 받는다(sqlx가 세션 시간대를 UTC로 고정). Next는 DB 기본 시간대를 따른다. `/{locale}/llms-full.txt`의 번역 갱신 시각 줄에만 드러나고, 이 저장소의 Postgres 기본값은 UTC라 지금은 같다 | 수용 |
| 33 | 날짜 문자열 해석: Postgres가 쓰지 않는 형태(없는 날짜 `2026-02-30`, 시간대 없는 시각)를 V8은 숫자로 읽고 Axum은 날짜가 아닌 것으로 본다. DB에서 온 값으로는 닿지 않는다 | 수용 |
| 34 | `/api/explore/previews`의 출처 검사에서 「Next 자신의 요청 URL」 출처를 Axum은 `<프로토콜>://localhost:<UPSTREAM_URL의 포트>`로 본다(프로토콜은 `x-forwarded-proto`). 127.0.0.1에 묶인 Next에서 측정한 값이고, 다른 주소에 묶인 Next는 그 주소를 쓸 수 있다. 브라우저는 사이트 출처(`NEXT_PUBLIC_SITE_URL`)를 보내므로 운영 요청과는 무관하다 | 수용 |
| 35 | 그 경로의 제한기 둘도 프로세스별이고, 주소가 아닌 `X-Forwarded-For` 값은 `unknown` 버킷을 함께 쓴다(#1~#3과 같다) | 수용 |
| 36 | 그 경로의 동시 읽기 4자리: Next는 4초 기한이 지나도 뒤의 작업이 끝날 때까지 자리를 쥐고, Axum은 기한에 자리를 돌려준다(남은 쿼리는 1.5초 `statement_timeout`으로 끝난다) | 수용 |
| 37 | 그 경로의 요청 본문: `JSON.parse`는 받고 `serde_json`은 거부하는 입력(#20의 셋)은 400 `invalid request`다. Next는 그 본문에서 `ids`를 읽는다 | 수용 |
| 38 | 그 경로가 읽은 행의 형이 스키마와 다르면(열 형과 CHECK 제약이 막는 경우) Next는 그 카드만 비우고 Axum은 503이다 | 수용 |
| 39 | `serde_json`이 거부하고 `JSON.parse`가 받는 세 입력(짝 없는 `\uD800` 꼴 이스케이프, `1e999`, 128단 넘는 중첩)이 본문에 있으면 Rust는 잘못된 JSON으로 답한다(카드 받기 400 `invalid_input`, 조회·분석 400 `invalid_json`). Next는 본문을 받아들여 처리한다. 5절 차이 20과 같은 원인인데 여기서는 상태 코드가 달라진다. 앱의 클라이언트는 이런 본문을 보내지 않는다 | 수용 |
| 40 | 제한기 키는 IP 주소 아니면 `unknown`이고 버킷은 최대 10,000개다(5절 차이 1·2). `meme-view:`, `analytics:ip:`, `analytics:session:` 키가 한 제한기를 같이 쓴다. 해시에 들어가는 클라이언트 주소는 Next와 같은 원문이라 저장되는 값은 같다 | 수용 |
| 41 | 제한기 카운터는 프로세스별이다(5절 차이 3). `/api/memes/view`는 Next의 `/api/memes/[id]/view`와 더 이상 카운터를 나누지 않는다 | 수용 |
| 42 | `Origin`이 사이트 origin이 아닌 `POST`(세 경로)는 Next가 답한다. Next가 내려가 있으면 403이나 정상 처리 대신 502다. 그런 요청의 제한 카운트는 Next 쪽에 쌓인다 | 수용 |
| 43 | 세션을 조회하지 못하면 결과는 Next와 같지만(비로그인으로 처리) 최대 3초 뒤에 답한다. DB가 내려가 있을 때의 지연이다(5절 차이 7) | 수용 |
| 44 | `claimedAt`은 UTC로 적힌다. DB 기본 타임존이 UTC가 아니면 Next와 오프셋 표기가 달라진다(7절 발견 4) | 수용, 지금은 영향 없음 |
| 45 | 페이지와 개수 쿼리를 한 트랜잭션에서 읽는다. TypeScript는 쿼리마다 트랜잭션이 따로다. 그 사이에 행이 바뀌는 경우에만 결과가 다를 수 있다 | 수용 |
| 46 | `MEMECATCH_SIGNING_SECRET`이 Axum에 없으면 조회·분석 경로는 Next가 답한다(7절 발견 1) | 수용. 단계 5a부터 `docker-compose.axum.yml`이 Next와 같은 값을 넘긴다 |
| 47 | `mc_growth_session` MAC의 느슨한 base64 규칙은 Node 26에서 확인한 것을 옮겼다. 운영 이미지는 Node 22다. 규칙이 다르다면 표준이 아닌 표기로 고쳐 쓴 쿠키에서만 차이가 난다 | 수용 |
| 48 | 무작위 퀴즈의 난수원이 `Math.random`이 아니라 `rand`다. 출제되는 밈의 집합과 응답 구조는 같다 | 수용 |
| 49 | 분석 경로가 500으로 끝날 때 로그 내용이 다르다. 응답(본문 없는 500)은 같다 | 수용 |
| 50 | 업로드 두 경로는 R2일 때만 Axum이 답한다. 로컬 저장소에서는 Axum이 쓴 파일을 Next가 볼 수 없으므로 등록하지 않는다(8절 발견 1) | 수용 |
| 51 | 업로드 폼은 Node 22(undici 6.29)가 읽는 대로 읽는다. Next 이미지가 Node 24 이상으로 오르면 몇 가지 비정상 폼(마지막 경계 뒤의 글자, `filename`이 `name`보다 앞인 경우, 따옴표 없는 `name`, `filename*=utf-8''…`, 이름 앞의 BOM)의 해석이 달라진다(8절 발견 2). 그때 `parity/multipart-fixture.mjs`를 새 Node로 다시 돌리고 파서를 맞춰야 한다 | Node를 올릴 때 미해결 |
| 52 | 선언한 `Content-Length`보다 많이 보낸 요청: 두 서버 모두 선언한 만큼만 읽고(폼이 아니라 400), 아무것도 저장하지 않고, 한 번 계량한다. 남은 바이트는 다음 요청으로 읽혀 400이 된다. Node는 그 400을 바로 내고 연결을 닫아 경로의 응답이 클라이언트에 가지 않는다. hyper는 경로의 응답(400 `no_file`)을 먼저 보낸다 | 수용 |
| 53 | 읽지 않은 요청 본문(일찍 거절했거나 한도를 넘은 경우)은 Node처럼 버리면서 끝까지 받는다. Axum은 응답 뒤 300초(Node의 `requestTimeout`)까지만 받는다. Node의 한도는 요청이 시작된 때부터 잰다 | 수용 |
| 54 | `rightsDeclaration`, 렌더 요청 본문의 JSON에 짝 없는 `\uD800` 같은 이스케이프, double보다 큰 수, 128단계보다 깊은 중첩이 있으면 Axum은 형식이 틀린 JSON으로 본다(`routes/request.rs`의 `Json`). 렌더는 둘 다 400이지만 오류 코드가 `invalid_render_request`(Next는 `render_not_available`)이고, 권리 선언은 Axum만 `rights_required`다 | 수용 |
| 55 | R2 PUT의 서명된 부분(키, 경로 인코딩, `content-type`, `x-amz-content-sha256: UNSIGNED-PAYLOAD`, 서명 헤더 목록, 범위)은 TypeScript와 같다. 서명하지 않는 헤더는 다르다: undici는 `user-agent`·`accept`·`accept-language`·`sec-fetch-mode`·`accept-encoding`을 더한다 | 수용 |
| 56 | `/api/media/...`에서 R2 연결 자체가 실패하면 본문 없는 500이다. Next는 `fetch`가 던져 Next의 500 페이지가 나간다. 비교하지 않았다 | 수용 |
| 57 | 후보 매칭 목록을 DB 오류로 못 읽으면 본문이 `candidate_match_list_failed: <메시지>`다. Postgres가 낸 오류는 메시지가 같고, 연결 실패는 sqlx와 node-pg의 문구가 다르다 | 수용 |
| 58 | 후보 매칭의 `evidence_json`에 double을 넘는 수(`1e400`)가 있으면 Axum은 그 행 전체를 `null`로 낸다. Next는 그 수만 `null`이다. 앱은 JavaScript 수만 쓰므로 생기지 않는다 | 수용 |
| 59 | `mpe-renders`의 출처 검사는 `explore-previews`와 같은 규칙(#34)이고, 업로드 둘은 사이트 origin이 아닌 `Origin`을 Next에 넘긴다(#42와 같은 규칙). 결과는 같고 Next가 내려가 있을 때만 다르다 | 수용 |
| 60 | Bedrock 호출은 HTTP/1.1이다(SDK는 HTTP/2). 서명된 부분 중 경로, `content-type`, 본문 해시(`x-amz-content-sha256`), 범위(`<날짜>/<리전>/bedrock/aws4_request`)와 본문(데이터로)은 SDK와 같다. 서명 헤더 목록은 다르다: SDK는 `amz-sdk-invocation-id`·`amz-sdk-request`·`x-amz-user-agent`까지 서명하고 HTTP/2의 `:authority`를, Axum은 `host`를 서명한다 | 수용 |
| 61 | Bedrock 자격 증명은 환경 변수(`AWS_ACCESS_KEY_ID`·`AWS_SECRET_ACCESS_KEY`·`AWS_SESSION_TOKEN`)만 읽는다. SDK의 기본 체인은 그 밖에 공유 설정 파일, SSO, 컨테이너·인스턴스 메타데이터도 본다. 환경 변수가 없으면 Axum은 예약한 뒤 503이다(SDK가 자격 증명을 못 찾을 때와 같은 답) | 수용, 단계 5에서 VM의 값 확인 |
| 62 | `/api/admin/meme-studio` 본문은 1 MiB까지만 읽고 더 길면 형식이 틀린 JSON으로 본다(400). Next(`request.json()`)는 길이 제한이 없다. Bedrock의 답은 4 MiB까지 읽는다(넘으면 503) | 수용 |
| 63 | 두 스튜디오 경로의 JSON에도 차이 54의 세 경우(짝 없는 서로게이트 이스케이프, double을 넘는 수, 128단계 넘는 중첩)가 해당한다. 공개 스튜디오는 400 메시지가 「JSON 요청 본문이 올바르지 않습니다」가 되고 Next는 스키마 오류 문구다 | 수용 |
| 64 | Bedrock 답의 캡션 중복 검사에서 소문자화가 로캘과 무관하다. Next의 `toLocaleLowerCase()`는 프로세스 기본 로캘을 따른다. 터키어·리투아니아어 같은 로캘에서만 다를 수 있다 | 수용 |
| 65 | 의미 검색 경로의 큐레이션 카드는 `src/routes/search/curated.json`(실제 TypeScript가 만든 목록과 검색 텍스트)으로 들고 있다. `lib/curated-memes.ts`를 바꾸면 `parity/curated-search-catalog.mjs`를 다시 돌려야 같아진다 | 수용 |
| 66 | 의미 검색의 질의 소문자화는 `ko-KR` 로캘 규칙 대신 Rust의 소문자화다. 한국어 로캘에 특별한 대응이 없어 같은 결과다 | 수용 |
| 67 | Axum 페이지에서 URL이 없는 언어(예: 아랍어)를 고르면 틀(헤더·푸터·하단 내비·챗봇)만 `/_axum/frame/{locale}`에서 받아 바꾸고, 페이지 본문은 그대로 둔다(저장 버튼 문구는 바꾼다). Next는 본문 안의 클라이언트 컴포넌트도 다시 그린다. 시범 두 페이지에서는 저장 버튼 말고 바뀌는 문구가 없다 | 수용 |
| 68 | 로그아웃은 Next의 서버 액션 대신 better-auth의 `POST /api/auth/sign-out`을 부른 뒤 `/`로 간다. 쿠키와 도착 페이지는 같다 | 수용 |
| 69 | 한 페이지에서 `GET /api/auth/get-session`을 한 번만 묻는다. Next는 계정 메뉴·저장 버튼이 따로 두세 번 묻는다 | 수용 |
| 70 | 이동 표시줄은 클릭 120 ms 뒤 나타나 다음 페이지가 올 때까지 남는다(전체 페이지 이동이라 100 %로 채우는 마무리가 없다). 하단 내비 탭의 대기 스피너(`useLinkStatus`)는 옮기지 않았다: 브라우저 자체의 로딩 표시가 대신한다 | 수용 |
| 71 | 계정 메뉴·챗봇 패널은 CSS `menu-pop`으로 나타나고, 로그인 안내·설치 안내 시트는 애니메이션 없이 나타난다. Next는 motion의 스프링·슬라이드를 쓴다 | 수용 |
| 72 | `PublicWebMcpTools`(`document.modelContext`에 공개 도구 등록)는 옮기지 않았다. 브라우저가 이 API를 내놓기 전에는 아무 일도 하지 않는 컴포넌트다 | 미해결, 이 API가 쓰이게 되면 |
| 73 | 페이지를 켜는 변수는 이름이 `AXUM_PILOT_ROUTES` 그대로다. 이제 시범이 아니라 모든 페이지의 스위치이지만, `docker-compose.axum.yml`이 이 이름으로 넘기므로(#143) 이름을 바꾸려면 컴포즈 파일도 함께 바꿔야 한다 | 수용 |
| 74 | 퇴역 상품 410 문서의 카드 네 장은 Axum이 5분마다 다시 읽는다(`RETIRED_CARDS_TTL`). Next는 공개 카탈로그 캐시로 최대 하루 보관하고 운영자 액션의 태그 무효화로 비운다. 편집 직후에는 두 서버의 카드가 다를 수 있다 | 수용 |
| 75 | 퇴역 상품 410 문서는 Axum의 스타일시트(`/_axum/site.<해시>.css`)를 건다. Next는 빌드의 CSS 파일들을 건다. 클래스는 같다 | 수용 |
| 76 | B1의 정적 문서는 Next가 빌드 때 한 번 렌더하고 Axum은 요청마다 렌더한다. `Cache-Control`은 같다. 푸터의 연도는 Next에서 빌드한 해, Axum에서 응답한 해다 | 수용 |
| 77 | B1의 정적 문서(소개 제외)는 TypeScript에서 그대로 옮겨 적은 마크업이다(가이드와 퇴역 상품의 문구는 생성된 JSON). 문구를 고치면 TypeScript와 `server/src/pages/documents/`를 함께 고치고 페이지 게이트로 확인한다 | 수용 |
| 78 | Axum 페이지의 스크립트는 `/api/db/query`가 `503 "database busy"`(프로세스 안 동시 쿼리 6개 상한, 실행 전 거절)와 `Retry-After`로 답하면 그만큼 기다렸다 한 번 다시 보낸다. Next의 `lib/db/client.ts`는 오류로 읽어 저장한 밈이 저장 안 됨으로, 닉네임이 기본값으로 보인다(부하 시험 B0 저장 시나리오 간헐 실패의 원인). TypeScript 쪽도 같이 고치는 것이 맞다 | 미해결, `lib/db/client.ts` |
| 79 | 밈 채팅의 두 제한(주소별 10분 5회, 서버 전체 1분 20회)과 생성 답 캐시(32개, 1분)는 Axum 프로세스 안에 있다. Next의 카운터·캐시와 나뉘고, 전환 직후 캐시는 비어 있다 | 수용 |
| 80 | 채팅의 `MEME_CHAT_PROVIDER=opencodex`(로컬 프록시)는 Axum에서 언제나 꺼짐이다. Axum 뒤의 standalone Next도 `NODE_ENV=production`이라 꺼짐이고, `next dev`를 뒤에 둘 때만 다르다 | 수용 |
| 81 | OpenRouter 요청(채팅, 근거 초안)의 헤더는 undici와 같다(`authorization`, `content-type`, `accept: */*`, `accept-language: *`, `sec-fetch-mode: cors`, `user-agent: node`, `cache: "no-store"`가 더하는 `cache-control`·`pragma: no-cache`) 다만 `accept-encoding: gzip, deflate`는 보내지 않는다(압축을 풀지 않는다). 본문은 바이트 단위로 같다(`parity/chat.mjs`, `mpe-candidates.mjs`) | 수용 |
| 82 | 채팅의 OpenRouter 답은 4 MiB까지 읽는다(넘으면 형식 오류로 보고 요약을 낸다). Next는 끝까지 읽는다 | 수용 |
| 83 | 채팅 질문 본문, OpenRouter의 답(채팅 `content`, 근거 초안의 답과 `content`)에도 차이 54의 세 경우가 해당한다. 채팅은 요약으로, 초안은 500으로 떨어진다 | 수용 |
| 84 | 제목 키(`memeTitleKey`)의 `\s\p{P}\p{S}_`와 후보 텍스트 정규화의 `\p{Script=Hangul}\p{L}\p{N}`은 Node 22의 V8이 만든 표(`src/routes/unicode_classes.rs`, Unicode 17)를 쓴다. NFKC와 소문자화는 Rust 크레이트·표준 라이브러리의 표라 새로 배정된 글자에서 버전 차이가 날 수 있다. Next 이미지의 Node를 올리면 `parity/unicode-classes.mjs`를 다시 돌린다 | Node를 올릴 때 확인 |
| 85 | 근거 초안의 OpenRouter 요청은 리디렉션을 따르지 않는다(3xx는 실패한 답이다). Next의 `fetch`는 따라간다. OpenRouter가 리디렉션을 내지 않으므로 비교하지 않았다 | 수용 |
| 86 | 초안 재시도의 `Retry-After`는 수(`Number`가 읽는 꼴)와 HTTP 날짜만 읽는다. V8의 다른 날짜 꼴은 기본 대기(250 ms부터)로 떨어진다. 기다리는 시간만 다르다 | 수용 |
| 87 | `POST /api/admin/mpe-candidates` 본문은 1 MiB까지만 읽고 더 길면 JSON이 아닌 본문처럼 400이다. Next(`request.json()`)는 길이 제한이 없다 | 수용 |
| 88 | 후보 경로의 오류 메시지에 들어가는 DB 메시지(`candidate_search_failed: …` 등)는 Postgres가 낸 오류면 같다. 연결 실패는 sqlx와 node-pg의 문구가 다르다(차이 57과 같다) | 수용 |
| 89 | 근거 초안의 `권리 확인 시각`은 `row_to_json`이 세션 시간대로 쓴 글자다. sqlx 세션은 UTC, node-pg는 DB 기본값이라 DB 기본이 UTC가 아니면 다르다(7절 발견 4와 같다) | 수용 |
| 90 | 채팅의 `text()` 자르기가 서로게이트 쌍을 가르면 그 반쪽을 Next처럼 `\udXXX`로 쓴다(`routes/js_string.rs`). Next가 받는 질문에 짝 없는 서로게이트 이스케이프가 있으면 Next는 읽고 Axum은 400이다(차이 78) | 수용 |
| 91 | 저장 상태 메일: 메일 제공자가 리디렉션으로 답하면 Node의 `fetch`는 따라가고(최대 20번) Axum은 그 상태 코드를 `provider_http_3xx`로 기록한다 | 수용, 제공자 API가 POST에 리디렉션을 내는 일은 없다고 본다 |
| 92 | 저장 상태 메일: Axum이 보내는 헤더는 `content-type`, `authorization`(토큰이 있을 때), `host`, `content-length`뿐이다. `fetch`는 `accept`, `accept-language`, `accept-encoding`, `sec-fetch-mode`, `user-agent: node`를 더한다. 본문과 앞의 헤더는 같다(9절) | 수용 |
| 93 | 저장 상태 메일: 상태 이름이 `Object.prototype`의 속성(`toString`, `constructor`, `__proto__` 등)이면 TypeScript는 `TypeError`로 실패하고 그 메시지를 기록한다. 메시지에는 Next 운영 빌드의 압축된 변수 이름이 들어간다(`a.replaceAll is not a function`). Axum은 그 문자열을 그대로 기록하므로, 다른 빌드에서 이름이 바뀌면 그 행의 `last_error` 글자만 달라진다 | 수용, 그런 상태는 DB가 만들지 않는다 |
| 94 | 저장 상태 메일: TLS 신뢰 루트는 Axum이 바이너리에 든 Mozilla 루트(`webpki-roots`)와 `AXUM_EXTRA_CA_CERTS`, Node가 자신에 든 루트와 `NODE_EXTRA_CA_CERTS`다. 버전에 따라 루트 목록이 조금 다를 수 있다. 연결 시도 제한도 Axum 5초, undici 10초라 연결이 5~8초 걸리는 제공자에서는 기록되는 오류가 `fetch failed`와 시간 초과 메시지로 갈린다 | 수용 |
| 95 | 저장 상태 메일: 받는 사람은 `"user".email`만 읽는다. Next의 `getUserById`는 먼저 `ensureAuthSchema()`로 better-auth 테이블이 없으면 만든다. 테이블이 없는 DB에서 Next는 만들고 보내며 Axum은 `recipient_lookup_failed`를 기록한다. 운영에는 테이블이 있다 | 수용, Rust는 better-auth 테이블에 쓰지 않는다 |
| 96 | 캐시를 만료하는 두 경로(`source-refresh` `POST`, `instagram-video-cache`)는 Next의 `/api/internal/cache`를 부른다. Next가 응답하지 않으면 Axum은 TypeScript가 `revalidateTag`가 던질 때 내는 답(500 `REVALIDATION_FAILED`, 503 `retry-after: 1`)을 낸다. Next 자신이 답할 때는 이 실패가 생길 수 없다 | 수용 |
| 97 | `instagram-video-cache`의 분당 30회 제한은 프로세스별이다(5절 차이 3). Axum과 Next가 카운터를 나누지 않는다 | 수용 |
| A1-5 | better-auth 제한기(운영에서만, 10초에 100회, IP·경로마다)의 카운터는 프로세스별이다. `get-session`·`sign-out`은 Axum이 세고 나머지 `/api/auth/*`는 Next가 센다. 키가 경로마다 따로라 원래 두 경로는 다른 경로와 카운터를 나누지 않는다. 재시작하면 둘 다 0이 된다 | 수용 |
| A1-6 | 세션 연장 여부와 새 `expiresAt`·`updatedAt`을 Rust는 한 시각으로 정한다. better-auth는 만료 판단, 연장 판단, `expiresAt`, `updatedAt`에서 시계를 따로 읽는다(`dist/api/routes/session.mjs:155,180,199-200`). 경계에서 1 ms 안쪽일 때만 다를 수 있다 | 수용 |
| A1-7 | 두 경로의 쿼리는 `statement_timeout` 15초(`DbIdentity::better_auth`, 역할 전환은 없다) 안에 끝나야 한다. better-auth의 풀에는 시간 제한이 없다. 넘기면 `get-session`은 500 `FAILED_TO_GET_SESSION`이다. better-auth가 DB 오류에 내는 답과 같다. `sign-out`은 A1-4를 본다 | 수용 |
| A1-8 | `BETTER_AUTH_TRUSTED_ORIGINS`에 와일드카드나 `http(s)`가 아닌 항목이 있으면 `auth-sign-out`을 등록하지 않는다(Next가 답한다). 그런 패턴의 비교는 옮기지 않았다. 지금 Next 컨테이너는 이 변수를 받지 않는다 | 수용 |

## 6. 단계 2 진행: R1 (공개 텍스트 경로)

브랜치 `torisKR/axum-routes-r1`. 대상 8개 중 7개를 옮겼다. 검증은 같은 시드 DB에서 실제 Next와 바이트 단위로 비교했고(`server/parity/README.md` "Text routes", "Explore previews"), `cargo test`는 Next가 낸 본문을 픽스처(`server/tests/fixtures/r1/`, `previews.json`)로 들고 있다.

### 캐시와 `proxy.ts`

- 텍스트 경로 여섯 모두 Next에서 `force-dynamic`이다. 프리렌더·ISR이 없고, 응답 헤더는 핸들러가 넣는 `Cache-Control: public, max-age=3600`(실패 시 `no-store` + `Retry-After: 300`)뿐이다. Axum도 요청마다 렌더링한다.
- `proxy.ts`의 첫 매처는 `.txt`·`.xml`로 끝나는 경로를 건너뛴다. 그래서 이 경로들에는 `proxy.ts`가 붙이는 `Content-Language`가 없고(llms는 핸들러가 직접 넣는다), 적용되는 것은 www 호스트의 301뿐이다. Axum은 www 요청을 Next로 넘긴다.
- Next는 이 경로들의 본문을 압축하지 않는다(630 KB인 `/llms-full.txt`도). Axum도 압축하지 않는다.

### 이식한 TypeScript 동작(버그 포함)

1. **로케일 llms의 번역 순서는 정해져 있지 않다.** `getLocalizedFeaturedMemes`가 `trend_score` 정렬을 임베드된 `memes` 행(한 행)에 걸어, 최상위 쿼리에는 `ORDER BY`가 없다. 「트렌드 상위」가 아니라 Postgres가 읽은 순서대로 실리고, `LIMIT`에 걸리는 번역도 그 순서로 정해진다. 같은 DB에서 ANALYZE 전후로 순서가 뒤집히는 것을 확인했다. Axum은 같은 SQL을 준비하지 않은 문장으로 보내 Next와 같은 계획·같은 순서를 얻는다.
2. **제한 공개(`limited`) 밈도 번역이 검수됐으면 로케일 llms에 실린다.** 한국어 내보내기는 `approved`만 싣는다.
3. **`/llms-full.txt`의 별칭 줄.** 별칭이 전부 공백이면 `- 별칭: ` 뒤가 빈 줄이 그대로 나간다.
4. **내보내기 한도.** 후보가 50,000행을 넘으면 한국어 내보내기 넷은 503이고, 로케일 llms의 색인 집합은 오류 없이 50,000행에서 멈춘다.

### `/api/explore/previews`

- 과제 표에는 `GET`으로 적혀 있었지만 Next의 핸들러는 `POST`뿐이다(`GET`은 405). `POST`만 옮겼고 나머지 메서드는 Next가 답한다. `force-dynamic`, 응답은 `Cache-Control: no-store`.
- 어떤 콘텐츠를 미리보기로 내고 임베드를 허용할지는 `lib/meme-delivery.ts`의 권리 정책이 정한다. 그 부분(`resolveMemeDelivery` 중 이 경로가 읽는 것, `normalizeSourceUrl`, `sourcePlatformFromReference`)을 옮기고, 실제 TypeScript가 914개 사례에 낸 답을 픽스처(`server/tests/fixtures/preview_delivery.json`, `server/parity/preview-fixture.mjs`가 만든다)로 두어 사례마다 비교한다. 이식본을 38가지로 고쳐 보는 변이 시험에서 37개가 잡혔고, 남은 하나는 어떤 입력에서도 답을 바꾸지 못한다.
- 출처 검사(`lib/origin.ts`)는 Next 자신의 요청 URL을 쓴다. 독립 실행 Next에서 그 값은 `Host` 헤더가 아니라 `<x-forwarded-proto 또는 http>://localhost:<Next의 포트>`다(#34).
- 응답 카드의 순서는 Postgres가 행을 돌려준 순서다(쿼리에 `ORDER BY`가 없다). 요청한 id 순서가 아니다. 그대로 옮겼다.

### 프록시로 남긴 경로

- **`/api/oembed`.** `reserve_oembed_request()`를 부르는데 이 함수를 만드는 마이그레이션이 없다(`lib/database.types.ts`와 라우트·테스트에만 이름이 있다). `db/migrations`로 만든 DB에서는 로그인 안 한 요청은 401, 로그인한 요청은 전부 429라서 성공 경로에 닿을 수 없다. `components/meme-embed.tsx`가 모든 방문자에게 이 경로를 부르므로 제품 버그일 가능성이 크다(운영 DB에 함수가 따로 있는지는 확인하지 않았다). 성공 경로의 동치(할당량 호출, 플랫폼 요청, Next의 1시간 fetch 캐시)를 실제 스키마로 증명할 수 없어 옮기지 않았다. 함수를 마이그레이션으로 넣을지, 할당량 호출을 뺄지를 먼저 정해야 한다.

## 7. 단계 2·3 일부: R2 (밈 카드·퀴즈·조회수·분석 이벤트)

브랜치 `torisKR/axum-routes-r2`. 옮긴 경로는 5절 표의 `quiz`부터 `analytics-events`까지 일곱 개다. 동치 확인은 `server/parity/cards-quiz.mjs`·`tracking.mjs`(실제 Next와 같은 DB에서 요청·행 비교), `server/tests/quiz_parity.rs`(실제 `lib/quiz.ts` 출력), `server/tests/engagement_routes`(HTTP 통합 테스트)에 있다.

### 옮기지 않은 경로

| 경로 | 이유 |
| --- | --- |
| `/api/memes/{id}/view` | 통과시키는 `Origin`이 `new URL(request.url).origin` 하나뿐인데, 이 값은 Next가 자기 리슨 주소로 만든다(발견 2). Axum은 그 값을 알 수 없어 어떤 `Origin`이 통과인지 판정할 수 없다. 게다가 이 경로가 부르는 `record_meme_view` 함수가 마이그레이션에 없어서 검사를 통과해도 항상 400 `view_not_recorded`이고, 이 경로를 부르는 클라이언트 코드도 없다 |

### 계획을 바꾸는 발견

1. **`docker-compose.axum.yml`은 `MEMECATCH_SIGNING_SECRET`을 Axum에 넘기지 않는다.** 그래서 지금 opt-in 컴포즈로 켜면 `memes-view`와 `analytics-events`는 등록되지 않고 Next가 계속 답한다(값 없이 직접 답하면 503이 되므로 등록하지 않게 했다). 단계 5에서 컴포즈의 `app` 환경에 Next와 같은 값을 추가해야 두 경로가 네이티브가 된다. 값이 같아야 `mc_growth_session` 쿠키와 조회·네트워크 해시가 두 서버 사이에서 통한다. 단계 5a에서 추가했다(`.env`의 같은 변수를 두 서비스가 읽는다).
2. **Next의 `request.url`은 `Host` 헤더가 아니라 Next 자신의 리슨 주소로 만들어진다.** standalone 서버에서 `http://localhost:<PORT>`이고(127.0.0.1에 바인드해도 `localhost`), `X-Forwarded-Proto`에 `https`가 들어 있으면 `https://localhost:<PORT>`다. `hasTrustedOrigin`·`/api/memes/view`·`/api/analytics/events`는 `Origin`을 이 값과 `SITE_URL`의 origin 두 개와 비교한다. Axum은 앞의 값을 알 수 없으므로, `Origin`이 `SITE_URL`의 origin과 같으면 직접 처리하고 그 밖의 `Origin`은 Next에 넘겨 Next가 판정하게 했다. 운영에서 브라우저가 보내는 `Origin`은 사이트 origin뿐이라 실제 트래픽은 전부 네이티브로 처리된다. Next를 없애는 단계에서는 이 검사를 다시 정의해야 한다.
3. **`record_meme_view` 함수는 어디에도 없다.** `/api/memes/[id]/view`는 죽은 경로다. 지우거나 함수를 만드는 것은 TypeScript 쪽 과제다.
4. **sqlx는 세션 `TimeZone`을 UTC로 고정하고 node-pg는 DB 기본값을 쓴다.** 타임스탬프를 글자로 내보내는 경로(`claimedAt`)는 DB 기본 타임존이 UTC일 때만 Next와 같다. 컴포즈의 Postgres 이미지는 `Etc/UTC`다. 타임존을 바꾸면 Axum 쪽 표기만 `+00:00`으로 남는다.
5. **`growth_client_rate_limits`는 소유자와 SECURITY DEFINER 함수만 만질 수 있다.** `service_role`도 읽지 못한다. 그래서 통합 테스트는 그 테이블을 응답으로만 확인하고, 패리티 스크립트가 슈퍼유저로 직접 읽는다.

### 그대로 옮긴 TypeScript의 동작(고치지 않았다)

| # | 동작 | 위치 |
| --- | --- | --- |
| 1 | `/api/memes/view`(분당 120)와 `/api/memes/[id]/view`(분당 30)가 제한기 키 `meme-view:<ip>` 하나를 같이 쓴다. Axum은 앞의 경로만 답하므로 이 공유는 끊겼다(5절 차이 41) | `app/api/memes/view/route.ts`, `app/api/memes/[id]/view/route.ts` |
| 2 | 조회 본문은 128바이트 제한인데 `request.text()`로 전부 읽은 뒤에 잰다. `Content-Length`가 128을 넘으면 읽기 전에 413이고, 길이 선언이 없으면 BOM 3바이트를 뺀 뒤 잰다. 그래서 BOM + 128바이트는 선언하면 413, chunked면 통과다. Axum은 131바이트까지만 읽고 같은 답을 낸다 | `app/api/memes/view/route.ts` |
| 3 | `db.auth.getUser()`는 오류를 돌려주지 않아서 분석 경로의 `auth_unavailable`(503) 분기는 도달할 수 없다. 세션 조회가 실패하면 비로그인 이벤트로 기록된다 | `lib/db/server.ts`, `app/api/analytics/events/route.ts` |
| 4 | 분석 이벤트의 함수 호출이 한도(`P0429`) 말고 다른 이유로 실패하면 경로가 예외를 던져 500(본문 없음)이 된다. 세 가지가 확인됐다: `slice(0, 100)`이 서로게이트 쌍을 잘라 반쪽이 metadata JSON에 `\ud83d` 꼴로 들어간 경우, 문자열에 NUL이 있는 경우, 없는 밈 id(외래 키) | `app/api/analytics/events/route.ts` |
| 5 | 같은 dedupe key(같은 세션·이벤트·identity·분)의 두 번째 이벤트는 행을 쓰지 않지만 202이고 한도 카운터는 올라간다 | `record_growth_event` |
| 6 | 본문 길이·자르기가 UTF-16 코드 유닛 기준이다. 잘린 반쪽 서로게이트는 text 인자로는 U+FFFD가 되어 저장된다 | `app/api/analytics/events/route.ts` |
| 7 | 카드 받기 본문의 키가 반복되면(`{"cardId":"x","cardId":"mc-0001"}`) 마지막 값으로 통과한다 | `app/api/meme-cards/claim/route.ts` |
| 8 | `?cardIds=`의 `ownedCardIds`는 `ORDER BY`가 없어 Postgres가 돌려주는 순서다 | `lib/meme-collectible.server.ts` |
| 9 | 필터 없는 카탈로그 페이지는 같은 페이지를 두 번 읽고 대조한다. 예전 캐시와 맞춰 보던 로직이 캐시 없이 남은 것이다 | `lib/meme-collectible.server.ts` |
| 10 | `mc_growth_session` 쿠키의 MAC을 Node의 느슨한 base64 디코더로 읽는다. 같은 MAC의 다른 표기(`=` 패딩, 표준 알파벳, 중간에 낀 알파벳 밖 문자)도 통과하고, `uuid.mac.` 뒤의 조각은 보지 않는다 | `lib/growth/events.server.ts` |
| 11 | 퀴즈의 `set`은 mode의 연도 필터를 받지 않는다. 오답을 뽑는 풀만 필터된다. `set`의 각 id는 trim된다 | `app/api/quiz/route.ts` |
| 12 | 로그인한 사용자의 `auth.users` 행이 없으면 카드 받기는 외래 키 오류로 409 `card_unavailable`이다 | `lib/meme-collectible.server.ts` |

### Next와 남은 차이

5절 「Next와 남은 차이」 표의 39~49번이다. 따로 받은 번호(R2-1~R2-11)를 한 목록으로 합치면서 다시 매겼다: R2-n이 38+n번이다.

### 단계 5에서 추가로 확인할 것

- [x] `docker-compose.axum.yml`의 `app` 환경에 `MEMECATCH_SIGNING_SECRET` 추가(발견 1). 단계 5a에서 했다.
- 메인 풀 크기. 한 요청이 쓰는 트랜잭션은 카탈로그가 최대 셋(페이지, 대조, 보충), 컬렉션이 셋(세션, 소유 행, 카드), 카드 받기가 넷(세션, 자격, 쓰기, 읽기)이다. 차례로 쓰므로 연결은 요청당 하나지만, `AXUM_DB_POOL_MAX`(기본 4)를 정할 때 조회·분석 이벤트의 빈도와 함께 봐야 한다.

## 8. 단계 3 일부: R3 (미디어·업로드·밈 제작 API)

브랜치 `torisKR/axum-routes-r3`. 옮긴 경로는 5절 표의 `media-object`부터 `admin-mpe-candidates`까지 여섯 개다(`admin-mpe-candidates`는 `GET`만). 동치 확인은 `server/parity/mpe.mjs`(작업·렌더·후보 목록·미디어를 실제 세션으로), `server/parity/uploads.mjs`(업로드 두 경로, TypeScript와 Rust의 R2 요청, 워커), `server/tests/mpe_routes.rs`·`media_objects.rs`·`uploads.rs`(HTTP 통합 테스트, 업로드는 S3 게이트웨이와 함께), `server/tests/fixtures/multipart.json`(Node 22의 실제 `formData()`가 79개 본문에 낸 답)에 있다.

### 옮기지 않은 것

| 경로 | 이유 |
| --- | --- |
| `POST /api/admin/mpe-candidates` | 후보를 만들고 해시·텍스트 임베딩으로 매칭한 뒤(`lib/mpe/candidates.server.ts`) OpenRouter로 근거 초안을 만든다(`lib/mpe/evidence-draft.server.ts`). 외부 호출을 기록하는 스텁으로 TypeScript와 비교하는 일을 이번 배치에서 하지 않았으므로 Next에 둔다. 같은 경로의 `GET`(저장된 매칭 목록)만 옮겼다 |

### 계획을 바꾸는 발견

1. **로컬 저장소에서는 업로드를 Next에 둔다.** 5절 발견 8의 결론이다. Axum이 자기 컨테이너에 쓴 파일은 Next도 워커도 보지 못하므로, `upload`·`mpe-uploads`는 R2 값 네 개가 있을 때만 등록된다. 컴포즈 기본(로컬 저장소)에서는 두 경로가 Next에 남는다. 읽기(`media-object`)는 로컬에서 못 찾은 객체를 Next에 넘긴다.
2. **Next 이미지는 Node 22이고 로컬 Node는 26이다. 둘의 `formData()`가 다르다.** Node 22는 undici 6.29, Node 26은 undici 8이다. 같은 79개 본문 중 6개를 다르게 읽는다(5절 차이 51). 파서(`routes/multipart.rs`)는 운영과 같은 Node 22를 따르고, 픽스처 스크립트는 다른 버전에서 실행되기를 거부한다. 업로드 비교도 Node 22로 띄운 Next와 했다. 로컬 Node로 띄운 Next와 비교하면 그 6가지에서 차이가 보이는 것이 맞다.
3. **Node는 핸들러가 읽지 않은 본문을 버리면서 끝까지 받고, hyper는 연결을 닫는다.** 20 MB를 보내는 중인 클라이언트를 401이나 413으로 거절하면 hyper에서는 클라이언트가 응답 대신 끊긴 연결을 본다. 업로드 두 경로는 거절할 때 남은 본문을 백그라운드에서 버리며 받는다(`multipart::drain`, 메모리에 남기지 않는다). 그 덕분에 한도를 1바이트 넘긴 요청도 Next처럼 413을 받는다.
4. **업로드 본문은 한도까지만 쌓는다.** 한도는 두 경로 모두 20 MiB + 128 KiB다. `Content-Length`가 한도를 넘으면 읽기 전에, chunked면 한도를 넘기는 조각이 도착했을 때 413이다. 한도 안의 본문은 TypeScript처럼 다 받은 뒤 폼을 읽으므로 업로드 하나가 요청 동안 최대 약 20 MB를 차지한다.
5. **MPE 업로드는 지금 운영에서 성공할 수 없다.** 아래 TypeScript 동작 2. 워커가 Axum이 만든 작업을 처리하는지는 그 조건만 채워서 확인했다(아래 "워커").

### 그대로 옮긴 TypeScript의 동작(고치지 않았다)

| # | 동작 | 위치 |
| --- | --- | --- |
| 1 | RPC 플래너가 함수 인자 타입을 배열이 아니라 글자로 받아(`loadFunctions`의 `types`, node-pg가 `name[]`을 풀지 않는다) 어떤 인자에도 캐스트를 붙이지 않고 배열 인자를 `text[]`로 보낸다. `queue_metered_mpe_render_job(..., p_segments jsonb, ...)` 호출은 함수를 찾지 못해 실패하고, 검증을 통과한 렌더 요청은 전부 400 `render_not_available`이다. 작업은 쌓이지 않고 계량도 되지 않는다. 문장 로그로 Next가 `"p_segments" => $2::text[]`를 보내는 것을 확인했다 | `lib/db/execute.ts`, `app/api/mpe/renders/route.ts` |
| 2 | `create_media_ingestion`은 `storage.objects`에 임시 객체 행이 있어야 하는데, 지금 그 테이블에 행을 쓰는 코드가 없다(Supabase 저장소를 쓰던 때의 검사다. 부트스트랩의 `storage.objects`는 빈 껍데기다). 그래서 `/api/mpe/uploads`는 객체를 저장했다가 지우고 500 `ingestion_failed`를 낸다. `mpe_upload_storage`와 `mpe_ingestion` 한도는 그래도 한 번씩 쓴다 | `db/migrations/20260824220000_mpe_pipeline.sql`, `lib/object-storage.ts` |
| 3 | `next.config.ts`의 정적 자산 헤더 규칙(`/:path*\.(svg|png|jpg|jpeg|webp|avif|ico|woff2)`)이 `/api/media/...`에도 걸려, 핸들러의 `private, no-store` 대신 `public, max-age=2592000, stale-while-revalidate=86400`이 나간다. 비공개 업로드와 404도 마찬가지다. 앞단 캐시가 비공개 업로드를 30일 보관할 수 있으므로 따로 검토가 필요하다 | `next.config.ts`, `app/api/media/[...path]/route.ts` |
| 4 | 두 업로드 경로는 본문을 읽기 전에 `reserve_api_request`로 한도를 쓴다. 한도를 넘는 본문, 폼이 아닌 본문도 한 번으로 센다 | `app/api/upload/route.ts`, `app/api/mpe/uploads/route.ts` |
| 5 | `readBoundedFormData`가 크기 말고 다른 이유로 실패하면(폼이 아님, 본문이 끊김) 오류를 삼키고 "파일 없음"(`no_file`, `file_required`)으로 답한다 | 같은 곳 |
| 6 | `/api/upload`의 `too_large`는 두 가지다: 본문이 한도를 넘으면 413, 이미지가 5 MiB를 넘으면 400. 빈 파일은 `invalid_type`이다 | `app/api/upload/route.ts` |
| 7 | 렌더 결과의 서명 URL에 `download` 파일 이름 옵션을 넘기지만 저장소 계층이 무시한다 | `app/api/mpe/jobs/[id]/route.ts`, `lib/object-storage.ts` |
| 8 | 후보 목록은 `is_operator`를 두 번 묻는다(경로와 `listCandidateMatches`) | `app/api/admin/mpe-candidates/route.ts` |
| 9 | 운영자도 남의 비공개 업로드를 `/api/media/...`로 읽지 못한다(승인된 제보에 첨부된 것만) | `app/api/media/[...path]/route.ts` |

### 워커

`server/parity/uploads.mjs worker`가 확인한다. 레코딩 프록시가 Axum의 PUT을 받으면 `storage.objects` 행을 써 준다(TypeScript 동작 2의 조건만 채운다). 그러면 Axum의 `/api/mpe/uploads`가 201과 작업 id를 내고, `media_ingestions` 행(형식·종류·크기·sha256·키·만료 24시간)이 TypeScript가 보내는 인자대로 만들어진다. 게이트웨이의 객체를 워커 전용 디렉터리에 복사하고 `scripts/mpe-media-worker.mjs`를 한 번 실행하면 그 `inspect` 작업이 `completed`가 된다(`ffprobe` 결과의 형식 `mov,mp4,...`, 폭 64). 같은 업로드를 Next에 보내면 행이 없어 500 `ingestion_failed`다.

### 단계 5에서 추가로 확인할 것

- 업로드 동시성과 메모리. 업로드 하나가 요청 동안 최대 약 20 MB를 쥔다(TypeScript도 같다). Axum 컨테이너 256 MB에서는 동시 업로드 열 개 안팎이 한계다. 한도는 사용자별이라 여러 사용자가 동시에 올리면 막지 못한다. 동시 업로드 수 제한이나 메모리 상향을 정해야 한다.
- `storage.objects` 검사(TypeScript 동작 2)를 함수에서 빼거나, 저장할 때 행을 쓰거나. MPE 업로드를 살리려면 TypeScript·마이그레이션 쪽 결정이 먼저다.
- 비공개 업로드의 캐시 헤더(TypeScript 동작 3).
- Next 이미지의 Node를 올릴 때 5절 차이 51.

## 9. 단계 3 일부: R5 (AI 경로)

브랜치 `torisKR/axum-routes-r5`. 대상 다섯 중 셋을 옮겼다: `meme-studio`, `admin-meme-studio`(R5), `memes-semantic-search`(R5b). 동치 확인은 `server/parity/studio.mjs`(두 경로, Bedrock을 대신하는 기록 스텁, 예산 경계), `server/tests/fixtures/meme_studio.json`(실제 `generateMemeConcepts`가 228개 입력에 낸 답), `server/tests/fixtures/meme_studio_bedrock.json`(실제 SDK가 보낸 Converse 요청 본문 10개), `server/tests/studio.rs`에 있다.

### 옮기지 않은 경로

| 경로 | 이유 |
| --- | --- |
| `/api/memes/semantic-search`의 의미 검색 경로 | 쓸 수 있는 `MEME_EMBEDDING_URL`이 있을 때(임베딩 HTTP 호출, 번들 런타임의 HMAC, `search_meme_references`)는 Next가 답한다. 운영에는 URL이 없다(아래 발견 5) |

`/api/memes/chat`과 `POST /api/admin/mpe-candidates`는 R5c에서 옮겼다(10절).

### 계획을 바꾸는 발견

1. **공개 스튜디오는 AI를 부르지 않는다.** 정해진 템플릿 세 개를 주제 길이(UTF-16)로 돌려 낸다. 비용이 드는 생성은 운영자 경로뿐이다.
2. **AWS SDK(3.1121)는 Bedrock Runtime에 HTTP/2로 말하고, `AWS_ENDPOINT_URL_BEDROCK_RUNTIME`을 요청 시점에 읽는다.** 그래서 Next를 HTTP/2 스텁에, Axum을 HTTP/1.1 스텁에 붙여 같은 응답으로 비교했다. 본문 픽스처는 네트워크 없는 컨테이너에서 실제 SDK로 만든다. Axum도 같은 두 변수를 읽는다.
3. **Next는 `lib/meme-studio-bedrock.server.ts`의 매개변수 속성 때문에 Node의 타입 제거(`--experimental-strip-types`)로 못 읽는다.** 픽스처 스크립트는 `--experimental-transform-types`로 돈다.
5. **운영의 의미 검색은 임베딩을 하지 않는다.** 질의 경로(`lib/meme-vector-lookup.server.ts`의 `embedMemeQuery`)는 프로세스 안의 모델을 부르지 않고 언제나 `MEME_EMBEDDING_URL`로 HTTP 요청을 한다. 번들 런타임(`MEME_EMBEDDING_RUNTIME=bundled`)의 모델은 `/v1/embeddings`와 재색인만 쓴다. 운영에는 URL이 없으므로 의미 검색은 언제나 키워드 검색으로 떨어지고 이유는 `model_unavailable`이다. Axum은 그 경우만 맡는다.
6. **운영의 운영자 스튜디오에는 Bedrock 자격 증명이 없어 보인다.** `docker-compose.yml`은 `AWS_ACCESS_KEY_ID`·`AWS_SECRET_ACCESS_KEY`를 `.env`에서 빈 값 기본으로 넘기고, `app` 서비스는 모델 볼륨 말고는 아무것도 마운트하지 않는다(`~/.aws` 없음, `AWS_PROFILE`·컨테이너 자격 증명 변수 없음). SDK 체인은 마지막에 인스턴스 메타데이터를 묻는데 VM은 AWS가 아니라 OCI다. 그래서 지금 운영에서 운영자 스튜디오는 실패할 가능성이 크고, 예산 예약은 호출 전에 하므로 시도마다 평생 예산 100 USD에서 0.043 USD가 빠진다(TypeScript 동작 1). 코드와 컴포즈만 읽은 결론이고 VM에서 확인하지 않았다. 이 이유로 Axum 서비스에는 `BEDROCK_*`·`AWS_*`를 넘기지 않으며, `BEDROCK_MEME_STUDIO_ENABLED`가 없으면 Axum은 그 경로를 등록하지 않으므로 운영에서는 Next가 답한다.
4. **평생 예산 원장(`bedrock_meme_studio_lifetime_budget`)은 `service_role`도 읽지 못한다.** 테스트는 예약 함수가 돌려주는 합계로 원장을 움직인다. 한 번 천장에 닿으면 슈퍼유저만 되돌릴 수 있으므로 `cargo test`의 예산 테스트는 새 DB가 필요하다(패리티 스크립트는 슈퍼유저로 행을 다시 쓴다).

### 그대로 옮긴 TypeScript의 동작(고치지 않았다)

| # | 동작 | 위치 |
| --- | --- | --- |
| 1 | 운영자 스튜디오는 요청마다 최대 비용(입력 4,096 + 출력 2,048 토큰, 기본 0.043 USD)을 예약하고 정산하지 않는다. Bedrock이 실패하거나 답이 검사를 통과하지 못해도 예약은 남는다 | `lib/meme-studio.server.ts`, `reserve_bedrock_meme_studio_budget` |
| 2 | 운영자 스튜디오에는 요청 수 제한이 없다. 예산만 막는다 | `app/api/admin/meme-studio/route.ts` |
| 3 | 공개 스튜디오의 제한은 스키마 검사 뒤에 센다. 잘못된 요청은 세지 않는다. 키는 클라이언트가 보낸 `X-Forwarded-For` 첫 항목이다 | `app/api/meme-studio/route.ts`, `lib/rate-limit.ts` |
| 4 | 공개 스튜디오는 본문이 4 KiB를 넘어도 413이 아니라 400(「JSON 요청 본문이 올바르지 않습니다」)이다 | `app/api/meme-studio/route.ts` |
| 5 | 운영자 스튜디오의 실패는 전부(꺼짐, 요율 설정 오류, 예산 거절, Bedrock 실패, 답 검사 실패) 같은 503 `bedrock_unavailable`이다 | `app/api/admin/meme-studio/route.ts` |

### 단계 5에서 추가로 확인할 것

- VM에서 Bedrock 자격 증명이 환경 변수로 들어가는지(차이 61). 파일이나 다른 체인을 쓰면 Axum에서는 운영자 스튜디오가 503이 된다.
- `BEDROCK_MEME_STUDIO_*`, `AWS_REGION`과 AWS 키를 Axum 컨테이너에도 넘길 것. `BEDROCK_MEME_STUDIO_ENABLED`가 없으면 운영자 스튜디오는 Next에 남고, 켜져 있는데 키가 없으면 Axum이 503으로 답한다.

## 10. 단계 3 일부: R5c (밈 채팅, 후보 초안)

브랜치 `torisKR/axum-routes-r5c`(`torisKR/axum-routes-r5` 위). 두 경로를 옮겼다: `memes-chat`, `admin-mpe-candidates-post`. 동치 확인은 다음에 있다.

- `server/parity/chat.mjs`: 운영과 같은 설정(생성 켬, 키 없음)에서 모든 상태와 스트림, 제한, 25초 기한; 키를 준 두 서버에서 OpenRouter를 대신하는 기록 스텁으로 생성 답·거절 18가지·캐시·동시 요청 공유·대기 중 기록 변경·스트림의 진행 줄과 연결 끊김. Next의 `fetch`는 `parity/openrouter-intercept.mjs`가 프로세스 안에서 가로채 같은 스텁으로 보낸다.
- `server/parity/mpe-candidates.mjs`: 경우마다 다시 시드하고 Next, 남은 행, 다시 시드, Axum, 남은 행을 비교한다. 운영 설정의 모든 상태, 키를 준 설정의 초안 요청·재시도·예산 행, 그리고 저장이 실패할 때 Axum이 기록하는 매칭을 실제 `generateCandidateMatches`가 같은 행으로 계산한 값(`parity/mpe-candidates-flow.mjs`)과 비교한다.
- `server/tests/fixtures/meme_chat.json`, `mpe_candidates.json`: 실제 TypeScript가 만든 픽스처. 채팅은 20가지 기록·답에 대해 OpenRouter 요청 본문(바이트)과 결과, 제목 키, 답 검사 정규식의 판정(정규식은 소스에서 읽는다). 후보는 정규화·유사도·텍스트 임베딩·`Math.hypot`·해시·작업 검사·순위·해시 발견, 주장 검사, 그리고 스텁 클라이언트로 돌린 `generateEvidenceDraft`의 요청 본문·예약 횟수·저장 인자 16가지.
- `server/tests/chat.rs`, `mpe_candidates.rs`: HTTP 통합 테스트.

### 계획을 바꾸는 발견

1. **`POST /api/admin/mpe-candidates`는 지금 한 번도 성공하지 못한다.** 아래 TypeScript 동작 1. 운영자 화면의 후보 생성·매칭·근거 초안은 전부 500이다.
2. **운영의 채팅은 생성하지 않는다.** `MEME_CHAT_GENERATION_ENABLED`가 있어도 `OPENROUTER_API_KEY`가 없어 `generationConfig()`가 `null`이고, 답은 언제나 검색된 기록의 요약(`mode: "retrieved"`, `retrievalMode: "keyword"`)이다. 초안은 같은 이유로 503 `draft_provider_not_configured`다.
3. **TypeScript의 OpenRouter 주소는 운영에서 바꿀 수 없다.** 채팅은 `https://openrouter.ai`로 고정이고, 초안은 `NODE_ENV=production`에서 그 origin만 받는다. Axum은 테스트 전용 `AXUM_TEST_OPENROUTER_ORIGIN`(루프백 `http://host:port`만 받는다)으로 같은 요청을 스텁에 보낸다.
4. **Axum 컨테이너는 두 경로가 읽는 변수를 Next와 같은 `.env` 값으로 받는다.** `docker-compose.axum.yml`이 `MEME_CHAT_GENERATION_ENABLED`·`MEME_CHAT_PROVIDER`·`OPENROUTER_API_KEY`·`OPENROUTER_BASE_URL`·`OPENROUTER_MPE_MODEL`을 넘긴다(의미 검색의 두 변수는 #148). 처음에는 넘기지 않아, 운영에 키를 넣으면 Next만 생성할 뻔했다. `server/tests/compose_env.rs`가 서버가 읽는 변수를 소스에서 찾아, 컴포즈에 없고 일부러 뺀 목록(`BEDROCK_*`, `AWS_*`, `CSP_*`, 빌드 값, 테스트 전용 `AXUM_TEST_OPENROUTER_ORIGIN`)에도 없으면 실패한다.
## 11. 단계 3 일부: R4 (크론과 작은 운영자 API)

`server/src/routes/ops.rs`와 그 아래 모듈. 경로 id는 5절 표의 `growth-baseline`·`saved-state-emails`·`source-refresh`·`instagram-video-cache`·`adpick-hotdeals`·`creator-products`다. 비교는 `server/parity/ops.mjs`(실제 Next 운영 빌드와 같은 DB, 메일 제공자 대신 `server/parity/https-stub.mjs`), 시험은 `server/tests/ops_routes.rs`.

### Next의 캐시

Next의 Data Cache는 Next 프로세스 안에 있어서 Axum이 직접 지울 수 없다. 그래서 Next에 내부 경로 `POST /api/internal/cache?scope=<범위>`(`app/api/internal/cache/route.ts`)를 더했다. 크론 경로와 같은 `Authorization: Bearer $CRON_SECRET`을 요구하고, 범위는 둘뿐이다: `public-catalog`(`revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 })`)와 `instagram-video-verification`(`expireInstagramVideoVerificationCache()`, 카탈로그 태그와 `revalidatePath("/", "layout")`). 호출하는 쪽이 태그나 경로를 고를 수 없다. Axum은 `proxy::Upstream::expire_cache`로 이 경로를 부른다.

확인: `/memes/<key>`는 밈을 `cacheCatalogRead`(태그 `public-meme-catalog`, 24시간)로 읽는다. DB에서 제목을 바꾸면 페이지는 옛 제목을 계속 보이고, Axum의 `POST /api/cron/source-refresh`, Next의 같은 경로, Axum의 운영자 경로, Next의 운영자 경로 각각을 부른 뒤에는 새 제목을 보인다. 아무것도 부르지 않으면 옛 제목이 남는다(`ops.mjs cache`).

캐시를 지우는 R4 경로 가운데 Axum으로 옮긴 것은 이 둘뿐이다. 나머지(`source-refresh`의 `GET`, `/api/db/query`의 영상 확인)는 Next에 남아 있어서 지금처럼 Next 안에서 지운다. `trend-pulse`는 R8이 같은 길로 옮겼다(15절).

### Next에 남긴 경로와 이유

| 경로 | 이유 |
| --- | --- |
| `GET /api/cron/trend-pulse` | (R8이 옮겼다, 15절) `RADAR_*`와 토큰이 설정되면 X(`api.x.com`), Threads(`graph.threads.com`), Instagram(`graph.facebook.com`)을 고정 주소로 부른다. TypeScript를 고치지 않고는 로컬 스텁으로 돌릴 수 없어 같은 요청을 보내는지 증명할 수 없다. 레이더 코드도 1,400줄이다. 레이더 없는 부분(`compute_trend_scores`, 실패 기록, 캐시 만료, 두 팬아웃)은 작으니, 컨테이너의 DNS를 스텁으로 돌리는 하네스를 만든 뒤 함께 옮긴다 |
| `GET /api/cron/source-refresh` | YouTube Data API와 다섯 플랫폼의 oEmbed를 고정 주소로 부른다(위와 같은 이유). 약 1,500줄이다. `POST`는 옮겼다. R8은 Next의 oEmbed 캐시 때문에 남겼다(15절) |
| `POST /api/admin/source-ingestions` | 같은 oEmbed 조회(`getOEmbed`)를 고정 주소로 한다 |
| `GET /api/cron/mcp-events` | 전송(`sendPinned`)이 DNS 답을 검사해 공인 IPv4가 아닌 목적지를 거부하고 TLS를 그 주소에 고정한다. 로컬 스텁은 설계상 거부되므로 성공한 전송을 비교할 수 없다. 상태는 Node MCP 서버와 함께 쓰는 AES-256-GCM 암호문 JSON이라, 키 순서까지 Node와 같게 다시 써야 한다 |
| `POST /api/db/query` | 아래 |

### `/api/db/query`

브라우저 쪽 DB 클라이언트(`lib/db/client.ts`)의 유일한 통로다. 저장·반응·댓글·투표·제출·검색·탐색 등 컴포넌트 18개가 쓴다. 브라우저가 쿼리 계획(`lib/db/plan.ts`의 `QueryPlan`)을 보내면 서버가 매개변수 SQL로 바꿔 실행한다: `public` 스키마의 아무 테이블에 `select`·`insert`·`update`·`delete`·`upsert`, 아무 함수에 `rpc`. 누가 부를 수 있나: 신뢰된 origin(사이트 origin, Next 자신의 origin, 또는 `Sec-Fetch-Site: same-origin`)에서 오는 누구나. 세션이 있으면 `authenticated`(그 사용자 id)로, 없거나 위조면 `anon`으로 돈다. 허가는 Postgres의 권한과 행 수준 보안이 전부다. 라우트가 직접 거르는 것은 origin(403), 제한(전체 분당 1,200, 주소별 180: 429), 본문 1 MB(413), 계획 모양(연산 여섯 가지, 필드 50·깊이 2·행 1,000·임베드 100·필터 50 등: 400), 동시 실행 6개(503)뿐이다. 오류 메시지는 `login_required`·`premium_save_limit` 말고는 `query failed`로 바꾸고 SQLSTATE만 낸다.

R4에서는 옮기지 않았고 R9에서 옮겼다(18절). 당시의 판단: 계획 컴파일러(`lib/db/execute.ts`, `plan.ts`, 1,200줄)는 스키마 메타데이터를 읽어 임베드·필터·함수 오버로드를 풀고, 결과를 `row_to_json`으로 모양 짓는다. 임의의 계획에 대해 같은 SQL과 같은 권한 판단을 낸다는 것을 이 배치에서 증명할 수 없다. 틀린 번역은 곧 권한 우회가 될 수 있는 경로다. 대신 거부 경우를 Next에 직접, 그리고 Axum의 프록시를 거쳐 보내 같은 답을 확인했다(`ops.mjs db-query`, 허용되는 읽기 셋과 함께 검사 24개): origin 없음·다른 origin, JSON 아님, 1 MB 초과, 계획 없음·모르는 연산·필드 모양·한도 초과·음수 한도·필터 51개·임베드 세 단계, 식별자 아닌 테이블, 익명의 outbox 읽기(42501), 익명의 `service_role` 함수 호출(42501), 없는 함수(404), 익명의 밈 쓰기(42501), 로그인 사용자의 권한 없는 열 읽기(42501)와 자기 역할 올리기(42501, 행이 그대로인 것까지), 위조 쿠키는 익명, 주소별 181번째 요청(429). 옮길 때 이 목록이 출발점이다.

### Next와 남은 차이

5절 「Next와 남은 차이」 표의 74~80번이다.

### 그대로 옮긴 TypeScript의 동작(고치지 않았다)

| # | 동작 | 위치 |
| --- | --- | --- |
| 1 | RPC 플래너가 함수 인자 타입을 `name[]`의 글자열로 받아(8절 동작 1과 같은 원인) 배열 인자를 `text[]`로, 나머지를 타입 없이 보낸다. `replace_mpe_candidate_matches(p_candidate_id => unknown, p_matches => text[])`와 `replace_mpe_candidate_evidence(p_candidate_id => unknown, p_draft_json => unknown, p_evidence => text[])`는 없는 함수라, 매칭·생성·초안이 그 앞의 일을 다 한 뒤 500 `candidate_match_replace_failed: …`·`draft_replace_failed: …`로 끝난다. 그 앞의 일: 텍스트 임베딩 지문 교체, 후보 생성과 삭제, 예산 예약과 OpenRouter 호출. Axum은 같은 문장을 oid 0(타입 없음) 매개변수로 보내 같은 메시지를 얻는다 | `lib/db/execute.ts`, `lib/mpe/candidates.server.ts`, `evidence-draft.server.ts` |
| 2 | `create`가 이미 있는 후보를 찾으면(`created: false`) 실패해도 되돌리지 않는다. 새로 만든 후보는 지우는데, 그 삭제가 실패하면 그 오류가 원래 오류를 덮는다 | `app/api/admin/mpe-candidates/route.ts` |
| 3 | 초안은 요청(재시도, 교정 요청 포함, 최대 4번)마다 일일 예산을 먼저 예약한다. 실패한 요청도 예산을 쓴다 | `lib/mpe/openrouter.server.ts` |
| 4 | 초안의 공급자 오류(500, 연결 실패, 답이 JSON이 아님, 빈 내용)는 모두 같은 500 `mpe_candidate_failed`다. 답이 JSON이 아니면 재시도하지 않는다 | 같은 곳, `route.ts`의 `errorResponse` |
| 5 | 매칭의 검색어는 후보 제목과 모든 텍스트 조각을 이은 글 전체라, `search_memes`의 부분 문자열 조건(`ilike '%…%'`)에는 거의 걸리지 않는다 | `lib/mpe/candidates.server.ts` |
| 6 | 채팅의 `text()`는 UTF-16 단위로 자른다. 이모지 한가운데서 자르면 제목·요약·출처 이름에 반쪽이 남아 `\ud83d`로 나가고, 번역 슬러그가 그렇게 잘리면 `encodeURIComponent`가 던져 그 로캘의 답 전체가 503 `search_unavailable`(스트림은 오류 줄)이다 | `lib/meme-chat.server.ts` |
| 7 | 채팅의 주소별 제한은 클라이언트가 보낸 `X-Forwarded-For` 첫 항목으로 센다. 본문을 읽기 전에 세므로 잘못된 요청도 센다 | `app/api/memes/chat/route.ts`, `lib/rate-limit.ts` |
| 8 | 매칭·생성·초안은 요청 하나에 `is_operator`를 서너 번 묻는다 | `lib/mpe/*.server.ts` |

### Next와 남은 차이

5절 「Next와 남은 차이」 표의 74~85번이다.

### 단계 5에서 추가로 확인할 것

- TypeScript 동작 1: 플래너를 고치면(`types`를 배열로 읽기) 두 저장 함수가 처음으로 실행된다. 그때 Axum의 같은 두 문장도 고쳐야 하고, 성공한 답(`{ ok: true, data }`)은 아직 어느 서버에서도 본 적이 없다.
| 1 | 저장 상태 메일의 상태 이름이 `Object.prototype`의 속성이면 `STATE_LABELS[locale][state]`가 함수나 객체라서 `escapeHtml`이 `TypeError`를 던지고, 그 행은 그 메시지로 실패한다(5절 차이 76) | `lib/trend/outbox.server.ts` |
| 2 | 제목을 `slice(0, 200)`으로 UTF-16 단위로 자른다. 서로게이트 쌍이 잘리면 반쪽이 제공자에게 가는 JSON에 `\ud83d` 꼴로 들어간다 | 같은 파일 |
| 3 | 성공 기록(`finish_notification_outbox`)이 실패하면 같은 행을 실패로 다시 기록하려 한다. 그 호출도 실패하면 행은 `processing`으로 남는다 | 같은 파일 |
| 4 | `growth-baseline`은 다른 크론 경로와 달리 401 본문이 소문자 `unauthorized`이고, DB 오류는 객체를 그대로 던져 본문 없는 500이 된다 | `app/api/cron/growth-baseline/route.ts` |
| 5 | 운영자 경로는 `is_operator()` 조회가 실패해도 503이 아니라 403이다 | `app/api/admin/instagram-video-verification/revalidate/route.ts` |

### 새 설정

- `AXUM_EXTRA_CA_CERTS`: 바깥으로 나가는 HTTPS(지금은 메일 전송)가 바이너리의 Mozilla 루트에 더해 믿을 PEM 파일. Node의 `NODE_EXTRA_CA_CERTS`에 해당한다. 운영에서는 비워 둔다.
- `docker-compose.axum.yml`의 Axum 환경에 `PLUS_DIGEST_DELIVERY_URL`·`PLUS_DIGEST_DELIVERY_TOKEN`·`PLUS_DIGEST_FROM_EMAIL`을 `docker-compose.yml`이 Next에 주는 방식 그대로 더했다.

## 12. 단계 6 일부: A1 (세션 읽기·연장과 로그아웃)

브랜치 `torisKR/axum-auth-a1`. UI-PLAN의 인증 순서 ①·②다. 옮긴 경로는 5절 표의 `auth-get-session`·`auth-sign-out` 둘이다(`server/src/routes/better_auth/`). 기준은 better-auth 1.7.20과 better-call 1.4.5이고, 따른 원본 파일과 줄은 코드 주석에 있다. 이 앱의 설정에서는 쿠키 캐시·보조 저장소·`deferSessionRefresh`가 없으므로 그 분기는 옮기지 않았다. 세션 테이블은 better-auth가 쓰는 대로 로그인 역할 `memecatch`로 읽고 쓴다(`DbIdentity::better_auth`: `set role`도 설정값도 없고 `statement_timeout`만 둔다). `service_role`은 `user`·`session`에 `SELECT`만 있다.

동치 확인:

- `server/parity/auth-session.mjs`: 실제 Next와 두 경로의 모든 경우. 답(상태, 헤더, `Set-Cookie` 순서, 본문)과 쓰는 경우의 세션 행을 비교한다. 운영 빌드(`NODE_ENV=production`, 쿠키 `__Secure-`) 51/51, `next dev`(`NODE_ENV=development`) 50/50. 리뷰 수정(A1-1~A1-4) 뒤 다시: 67/67, 66/66.
- `server/tests/auth_session_cross.rs`(무시된 테스트, Node 필요): 같은 DB에서 실제 better-auth와 양방향. better-auth가 만든 세션을 Rust가 읽고, 연장하고, 만료시키고, 로그아웃한 뒤 better-auth의 `getSession`이 그 상태에 동의한다. 반대로 better-auth가 연장·만료·로그아웃한 뒤 Rust가 동의한다. 연장 경계(`expiresAt - 7일 + 1일 <= now`)와 만료 경계를 1초 앞뒤에서 본다. 두 `NODE_ENV` 모두.
- `server/tests/all_routes.rs`: 두 id 모두 `AXUM_DISABLED_ROUTES`에 적으면 Next로 간다. 나머지 `/api/auth/*`와 Next에 넘기는 요청(쿼리, `RSC`, 다른 메서드, 다른 본문)이 Next로 가는 것도 본다.
- B0 브라우저 게이트(`server/parity/behaviour/scenarios/account.spec.mjs`): 헤더의 로그인 상태가 페이지를 읽을 때 맞고, 계정 메뉴의 로그아웃이 세션을 끝낸다. Next와 Axum, 폰과 데스크톱 32/32. 행 삭제가 막힌 로그아웃(A1-4)을 더해 36/36. Axum과 Next 사이에 두 경로를 599로 거절하는 프록시를 두고도 Axum 쪽 16개가 통과했고(프록시까지 간 요청 0), 두 id를 끄면 실패했다.

### 옮기지 않은 것

| 요청 | 이유 |
| --- | --- |
| `HEAD /api/auth/get-session` | Next는 404다. 그대로 Next가 답한다 |
| 쿼리 문자열이 있는 `get-session` | `disableCookieCache`·`disableRefresh` 질의 스키마를 옮기지 않았다 |
| `RSC: 1`이 있는 `get-session` | Next가 better-auth 앞에서 `?_rsc`로 307을 낸다. `nextCookies`의 연장 건너뛰기(`dist/integrations/next-js.mjs:40-71`)는 HTTP 요청(`_flag === "router"`)에는 작동하지 않는다 |
| JSON 객체가 아닌 `sign-out` 본문, `callbackURL`·`disableRedirect`·`state`·`redirectTo`·`errorCallbackURL`·`newUserCallbackURL`이 있는 본문, 쿼리 문자열이 있는 `sign-out` | 415·400과 콜백 URL 검사(403, 문자열이 아니면 400)는 Next가 낸다(A1-2) |
| `Origin: null`과 `Sec-Fetch-Site: same-origin`인 `sign-out` | better-auth가 요청 URL에서 출처를 추정한다. Next가 답한다 |

### 계획을 바꾸는 발견

1. **운영 Next 빌드는 언제나 `__Secure-` 쿠키를 쓴다.** `useSecureCookies`가 `NODE_ENV === "production"`인데 Next의 운영 빌드가 이 값을 빌드 때 박아 넣는다. 그래서 `NODE_ENV=development` 비교는 standalone이 아니라 `next dev`와 했다. Axum은 `NODE_ENV`를 실행 때 읽고, 컴포즈는 둘 다 `production`이다.
2. **로그아웃의 출처 검사에는 `BETTER_AUTH_URL`이 필요하다.** 믿는 출처의 첫째가 `BETTER_AUTH_URL`(없으면 사이트 URL)의 origin이다. 컴포즈가 Axum에도 같은 값을 넘긴다.
3. **Next 컨테이너는 `BETTER_AUTH_TRUSTED_ORIGINS`를 받지 않는다.** 그래서 믿는 출처는 사이트 origin, `http://localhost:3000`, `http://127.0.0.1:3000`뿐이다(`lib/auth/server.ts`).

### 보안 리뷰 후 고친 것과 남은 차이

리뷰(쿠키 파싱, 로그아웃 검사, 로그아웃 DB 실패, `NODE_ENV`) 뒤에 고친 내용이다. id는 이 절 안에서만 쓴다.

| id | 내용 | 판정 |
| --- | --- | --- |
| A1-1 | `Cookie` 헤더 파싱과 `Set-Cookie` 줄 정리가 쿠키 수에 대해 이차였다(400 KB 헤더 하나에 수 초). 둘 다 `HashMap`으로 선형이 됐다(`cookies.rs`, 400 KB가 디버그 빌드에서도 0.5초 안). 두 경로는 `Cookie` 헤더(여러 개면 합)가 16 KiB를 넘으면 무엇보다 먼저 431, 빈 본문, `connection: close`로 답한다. Node가 그런 요청을 Next 앞에서 431로 거절하는 것과 같다. 차이: Node는 모든 헤더 바이트를 세고 Axum은 `Cookie`만 센다. 그래서 `Cookie`는 16 KiB 이하인데 헤더 전체가 16 KiB를 넘는 요청은 Next가 431, Axum은 보통 답이다. Axum의 431에는 `headers::apply`의 헤더가 붙고 Node의 431에는 아무 헤더도 없다 | 수용 |
| A1-2 | better-auth의 `originCheckMiddleware`는 `sign-out`에서도 쿼리의 `callbackURL`과 본문의 `redirectTo`·`errorCallbackURL`·`newUserCallbackURL`을 믿는 출처와 비교한다(쿠키가 없어도). 믿지 않는 값이면 403(`INVALID_CALLBACK_URL` 등), 문자열이 아니면 400이고 세션은 남는다. Rust는 이런 요청에 200을 내고 세션을 지웠다. 이제 쿼리 문자열이 있거나 이 키가 있는 요청은 Next가 답한다. 검사 자체는 옮기지 않았다. `auth-session.mjs`의 `sign-out` 절이 각 경우를 실제 Next와 비교한다 | 해결 |
| A1-3 | `NODE_ENV`가 없을 때 쿠키 이름은 운영(`__Secure-`)으로, 제한기는 개발(꺼짐)로 읽었다. 이제 둘 다 같은 판정 하나(`NODE_ENV`가 `production`이거나 없음)를 따른다(`config.rs`). 운영 Next 빌드가 `NODE_ENV`를 `production`으로 박아 넣으므로 그 빌드와 같다. `NODE_ENV=development`·`test`이면 둘 다 꺼진다. 컴포즈는 `production`을 넘기므로 운영은 바뀌지 않는다 | 해결 |
| A1-4 | **better-auth와 일부러 다르게 했다.** better-auth의 `signOut`은 세션 행을 지우다 DB 오류가 나면 기록("Failed to delete session from database")만 하고 쿠키를 지운 뒤 200 `{"success":true}`를 낸다. 실제 `lib/auth/server.ts`로 연결을 거부하는 DB에 대고 재 보니 5 ms에 200 success였고 행은 남았다. 그 토큰을 가진 누구나 세션을 계속 쓰고 연장할 수 있는데 사용자는 로그아웃됐다고 본다. Rust는 지우기가 풀 타임아웃(5초)으로 실패하면 한 번 더 시도한다(node-pg는 연결을 기다리므로 바쁜 풀에서는 결국 지운다). 그래도 못 지우면(DB가 연결을 거부, 10초 넘게 바쁜 풀, 그 밖의 DB 오류) 500 `{"message":"Failed to sign out","code":"FAILED_TO_SIGN_OUT"}`을 낸다. 쿠키 만료 줄은 성공 때와 같이 보내므로 이 기기에서는 로그아웃된다. 서버 기록 "sign-out could not delete the session"에 오류가 남는다(토큰은 없다). 호출하는 곳: Next의 로그아웃(계정 메뉴, `/my`)은 서버 액션이 `getAuth().api.signOut`을 프로세스 안에서 부르므로 이 경로를 HTTP로 부르지 않는다. HTTP로 부르는 곳은 Axum 화면의 계정 메뉴 스크립트(`server/ui`)뿐이고, 답의 상태를 보지 않고 로그인 표시를 지운 뒤 `/`로 간다. B0 `account.spec.mjs`의 "signing out when the server cannot end the session"이 행 삭제를 막은 채 Next와 Axum에서 같은 결과(쿠키 없음, `/`, 로그인 링크, 행은 남음)를 본다. `auth-session.mjs`는 이 차이(Next 200, Axum 500, 같은 쿠키 줄)를 확인한다 | 의도한 차이 |

## 13. 단계 3 일부: R7 (Open Graph 이미지)

브랜치 `torisKR/axum-routes-r7`. `next/og`를 쓰는 경로를 모두 찾았다: 기본 카드 `app/og/[locale]/route.ts`, 루트 `app/opengraph-image.tsx`, 퀴즈 결과 `app/og/quiz/[token]/route.ts`, 밈 공유 카드 둘(`app/(default)/memes/[key]/opengraph-image-k2cx9c/route.ts`, `app/[locale]/memes/[key]/opengraph-image/route.ts`), 카드 내보내기 `app/(default)/memes/[key]/export/route.ts`. 앞의 셋을 옮겼다(`server/src/og/`, `server/src/routes/og.rs`). 이 절의 차이는 `R7-n`으로 적는다.

| Route id | 경로 | 메서드 | 비고 |
| --- | --- | --- | --- |
| `og-default` | `/og/{ko,en,ja,zh,zh-tw,ar}` | `GET`, `HEAD` | Next가 빌드 때 미리 그린 카드. Axum은 프로세스마다 처음 요청에 한 번 그려 둔다. `ar`은 커밋된 PNG 그대로. 다른 세그먼트(`/og/xx`는 Next가 한 번 그려 두는 404), `%`가 든 경로, 다른 메서드는 Next가 답한다 |
| `opengraph-image` | `/opengraph-image` | `GET`, `HEAD` | 한국어 기본 카드와 같은 그림, `Cache-Control`만 다르다 |
| `og-quiz` | `/og/quiz/{token}` | `GET`, `HEAD` | 토큰만으로 그린다(DB 없음). 틀린 토큰은 404 `Not found`. `%`가 든 토큰(Next가 풀고 `trim`한다)과 다른 메서드는 Next가 답한다 |

### 어떻게 같게 그리나

Next(Satori 0.25 + sharp)는 레이아웃을 SVG로 쓰고 글자를 모두 글리프 외곽선 경로로 바꾼 뒤, sharp가 설치되어 있으므로(Next의 선택 의존성, standalone에도 들어간다) resvg가 아니라 libvips(librsvg)로 PNG를 만든다. Axum은 같은 SVG 기하를 직접 만들고 resvg 0.50으로 그린다.

- 글꼴은 앱의 파일 그대로(`assets/og-fonts`를 `server/assets/og`에 복사, 서버 이미지가 `server/`만 받기 때문. `tests/og_cards.rs`가 바이트가 같은지 본다).
- 글자 배치는 Satori가 쓰는 opentype.js를 따랐다(`server/src/og/font.rs`, `text.rs`): `hhea` 어센더, GPOS 커닝은 기본 스크립트의 `kern` 기능 중 타입 2 조회만(확장 조회는 opentype.js처럼 건너뛴다. 그래서 영어 카드에는 커닝이 없다), 줄 폭은 글자소마다 따로 잰 폭의 합의 올림, 글리프 경로는 공백마다 끊고 그 앞까지의 잰 폭에서 시작, 좌표는 `toFixed(1)`. 상자 배치는 Yoga의 반올림(반은 올림)을 따랐다.
- 확인: `server/tests/og_cards.rs`가 기본 카드 5개와 퀴즈 카드 13개를 Satori가 낸 SVG(`server/tests/fixtures/og/`, `server/parity/og-reference.mjs`가 앱의 TSX로 만든다)와 **같은 래스터라이저로 그려 픽셀이 하나도 다르지 않음**을 본다. 개발 중에는 퀴즈 토큰 50개(총문항 1~10, 모든 등급·모드·점수 자릿수)도 모두 같았다.
- 실제 Next와 비교: `server/parity/og.mjs`. 이미지마다 상태·헤더(`content-length` 빼고)와 크기가 같고, 픽셀은 허용 오차 안(채널 차이 평균 ≤ 0.5, 32 넘게 다른 채널 ≤ 0.05 %, 최대 ≤ 96)이어야 한다. 결과 79/79, 이미지 60장 중 가장 나쁜 값은 최대 67, 평균 0.303, 32 초과 0.0072 %다. 같은 SVG를 두 래스터라이저로 그렸을 때의 차이와 같다(가장자리 안티에일리어싱과 퀴즈 배경 그러데이션의 띠).

### Next에 남긴 경로

| 경로 | 이유 |
| --- | --- |
| `/memes/{key}/opengraph-image-k2cx9c`, `/{locale}/memes/{key}/opengraph-image` | 대표 사진이 있으면 저장소에서 읽어 앱의 JPEG·PNG 디코더로 풀고 `object-fit: cover`로 채워 그린다. 이미지 리샘플링은 래스터라이저마다 달라 사진 픽셀의 허용 오차를 장담할 수 없고, 1 MB를 넘으면 앱의 JPEG 인코더로 다시 줄인다. 제목은 자유 문자열이라 글자마다 글꼴(한·일·간·번 OTF 4개와 이모지 13개, 21 MB)을 고르고, 어느 글꼴에도 없는 글자는 Satori가 그 자리에서 Google Fonts·twemoji를 내려받는다(외부 호출). 문서 조회(`resolveKoreanMemeDocument`, 번역 판정, 검토된 매체)도 함께 옮겨야 한다. 별도 배치(R7b)로 할 일이다 |
| `/memes/{key}/export` | (R10에서 옮겼다. 아래 표의 두 줄도 마지막 절 "R10") 요청 때 jsDelivr에서 Pretendard를 내려받고(실패하면 Satori 기본 글꼴과 위의 동적 글꼴 내려받기), 제목·요약이 여러 줄로 접힌다(Satori의 `linebreak`(UAX #14)와 `Intl.Segmenter`). 로그인과 `reserve_meme_export` 쿼터가 앞선다 |

### Next와 남은 차이

| # | 차이 | 판정 |
| --- | --- | --- |
| R7-1 | 래스터라이저가 다르다(resvg ↔ libvips). 같은 SVG에서 가장자리 안티에일리어싱과 그러데이션 띠만 다르다(위 수치). PNG 인코더도 달라 바이트와 `Content-Length`가 다르다 | 수용 |
| R7-2 | 미리 그린 카드를 Next는 빌드 때, Axum은 프로세스가 처음 요청받을 때 그린다. 첫 요청만 수십 ms 늦다. `x-nextjs-cache: HIT`는 늘 붙인다(`/robots.txt`와 같다) | 수용 |
| R7-3 | 그리기는 한 번에 둘까지다(`src/og/mod.rs`의 `MAX_RENDERS`). 더 오면 기다린다. Next에는 제한이 없다 | 수용 |
| R7-4 | 그리기가 실패하면 Axum은 그 요청을 Next에 넘긴다. Next라면 500이다 | 수용 |
| R7-5 | 운영의 Next는 리눅스용 sharp로 그린다. 픽셀 비교는 macOS의 Next와 리눅스 Next 이미지(`docker build .`) 둘 다와 했고 결과가 같았다(72/72, 최대 67, 평균 0.303) | 확인됨 |

### 그리는 비용

각 서버 이미지를 운영 컴포즈의 제한으로 띄워 쟀다(`docker run --memory --cpus`, 메모리는 컨테이너 cgroup의 `memory.current`·`memory.peak`). 퀴즈 카드는 매번 그리고, 기본 카드는 미리 그려 둔 것을 낸다.

| | Axum (256 MB, 0.35 CPU) | Next (2816 MB, 0.75 CPU) | Next를 Axum 제한으로 (256 MB, 0.35 CPU) |
| --- | --- | --- | --- |
| 시작 직후 메모리 | 15 MB | 171 MB | 96 MB |
| 첫 `/og/ko` | 12 ms (이때 그린다) | 14 ms | 14 ms |
| 퀴즈 카드 20장 하나씩 | 중앙값 83 ms, 최대 89 ms | 중앙값 44 ms, 최대 424 ms | 중앙값 107 ms, 최대 1.1 s |
| 퀴즈 카드 30장 동시 | 2.8 s, 모두 200 | 1.6 s, 모두 200 | 4.7 s, 모두 200 |
| 그동안 `/robots.txt` | 최대 90 ms | 최대 1.27 s | 최대 4.3 s |
| 최대 메모리 | 33 MB | 400 MB | 256 MB(제한에 닿음) |

Axum은 그리기를 블로킹 풀에서 한 번에 둘까지만 하므로(R7-3) 이미지 요청이 몰려도 다른 요청이 막히지 않고 메모리가 늘지 않는다.


| 1 | `/og/en` 같은 영어·일본어·중국어 카드에도 `Content-Language: ko`가 붙는다. `proxy.ts`가 `/og/*`를 문서 경로로 보지 않아 기본값 `ko`를 쓴다 | `proxy.ts` `documentLocaleFromPathname` |
| 2 | `POST /og/{locale}`도 미리 그린 카드를 200으로 낸다(Next가 정적 경로를 메서드와 상관없이 낸다). Axum은 `POST`를 Next에 넘기므로 결과는 같다 | Next |

## 14. 단계 3 일부: R6 (ChatGPT 커넥터의 MCP 경로)

브랜치 `torisKR/axum-routes-r6`(main의 #150 위). 아홉 경로 id를 옮겼다: `mcp`, `mcp-operator`, `mcp-operator-post`, `mcp-oauth-authorize`, `mcp-oauth-token`, `mcp-oauth-metadata`, `mcp-resource-metadata`, `mcp-github`, `mcp-events-cron`. 로직은 `integrations/memecatch-chatgpt/src/`에 있고, Rust는 `server/src/routes/mcp.rs`와 `mcp/`다. 동치 확인은 다음에 있다.

- `server/parity/mcp.mjs`: 운영과 같은 설정(상태 키 없음)의 두 서버를 비교한다. 프로토콜 검사(버전 헤더, `Mcp-Method`, base64 `Mcp-Name`, `_meta`, 레거시 버전의 `resultType`), 모든 메서드와 오류 코드, 202·403·413·415·429, 도구 셋의 모든 인자 경우, 코퍼스를 못 읽는 여섯 경우(500, 리다이렉트, 끊긴 본문, 5 MiB가 넘는 `Content-Length`, 12초 초과, 밈이 없는 본문)와 각 서버가 보낸 요청, 시드된 `llms-full.txt`의 밈 48개 전부를 `get_meme`으로(필드마다 바이트 단위), 메타데이터, 운영 경로, 승인 경로의 모든 경우(비로그인·일반 사용자·운영자, 클라이언트 메타데이터 다섯 가지 실패), GitHub 서명과 페이로드 18가지, 크론의 비밀값 여섯 가지, 다른 메서드. Next의 `fetch`는 `parity/mcp-intercept.mjs`가 같은 스텁으로 보낸다.
- 공식 MCP SDK(`@modelcontextprotocol/sdk` 1.32.2, 저장소 밖에 설치) 클라이언트 세션: 연결, 도구·리소스 목록, 리소스 읽기, ping, 도구 호출 셋, 없는 도구, 잘못된 인자, 지원하지 않는 메서드 둘. 결과와 HTTP 교환 14개가 두 서버에서 같다.
- `server/tests/mcp.rs`: HTTP 통합 테스트 12개(스텁이 요청을 기록한다), `tests/all_routes.rs`: 아홉 id 각각이 `AXUM_DISABLED_ROUTES`로 Next에 넘어간다.

### 계획을 바꾸는 발견

1. **`/api/cron/mcp-events`가 503인 까닭: 운영 이벤트 MCP가 운영에 설정되어 있지 않다.** VM의 `.env`에 `MCP_EVENT_STATE_KEY`, `MCP_EVENT_RETRY_TOKEN`, `MCP_GITHUB_WEBHOOK_SECRET`, `MCP_EVENT_CALLBACK_ORIGINS`가 모두 없다(설정 여부만 확인했다). 게다가 `docker-compose.yml`은 Next에 앞의 둘(`MCP_EVENT_RETRY_TOKEN`, `MCP_GITHUB_WEBHOOK_SECRET`)만 넘기고, 상태를 봉인하는 키와 `MCP_EVENT_CALLBACK_ORIGINS`는 넘기지 않는다. 그래서 `databaseStore()` 안의 `stateKey()`가 던지고 경로는 503 `{"error":"Event retry is unavailable."}`를 낸다(`CRON_SECRET`이 맞을 때. 틀리면 401). 스케줄러 항목은 #82(2026-11-15)부터 있었다. 2026-11-20이라는 시작일은 코드로는 설명되지 않는다. 로컬 확인: 키 없는 Next는 503, 임의의 32바이트 키를 준 Next는 200 `{"ok":true,"attempted":0,"accepted":0}`. **고치는 법은 소유자가 정할 일이다(TypeScript는 그대로).** (가) 운영 이벤트 MCP를 쓰려면 새 키(32바이트 base64. 봉인된 옛 행은 없다)와 재시도 토큰·웹훅 비밀값·콜백 origin을 `.env`에 넣고, `docker-compose.yml`의 Next 환경에도 `MCP_EVENT_STATE_KEY`와 `MCP_EVENT_CALLBACK_ORIGINS`를 넘긴다. 아래 동작 1(승인 화면의 CSP)도 함께 풀어야 동의가 끝까지 간다. (나) 쓰지 않으려면 스케줄러에서 `mcp-events` 크론을 뺀다. 그때까지 503은 설정이 없다는 뜻일 뿐이다. Axum 모드에서는 `docker-compose.axum.yml`이 같은 `MCP_EVENT_STATE_KEY`를 Next(`next`)와 Axum(`app`)에 함께 넘긴다. 키가 생기면 Axum은 다섯 상태 경로를 등록하지 않고(차이 R6-1) Next가 답하며, 한쪽만 키를 받아 두 서버가 누가 답할지 어긋나는 일은 `server/tests/compose_env.rs`가 막는다(두 서비스에 가는 값이 다르면 실패).
2. **키가 없으면 운영 이벤트 쪽은 전부 고정된 실패다.** 승인은 503, 토큰은 언제나 503 `server_error`, `POST /api/mcp-operator`는 -32603, 웹훅은 검사를 통과해도 503이다. 코드도 토큰도 구독도 생길 수 없으므로, Axum은 이 고정된 답만 옮겼다. 키가 있으면 Axum은 그 경로들을 등록하지 않아, 코드와 토큰을 내주는 곳도 받는 곳도 언제나 Next다. "Next가 낸 코드·토큰을 Rust가 받고 그 반대도"는 이렇게 지켜진다: Rust가 내주거나 받는 코드·토큰은 없다. 키를 둔 OAuth 서버(PKCE, 리다이렉트 URI 일치, 봉인된 코드·토큰과 만료, 범위, 재사용 거부)와 이벤트 브로커는 프록시로 남겼다. 운영에서 한 번도 실행된 적이 없고, 옮기려면 AES-256-GCM 봉인 형식과 저장 행을 바이트 단위로 맞추는 별도 묶음이 필요하다.
3. **Axum 컨테이너도 바깥으로 HTTPS를 연다.** 도구는 `https://catchmeme.com/llms-full.txt`를(자기 자신을 Cloudflare 너머로), 승인은 `https://chatgpt.com/oauth/client.json`을 읽는다. Next와 같은 요청 헤더(`accept`, `accept-language: *`, `sec-fetch-mode: cors`, `user-agent: node`, 승인은 `cache-control`·`pragma: no-cache`)를 보낸다. 테스트에서는 `AXUM_TEST_MCP_ORIGIN`(루프백만)이 둘 다 스텁으로 보낸다.

### 그대로 옮긴 TypeScript의 동작(고치지 않았다)

| # | 동작 | 위치 |
| --- | --- | --- |
| 1 | 승인 화면의 보안 헤더가 클라이언트에 닿지 않는다. 경로가 정한 CSP(`default-src 'none'`, `form-action 'self' https://chatgpt.com/connector_platform_oauth_redirect`, `frame-ancestors 'none'`)와 `Referrer-Policy: same-origin`·`no-referrer`를 `next.config.ts`의 전역 값(`form-action 'self'`, `frame-ancestors 'self'`, `strict-origin-when-cross-origin`)이 대신한다. 전역 CSP는 강제(enforce)이므로, 키를 넣어 승인이 살아나면 동의 뒤 ChatGPT로 가는 303이 `form-action 'self'`에 막힐 가능성이 크다(브라우저로는 확인하지 않았다. 지금은 닿을 수 없는 길이다). Axum은 전역 값을 붙이는 `headers::apply`에 맡겨 같은 헤더를 낸다 | `integrations/memecatch-chatgpt/src/http.mjs`, `next.config.ts` |
| 2 | `fetch`가 던지는 `TypeError`를 인자 오류로 다룬다. 코퍼스에 연결하지 못하거나 리다이렉트되면 JSON-RPC -32602 `fetch failed`, 본문이 끊기면 -32602 `terminated`다. 서버 쪽 장애가 "잘못된 인자"로 보인다. 그 밖의 실패(상태 코드, 시간 초과, 크기, 밈 없음)는 `isError` 결과다 | `protocol.mjs`, `corpus.mjs` |
| 3 | 승인 `GET`은 세션보다 먼저 ChatGPT 클라이언트 메타데이터를 읽는다. 메타데이터가 유효하지 않은 동안(유효할 때만 1시간 보관) 비로그인 요청마다 바깥 요청이 한 번씩 나간다 | `app/api/mcp-operator/oauth/authorize/route.js`, `oauth.mjs` |
| 4 | `tools/call`의 주소별 제한은 클라이언트가 보낸 `X-Forwarded-For` 첫 항목으로 센다(10절 동작 7과 같다). 전체 제한이 먼저 세어진다 | `app/api/mcp/route.js`, `lib/rate-limit.ts` |
| 5 | 본문의 BOM을 지우지 않는다. BOM으로 시작하는 JSON-RPC 요청은 -32700, 웹훅은 400이다 | `app/api/mcp/route.js`, `app/api/mcp-operator/github/route.js` |

### Next와 남은 차이

| # | 차이 | 상태 |
| --- | --- | --- |
| R6-1 | `MCP_EVENT_STATE_KEY`가 비어 있지 않으면 `mcp-operator-post`, `mcp-oauth-authorize`, `mcp-oauth-token`, `mcp-github`, `mcp-events-cron`을 등록하지 않는다. 그 경로들은 Next가 답한다(발견 2) | 수용 |
| R6-2 | 승인 `GET`의 요청 대상이 8,000바이트를 넘으면 Next로 넘긴다. Next는 자기 origin을 포함한 `request.url`이 8,192자를 넘는지 보는데, 그 origin은 Axum이 알 수 없다. 답은 Next가 내므로 같다 | 수용 |
| R6-3 | ChatGPT 클라이언트 메타데이터 본문을 64 MiB까지만 읽고, 넘으면 503이다. Next는 끝까지 읽은 뒤 16 KiB 검사로 400을 낸다 | 수용 |
| R6-4 | 코퍼스를 읽는 중에 다른 요청이 기다리다 그 읽기가 실패하면, Axum은 기다린 요청마다 다시 읽는다. Next는 기다린 요청 모두에 같은 실패를 준다 | 수용 |
| R6-5 | 바깥 요청의 TLS는 webpki 루트(Mozilla 목록)와 HTTP/1.1이고, Node는 자체 CA 목록과 undici다. 한쪽만 믿는 인증서라면 답이 다르다. `fetch` 실패의 메시지는 Axum에서 `fetch failed`(연결·리다이렉트)와 `terminated`(끊긴 본문) 둘뿐이다 | 수용 |

### 단계 5에서 추가로 확인할 것

- 발견 1: 운영 이벤트 MCP를 설정할지(새 키), 아니면 크론을 뺄지. 설정한다면 `docker-compose.yml`의 Next 환경에도 키를 넘겨야 Axum 없이 배포할 때도 Next가 상태 경로를 실행한다.
- 동작 1: 키를 넣기 전에 승인 경로의 CSP를 전역 값에서 빼야 동의가 끝까지 갈 수 있다(TypeScript·`next.config.ts` 변경이다).
- VM의 Axum 컨테이너가 `catchmeme.com`과 `chatgpt.com`에 HTTPS로 나갈 수 있는지(발견 3). 못 나가면 도구는 -32602 `fetch failed`, 승인은 503이다. Next는 이미 나간다.

## 15. 단계 3 일부: R8 (바깥 호스트가 고정된 경로)

브랜치 `torisKR/axum-routes-r8`(main 위, R4 #146 포함). `GET /api/cron/trend-pulse`를 옮겼다(경로 id `trend-pulse`). `GET /api/cron/source-refresh`와 `POST /api/admin/source-ingestions`는 Next에 남긴다. 코드는 `server/src/routes/ops/trend_pulse.rs`, `radar.rs`, `radar_connectors.rs`, `radar_text.rs`. 비교는 `server/parity/trend-pulse.mjs`(실제 Next 운영 빌드와 같은 DB, 바깥 호스트는 Next 쪽 `radar-intercept.mjs`, Axum 쪽 `AXUM_TEST_RADAR_ORIGIN`으로 같은 녹음 스텁에 보낸다), 시험은 `server/tests/trend_pulse.rs`.

### `trend-pulse`가 하는 일

`compute_trend_scores()` → (커넥터가 설정돼 있으면) 레이더 → `fan_out_trend_alerts()` → `fan_out_saved_context_alerts()`. 모두 `service_role`, 문장마다 트랜잭션 하나. 함수는 이름으로 먼저 찾고 없으면 `function not found`다(계획 실행기와 같다). `compute`가 실패하면 `job_runs`에 실패를 적고 502로 끝난다. 팬아웃이 실패하면 502, 레이더가 실패하거나 일부만 되면 200 `partial`이다.

**캐시 만료의 순서.** TypeScript는 `compute_trend_scores` 바로 뒤에서 `revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 })`를 부른다. 그러나 경로 핸들러 안의 `revalidateTag`는 태그를 적어 두기만 한다. Next는 핸들러가 응답을 돌려준 뒤 `executeRevalidates`로 만료하고(`next/dist/server/route-modules/app-route/module.js`의 `resolvePendingRevalidations`, `revalidation-utils.js`), 그 결과는 `waitUntil`로 응답과 따로 간다. 그래서 실제로 만료되는 때는 실행의 모든 쓰기 뒤이고, 만료가 실패해도 답은 같다. Axum은 이를 따라 `compute`를 지난 실행이면 끝에서 R4의 `Upstream::expire_cache(PublicCatalog)`를 부르고, 실패는 로그만 남긴다. 호출 자리를 TypeScript 글자 그대로(레이더 앞) 두면 레이더와 팬아웃 사이에 그려진 페이지가 캐시에 남을 수 있어 Next와 달라진다. R4의 `POST /api/cron/source-refresh`는 만료 실패에 500을 내는데, 그 경로의 `catch`는 Next 안에서는 닿지 않는다(5절 차이 96). 이 경로에는 그런 `catch`가 없다.

확인: `/memes/<key>`의 제목을 DB에서 바꾸면 페이지는 옛 제목을 보이고, Axum의 trend-pulse 뒤에도 Next의 trend-pulse 뒤에도 새 제목을 보인다. `compute_trend_scores`가 없을 때(502)는 두 서버 모두 옛 제목이 남는다(`trend-pulse.mjs cache`).

### 레이더가 실제로 닿는 곳

레이더 코드(`lib/trend/radar*.ts`)는 1,400줄이지만 운영 스키마에서 실행되는 부분은 그 앞부분뿐이다. 신호를 하나라도 모으면 저장에서 반드시 실패하기 때문이다(R8-1). 그래서 옮긴 것: 커넥터 상태 읽기, 세 커넥터의 요청과 응답 읽기(동시에, 커넥터마다 30초), 신호의 시각 검사(`normalizeRadarSignal`), 실패하는 신호 저장, 신호가 없을 때의 커넥터 상태 쓰기와 밈 두 읽기. 매칭·점수·상태 추천·안전 검토 대기열은 닿을 수 없어 옮기지 않았다. `tests/trend_pulse.rs`가 `external_signals.raw_expires_at`의 `NOT NULL`을 고정해 두므로, 이를 바꾸는 마이그레이션은 시험을 깨뜨린다. 그런 스키마에서 저장이 성공하면 Axum은 그 저장을 되돌리고 오늘처럼 `RADAR_SIGNAL_WRITE_FAILED`로 답하며 오류를 남긴다.

### 옮겨 온 TypeScript 버그

| id | 버그 | 위치 |
| --- | --- | --- |
| R8-1 | 신호 저장(`signalInsert`)이 `raw_expires_at: signal.rawExpiresAt`을 넣는데 어느 커넥터도 그 값을 정하지 않는다. 계획 실행기는 빈 값을 `NULL`로 보내고, 열은 `NOT NULL`(기본값 `now() + 30 days`는 명시한 `NULL`에 쓰이지 않는다)이라 신호가 하나라도 있으면 실행은 `RADAR_SIGNAL_WRITE_FAILED`다. 커넥터 상태도 그 뒤라 기록되지 않는다 | `lib/trend/radar-repository.server.ts` |
| R8-2 | X 커넥터의 키 `x`는 `connector_health.connector_key`의 검사 `^[a-z0-9][a-z0-9_-]{1,63}$`(두 글자 이상)를 통과하지 못한다. X가 설정되면 신호가 없는 실행도 `RADAR_CONNECTOR_HEALTH_WRITE_FAILED`이고, 그래서 X의 커서(`since_id`)는 한 번도 저장되지 않는다. `external_signals.platform`의 같은 검사도 `x`를 거절한다(R8-1이 먼저 실패한다) | 같은 파일, `radar-connectors.server.ts` |
| R8-3 | `normalizeRadarHashtag`는 `#`을 앞뒤 공백을 지우기 전에 뗀다(`/^#+/`). 그래서 `RADAR_X_TERMS="밈, #짤"`의 두 번째 항목은 `#짤`로 남아 X 검색어가 `"#짤"`이 된다 | `lib/trend/radar.ts` |

### Next와 남은 차이

| id | 차이 | 판정 |
| --- | --- | --- |
| R8-4 | 캐시 만료: Axum은 실행 뒤, 응답 전에 만료를 기다린다. Next는 응답과 함께 백그라운드로 만료한다. 둘 다 만료 실패는 답을 바꾸지 않는다 | 수용 |
| R8-5 | 공급자 요청의 헤더는 undici와 같다(`authorization`, `accept: */*`, `accept-language: *`, `sec-fetch-mode: cors`, `user-agent: node`, `cache: "no-store"`의 `cache-control`·`pragma`). `accept-encoding`은 보내지 않는다(5절 차이 81과 같다). 리디렉션을 따라가지 않고, 32 MiB가 넘는 답은 `terminated`로 실패한다(`response.json()`에는 한도가 없다) | 수용 |
| R8-6 | 2xx인데 JSON이 아닌 답: 두 서버 모두 그 커넥터가 실패하지만 `last_error`의 글이 다르다(Next `Unexpected token '<', "<html>" is not valid JSON`, Axum `expected value at line 1 column 1`). 빈 답(`Unexpected end of JSON input`)은 같다. JSON 안의 짝 없는 서로게이트 이스케이프(`"\ud800"`)는 V8이 받고 serde_json은 거절한다 | 수용 |
| R8-7 | 공급자 시각: `Date.parse`가 받는 ISO 꼴(연, 연-월, 연-월-일, 6자리 부호 연도, `T`·`t`·공백 뒤 시각, 소수 초, `Z`·`±HH:MM`·`±HHMM`, 월말 넘김, `24:00`)은 같다(`radar_text.rs` 시험). V8의 옛 파서가 받는 그 밖의 꼴(`Nov 24 2026` 등)은 Axum이 거절해 그 커넥터가 실패한다. 시간대 없는 시각은 Next에게 지역 시각, Axum에게 UTC다(이미지의 시간대는 UTC). X·Meta는 ISO로 보낸다 | 수용 |
| R8-8 | 함수가 아닌 것을 부르는 `TypeError`의 글에는 Next 운영 빌드가 줄인 변수 이름이 들어간다(`a.trim`, `a.normalize`, `(k.data ?? []).map`, `(h.data ?? []).filter`, `(p.data ?? []).filter`). Axum은 비교한 빌드(Next 16.3.4)의 글을 그대로 쓴다. 다른 빌드에서 이름이 바뀌면 그 `last_error`만 달라진다(5절 차이 93과 같다) | 수용, 공급자가 규격에 없는 답을 할 때만 |
| R8-9 | DB에 닿지 못할 때 `compute:` 뒤의 글은 node-pg(`connect ECONNREFUSED …`)와 sqlx가 다르게 쓴다. DB가 낸 오류의 글은 같다 | 수용 |
| R8-10 | 실패할 수밖에 없는 신호 저장(R8-1)에 넣는 해시태그는 `\p{L}\p{N}` 대신 Rust의 알파벳·숫자로 뽑는다. 그 행은 저장되지 않는다 | 수용 |
| R8-11 | TLS 신뢰 루트는 바이너리의 Mozilla 루트, Node는 자신의 루트다(5절 차이 94와 같다). `AXUM_EXTRA_CA_CERTS`는 레이더에 쓰이지 않는다 | 수용 |

### 비교 결과

같은 DB에서 실제 Next(standalone, Node 22)와 Axum을 나란히 띄워 각 경우마다 DB를 같은 상태로 되돌린 뒤 한 서버씩 실행하고, 답(상태, `content-type`, `cache-control`, 본문), 공급자가 받은 요청(메서드, 경로와 질의, 헤더), 남은 행(`connector_health` 전체, `external_signals` 수, `job_runs`의 `compute_trend_scores` 행, 밈 점수의 해시. 시각은 꼴만)을 비교했다.

- 레이더 설정 없음(운영의 지금): bearer 다섯 가지, 다른 메서드 넷, `HEAD`, 정상, 팬아웃 값 7과 `null`, `compute`의 예외와 부재, 두 팬아웃의 예외. 28/28. 캐시 4/4.
- 세 커넥터 모두(`RADAR_X_TERMS="밈, #짤,밈"`, 공백 있는 토큰, `META_GRAPH_API_VERSION=" v99.0 "`): 27경우 81/81.
- Threads·Instagram만(커넥터 상태가 기록돼 `last_error`까지 비교된다): 같은 27경우 81/81. 경우: 빈 답, 앞선 상태(커서·실패 수·`quota_remaining` 5.5·잘못된 형의 값), 신호가 있는 각 공급자, 고유 번호 없는 검색, 객체인 `data`, 401·404·500·403, 연결 거절, 한 검색어만 실패, 날짜가 아닌 시각·`null` 시각·없는 시각·`+0000`·숫자 시각, `null` 게시물, 숫자 본문, `null` 본문, 문자열·숫자 `data`, 빈 200, 걸러지기 전의 `null`, `true` 시각, 객체 캡션.
- 30초 시간 초과는 두 서버 모두 `Connector threads timed out`. HTML 답은 R8-6.
- `paths.txt` 160개 중 158개가 같다(나머지 둘은 `/memes/random`의 무작위 리디렉션).

### 새 설정

- `AXUM_TEST_RADAR_ORIGIN`: 시험과 비교 전용. `http://127.0.0.1:<port>`(또는 `localhost`)만 받고, `https://api.x.com`·`https://graph.threads.com`·`https://graph.facebook.com`으로 갈 요청을 `<origin>/<host><path>`로 보낸다.
- `docker-compose.axum.yml`의 Axum 환경에 `RADAR_X_TERMS`, `X_API_BEARER_TOKEN`, `RADAR_THREADS_TERMS`, `THREADS_ACCESS_TOKEN`, `RADAR_INSTAGRAM_HASHTAGS`, `META_INSTAGRAM_ACCESS_TOKEN`, `META_INSTAGRAM_USER_ID`, `META_GRAPH_API_VERSION`을 `docker-compose.yml`이 Next에 주는 그대로 더했다. 없으면 Next가 모을 때 Axum은 아무것도 모으지 않는다(`server/tests/compose_env.rs`가 지킨다).

### Next에 남긴 경로

| 경로 | Next에 남긴 까닭 |
| --- | --- |
| `GET /api/cron/source-refresh` | TikTok·Instagram·Threads·Facebook 출처를 `getOEmbed()`로 확인하는데, `getOEmbed()`는 공급자를 `fetch(..., { next: { revalidate: 3_600 } })`로 묻는다(`lib/oembed.ts`). Next 16.3.4에서 이것은 데이터 캐시다(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md`, `options.next.revalidate`). `force-dynamic` 경로 핸들러에서도 명시한 `revalidate`는 캐시되고, 200 답만 저장된다(`next/dist/server/lib/patch-fetch.js`). 키는 공급자 URL이라 `/api/oembed`, 제출 액션, 운영자 액션, `source-ingestions`가 같은 캐시를 쓴다. 그래서 판정 불가(200, 제목·작성자 없음)인 TikTok 답의 재시도(5분, 10분, 20분, 40분)는 한 시간 동안 TikTok에 닿지 않고 캐시된 답을 다시 읽는다. 매번 묻는 Axum은 다른 답을 받을 수 있다. YouTube(`videos.list`, `cache: "no-store"`)는 해당하지 않는다. `POST`는 R4가 옮겼다 |
| `POST /api/admin/source-ingestions` | 같은 `getOEmbed()`와 같은 캐시를 쓴다 |

`getOEmbed()`를 부르는 경로는 그 캐시와 함께 한 묶음으로 옮긴다. Axum 쪽에 한 시간 캐시를 따로 두는 것으로는 부족하다(Next 프로세스의 캐시와 공유되지 않는다).

### `/api/cron/source-refresh`가 502인 까닭(경로 동작은 바꾸지 않았다)

1. **502는 "일부 실패"(`status: "partial"`)다.** #89(2026-11-16 머지)가 두 가지를 바꿨다. 하나, `partial`도 502로 답한다(그 전에는 `failed`만 502였고 `partial`은 200이었다). 둘, 스케줄러가 하루 한 번(17:00)이 아니라 15분마다 부른다(`deploy/scheduler/crontab`). `partial`은 고른 행 하나만 실패해도 된다. 해당하는 경우는 오래된 행·재시도 행 조회의 실패, YouTube 호출의 실패, oEmbed 행 하나의 실패(모양이 잘못된 ID 포함), 기한(40초)에 걸려 미뤄진 oEmbed 행(#139부터), 캐시 만료의 실패, `job_runs` 기록의 실패다.
2. **운영에서 계속 실패하는 것은 TikTok이다.** 운영 `job_runs`(`refresh_media_sources`의 `detail->'observations'`, 읽기 전용 조회)로는 Instagram과 YouTube 행은 확인되고, TikTok oEmbed는 449건 중 0건이 확인됐다. 그러니 `partial`은 주로 TikTok에서 온다. 앞선 메모의 "Instagram oEmbed가 토큰 없이 불려 계속 실패한다"는 추측은 운영 기록과 맞지 않아 거둔다. TikTok의 확인은 제목이나 작성자가 없는 일반 플레이어 답을 "판정 불가"로 실패시키고, 그 200 답은 위의 한 시간 캐시에 남아 재시도에도 같은 답이 돌아온다. 경로 동작은 바꾸지 않았다.
3. **실패한 행이 실행 대부분을 실패로 만든다.** 실패한 행은 `last_checked_at`을 바꾸지 않고 복구 대기열에 들어간다. DB 함수 `record_source_acquisition_failure`가 5분에서 시작해 두 배씩(최대 24시간) 다음 시도를 미룬다. 15분마다 도는 실행에 다시 시도할 TikTok 행이 하나라도 끼면 그 실행은 502다.
4. **시작일 2026-11-18은 코드로는 확정할 수 없다.** #89는 11-16에 머지됐고, 11-17~18에 배포 경로를 고친 커밋(#103, #111)이 있다. #89가 VM에 처음 올라간 날이 11-18일 수 있다.

## 16. 단계 6 일부: A2 (이메일 로그인·가입·인증 메일·비밀번호 재설정)

브랜치 `torisKR/axum-auth-a2`(A1-FIX 841687aab 위). UI-PLAN의 인증 순서 ③·④다. 옮긴 경로는 5절 표의 다섯 개다(`server/src/routes/better_auth/`). 이 앱이 쓰는 better-auth 엔드포인트를 서버 액션(`lib/actions/auth.ts`)과 `lib/db/server.ts`의 `auth.api.*` 호출에서 찾았다: `signInEmail`, `signUpEmail`, `requestPasswordReset`, `resetPassword`, 그리고 인증 메일의 링크인 `verifyEmail`. Next의 폼은 지금도 서버 액션으로 better-auth를 프로세스 안에서 부르므로, 이 HTTP 경로를 쓰는 것은 B6에서 옮길 Axum 폼과 `/api/auth/*`를 직접 부르는 클라이언트다.

동치 확인:

- `server/parity/auth-credentials.mjs`: 실제 Next와 다섯 경로의 모든 경우. 답(상태, 헤더, `Set-Cookie`, 본문), 그 주소가 `user`·`account`·`session`·`verification`·`auth.users`·`profiles`에 남긴 행, 웹훅으로 보낸 메일 본문을 비교한다. 운영 빌드(`NODE_ENV=production`, 웹훅 있음) 75/75, `next dev`(웹훅 없음) 73/73. 웹훅이 없으면 두 서버가 같은 `{"event":"…_not_delivered","email":…}` 줄을 남긴다.
- `server/tests/auth_credentials_cross.rs`(무시된 테스트, Node 필요): 같은 DB에서 실제 better-auth와 흐름마다 양방향, 두 `NODE_ENV`. better-auth로 가입한 사용자가 Rust에서 인증하고 로그인하고, 그 세션을 better-auth가 읽는다. Rust로 가입한 사용자는 better-auth에서 인증하고 Rust가 만든 scrypt 해시로 로그인한다. 재설정은 한쪽에서 요청하고 다른 쪽에서 끝내며, 쓴 토큰은 둘 다 거절한다.
- 해시: `server/parity/password-fixture.mjs`가 앱 코드(`lib/auth/passwords.ts`, bcryptjs)로 만든 해시 32개와 그 판정(`server/tests/fixtures/password_hashes.json`)을 Rust가 모두 같게 판정한다(scrypt의 NFKC, 72바이트 넘는 bcrypt 포함). 반대 방향은 교차 테스트가 본다.
- 화면: 이 경로를 쓰는 Axum 페이지는 아직 없다(B6). B0의 `account.spec.mjs`는 회귀로 다시 돌렸다.

### 보안 리뷰 전에 알아 둘 것과 남은 차이

| id | 내용 | 판정 |
| --- | --- | --- |
| A2-1 | **인증 메일 토큰은 `verification` 행이 아니다.** better-auth는 비밀값으로 서명한 HS256 JWT(`{email, userId, iat, exp}`, 1시간)를 메일에 넣는다. 한 번만 쓰이는 것이 아니라 만료까지 다시 쓸 수 있고, 두 번째부터는 이미 인증된 주소라 같은 답이다. Rust는 같은 바이트로 서명하고 jose처럼 검증한다(만료는 `exp <= now`). 서명은 맞는데 모양이 다른 토큰(이메일 변경 흐름의 `updateTo` 등)은 Next가 답한다. 재설정 토큰은 행(`reset-password:<24자>`, 1시간)이고 비밀번호를 바꾸는 트랜잭션 안에서 한 번에 지워진다 | 기록 |
| A2-2 | Next가 답하는 요청: 위 다섯 경로에서 스키마 밖 본문(다른 키, 다른 타입, 폼 본문, `callbackURL`·`image`), zod가 거절할 본문(주소 형식, 빈 비밀번호), 쿼리 문자열, 절대 URL이나 일반 경로가 아닌 `callbackURL`·`redirectTo`, `Origin: null` 같은 출처 요청, 저장된 해시를 TypeScript가 읽지 못하는 경우(그때는 이미 읽은 요청을 Next로 다시 보낸다). 옮기지 않은 엔드포인트: `send-verification-email`, `GET /reset-password/:token`(앱의 메일이 가리키지 않는다) | 수용 |
| A2-3 | 제한기(운영에서만: 로그인·가입 10초에 3회, 재설정 요청 60초에 3회, 나머지 10초에 100회)의 카운터는 프로세스별이다. Next로 넘긴 요청은 Next가 센다. 그래서 모양을 바꿔 가며 보내면 같은 주소가 두 서버에서 따로 센다. 비밀번호 추측에 쓰는 정상 본문은 모두 Rust가 센다 | 수용 |
| A2-4 | 해시 하나에 32 MB(scrypt N=16384, r=16)가 들어서 Axum은 동시에 둘만 계산한다(컨테이너 256 MB). Node는 libuv 스레드 넷이다. 몰리면 Axum의 로그인·가입·재설정이 더 오래 기다린다 | 수용 |
| A2-5 | 메일 웹훅: 두 서버 모두 응답을 기다리고(better-auth는 가입 트랜잭션을 연 채로, Axum은 커밋한 뒤에. A2-12), 실패는 기록만 하고 답을 바꾸지 않는다. Axum은 30초에서 끊는다. Node의 `fetch`에는 한도가 없다 | 수용 |
| A2-6 | 없는 주소와 비밀번호가 틀린 주소는 같은 401이고, 없는 주소도 scrypt 해시를 하나 계산한다(better-auth와 같다). bcrypt 계정은 bcrypt 비용만큼 걸려서 시간으로 계정 종류가 드러나는 것은 Next와 같다. 비밀번호가 맞아야 `EMAIL_NOT_VERIFIED`가 나온다 | 기록 |
| A2-7 | bcrypt는 bcryptjs처럼 저장된 salt로 다시 해시해 버전 글자까지 문자열 전체를 상수 시간으로 비교한다(`$2a$`·`$2b$`·`$2y$`는 같은 계산). 60자가 아니면 불일치, TypeScript가 예외를 내는 해시는 Next로 넘긴다. scrypt는 `salt:key`의 key를 소문자 hex로 상수 시간 비교한다 | 기록 |
| A2-8 | 가입 후 `syncAuthUser`가 실패하면(닉네임 다섯 번 충돌, DB 오류) 사용자는 이미 커밋된 채 빈 500이다. better-auth의 커밋 후 훅과 같다. 같은 주소로 다시 가입하면 있는 주소의 답(200)이다 | 기록 |
| A2-9 | 브리프는 `server/tests/compose_env.rs`가 빠진 변수를 알려 준다고 했지만 이 브랜치의 바탕(A1-FIX)에는 아직 없다(#150, `origin/main`). `AUTH_EMAIL_WEBHOOK`를 `docker-compose.axum.yml`에 넘겼고, 이 경로가 읽는 다른 변수(`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `NODE_ENV`)는 이미 넘긴다. #151이 `main`에 들어가면 다시 쌓아 그 테스트로 확인한다 | 남음 |
| A2-10 | 네 테이블은 마이그레이션이 아니라 better-auth가 Next의 첫 인증 요청에서 만든다(`ensureAuthSchema`). Rust는 만들지 않으므로 Next가 한 번도 인증을 처리하지 않은 새 DB에서는 이 경로들이 빈 500이다. 운영 DB에는 이미 있다. 교차 테스트는 Node 쪽을 먼저 한 번 돌린다 | 수용 |
| A2-11 | **보안 리뷰 1(MEDIUM) 수정.** 해시 차례(동시 2개)를 async 함수가 쥐고 있어서, 해시 도중 클라이언트가 끊으면 차례는 풀리고 scrypt(32 MB)는 blocking 스레드에서 계속 돌았다. 그러면 다음 요청이 또 32 MB를 잡아 동시 해시 수에 한도가 없어진다(256 MB 컨테이너 OOM이면 사이트 전체가 내려간다). 이제 차례와 대기 자리를 `spawn_blocking` 클로저로 옮겨 해시가 끝날 때 풀린다. 대기도 8개로 제한한다. 그보다 많으면 해시하지 않고 제한기와 같은 429(`{"message":"Too many requests. Please try again later."}`, `X-Retry-After: 1`)로 답한다. better-auth에는 이런 답이 없다(Node는 libuv 풀에서 한도 없이 기다린다). 그래서 몰릴 때 Axum의 로그인·가입·재설정은 Next와 달리 429를 낸다. 없는 주소의 로그인도 같은 해시를 하므로 같은 429이고, 주소가 있는지 드러나지 않는다. `passwords.rs`의 두 테스트가 고치기 전 모양에서 실패하고 고친 뒤 통과한다 | 의도한 차이 |
| A2-12 | **보안 리뷰 2(MEDIUM) 수정.** 가입이 인증 메일 웹훅(최대 30초)을 트랜잭션 안에서 기다려서, 그동안 풀 연결(기본 4개)을 쥐고 있었다. 웹훅이 느리거나 죽으면 동시 가입 넷이 풀을 다 잡고, Axum의 다른 DB 경로(모든 페이지의 get-session, 밈 문서)가 5초 기다린 뒤 실패했다. better-auth는 사용자와 credential 계정을 쓴 다음 트랜잭션의 마지막 일로 메일을 보낸다. 메일 뒤 커밋 전에는 아무것도 쓰지 않는다(`autoSignIn: false`라 세션도 없다). 그래서 Axum은 먼저 커밋하고 메일을 보낸 다음 `syncAuthUser`를 돌린다. 효과의 순서(행, 메일, `auth.users`)와 답은 같다. 달라지는 것은 둘이다. 메일을 보내는 동안 행이 이미 보이고, 메일 도중 프로세스가 죽으면 better-auth는 행을 되돌리지만 Axum은 남긴다(같은 주소로 다시 가입하면 있는 주소의 답). `tests/auth_sign_up.rs`가 풀 하나와 멈춘 웹훅으로 이를 본다: 고치기 전에는 메일 도중의 get-session이 5초 뒤 500이었다 | 의도한 차이 |
| A2-13 | **보안 리뷰 3(LOW) 수정.** Next는 `RSC` 헤더가 있는 요청을 메서드와 상관없이 라우트 전에 `?_rsc=…`로 307 보낸다(`validateRSCRequestHeaders`). Axum은 get-session과 verify-email에서만 그 헤더를 보고 넘겼다. 그래서 `RSC: 1`이 붙은 `POST /api/auth/sign-in/email`을 Axum은 로그인시키고 Next는 아무도 로그인시키지 않았다. 이제 JSON 본문을 받는 다섯 경로(A1의 `sign-out` 포함)도 그런 요청을 Next로 넘긴다(`forms.rs`). `tests/all_routes.rs`가 일곱 경로 모두를 본다 | 해결 |
| A2-14 | 리뷰 미확인 3: 재설정 링크의 `SITE_URL`. Next는 `NEXT_PUBLIC_SITE_URL`을 빌드 때 박아 넣고 Axum은 실행 때 읽는다. 두 이미지는 같은 빌드 인자(`deploy/build.env`)로 빌드되고 Axum 이미지는 그 값을 이미지 환경에 남긴다(`Dockerfile.server`, `docker-compose.axum.yml`의 주석). CI의 이미지 빌드 단계가 `printenv NEXT_PUBLIC_SITE_URL`이 `deploy/build.env`와 같은지 본다. 그래서 운영의 두 서버는 같은 값을 쓴다 | 기록 |
| A2-15 | 리뷰 미확인 1: 운영에서 Axum이 받는 `X-Forwarded-For`의 모양. Caddy(`trusted_proxies`와 `reverse_proxy`)가 Cloudflare의 값 뒤에 주소를 덧붙여 주소가 둘이 되면, better-auth의 `getIP`(Axum의 `client_ip`도)는 주소를 못 얻는다. 그러면 모든 요청이 `no-trusted-ip` 한 칸을 같이 써서 사이트 전체가 10초에 로그인 3번이다. 지금 Next의 로그인 폼은 서버 액션이라 HTTP 제한기를 거치지 않으므로 드러나지 않는다. B6에서 폼이 이 경로를 부르기 전에 운영의 실제 값을 확인해야 한다(코디네이터가 확인한다) | 남음(B6) |

## 17. 단계 6 일부: A3 (Google·Kakao 로그인)

브랜치 `torisKR/axum-auth-a3`(A2 리뷰 수정 cec9b9787 위). UI-PLAN의 인증 순서 ⑤다. 옮긴 경로는 5절 표의 `auth-oauth` 하나에 묶인 셋이다(`server/src/routes/better_auth/oauth/`). better-auth 1.7.20에서 이 두 공급자가 쓰는 엔드포인트는 이것뿐이다. Kakao의 `genericOAuth`는 1.7.20부터 자기 엔드포인트(`/oauth2/sign-in`, `/oauth2/callback/:id`)가 없고 `signInSocial`과 `/callback/:id`를 쓴다(dist/plugins/generic-oauth/index.mjs). 앱이 부르는 곳은 `signInWithOAuth`(lib/db/client.ts)와 Axum 화면의 `server/ui/save.js`이고, 둘 다 `{provider, callbackURL: "<origin>/auth/callback?next=…", disableRedirect: true}`를 보낸다. 계정 연결(`/link-social`)은 앱이 부르지 않는다.

동치 확인:

- `server/tests/auth_oauth_cross.rs`(무시된 테스트, Node 필요): 같은 DB에서 앱의 better-auth(`auth.handler`, `tests/better_auth_oauth.mjs`)와 양방향. 공급자는 로컬 스텁이다(Rust는 `AXUM_TEST_OAUTH_ORIGIN`, Node는 `tests/oauth_fetch_stub.mjs`가 `fetch`를 가로챈다). TypeScript는 바꾸지 않았고 Google·Kakao에는 아무 요청도 가지 않는다. 경우 18개(새 사용자 넷, 연결 셋, 다시 로그인, 공급자 오류, 토큰·프로필 실패, 주소 없음, 예약 도메인, JWT 아닌 `id_token`, `code` 없음, 만료 state, 쿠키를 쥔 채 행까지 만료된 state, 쿠키 없는 콜백)를 두 `NODE_ENV`에서 각각 세 번 돌린다: better-auth로 시작·완료(기준), better-auth로 시작해 Rust로 완료, Rust로 시작해 better-auth로 완료. 콜백의 답(상태, `Location`, `Set-Cookie`, 본문), 그 주소의 `user`·`account`·세션 수·`auth.users`, 보낸 메일, 공급자가 받은 토큰 요청, 다른 서버에서 같은 콜백을 다시 보낸 답, state 행이 남았는지가 기준과 같고, 만든 세션을 다른 서버가 읽는다. 72개 모두 통과. 같은 파일의 두 번째 시험이 A3-12(사이트 밖 URL이 든 행)를 본다.
- `server/parity/auth-oauth.mjs`: 실제 Next와 세 경로의 모든 경우. 답(상태, 모든 헤더, `Location`, 모든 `Set-Cookie`, 본문), 시작이 쓴 state 행, 콜백 뒤 그 주소의 `user`·`account`·`session`·`auth.users`·`profiles`, 메일, 공급자가 받은 요청(토큰 요청의 본문 순서와 값, Kakao 프로필 요청의 헤더), 같은 콜백의 재전송을 비교한다. 운영 빌드(`NODE_ENV=production`) 102/102(`start` 49, `callback` 24, `state` 8, `accounts` 5, `handed` 12, `redirect` 4)와 Kakao를 끈 실행의 `unset` 2/2, `next dev`(`NODE_ENV=development`) 102/102. 보안 리뷰 수정 뒤의 수치다: `state`에 쿠키를 쥔 채 행까지 만료된 경우가, `redirect`에 A3-12의 의도한 차이(Next는 `//evil.example?error=state_mismatch`, Axum은 기본 오류 페이지, `HEAD`는 둘 다 404)가 더해졌다. 믿지 않는 URL(절대 외부 URL, `//host`, 백슬래시, `%2F`·`%5C`, `@`로 숨긴 호스트, `javascript:`·`data:`, 제어 문자)은 세 필드 각각에서 두 서버 모두 403이다.
- `server/tests/all_routes.rs`: `auth-oauth`를 끄면 세 경로가 모두 Next로 가고, 다른 공급자의 콜백과 `/oauth2/callback/*`은 언제나 Next로 간다. `RSC` 요청도 Next로 간다(A2-13).

### 보안 리뷰 전에 알아 둘 것과 남은 차이

| id | 내용 | 판정 |
| --- | --- | --- |
| A3-1 | **state는 두 서버가 같은 바이트다.** better-auth의 `database` 전략: 32자(`a-z0-9A-Z-_`) state, `verification` 행 `auth-state:<state>`(10분, 값은 `{callbackURL, codeVerifier, errorURL?, newUserURL?, expiresAt, oauthState}` JSON, 키 순서까지 같다), 서명한 `state` 쿠키(5분, `__Secure-`는 A1과 같다), 128자 PKCE 검증자와 S256. 콜백은 better-auth 순서대로 본다: 행이 없으면 `state_mismatch`, JSON이 스키마에 맞지 않으면 `internal_server_error`, `oauthState`가 다르거나 서명 쿠키가 state와 다르면 `state_mismatch`(행은 남는다), 그다음 쿠키를 만료하고 행을 지운 뒤 만료(`expiresAt < now`)면 `state_mismatch`. 행 자체도 만료돼(10분) 읽기의 정리가 이미 지웠으면 A3-2의 경합보다 만료를 먼저 본다. better-auth처럼 흐름의 오류 페이지로 간다(A3 보안 리뷰 3: 쿠키를 5분 넘게 쥔 클라이언트에서만 닿는다). 앞의 둘은 기본 오류 페이지로, 뒤의 셋은 흐름의 `errorCallbackURL`로 간다. state는 공급자에 묶이지 않는다(better-auth도 그렇다). Rust가 끝내지 않는 흐름의 행(`link`, `idTokenNonce`, `serverContext`, `additionalData`의 키)은 A3-12의 URL 검사 뒤, 지우기 전에 요청째 Next로 넘긴다. 그 전에 한 일은 better-auth도 하는 만료 행 정리뿐이다 | 기록 |
| A3-2 | **better-auth와 일부러 다르게 했다.** better-auth는 행을 읽고(`findVerificationValue`) 나중에 지운다(`deleteVerificationByIdentifier`). 그래서 같은 state로 동시에 온 콜백 둘이 모두 통과할 수 있다. Rust는 지우기가 행을 지웠을 때만 이어 가고, 못 지웠으면 `state_mismatch`(기본 오류 페이지, 쿠키 만료)로 답한다. 경합이 없으면 답은 같다(교차 테스트의 재전송) | 의도한 차이 |
| A3-3 | 열린 리디렉션: Rust는 better-auth가 믿는 URL 중 모양을 정확히 아는 것만 받는다. 일반 경로(`forms::is_plain_path`)이거나, `http(s)://`에 소문자·숫자·`.`·`-`·포트뿐인 호스트, 믿는 출처(`BETTER_AUTH_URL`의 출처, `SITE_URL`, `localhost:3000`, `127.0.0.1:3000`, `BETTER_AUTH_TRUSTED_ORIGINS`), 나머지는 따옴표·`<>`·백슬래시·`^`·백틱·`{|}` 없는 보이는 ASCII여야 한다. 나머지는 쓰기 전에 Next로 가고 Next가 403으로 거절하거나 받는다. 콜백이 따라가는 URL은 state 행에 든 것(두 서버 중 하나가 검사하고 A3-12가 다시 본 것)과 기본 오류 페이지뿐이다. 오류 URL에 `error`·`error_description`을 붙이는 것은 `appendQueryParams`와 같다(`URL`로 읽어 `href`로 쓴다). `error_description`은 공급자가 보낸 값이지만 쿼리 값으로 인코딩되어 들어간다 | 기록 |
| A3-4 | 공급자 응답: Google은 `id_token`을 검증하지 않고 디코딩만 한다(better-auth의 `getUserInfo`가 그렇다. 토큰은 TLS로 `oauth2.googleapis.com`에서 직접 받는다). `email_verified`는 `true`나 `"true"`일 때만 인증된 주소다. Kakao는 앱의 `getUserInfo` 그대로다: 주소가 없으면 `<id>@kakao.memecatch.internal`, 별명이 없으면 `카카오_<id 앞 6자>`, `is_email_verified === true`일 때만 인증된 주소. 두 공급자가 문서에 적지 않은 타입의 필드(문자열이 아닌 토큰, 숫자가 아닌 `expires_in`, 문자열이 아닌 `email`·`name`·`picture`·별명, 문자열·숫자가 아닌 `sub`·`id`)는 Rust에서 토큰 교환 실패(`invalid_code`)나 사용자 없음(`unable_to_get_user_info`)이다. better-auth는 그 값을 그대로 쓰거나 나중에 예외를 낸다 | 수용 |
| A3-5 | 공급자 요청: Rust의 HTTP 클라이언트는 리디렉션을 따라가지 않는다. 토큰 요청은 better-auth도 거절하므로 같고(`invalid_code`), Kakao 프로필 요청은 Node의 `fetch`라면 따라간다. 30초에서 끊고 본문은 1 MiB까지 읽는다(Node는 한도가 없다). 프로필 요청은 `fetch`처럼 `accept: */*`를 보내고, `fetch`가 더하는 `user-agent`·`accept-language`·`accept-encoding`·`sec-fetch-mode`는 보내지 않는다. 토큰 요청은 본문(`grant_type, code, code_verifier, redirect_uri, client_id, client_secret` 순서)과 `accept`까지 같다 | 수용 |
| A3-6 | 계정: 이 앱에는 믿는 공급자가 없고 연결 설정은 기본값이다. 이미 있는 계정 키는 그 사용자로 로그인하고 토큰을 갱신한다(`providerId`, 응답에 있던 토큰만. 없던 토큰은 남기고 `null`은 쓴다. `scope`는 바꾸지 않는다). 공급자가 인증한 주소면 사용자를 인증 상태로 바꾼다. 같은 주소의 다른 사용자에게는 공급자가 주소를 인증했고 그 사용자도 인증했을 때만 계정을 붙인다(아니면 `account_not_linked`). 새 사용자는 사용자와 계정을 한 트랜잭션에 쓰고, 커밋 뒤 `syncAuthUser`, 그다음 공급자가 주소를 인증하지 않았으면 인증 메일을 보낸다(Kakao의 내부 주소에도 보낸다. better-auth가 그렇다). 계정 키의 사용자가 없으면 `unable_to_link_account`. 같은 키의 계정이 둘이거나 DB가 실패하면 기본 오류 페이지의 `internal_server_error` | 기록 |
| A3-7 | 예약 도메인: 가입 전 훅 그대로다. `@auth.`·`@wallet.`·`@kakao.memecatch.internal`은 거절하되, Kakao 콜백이 만든 `@kakao.memecatch.internal`은 받는다. 거절은 리디렉션이 아니라 better-auth처럼 400 `{"message":"blocked email domain"}`이고, state는 이미 쓰였고 쿠키는 만료된다 | 기록 |
| A3-8 | 예외로 끝나는 경우는 better-auth처럼 쿠키 없는 빈 500이다: JWT가 아닌 `id_token`, JSON이 아닌 Kakao 프로필, Kakao 프로필 요청의 연결 실패, 세션이나 토큰 갱신의 DB 오류, 헤더에 쓸 수 없는 콜백 URL. state 행을 쓰지 못한 시작도 빈 500이다(`generateState`가 기다리지 않고 돌려준 약속의 오류라 `catch`가 잡지 못한다). `syncAuthUser`가 실패하면 사용자와 계정은 커밋된 채 `unable_to_create_user`이고 세션은 없다. DB 실패 경우는 parity로 재지 않았고 소스로만 맞췄다 | 기록 |
| A3-9 | `app/auth/callback/route.ts`는 Next에 남겼다. 앱의 `callbackURL`이 가리키는 페이지지만 better-auth의 흐름 밖이다. state도 공급자도 쓰지 않고 세션 쿠키만 읽어 `next`로 보낸다(`code`가 있으면 언제나 `/login?error=auth`). 어느 서버의 세션이든 읽으므로 전환에 걸리지 않는다. 옮기려면 `safeNext`, 세션 연장의 쿠키, `proxy.ts`의 페이지 헤더가 함께 가야 해서 로그인 화면과 같이 B6에서 옮긴다 | 수용 |
| A3-10 | 설정되지 않은 공급자: 시작은 Next처럼 404 `PROVIDER_NOT_FOUND`, 콜백은 state를 먼저 쓴 뒤 `oauth_provider_not_found`다(`unset` 절). `docker-compose.axum.yml`이 `GOOGLE_*`·`KAKAO_*` 네 변수를 이름으로 넘긴다. `AXUM_TEST_OAUTH_ORIGIN`은 테스트 전용이고 컴포즈에 없다. 다른 시험 전용 출처(`AXUM_TEST_OPENROUTER_ORIGIN`, `AXUM_TEST_MCP_ORIGIN`, main의 config.rs)가 더 엄격하게 막혀 있어 같게 했다(A3 보안 리뷰 2): 루프백 `http://127.0.0.1:<port>`나 `http://localhost:<port>`(경로·사용자 정보 없음)만 받고, 다른 값이면 서버가 뜨지 않는다. 빌드나 `NODE_ENV`와 상관없이 그렇다. 그래서 설정돼도 공급자 요청(코드, PKCE 검증자, `client_secret`, Kakao 토큰)은 그 기기 밖으로 나가지 않는다. A2-9처럼 이 바탕에는 `server/tests/compose_env.rs`가 아직 없다(main의 것은 main의 컴포즈 파일을 전제해서 여기서 돌지 않는다). **main에 합칠 때 그 파일의 `LEFT_OUT`에 `AXUM_TEST_OAUTH_ORIGIN`을 두 시험 전용 출처 옆에 넣어야 한다.** 넣지 않으면 그 시험이 실패한다 | 기록 |
| A3-11 | 제한기: 시작은 `/sign-in*` 규칙(10초에 3회), 콜백은 기본(10초에 100회). A2-3과 같이 Next로 넘긴 요청은 Next가 센다. A2-15(운영의 `X-Forwarded-For` 모양)는 이 경로에도 해당한다 | 수용 |
| A3-12 | **열린 리디렉션은 better-auth와 일부러 다르게 막았다(A3 보안 리뷰 1).** better-auth는 `/a/..//evil.example`, `/..//evil.example`, `/x/%2e%2e//evil.example` 같은 오류 URL을 믿는 상대 경로로 받고, `appendQueryParams`가 점 구간을 풀어 `//evil.example?error=…`(다른 호스트로 가는 프로토콜 상대 URL)을 쓴다. 공격자가 쿠키 없이 그런 `errorCallbackURL`로 시작하면(Rust는 Next로 넘기고 Next가 행을 쓴다) 피해자가 연 그 state의 콜백은 쿠키가 없어 `state_mismatch`로 그 URL에 간다. Rust는 콜백이 행을 읽은 바로 뒤, 다른 검사와 Next로 넘기기 전에, 흐름이 보낼 수 있는 모든 `Location`(오류 URL에 `error`를 붙인 것, `callbackURL`, `newUserURL`)을 브라우저처럼 콜백 주소에 대해 푼다(점 구간, 앞의 슬래시·백슬래시, 탭·개행, 스킴의 대소문자). 풀린 출처가 A3-3의 믿는 출처가 아니거나 사용자 이름·비밀번호가 있으면 `state_mismatch`로 기본 오류 페이지에 보낸다. 행은 남고 토큰 교환은 없다. `URL`이 읽지 못해 better-auth가 빈 500으로 끝내는 오류 URL(`//host`, `/\host`, `%2F%2Fhost`)도 같다. Rust가 끝내지 않는 행(A3-1)도 이 검사 뒤에야 Next로 가므로 Next는 그런 행으로 리디렉션하지 못한다. Next로 넘기는 다른 요청은 이 경로에 닿지 않는다: `POST`는 better-auth가 같은 출처의 `GET`으로 돌려보내고 그 `GET`은 Rust가 답한다. `RSC`와 이름이 겹친 쿼리는 Next가 better-auth 전에 답하고, 날것의 비ASCII 쿼리는 Next가 400이며 브라우저는 보내지 않는다. `HEAD`는 Next(better-call)가 404로 답한다(parity `redirect`에서 쟀다). **운영의 Next(better-auth 1.7.20)에는 지금도 같은 문제가 있다.** 시험: `callback.rs`의 단위 시험, `auth_oauth_cross.rs`의 `a_state_with_a_url_off_the_site_is_refused_toward_the_default_error_page`(고치기 전에는 110곳이 실패), parity `redirect`. better-auth에 알릴 것 | 의도한 차이 |

## B2: 목록·탐색 페이지

화면 묶음 B2의 차이(`UI-PLAN.md` 5.3절). 번호는 이 묶음 안에서만 센다.

| # | 차이 | 상태 |
| --- | --- | --- |
| B2-1 | 목록 페이지의 데이터를 Axum은 5분 보관한다(밈 전체 목록·모음·연표). Next는 1시간~하루(ISR, `unstable_cache`) 보관하고 운영자 액션의 태그 무효화로 비운다. 편집 직후와 Next 캐시가 오래된 동안에는 두 서버의 목록이 다를 수 있다 | 수용 |
| B2-2 | `/memes`의 가나다순은 Node의 `Intl.Collator("ko", { sensitivity: "base", numeric: true })` 대신 ICU4X `icu_collator` 2.4(한국어, 1차 강도, 숫자 정렬)다. 3,562개 제목(저장소의 실제 제목과 한글·자모·라틴 대소문자·악센트·전각 숫자·기호·이모지·공백 경계 사례)에서 Node 22.23.5·26의 ICU 78.3과 순서가 같다(`tests/directory_order.rs`). Next 이미지의 `node:22-bookworm-slim`이 ICU를 올리면 `parity/directory-catalog.mjs`로 픽스처를 다시 만들어야 한다. 동점의 짧은 id 비교는 바이트 순서로, `gen_short_id()`의 영소문자·숫자에서만 `localeCompare`와 같다 | 수용, Node 이미지를 올릴 때 픽스처 재생성 |
| B2-3 | Next는 `/memes`의 `?page=1`(영구 리디렉션)과 잘못된 쪽(`notFound()`)을 스트리밍하는 중에 내므로 308·404가 아니라 200이다(리디렉션은 스크립트로, 404는 noindex 문서로). 목록을 못 읽으면 색인 가능한 200 오류 화면이다. Axum은 이 경우를 모두 Next에 넘겨 같은 답이 나간다. TypeScript 쪽에서 상태 코드를 바로잡을지 결정이 필요하다 | 미해결, TypeScript |
| B2-4 | `MotionList`·`Reveal`의 등장 애니메이션(투명도·10px)은 옮기지 않았다. 카드와 절이 처음부터 보인다 | 수용 |
| B2-5 | ISR 페이지(`/weekly`, `/slang`, `/collections/{slug}`)를 Next는 저장된 사본으로 먼저 답하고(첫 요청은 빌드 때 사본, `Cache-Control` 없음) 뒤에서 다시 만든다. Axum은 요청마다(목록은 5분 보관) 그린다. `Cache-Control`은 Next가 저장된 사본에 붙이는 값과 같다 | 수용 |
| B2-6 | `/slang`의 탭과 `/timeline`의 나머지 연도는 Next에서 React 데이터로, Axum에서 `<template>`과 `ui/slang.js`·`ui/timeline.js`로 온다. 크롤러가 받는 글자·링크는 같다 | 수용 |
| B2-7 | 밈 카드의 소유 그림은 `meme_contents.thumbnail_url`에서만 온다. TypeScript의 `card_art_url`은 `memes`에 그런 열이 없어 언제나 비어 있다 | 수용 |
| B2-8 | 시드의 `manual_video_verified`는 검수 원장의 투영이라 트리거(`meme_contents_manual_video_projection_guard`)가 넣을 때 지운다. 검증 시드(`b2-seed.sql`)는 트리거를 끄고 값을 쓴다 | 수용, 시험 데이터만 |
| B2-9 | 카드 그림이 스크립트가 돌기 전에 이미 실패했으면 Axum(`ui/card.js`)은 포스터로 바꾼다. Next의 `MemeCardFace`는 하이드레이션 뒤의 `error`만 받아 깨진 이미지가 남는다(동작 게이트에서 하이드레이션 전에 끊은 영상 정지 화면으로 관찰). 그 뒤에 실패하면 둘 다 포스터다 | 수용, TypeScript는 `MemeThumbnail`처럼 `complete`·`naturalWidth`를 볼 수 있다 |

### B2에서 옮기지 않은 페이지

`/explore`, `/global`, `/meme-cards`, `/news`, `/quiz`, `/quiz/r/[token]`, `/rankings`, `/search`, `/studio`(9개)는 이번 작업에서 옮기지 않았다. `/news`는 본문 문구를 방문자의 언어로 브라우저에서 다시 그리므로(`PAGE_COPY` 19개 언어와 `localizeBrief`) 틀만 바꾸는 차이 67로는 같지 않다. `/global`은 `service_role`로 읽는 매체 권리 원장이 필요하다.

## 18. 단계 3 일부: R9 (`/api/db/query`)

브랜치 `torisKR/axum-routes-r9`. 경로 id `db-query`(5절 표). 코드는 `server/src/routes/db_query/`에 TypeScript 파일과 함수를 따라 나눴다: `mod.rs`(app/api/db/query/route.ts), `bound.rs`(`boundPlan`), `compile.rs`·`write.rs`(`lib/db/execute.ts`의 문장 만들기), `exec.rs`(`executePlanWithDb`·`shapeRows`·`queryError`), `meta.rs`(`loadMeta`·`loadFunctions`), `run.rs`(node-pg를 거친 `runQuery`), `js.rs`(TypeScript의 검사가 기대는 JavaScript 변환). 비교는 `server/parity/db-query.mjs`, 시험은 `server/tests/db_query.rs`와 `src/routes/db_query/sql_tests.rs`.

### 앱이 보내는 계획

`server/parity/db-query/plans.capture.ts`가 실제 빌더(`lib/db/plan.ts`의 `createPlanClient`)와 내보낸 `buildMemesQuery`로 계획을 만들고, Axum 화면의 계획은 `server/ui/core.js`의 `queryPlan`을 그대로 꺼내 돌린다. 결과가 `server/tests/fixtures/db_query_plans.json`의 42개다: Next 클라이언트 컴포넌트 13개의 호출 18곳(검색 제안, 계정 메뉴 닉네임, 댓글 두 쪽, 커뮤니티 좋아요 상태·토글, 글쓰기 검색, 오늘의 퀴즈 상태·완료, 세대 투표 셋, 최근 본 밈, 반응 토글(열거형에 없는 값 하나 더), 저장 셋(공개 전 밈 하나 더), 제보 중복 검색), 탐색 그리드 17가지(정렬 넷, 플랫폼 넷, AI 주제 태그, `search_memes`·`search_ai_memes`, 빈 색인과 UUID 2,000개 색인), Axum 화면 스크립트 4곳(`ui/account.js`, `ui/save.js` 셋), 그리고 호출하는 곳이 이제 없는 이 경로 자신의 `record_instagram_post_video_verification` 분기. `lib/db/client.ts`를 가져오는 다른 파일 다섯은 인증만 쓰고, `today-meme`·`continue-stream`은 서버의 `createStaticClient`로 읽는다. `lib/**`와 `server/assets/**`(`server/ui`를 묶은 `site.js`)에는 그 밖에 계획을 만드는 곳이 없다.

### 어떻게 같게 만드나

- **문장이 같다.** 컴파일러를 함수 단위로 옮겨 같은 순서로 일한다. 그래서 별칭 번호(`r1`, `r2`, …), 매개변수 번호, 검사에 걸리는 지점이 같다. 식별자는 TypeScript의 `IDENT`(`/^[a-z_][a-z0-9_]*$/i`)를 통과한 것만 큰따옴표로 감싸 들어가고, 테이블과 관계는 스키마 메타데이터에 있는 것만 쓴다. 값은 모두 매개변수다.
- **JavaScript가 판정하는 대로 판정한다.** 브라우저가 계획의 모든 값을 고르고, TypeScript는 대부분을 문자열로 바꿔 보는 것(`IDENT.test(value)`, `` `"${value}"` ``), 속성 읽기, 참·거짓으로만 검사한다. `js.rs`가 그 연산을 하나씩 옮겼다: `String(value)`(배열은 `join(",")`, `null`은 `"null"`), `Map.get`과 `===`는 변환하지 않음, `null`의 속성 읽기는 `TypeError`, 문자열이 아닌 값의 `split`·`trim`·`endsWith`는 `TypeError`, ECMAScript의 `trim` 공백 목록(Rust의 `str::trim`과 다르다), `Object.entries`. 그래서 엉뚱한 타입의 계획이 TypeScript와 같은 곳에서 같은 오류(`invalid identifier`는 코드 `42602`, 다른 예외는 코드 없음)로 막히거나 통과한다.
- **매개변수는 node-pg처럼 타입 없는 글자다.** node-pg는 모든 값을 타입 없이 글자로 보내고 Postgres가 자리에 맞는 타입(`ref = $1`이면 열의 타입, `"p" => $1`이면 함수 인자의 타입)을 골라 그 타입의 입력 함수로 읽는다. sqlx는 매개변수를 이진으로만 보내므로, 문장마다 (1) 타입 없이 준비해 Postgres가 고른 타입을 읽고, (2) 각 글자를 Postgres가 그 타입의 입력 함수로 읽게 해(`array_in`: 원소 하나짜리 배열로, 배열 타입이면 글자 그대로) 이진 값을 받고, (3) 준비한 문장을 그 값으로 실행한다. 읽을 수 없는 값은 (2)에서 입력 함수가 내는 메시지와 SQLSTATE로 실패한다. node-pg가 `Bind`에서 받는 것과 같다. 값의 글자는 node-pg의 `prepareValue`·`arrayString`·`escapeElement`와 JavaScript의 수 표기를 따른다.
- **신원은 `with_identity`로만.** 메타데이터와 문장은 호출자 신원(`anon` 또는 그 사용자의 `authenticated`)으로, 함수 찾기는 TypeScript처럼 신원 없는 로그인 롤로 읽는다. 행 수준 보안은 데이터베이스의 것이다.
- **결과는 `JSON.stringify(JSON.parse(row_to_json))`.** 배열 색인 같은 키가 먼저 오고, 수는 JavaScript의 double로 적는다(`js_json`).
- **영상 확인**: `record_instagram_post_video_verification`이 `40001`로 실패하면 세 번까지 다시 하고, 그래도 안 되면 503 `verification_conflict_retry`(`Retry-After: 1`)다. 성공하면 R4의 내부 캐시 경로(`scope=instagram-video-verification`)로 Next의 캐시를 만료하고, Next가 확인하지 않으면 TypeScript처럼 202와 `cacheRetryPath`를 낸다.

### 증거

같은 시험 DB(`scripts/test-db.sh`)에 실제 Next 운영 빌드(standalone, Node 22)와 Axum을 붙이고, 세션 셋(사용자 둘, 운영자 하나)은 앱의 better-auth로 만들었다(`parity/behaviour/session.mjs`). 쓰기는 실행 전마다 DB를 시드 상태로 되돌리고(`db-query/snapshot.sql`), 실행 뒤 `public`·`private`의 모든 테이블의 행(시각과 임의 id 열 빼고)을 비교한다. 두 서버가 보낸 문장은 Postgres 로그(`log_statement = 'all'`, 응용 이름별)에서 사례마다 읽어 글자 그대로 비교한다.

| 비교 | 결과 |
| --- | --- |
| 고정 계획 42개 × 신원 넷(익명, 사용자, 다른 사용자, 운영자): 상태·헤더·본문, 쓰기 뒤 행, 보낸 문장 | 361개 검사, 차이 0. 문장 153개가 글자 그대로 같다 |
| 악의적·잘못된 계획 590개(`db-query/fuzz-plans.mjs`) × 익명·사용자: 모든 필드의 엉뚱한 타입, 경계 앞뒤 값, 따옴표·`;`·주석·유니코드·NUL, 시스템 열(`ctid`, `xmin`, `tableoid`), 다른 스키마·권한 없는 테이블, 대소문자, 63바이트 넘는 함수 이름, 오버로드·없는 함수, 세 단계 임베드, 행 예산, RLS가 막아야 할 쓰기 87개 | 1,793개 검사(답 1,180, 쓰기 뒤 행 174, 문장 439). 답이 다른 것은 짝 없는 서로게이트 하나(R9-1, 신원 둘)뿐. 문장 차이 12개는 모두 로그의 차이다: 인자 없는 RPC(`toggle_save()`처럼 없는 함수, 계획 여섯)를 Next는 매개변수가 없어 간단한 질의 프로토콜로 보내고 Postgres가 그것을 해석 전에 기록한다. Axum의 같은 문장은 준비 단계에서 거절되어 오류로만 남는다. 두 서버의 답은 같다(42883) |
| 한도: origin 넷, JSON 아님·빈 본문·`null`·배열·계획 없음, 정확히 1 MiB와 1바이트 넘는 본문, 동시 실행 상한(한 행 잠금에 묶인 저장 여섯 개 뒤 일곱째), 주소별 181번째, 전체 1,201번째 | 차이 0 |
| 영상 확인: 운영자·사용자·익명, 같은 작업 두 번(멱등 영수증), 작업의 advisory lock을 다른 세션이 쥔 채(세 번 `40001` 뒤 503) | 차이 0 |
| B0 동작 게이트 `account.spec.mjs`(닉네임 읽기, 저장 상태 읽기, 저장·해제, 로그아웃), 네 프로젝트 | 36/36 통과. Axum 쪽 요청은 Axum의 연결(`memecatch-axum`)이 실행했다 |

동작 게이트의 Axum은 사이트 origin(Next 빌드의 `NEXT_PUBLIC_SITE_URL`, 3611)이 아니라 `http://127.0.0.1:3712`에서 자기 `NEXT_PUBLIC_SITE_URL`로 돌렸다. 3611을 다른 작업트리가 쓰고 있었다. 이 시나리오가 부르는 것(`get-session`, `/api/db/query`, `sign-out`)은 모두 Axum이 직접 답하므로 Next 빌드의 origin은 관여하지 않는다.

`src/routes/db_query/sql_tests.rs`는 DB 없이 고정 계획 42개를 컴파일해 Next가 보낸 문장(`tests/fixtures/db_query_sql.json`, `db-query.mjs --write-sql`이 로그에서 쓴다)과 같은지 본다. 컴파일러를 바꿔 앱의 어느 계획이든 문장이 달라지면 여기서 실패한다.

### 동시 실행 상한과 풀

Next처럼 프로세스 안에서 동시에 도는 요청이 6개면 일곱째는 실행 전에 503 `database busy`(`Retry-After: 1`)다(5절 차이 78: Next의 클라이언트는 이것을 오류로 읽어 저장한 밈이 저장 안 됨으로 보인다. Axum 화면의 스크립트는 한 번 기다렸다 다시 보낸다). 상한은 그대로 옮겼다.

풀이 다르다. 요청 하나는 한 번에 연결 하나만 쓴다(세션 조회, 메타데이터, 함수 찾기, 문장마다 따로 트랜잭션). Next의 풀은 8개를 모든 경로가 나눠 쓴다. Axum은 이 경로의 문장(계획 문장, 함수 찾기)을 따로 둔 **계획 풀**에서 돌린다(`db.rs`의 `PLAN_POOL_MAX` 6, 문장 캐시 없음, 5초 놀면 닫고 최소 0개, 응용 이름은 같은 `memecatch-axum`). 상한과 풀 크기가 같아서(컴파일 시점에 확인), 자리를 얻은 요청은 연결을 기다리지 않고, 일곱째는 Next처럼 503이다. 세션 조회와 처음 한 번의 메타데이터 읽기만 메인 풀(`AXUM_DB_POOL_MAX`, 기본 4)을 짧게 쓴다.

그래서 이 경로를 켜는 데 필요한 풀은 **메인 풀 4(지금 값 그대로) + 계획 풀 6**이다. 계획 문장은 메인 풀을 쓰지 않으므로 다른 네이티브 경로와 세션 조회가 이 경로 때문에 연결을 못 얻는 일은 없다(R9 리뷰 M1, 아래). 연결 예산은 2절: 쓸 수 있는 27개 중 Axum 최대 12.

자리는 문장이 끝날 때까지 쥔다. 세션 조회부터 답까지를 자리를 소유한 tokio 작업에서 돌려서, 클라이언트가 끊어도 자리가 먼저 풀리지 않는다. 끊긴 요청의 문장은 끝까지 돈다. 문장마다 트랜잭션의 `statement_timeout` 15초가 한계이고, 한 요청은 문장 둘(데이터와 `count`), 영상 확인은 세 번까지다. TypeScript는 끊기면 `pg_cancel_backend`로 멈춘다(R9-8).

**한 클라이언트가 아직 가져갈 수 있는 것.** 상한 6은 프로세스 전체의 것이다. 한 주소가 15초 가까이 걸리는 계획 여섯 개를 보내면(분당 24번, 주소별 한도 180 안) 이 경로는 그동안 모든 사람에게 503 `database busy`이고, Postgres 백엔드 여섯이 15초씩 바쁘다(2코어 VM에서는 다른 쿼리도 느려진다). 다른 경로와 세션 조회의 연결은 남는다. Next도 같은 상한으로 같은 것을 내준다.

**Postgres 메모리 예산.** 이 저장소의 한도는 Postgres 컨테이너 `mem_limit` 1,280 MB, `shared_buffers` 192 MB, `work_mem` 4 MB, `maintenance_work_mem` 64 MB, `max_connections` 30이다(`docker-compose.yml`). 백엔드는 가장 큰 계획을 돌린 뒤의 메모리를 닫힐 때까지 쥔다(할당자가 돌려주지 않는다). 두 번째 리뷰의 실측(로컬, 운영 아님): 끝까지 도는 ~955 KB 계획(임베드 12) 하나 뒤 계획 풀 백엔드가 `RssAnon` 약 97~111 MB(`VmHWM` 125~128 MB)였고, 그 뒤 서로 다른 계획 60개와 병렬 파도 10번에도 더 자라지 않았다. 작은 계획만 돈 백엔드는 약 8 MB다. 본문은 1 MiB까지이고 쓰기의 매개변수는 65,535개까지라(N1), 이것이 한 백엔드의 대략의 최악이다. 그러면 계획 풀 6개 × 약 125 MB = 약 750 MB에 `shared_buffers` 192 MB를 더해 약 940 MB, 나머지 약 340 MB에 Next·Axum 메인·데드라인·워커·백업 백엔드(평소 하나 5~10 MB, 정렬마다 `work_mem` 4 MB)와 autovacuum이 든다. 큰 계획이 쉬지 않고 오는 동안에는 이 상태가 이어진다(한도 안이지만 여유가 작다). 끝나면 계획 풀 연결은 5초 놀고 닫혀(점검 주기 5초, 늦어도 약 10초) 백엔드 메모리를 돌려준다. 고치기 전에는 sqlx 기본값대로 10분 놀아야 닫혔고, 요청이 올 때마다 그 시계가 다시 시작했다(N3). 컨테이너 한도 아래에서 실제로 돌려 본 것은 아니다(단계 5b). 주소별 한도는 M2(아래) 때문에 우회된다.

### 그대로 옮긴 TypeScript의 동작(고치지 않았다)

| # | 동작 | 위치 |
| --- | --- | --- |
| 1 | RPC 인자의 타입을 `name[]`의 글자열로 받아(10절 동작 1, 8절 동작 1과 같은 원인) 어떤 인자에도 캐스트를 붙이지 않고, 배열 인자는 `text[]`로, 객체는 JSON 글자로 보낸다. 앱이 이 경로로 부르는 함수는 인자가 모두 스칼라라 결과가 달라지지 않는다 | `lib/db/execute.ts` `rpcSql` |
| 2 | 탐색의 플랫폼 필터 `withPublicContent`는 `.not("matched_contents.availability", "in", "(dead,region_blocked)")`로 목록을 글자 하나로 보낸다. `in`은 그 글자를 원소 하나로 보고 `availability::text`를 `"(dead,region_blocked)"`와 비교하므로 아무것도 빼지 않는다. 플랫폼을 고른 탐색에는 `dead`·`region_blocked` 콘텐츠만 있는 밈도 나온다 | `components/explore-grid.tsx`, `app/(default)/explore/page.tsx` |
| 3 | `eq`·`neq`의 값이 `null`이면 `negate`를 보지 않는다: `not(column, "eq", null)`도 `IS NULL`이다 | `lib/db/execute.ts` `compileFilter` |
| 4 | 식별자 검사는 `String(value)`에 한다. 그래서 `["title"]`, `null`, `true`, `undefined`(키 없음)도 통과해 `"title"`, `"null"`, `"true"`, `"undefined"` 열이 된다(없는 열이면 Postgres가 42703으로 막는다). 통과하는 것은 언제나 `IDENT`에 맞는 글자다 | `lib/db/plan.ts` `isIdent` |
| 5 | 스칼라 함수는 `.single()`·`.maybeSingle()`을 보지 않고 첫 행의 `result`를 낸다. `offset` 키가 없는 select는(빌더는 늘 `null`을 보낸다) `invalid identifier`다 | `shapeRows`, `limitSql` |
| 6 | 스키마 메타데이터는 프로세스가 처음 읽은 뒤 바뀌지 않는다. 마이그레이션으로 열이 생기면 두 서버 모두 재시작해야 그 열을 쓸 수 있다 | `loadMeta` |
| 7 | 매개변수 없는 문장(`count(*)`, 조건 없는 `DELETE`, 인자 없는 함수)도 그대로 보낸다. Next는 이것을 간단한 질의 프로토콜로, Axum은 확장 프로토콜로 보내지만 결과는 같다 | node-pg |

### Next와 남은 차이

| # | 차이 | 판정 |
| --- | --- | --- |
| R9-1 | 본문의 JSON을 `serde_json`으로 읽어서, 짝 없는 `\uD800` 같은 이스케이프, double보다 큰 수(`1e400`), 128단계보다 깊은 중첩이 있는 본문은 400 `invalid plan`이다(`routes/request.rs`의 `Json`). Next는 `JSON.parse`로 받아 실행한다. 퍼즈에서 짝 없는 서로게이트 하나가 이렇게 달랐다(Next 200 빈 결과). Axum이 더 막는 쪽이다 | 수용 |
| R9-2 | 같은 이유로 결과 행에 double보다 큰 `numeric`이나 128단계보다 깊은 `jsonb`가 있으면 Axum은 400 `query failed`(코드 없음)이다. Next는 `Infinity`를 `null`로 적어 낸다. 그런 행은 지금 없다 | 수용 |
| R9-3 | 매개변수가 있는 문장마다 Postgres에 더 묻는다(값을 그 타입의 이진으로 바꾸는 `SELECT array_in(...)`, 값 800개마다 하나). 문장은 이름 없이 준비했다가, 실행할 때 Postgres가 고른 타입을 붙여 다시 `Parse`한다. 계획 풀에는 문장 캐시가 없어 신원 설정(`set_config` 다섯)도 문장마다 `Parse`·`Describe` 왕복이 하나씩 는다. 문장 텍스트와 결과는 같다 | 수용, 단계 5에서 지연 측정 |
| R9-4 | DB가 죽었을 때: Next는 `ensureAuthSchema`가 실패하면 503 `database unavailable`, 그 뒤에는 즉시 400 `query failed`(코드 `ECONNREFUSED`)다. Axum은 세션 쿠키가 있으면 503 `database unavailable`, 없으면 연결을 5초 기다린 뒤 400 `query failed`(코드 없음)다 | 수용 |
| R9-5 | Next의 `getSession`은 하루 지난 세션을 연장하고 이 경로의 답에 쿠키를 다시 낸다. Axum은 읽기만 한다(5절 차이 9). 세션 연장은 페이지마다 부르는 `/api/auth/get-session`(Axum, 12절)이 한다 | 수용 |
| R9-6 | 이 경로의 문장은 메인 풀이 아니라 자기 계획 풀(6, 상한과 같음)에서 돈다(위 "동시 실행 상한과 풀"). Next는 한 풀을 모든 경로가 나눈다. 그래서 Axum에서는 상한이 먼저 차고, 이 경로가 다른 경로의 연결을 가져가지 않는다 | 수용(`AXUM_DB_POOL_MAX`는 4 그대로) |
| R9-7 | 메타데이터를 처음 읽을 때 동시에 온 요청이 각자 읽는다(TypeScript는 약속 하나를 나눠 기다리고, 실패도 함께 받는다) | 수용 |
| R9-8 | 끊긴 요청: Next는 `pg_cancel_backend`로 돌던 문장을 멈추고 자리를 돌려준다. Axum은 문장을 끝까지 돌리고(문장마다 `statement_timeout` 15초) 그동안 자리와 계획 풀의 연결을 쥔다. 끊긴 요청이 자리를 Next보다 오래 쥐지만, 끊지 않은 같은 요청보다 오래 쥐지는 않는다. 제한기 카운터는 프로세스별이고 Next와 나누지 않으며, 키는 IP 주소이거나 `unknown`이다(`rate_limit.rs`) | 수용 |
| R9-9 | 영상 확인 뒤 캐시 만료를 Next의 내부 경로에 맡기므로, Next가 확인하지 않으면 202 `cacheInvalidationPending`이다. Next 안에서는 `revalidateTag`가 거의 실패하지 않는다. `CRON_SECRET`이 없으면 경로를 등록하지 않는다 | 수용 |

### 보안 리뷰와 고친 것

독립 보안 리뷰(R9-REVIEW, 2165bec28)가 찾은 것과 처리. 고친 것마다 고치기 전에 실패하는 시험이 있다.

| # | 찾은 것 | 처리 |
| --- | --- | --- |
| H1 | 계획마다 문장 텍스트가 달라서 sqlx가 연결마다 이름 붙은 문장을 남겼다(`prepare`가 캐시에 넣는다, 연결당 100개). 리뷰의 시험: 익명 select 하나(필터 약 21,000개, 본문 880 KB, 답은 400 `54011`)가 백엔드의 `RssAnon`을 약 20 MB씩 늘렸다(풀 1에서 계획 0개 5.3 MB, 41개 약 855 MB). 같은 텍스트에 값만 다른 계획 101개는 52 MB로 그대로였다. 연결당 약 2 GB, 요청 400~600번이면 VM의 Postgres가 메모리 부족으로 죽을 수 있었다 | 고침(ce0cfa5e2): 계획 풀에 문장 캐시가 없어(`statement_cache_capacity(0)`) 모든 문장이 node-pg처럼 이름 없이 가고 다음 문장에서 풀린다. 시험 `distinct_plans_db_leave_no_prepared_statement_behind`(서로 다른 계획 20개 뒤 모든 연결의 `pg_prepared_statements`가 그대로. 고치기 전 11개에서 31개) |
| H2 | 요청 JSON 파서(`routes/request.rs`의 `Json`, R1·R2부터)가 객체의 키마다 앞선 키 전부와 비교했다: 서로 다른 키 n개에 O(n²), Tokio 작업자 위에서. 리뷰: 1 MiB 본문(키 116,500개)이 9.99초, 그런 본문 둘이 도는 동안 작은 요청이 8.3초 기다렸다. 이 경로의 insert 컴파일도 레코드의 값을 열마다 레코드 전체를 훑어 찾아서(`row[column]`은 해시 조회) 열이 많은 레코드 하나가 O(n²)였다 | 고침: 파서는 키에서 자리로 가는 해시 맵(ae560605a, 반복 키는 그대로 첫 자리에 마지막 값), insert는 레코드마다 맵(771b11a8c). 시험 `json_objects_with_many_keys_parse_in_linear_time`(1 MiB, 고치기 전 디버그 26.6초), `an_insert_of_many_columns_compiles_in_linear_time`(8만 열, 고치기 전 16초). 파서 고침은 main의 `request.rs`와 글자가 같아 따로 먼저 병합할 수 있다. 노출된 경로는 아래 표 |
| M1 | 활성 쿼리 자리가 핸들러 future에 있어서 클라이언트가 끊으면 풀렸고, 문장은 연결을 쥔 채 15초까지 돌았다. 리뷰: 풀 8에서 400 ms 만에 끊은 요청 여덟 개 뒤 `pg_stat_activity`에 문장 8개(상한 6), 무관한 select가 5.0초 뒤 400(풀 대기 초과). 세션 조회도 같은 풀이라 모든 네이티브 경로의 로그인이 실패할 수 있었다 | 고침(ff0b3ec9b): 세션 조회부터 답까지 자리를 소유한 작업에서 돌고, 문장이 끝나야 자리를 돌려준다. 계획 문장은 H1의 계획 풀(= 상한 6)에서 돌아 메인 풀을 비우지 못한다. 시험 `queries_whose_clients_left_db_keep_their_slots_until_they_end`(끊은 여덟 개 뒤 다음 요청이 즉시 503, 잠금을 기다리는 문장은 정확히 6. 고치기 전 5초 뒤 400) |
| M2 | 주소별 한도(분당 180)의 키가 `X-Forwarded-For`의 첫 값이다. Caddy는 Cloudflare를 믿어(`trusted_proxies`) 들어온 XFF를 넘기고 덧붙이며, Cloudflare는 클라이언트가 보낸 XFF 뒤에 실제 주소를 붙인다. 그래서 첫 값은 클라이언트가 정하고, 요청마다 다른 IP를 쓰면 한도를 넘는다(`db_query/mod.rs` `rate_limited`, `public/rate_limit.rs` `client_ip`, `deploy/Caddyfile:3-6`). 또 전체 한도(`db-query:all`, 1,200)를 주소별 검사 전에 세서, 주소별로 거절된 요청도 전체 몫을 쓴다. 한 클라이언트가 분당 1,200번 보내면 남은 창 동안 모두가 429다. 두 서버가 같다(`lib/rate-limit.ts` `getClientIp`, `route.ts`의 순서). 운영 `oci-hermes-dev`의 Caddy(`deploy/Caddyfile.site`는 `trusted_proxies`가 없음)는 리뷰가 보지 못했다. Cloudflare를 믿지 않으면 반대로 모든 방문자가 Cloudflare 가장자리 주소를 나눠 함께 429를 받는다 | 기록만(이번에 바꾸지 않음). 고칠 때는 두 서버를 함께: `CF-Connecting-IP`(또는 Caddy `{client_ip}`를 `header_up X-Real-IP`로)를 키로, 주소별 검사를 전체보다 먼저 |
| L1 | 값 전부를 `SELECT array_in(...)` 하나로 바꿨는데 Postgres의 SELECT 목록은 1,664개까지라, 그보다 값이 많은 계획(여러 행 insert·upsert, H1의 계획)은 Axum만 400 `54011`이었다. node-pg는 그대로 보낸다 | 고침(1e9db5324, TypeScript와 달라서): 800개씩 나눠 변환한다. 시험 `a_plan_of_more_values_than_a_target_list_holds_db_runs`(1,700행 insert가 2행 insert와 같은 42501. 고치기 전 54011) |
| I1 | 필터와 or 그룹이 없는 `update`·`delete`는 `WHERE TRUE`다(`write.rs` `mutation_sql`). 바꾸는 범위는 행 수준 보안만 정한다. TypeScript의 `mutationSql`도 같다 | 기록만(TypeScript와 같음). 두 서버에 함께 넣을 만한 가드: 필터도 or 그룹도 없는 쓰기 거절(앱의 호출은 모두 필터가 있다) |

### 두 번째 보안 리뷰와 고친 것

두 번째 리뷰(R9-REVIEW2, f758f045b)는 위 고침이 찾은 것을 닫았다고 확인하고, 같은 계획 컴파일러에서 넷을 더 찾았다. N1·N2는 R9 전부터 TypeScript(`lib/db/execute.ts`, 운영의 Next)에도 있던 것이라 두 서버를 함께 고쳤다. 고친 것마다 고치기 전에 실패하는 시험이 두 서버에 있다.

| # | 찾은 것 | 처리 |
| --- | --- | --- |
| N1 | insert·upsert는 레코드마다 첫 레코드의 열 수만큼 매개변수를 만든다(`write.rs` `insert_sql`, `execute.ts` `valuesSql`). 쓰기에는 행·값 한도가 없어, 열 1,000개짜리 첫 레코드 뒤에 3바이트 `{}` 레코드를 붙인 익명 insert가 거절되기 전에 매개변수 수백만 개를 만들었다. 리뷰: 21 KB 본문이 매개변수 400만 개, Axum 프로세스 472 MB(컨테이너 한도 256 MB), Postgres 백엔드 384 MB | 고침: 두 서버의 `boundPlan`이 insert·upsert의 레코드 수 × 첫 레코드의 열 수를 컴파일 전에 세어 65,535(프로토콜의 16비트 한도, node-pg와 sqlx도 그 위는 실패)를 넘으면 400 `invalid plan`이다. 지금 되는 계획은 하나도 잃지 않는다. 다른 문장은 매개변수가 본문 크기에 비례해서(1 MiB에 수만 개) 그대로 두었고, 한도를 넘으면 바인딩에서 실패한다. 시험 `writes_of_more_than_65535_parameters_are_refused`, `an_insert_past_65535_parameters_is_refused_before_it_compiles`(1,000열 × 4,001행이 즉시 400. 고치기 전 5초 뒤 400 `query failed`), vitest `refuses a write whose statement would bind more than 65,535 parameters` |
| N2 | upsert의 `DO UPDATE SET` 목록이 열마다 충돌 열 목록을 훑었다(`write.rs` `on_conflict`, `execute.ts`의 `conflict.includes`). H2와 같은 부류로, Tokio 작업자 위에서 돈다. 리뷰: 키 55,000개에 `onConflict` 이름 72,000개인 980 KB upsert가 4.88초, 그런 요청 둘이 도는 동안 작은 요청이 4.53초 기다렸다 | 고침: 충돌 열을 한 번 집합(`HashSet`, `Set`)으로 만들어 찾는다. `ON CONFLICT (…)`의 순서는 목록 그대로이고 문장은 같다(sql_tests 그대로 통과). 시험 `an_upsert_of_many_conflict_columns_compiles_in_linear_time`(4만 × 4만, 고치기 전 디버그 8.3초), vitest `compiles many columns against many conflict columns in linear time`(55,000 × 72,000, 고치기 전 3.97초) |
| N3 | 계획 풀 백엔드가 큰 계획 하나 뒤 약 110 MB를 쥐고, 계획 풀에 `idle_timeout`이 없어 sqlx 기본값대로 10분 놀아야(수명 30분) 닫혔다. 여섯이면 약 660 MB, Postgres 한도 1,280 MB의 절반이다 | 고침: 계획 풀은 5초 놀면 닫고(`PLAN_IDLE_TIMEOUT`, 데드라인 풀과 같다) 최소 0개를 둔다. 메모리 예산은 위 "동시 실행 상한과 풀". 시험 `idle_plan_connections_close_within_seconds`(계획 연결 셋이 15초 안에 풀에서도 `pg_stat_activity`에서도 사라진다. 고치기 전 15초 뒤에도 셋) |
| N4 | 2절의 연결 예산 "Axum 12 + Next 10 = 22, 30 중"이 슈퍼유저 예약 3개(쓸 수 있는 것은 27), 워커의 풀(`lib/db/pool.ts` 8 + 2), 백업의 연결 하나, 배포 중 컨테이너가 겹치는 동안을 빼고 셌다. 리뷰: 부하 중 배포에 28~33으로 27을 넘으면 `53300` | 고침(문서): 2절의 예산을 다시 적었다(쓰는 것마다 최대치와 노는 연결이 닫히기까지, 겹치는 동안, 넘으면 일어나는 일, 켜기 전에 정할 것). 단계 5b의 확인 항목과 `docker-compose.axum.yml`의 주석(“6 in all”)도 고쳤다. 문서만 바꿔서 시험은 없다 |


**H2가 고치기 전에 노출한 경로.** main(036f05d82)에서 네이티브로 등록되고 요청 본문을 `Json::parse`로 읽는 경로다. `serde_json::Value`로 읽는 경로(인증 A2의 폼, `csp-report`, `explore-previews`, `mpe-renders`)는 맵이 정렬 트리라 해당 없다. AI 응답(`memes-chat`, MPE 구조화 응답, 스튜디오)과 DB 행도 이 파서로 읽지만 클라이언트가 고르는 입력이 아니다. 요청당 CPU는 고치기 전 중복 검사를 그대로 옮긴 벤치(release, 이 개발 기기, 4글자 키 `"abcd":0,`로 한도를 채움)이고, 리뷰의 1 MiB 실측 9.99초와 맞는다.

| 경로 id | 경로 | 누가 | 본문 한도 | 한도를 채운 요청 하나의 CPU | 고치기 전에 쓸 수 있었나 |
| --- | --- | --- | --- | --- | --- |
| `mcp` | `POST /api/mcp` | 누구나(세션 없음. `Origin`이 없거나 chatgpt.com·catchmeme.com, `Content-Type: application/json`). 제한은 `tools/call`에만 있고 파싱 뒤에 센다 | 256 KiB | 0.67초(키 29,127개) | **예.** 익명으로, 한도 없이. 초당 3번이면 2코어 VM의 Tokio 작업자 둘이 다 찬다(Axum 전체와 Next로 가는 프록시가 멈춘다) |
| `mpe-uploads` | `POST /api/mpe/uploads` | 로그인한 누구나(세션, 분당 5번: 프로세스 안 + `reserve_api_request('mpe_upload_storage')`) | 20 MiB + 128 KiB(멀티파트. 텍스트 필드 `rightsDeclaration` 크기에 따로 한도 없음. `file` 필드만 있으면 그 다음에 파싱) | 약 69분(키 약 230만 개, n²로 1 MiB 값에서 늘려 잡음, 돌려 보지 않음) | **예.** 계정 하나로 요청 둘이면 작업자 둘이 한 시간가량 묶인다(R2가 설정된 운영에서 등록됨) |
| `admin-mpe-candidates-post` | `POST /api/admin/mpe-candidates` | 운영자만(읽기 전에 확인) | 1 MiB | 10.3초 | 운영자만 |
| `admin-meme-studio` | `POST /api/admin/meme-studio` | 운영자만(읽기 전에 확인), `BEDROCK_MEME_STUDIO_ENABLED`일 때만 등록 | 1 MiB | 10.3초 | 운영자만 |
| `mcp-github` | `POST /api/mcp-operator/github` | 서명(`MCP_GITHUB_WEBHOOK_SECRET`)을 파싱 전에 확인 | 2 MiB | 약 41초 | 비밀을 가진 쪽만 |
| `analytics-events` | `POST /api/analytics/events` | 사이트 origin | 16 KiB | 2.4 ms | 아니오 |
| `meme-studio` | `POST /api/meme-studio` | 누구나 | 4 KiB | 0.14 ms | 아니오 |
| `memes-semantic-search`, `memes-chat` | `POST /api/memes/semantic-search`, `POST /api/memes/chat` | 누구나 | 2 KiB | 0.04 ms | 아니오 |
| `meme-cards-claim` | `POST /api/meme-cards/claim` | 사이트 origin | 1 KiB | 0.01 ms | 아니오 |
| `memes-view` | `POST /api/memes/view` | 사이트 origin | 128 B | 0.02 ms 미만 | 아니오 |
| `db-query`(R9, 아직 운영에 없음) | `POST /api/db/query` | 누구나(사이트 origin) | 1 MiB | 10.3초(리뷰 실측 9.99초) | 켜기 전에 고침 |

### 단계 5에서 확인할 것

- 켜기 전에 부하 시험 B0 저장 시나리오를 Axum 앞에서 다시 돌린다. 연결은 Axum 최대 12(2절).
- 값 변환 왕복 하나(R9-3)의 지연을 운영과 같은 VM에서 잰다.
- TypeScript 동작 1(플래너의 `types`)을 고치면 `write.rs`의 `rpc_sql`도 같이 고친다. TypeScript 동작 2를 고치면 탐색 고정 계획을 다시 잡는다(`plans.capture.ts`).

## R10: 밈 공유 카드와 카드 내보내기

브랜치 `torisKR/axum-routes-r10`(`origin/main` 4930d9e03 위). R7(13절)이 Next에 남긴 세 경로를 옮겼다. 코드는 `server/src/og/`(글자 `satori/`, 카드 `share_card.rs`·`share_fonts.rs`, 사진 `photo/`, JPEG 인코더 `jpeg_encode.rs`)와 `server/src/routes/og_share/`. 이 절의 차이는 `R10-n`으로 적는다.

| Route id | 경로 | 메서드 | 비고 |
| --- | --- | --- | --- |
| `og-meme` | `/memes/{key}/opengraph-image-k2cx9c` | `GET`, `HEAD` | 한국어 카드. 행 → 미디어 스냅숏 → 큐레이션 카드(별칭 포함) 순서는 `loadKoreanShareCard` 그대로 |
| `og-meme-locale` | `/{en,ja,zh,zh-tw}/memes/{key}/opengraph-image` | `GET`, `HEAD` | 번역 카드. 검토·최신·필수 칸·색인 가능한 원문일 때만, 아니면 그 로케일의 기본 카드. 다른 첫 세그먼트(`ko`, `ar`, 그 밖)는 Next가 답한다 |
| `meme-export` | `/memes/{key}/export` | `GET`, `HEAD` | 400 `invalid_locale` → 401 `signed_out` → 503 `quota_unavailable`(R10-B1). 다른 메서드는 Next |

응답: 카드가 없으면(없는 밈, 빈 제목, 번역 없음) 로케일의 기본 카드에 `public, max-age=0, must-revalidate`. 그린 카드는 PNG, PNG가 1 MB를 넘으면 앱의 JPEG. 사진을 그렸으면 같은 헤더, 아니면 `no-store`. 그리기가 실패하면 기본 카드에 `no-store`. `Content-Language`는 `proxy.ts`대로(`/memes/*`는 `ko`, 번역은 `en`·`ja`·`zh-Hans`·`zh-Hant`, 내보내기는 `?locale=`).

### 어떻게 같게 그리나

- **글자.** Satori의 텍스트 노드를 옮겼다(`og/satori/`). 줄 나눔 단어는 Satori가 쓰는 `linebreak` 패키지의 분류표와 쌍 표 그대로(`parity/og-text-tables.mjs`가 번들에서 뽑아 `linebreak_data.rs`로 쓴다), 자소·단어는 `icu_properties`(이미 빌드에 있다) 위의 UAX #29와 Satori의 줄바꿈 없는 공백 합치기. 글꼴 엔진은 노드의 글꼴 → 불러온 모든 글꼴 순으로 고르고, 첫 UTF-16 단위로 기억하고(Satori의 `charCodeAt`), 없는 글자는 그 글자만 고른 글꼴의 글리프를 `unitsPerEm` 비로 늘려 쓴다(커닝은 첫 글꼴에서 그 글리프 번호로 찾는다. Satori 그대로). 반복 글리프의 경로는 opentype.js처럼 처음 경로를 옮겨 쓴다. 공유 카드의 줄 맞춤(`fitShareLines`, 말줄임표)은 앱 자체의 폭 표(`ttf-metrics.ts`)로 하고, 각 줄은 `ShareLine`처럼 글꼴 묶음마다 `white-space: pre` 노드 하나로 그린다.
- **글꼴.** `assets/og-fonts/share`의 OTF 4개와 Noto Emoji 13개(21 MB)를 `server/assets/og/share`로 복사했다(`tests/og_cards.rs`가 바이트를 비교). 어느 글꼴에도 없는 글자가 있으면 Satori는 그 자리에서 Google Fonts·twemoji를 내려받으므로, Axum은 그 요청을 Next에 넘긴다(R10-4). 내보내기 카드는 그리지 않으므로 Pretendard는 넣지 않았다(R10-B1).
- **상자.** Yoga의 반올림: 노드마다 부모에서의 위치를 따로 반올림해 더하고, 크기는 반올림 안 한 가장자리에서 잰다(`og::At`). R7의 한 겹 카드에서는 드러나지 않았다.
- **사진.** `prepareSharePhoto`를 옮겼다(`og/photo/`): 앱 자체의 `decodePng`·`decodeBaselineJpeg`(부동소수 IDCT, `Int16Array` 잘림, 가까운 크로마)로 레터박스를 판정하고 자른다. 자르지 않은 사진은 Next의 래스터라이저(sharp 안의 librsvg, mozjpeg)가 디코드하듯 libjpeg의 `islow` IDCT·팬시 업샘플링·고정소수 YCbCr로, PNG는 `png` 크레이트(이미 빌드에 있다)로 푼다. 그리기는 cairo `GOOD` 필터 = pixman 양선형(7비트 가중치, 잘림, 패딩, 16.16 고정소수, 그린 영역 가운데서 정확하게 맞춘 변환)을 옮겼다. 1 MB 판정은 sharp의 `png()`처럼(필터 없음, deflate 6) 인코딩한 길이로, JPEG는 앱의 인코더를 그대로 옮겼다.
- **사진 바이트.** `loadSharePhoto`: `i.ytimg.com` 정지 화면은 `maxresdefault` → `sddefault` → `hqdefault` 중 처음 사진이 되는 것. 사이트 경로(와 사이트 절대 주소의 경로)는 Next가 `public/`에서 읽거나 `SITE_URL`(운영에서는 이 서버)에서 받는다. Axum은 카드 그림·썸네일(`/api/media/meme-card-art/…`, `/api/media/meme-thumbs/…`)을 미디어 경로가 읽는 키 그대로 저장소에서 읽고(R2 404·오류는 사진 없음, 로컬 디렉터리에 없으면 Next에 묻는다), 그 밖의 경로는 Next에 묻는다. 어느 쪽이든 1.5초·200만·리디렉트 안 따름·8 MB.
- **디코드 한도.** 8 MB(TypeScript의 한도), 한 변 4096, 1920×1080 화소. 넘으면, 또는 여기서 풀 수 없는 JPEG(프로그레시브, 리스타트 마커, 정수배가 아닌 샘플링)면 Next가 그린다(R10-4).

### 확인

- `tests/og_text.rs`: 자소·단어·줄 나눔 단어가 Node(26, Unicode 17)의 `Intl.Segmenter`·`linebreak`와 같다(말뭉치 24개).
- `tests/og_share.rs`: 제목 카드 21개(로케일 5, 두 줄·말줄임표·한 덩어리 토큰·커닝·이모지·ZWJ·국기·한자·전각·공백·태국어)와 사진 카드 7개를 Satori의 SVG(`tests/fixtures/og/share-*.svg`, `og-reference.mjs share`)와 같은 래스터라이저로 그려 **화소가 모두 같다**. 태국어처럼 Satori가 글꼴을 내려받는 경우는 Axum이 거절해야 통과한다.
- `tests/og_photo.rs`: 사진 15장(4:2:0·4:2:2·4:4:0·4:4:4·흑백·프로그레시브·리스타트·레터박스·400px 미만·팔레트·16비트·투명)에서 앱 디코더의 RGBA, 자르기·버리기 판정, 자르지 않은 사진의 디코드가 libvips와, JPEG 인코더의 바이트가 앱과 같다(`photos.json`, `og-photo-fixtures.mjs`).
- 실제 Next와 비교: `server/parity/og.mjs share export`(`og-share-seed.sql`, 저장소 객체, `i.ytimg.com` 녹음 스텁, Next 쪽 `og-intercept.mjs`). 공유 카드 37개(위 키 모양 22개, 로케일 9개, `HEAD`, `POST`, 깨진 이스케이프의 500, 스텁 요청 순서 2개)와 내보내기 13개, R7의 79개가 모두 통과한다. 가장 나쁜 값: 사진을 늘린 카드 평균 0.483·최대 55·32 초과 0.0101 %, 줄인 카드(YouTube) 평균 0.421, 잘라 늘린 카드(TikTok) 평균 0.216·최대 65, 제목 카드 평균 0.096 이하·최대 67.

### Next와 남은 차이

| # | 차이 | 판정 |
| --- | --- | --- |
| R10-1 | 사진 카드의 화소는 R7 허용 오차 안에서만 같다. librsvg의 JPEG 디코드와 cairo 합성이 남기는 차이를 앱의 JPEG 재인코딩이 키운다. 1:1로 그린 사진도 평균 0.239다 | 수용 |
| R10-2 | Next는 밈 행과 번역을 Data Cache(하루, 카탈로그 태그로 비움)로 읽고 미디어 스냅숏만 매번 읽는다. Axum은 셋 다 매번 읽는다. 편집 직후 Next 카드가 옛 제목일 수 있다(B2-1과 같은 종류) | 수용 |
| R10-3 | 1 MB 판정에 쓰는 PNG 길이는 sharp와 같은 설정이지만 deflate 구현(zlib-ng ↔ miniz/zlib-rs)과 래스터가 조금 달라, 1 MB에서 1 % 안쪽인 카드는 한쪽만 JPEG가 될 수 있다. PNG 바이트와 `Content-Length`는 다르다 | 수용 |
| R10-4 | 요청 단위로 Next에 넘긴다: 번들 글꼴에 없는 글자(Satori가 내려받는다), 줄이 540px을 넘음, 제어 문자, Next가 다르게 푸는 키(`%` 이스케이프 오류), 한도를 넘는 사진, 프로그레시브·리스타트·특이 샘플링 JPEG. 답은 Next의 것이다 | 수용 |
| R10-5 | `https://catchmeme.com/…` 썸네일을 Next는 그 주소로 받고(운영에서는 이 서버), Axum은 경로로 바꿔 저장소나 Next에서 읽는다. `SITE_URL`이 다른 미리보기 배포에서만 다를 수 있다 | 수용 |
| R10-6 | YouTube 요청에 undici의 `accept`·`accept-language`·`sec-fetch-mode`·`user-agent`는 같게 보내고 `accept-encoding`은 보내지 않는다. 요청 순서는 같다(`og.mjs`가 확인) | 수용 |
| R10-7 | 공유 카드의 그리기(사진 디코드 포함)도 `MAX_RENDERS`(둘)를 같이 쓴다. 최악(1920×1080 4:4:4 JPEG 카드 6개 동시)의 최대 RSS는 아래 "그리는 비용" | 수용 |
| R10-8 | 단어 경계는 UAX #29 규칙이고 ICU의 한자·가나 사전 분절은 없다. 단어는 칠하는 묶음이 공백에서 끝나는 자리만 정하므로 그 자리가 같은지만 맞춘다(`og_text.rs`). Node 22(운영)와 26(시험)의 Unicode 차이는 새 글자에만 있다 | 수용 |

### 옮겨 온 TypeScript 버그

| id | 버그 | 위치 |
| --- | --- | --- |
| R10-B1 | 내보내기가 부르는 `reserve_meme_export`를 정의하는 마이그레이션이 없다. 계획 실행기가 `function not found`(42883)를 내므로 로그인한 모든 요청이 503 `quota_unavailable`이고 카드는 한 번도 그려지지 않는다. Axum도 같은 503을 내고, 함수가 생기면 부르기 전에 Next에 넘긴다(쿼터를 한 번만 잡는다) | `app/(default)/memes/[key]/export/route.ts` |
| R10-B2 | `decodePng`는 인터레이스를 무시해 Adam7 PNG를 뒤섞인 화소로 자르기 판정한다 | `lib/png-raster.ts` |
| R10-B3 | (Satori) 텍스트 노드의 글꼴 선택을 첫 UTF-16 단위로 기억해, 같은 상위 대리 쌍을 쓰는 두 이모지는 첫 이모지의 글꼴로 찾는다 | next/og의 `getEngine` |
| R10-B4 | 내보내기의 `loadCardFonts`는 jsDelivr 실패를 프로세스가 끝날 때까지 기억해 그 뒤 모든 카드를 기본 글꼴로 그린다(R10-B1 때문에 닿지 않는다) | `lib/meme-card.tsx` |

### 그리는 비용

한도 안의 최악은 1920×1080 4:4:4 JPEG 카드 그림이다. 디코드는 엔트로피 한 번에 두 IDCT를 같이 돌려 계수는 남기지 않는다(앱의 `i16` 표본 12.4 MB, libjpeg의 `u8` 표본 6.2 MB). 앱의 RGBA(8.3 MB)로 자르기를 판정하고 버린 뒤 libjpeg의 RGBA(업샘플 6.2 MB, RGBA 8.3 MB)를 만든다. 칠하기는 미리 곱한 사본(8.3 MB)과 카드(3 MB), PNG 1.3 MB, JPEG 인코딩이다. 그리기 하나가 60 MB 안팎이고 동시에 둘이다.

재어 본 값(macOS, 디버그 빌드, `ps` RSS): 시작 뒤 6 MB, 제목 카드 하나 뒤 31 MB, 그 카드 6개 동시(둘씩 그린다) 최대 155 MB와 164 MB(두 번 잰 값). 수정 전(원본 사진을 `u32` 미리 곱셈으로 들고, 자르지 않은 JPEG를 두 번 디코드)에는 216 MB였다. 256 MB 컨테이너에서 90 MB 남짓 남는다. 디버그 빌드에서 그 카드 하나는 7~10초 걸린다(제목 카드는 1초 안).
