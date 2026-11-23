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
- 연결 예산: Postgres `max_connections=30`. Next 풀 8 + 데드라인 풀 2, 워커·백업이 나머지를 쓴다. Axum은 최대 `AXUM_DB_POOL_MAX` + 2개를 연다(기본 6: 메인 풀 4 + 데드라인 풀 2). 데드라인 풀을 쓰는 경로가 아직 없어 지금 실제로 열리는 것은 메인 풀의 4개다. Next 10 + Axum 6 = 16.
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
| 3 | 크론 경로, 미디어 업로드·MPE 업로드(R2 쓰기), 분석 이벤트, 운영자 API | 대기 |
| 4 | `proxy.ts` 로직(www 리디렉션, 로케일, 정규 URL 리디렉션, 소프트 404, 인증 게이트)을 Axum 미들웨어로 | 대기 |
| 5a | 배포 스크립트와 에이전트가 `MEMECATCH_AXUM=1`일 때 Axum 구성을 배포한다(기본은 꺼짐). 컴포즈 파일 목록에 `docker-compose.axum.yml` 추가, `next`를 먼저 올려 health를 기다린 뒤 `app` 교체, 두 컨테이너의 health로 게이트, 두 이미지에 같은 `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`, 서버 이미지 빌드와 디스크 확인, CI `server` 확인, 두 이미지 스냅샷·롤백. 5절 "단계 5a 결과" 참조 | 완료. `torisKR/axum-deploy` |
| 5b | 운영 전환: VM의 `.env`에 `MEMECATCH_AXUM=1`을 넣고 수동 재배포. 5절 "단계 5b에서 확인할 것" 참조 | 사용자 승인 필요 |
| 6 | `/api/auth/*`(better-auth)를 Rust로 | 옮기기로 결정. 순서와 시험 항목은 [`UI-PLAN.md`](./UI-PLAN.md) 4절 "인증". 구현은 대기 |
| 7 | 화면 계층을 Rust로 | 옮기기로 결정. 방식(Maud 템플릿 + 작은 스크립트), 묶음 순서, 파일럿 두 페이지의 결과는 [`UI-PLAN.md`](./UI-PLAN.md). 나머지 페이지는 대기 |

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
| `page-about` | `/about` | `GET`, `HEAD` | 파일럿. `AXUM_PILOT_ROUTES`에 id를 적어야 켜진다(기본은 Next). 문서 요청만 답하고 `RSC` 요청과 www 호스트는 Next로 넘긴다 |
| `page-meme` | `/memes/{key}` | `GET`, `HEAD` | 파일럿, 위와 같다. "유래" 절까지만 그린다. 미디어·번역·자체 제작·편집 밈과 DB 조회 실패는 Next로 넘긴다 |
| `page-assets` | `/_axum/{file}` | `GET`, `HEAD` | 위 두 페이지의 스타일시트와 스크립트. 파일 이름에 내용 해시가 들어간다 |
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
| `admin-mpe-candidates` | `/api/admin/mpe-candidates` | `GET`, `HEAD` | 운영자만. `POST`(후보 생성·매칭·근거 초안, 임베딩과 OpenRouter 호출)는 Next가 답한다 |

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
- 전환하는 동안의 메모리와 연결. 최대 1분쯤 이전 `app`(Next)과 새 `next`가 함께 돈다: 한도 2,816 MB 둘, 연결 풀 최대 10개 둘. 그 뒤로는 Next 10 + Axum 6 = 16에 워커·백업과 Postgres의 슈퍼유저 예약 3개를 더해 30 안에 드는지. 워커의 풀 크기는 확인하지 않았다.
- `service_role`의 `user`·`session` 읽기 권한. Rust의 세션 조회는 `service_role`로 돈다(better-auth는 로그인 롤로 돈다). 이 권한은 마이그레이션이 아니라 Next가 실행 중에 부여한다(`lib/auth/server.ts`). 권한이 없으면 세션 쿠키가 있는 요청은 전부 503이 된다(열리지 않고 닫힌다). 다음에 마이그레이션이 허용될 때 권한을 마이그레이션으로 옮기는 것이 낫다.
- 환경변수. Axum 컨테이너는 `docker-compose.axum.yml`에 적힌 것만 받는다. 서버가 읽는 변수는 모두 받는다: `.env`에서 `DATABASE_URL`(비밀번호), `BETTER_AUTH_SECRET`, `CRON_SECRET`, `MEMECATCH_SIGNING_SECRET`, `OBJECT_SIGNING_SECRET`, `R2_*` 넷, `LOCAL_OBJECT_STORAGE_DIR`, `ADSENSE_AUTO_ADS_ENABLED`, `AXUM_DB_POOL_MAX`·`AXUM_DISABLED_ROUTES`·`AXUM_PILOT_ROUTES`; 이미지에서 `RELEASE_SHA`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_ADSENSE_CLIENT`. `CSP_ENFORCE`·`CSP_REPORT_URI`는 일부러 넘기지 않는다(5절 발견 1). `docker-compose.yml`이 Next에만 주는 나머지(`BETTER_AUTH_URL`, OAuth 클라이언트 `GOOGLE_*`·`KAKAO_*`·`TIKTOK_*`, `AWS_*`·`BEDROCK_*`, `GA4_*`, `MEME_CHAT_*`·`MEME_EMBEDDING_*`·`MEME_SEMANTIC_SEARCH_ENABLED`, `META_*`·`THREADS_ACCESS_TOKEN`·`X_API_BEARER_TOKEN`·`YOUTUBE_API_KEY`·`RADAR_*`, `MCP_*`, `OPENAI_*`·`OPENROUTER_*`, `PLUS_DIGEST_*`, `AUTH_EMAIL_WEBHOOK`, `NEXT_PUBLIC_COMMUNITY_ENABLED`·`NEXT_PUBLIC_SUBMISSIONS_OPEN`)는 아직 Next에 있는 경로가 읽는다. 경로를 옮길 때마다 그 경로가 읽는 변수를 더한다.
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
