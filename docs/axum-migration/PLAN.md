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

- 이 브랜치를 `main`에 합쳐도 운영 동작은 바뀌지 않는다. Axum은 별도 opt-in 컴포즈 파일(`docker-compose.axum.yml`)로만 켜진다.
- 운영 전환(컴포즈에서 `app`을 Axum으로 바꾸는 일)은 사용자 승인 후 별도 작업으로 한다.
- 경로별 되돌리기: `AXUM_DISABLED_ROUTES=<경로 id,...>`에 적힌 경로는 Axum이 처리하지 않고 Next로 넘긴다. 재배포 없이 컨테이너 재시작으로 적용된다. 없는 id를 적으면 Axum이 시작을 거부하고 유효한 id를 출력한다(오타로 되돌리기가 조용히 실패하는 일을 막는다).
- **단계 5 전에 손으로 opt-in하려면 자동 배포를 먼저 멈춰야 한다.** `scripts/deploy-oci.sh`는 컴포즈 파일 목록에 `docker-compose.axum.yml`을 넣지 않는다. 손으로 켠 뒤 자동 배포가 한 번 돌면 `app`이 다시 Next가 되고, `next` 컨테이너는 고아로 남아 Next 두 개가 각자 연결 풀(최대 10)과 메모리 한도(2,816 MB)를 쓴다. Axum은 말없이 빠진다.

## 3. 단계

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 0 | Axum 크레이트, Next로의 스트리밍 리버스 프록시, DB 신원 계층, 헬스체크, 패리티 하네스, Docker·CI | 완료. `torisKR/axum-foundation` `561dbde26` |
| 1 | R2/객체 저장소 + `/api/media/signed`, better-auth 세션 판독·운영자·크론 가드, 공개 읽기 경로 1차 | 완료. `torisKR/axum-foundation` `6365dcfbf` (병합 T2 `496b2e6f0`, T3 `a0c156bc4`, T4 `15cd5cddc`) |
| 2 | 나머지 공개 읽기 경로(llms.txt, 피드, oembed, 탐색 미리보기, 밈 카드, 퀴즈) | 진행 중. R1: llms.txt·피드 6개 경로 완료(6절) |
| 3 | 크론 경로, 미디어 업로드·MPE 업로드(R2 쓰기), 분석 이벤트, 운영자 API | 대기 |
| 4 | `proxy.ts` 로직(www 리디렉션, 로케일, 정규 URL 리디렉션, 소프트 404, 인증 게이트)을 Axum 미들웨어로 | 대기 |
| 5 | 운영 전환: `scripts/deploy-oci.sh`의 컴포즈 파일 목록에 `docker-compose.axum.yml` 추가, `next` 서비스의 health로 배포 게이트, Next 이미지를 빌드한 `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`을 Axum에 전달. 5절 "단계 5에서 확인할 것" 참조 | 사용자 승인 필요 |
| 6 | `/api/auth/*`(better-auth) 이관 여부 | 사용자 결정 필요 |
| 7 | 화면 계층: Next를 렌더러로 유지할지, Rust로 다시 쓸지 | 사용자 결정 필요 |

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
| `llms` | `/llms.txt` | `GET`, `HEAD` | 요청마다 승인·색인 가능 밈 전체를 1,000행씩 읽어 세고 트렌드 상위 15개를 싣는다. 랭킹 링크 여부는 프로세스에 60초 보관한다. www 호스트 요청은 Next로 넘긴다 |
| `llms-full` | `/llms-full.txt` | `GET`, `HEAD` | 같은 읽기, 상위 400개. www 호스트 요청은 Next로 넘긴다 |
| `feed` | `/feed.xml` | `GET`, `HEAD` | 최근 게시 30개. www 호스트 요청은 Next로 넘긴다 |
| `feed-updated` | `/feed/updated.xml` | `GET`, `HEAD` | 최근 수정 30개. www 호스트 요청은 Next로 넘긴다 |
| `llms-localized` | `/en/llms.txt`, `/ja/llms.txt`, `/zh/llms.txt`, `/zh-tw/llms.txt` | `GET`, `HEAD` | 번역 로케일 넷의 고정 경로만 등록한다. 다른 접두사(`/ko/llms.txt` 등)는 Next가 답한다(404). www 호스트 요청은 Next로 넘긴다 |
| `llms-full-localized` | `/en/llms-full.txt`, `/ja/llms-full.txt`, `/zh/llms-full.txt`, `/zh-tw/llms-full.txt` | `GET`, `HEAD` | 위와 같다 |

인증 추출자(`RequestIdentity`·`SignedInUser`·`Operator`·`CronAuthorized`·`CronAuthorizedTrimmed`)와 객체 저장소(`state.storage`)는 만들어졌고, 이를 쓰는 경로는 단계 2·3에서 붙는다. 크론 가드가 둘인 이유: 크론 경로 넷(`trend-pulse`·`source-refresh`·`growth-baseline`·`saved-state-emails`)은 `CRON_SECRET`을 그대로 비교하고 `meme-embeddings`는 trim한 뒤 비교한다.

### 계획을 바꾸는 발견

1. **Next는 빌드할 때 값을 고정한다.** 응답 헤더(CSP, `X-MemeCatch-Release-Sha`), `/robots.txt` 본문, `/memes/random`의 `Location`이 `next build` 시점의 `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`로 정해진다. Axum은 시작할 때 읽으므로 Next 이미지를 빌드한 값과 같은 값으로 실행해야 한다. `CSP_ENFORCE`·`CSP_REPORT_URI`는 Next 이미지가 그 값 없이 빌드되므로 Axum에 넘기지 않는다. 단계 5에서 자동배포 에이전트가 두 컨테이너에 같은 값을 넣어야 한다.
2. **`proxy.ts`는 `/api` 밖의 네이티브 경로에도 적용된다.** `/memes/random`에는 `Content-Language: ko`가 붙고, `/robots.txt`와 `/memes/random`은 www 호스트에서 301이 먼저 나간다. 단계 4 전까지는 `/api` 밖 경로를 옮길 때마다 그 경로가 `Content-Language`를 직접 내고 www 호스트 요청을 Next로 넘겨야 한다. `/api` 경로는 `proxy.ts` 매처 밖이라 해당 없다.
3. **Rust는 세션을 읽기만 하고 연장하지 않는다.** better-auth의 `getSession`은 하루 넘게 연장되지 않은 세션을 7일로 늘리고 쿠키를 다시 낸다. 페이지와 `/api/auth/get-session`이 Next에 있는 동안은 차이가 드러나지 않는다. 단계 6에서 그 엔드포인트를 옮기거나, Rust 경로만 부르는 클라이언트가 생기면 연장을 Rust에 구현해야 한다.
4. **세션 쿠키 이름은 `NODE_ENV`를 따른다.** `production`이거나 비어 있으면 `__Secure-better-auth.session_token`만, 그 밖의 값이면 `better-auth.session_token`만 읽는다. `docker-compose.axum.yml`은 `NODE_ENV: production`을 넘기고, 평문 HTTP로 로컬 실행할 때는 `NODE_ENV=development`가 필요하다.
5. **TypeScript `readSignedObject`는 서명된 `../x` 키로 저장소 루트 밖의 파일을 읽는다.** 서명 비밀을 가진 쪽만 만들 수 있는 URL이고 앱은 그런 키에 서명하지 않는다. 이 전환에서 TypeScript는 고치지 않았다. Rust는 정리된 키를 읽으므로 그런 URL의 응답만 다르다. TypeScript 수정은 별도 과제로 남아 있다.
6. **Next는 라우트 핸들러 본문을 chunked로 보내고 `HEAD`에도 길이를 붙이지 않는다.** `Routes::add`가 설치하는 계층이 모든 네이티브 경로에 같은 동작을 주므로, 새 경로는 따로 할 일이 없다.
7. **DB가 연결을 거부할 때 Axum은 쿼리 하나당 최대 5초를 기다린다.** Next는 1초 안에 같은 응답을 낸다. 메인 풀의 연결 대기 한도를 30초에서 5초로 줄인 결과이고, 그 대가로 빈 연결을 5초 넘게 기다린 요청은 실패한다(node-pg 풀은 계속 기다린다). 메인 풀 크기(`AXUM_DB_POOL_MAX`, 기본 4)를 정할 때 함께 봐야 한다.
8. **R2 없이 로컬 디스크 저장소를 쓰면 두 컨테이너가 객체를 공유하지 않는다.** 기본 컴포즈 파일은 객체 디렉터리에 볼륨을 두지 않아 Next가 자기 컨테이너 안에 쓰고, Axum 컨테이너는 그 파일을 보지 못한다. 그래서 로컬 저장소일 때 `/api/media/signed`는 자기 디스크에서 못 찾은 객체를 Next에 넘긴다(볼륨은 건드리지 않았다). R2 값 네 개가 설정되면 두 서버가 같은 버킷을 읽으므로 해당 없다. 단계 3에서 업로드를 Rust로 옮기면 쓰는 쪽에 같은 문제가 생기므로, 그 전에 로컬 저장소의 공유 방식을 정해야 한다.
9. **Axum이 앞에 서면 헬스체크가 Next를 가려 버린다.** `app` 컨테이너의 컴포즈 헬스체크와 배포 스크립트의 게이트는 `/api/health`를 묻는데, 이 경로를 Axum이 DB만 보고 답하면 Next가 죽어 있어도 통과한다. 그래서 Axum의 헬스는 Next의 `/api/health`도 확인한다.
10. **Axum 컨테이너의 메모리는 256 MB다.** Next(2,816 MB)가 버티는 입력을 Axum은 버티지 못할 수 있다. 클라이언트가 고르는 값을 키로 쓰는 맵에는 상한을 두고, 객체나 본문은 통째로 메모리에 올리지 않는다. 새 경로를 옮길 때마다 같은 점검이 필요하다.

### 단계 5에서 확인할 것

운영 전환 전에 확인하거나 정해야 하는 것. 이 저장소 안에서는 확인하지 못했다.

- `scripts/deploy-oci.sh`: 컴포즈 파일 목록에 `docker-compose.axum.yml` 추가, `next` 서비스의 health로 게이트, Next 이미지를 빌드한 `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`을 Axum에 전달. 그 전까지는 손으로 켜려면 자동 배포를 멈춘다(2절 "운영").
- VM의 Docker Compose 버전. `docker-compose.axum.yml`의 `!override`·`!reset`과 `depends_on`이 있는 `extends`는 최근 버전이 필요하다. v5.5.0에서는 렌더링된다.
- `cpus: 0.25`. 모든 요청이 지나는 프로세스라 부하에서 스로틀될 수 있다. 측정하지 않았다.
- 종료 시간. 정상 종료는 열려 있는 스트림(채팅 응답 등)이 끝나기를 기다리므로 배포마다 `docker stop`이 유예 시간을 다 쓸 수 있다. 시험하지 않았다.
- 연결 예산. Next 10 + Axum 6 = 16에 워커·백업과 Postgres의 슈퍼유저 예약 3개를 더해 30 안에 드는지. 워커의 풀 크기는 확인하지 않았다.
- `service_role`의 `user`·`session` 읽기 권한. Rust의 세션 조회는 `service_role`로 돈다(better-auth는 로그인 롤로 돈다). 이 권한은 마이그레이션이 아니라 Next가 실행 중에 부여한다(`lib/auth/server.ts`). 권한이 없으면 세션 쿠키가 있는 요청은 전부 503이 된다(열리지 않고 닫힌다). 다음에 마이그레이션이 허용될 때 권한을 마이그레이션으로 옮기는 것이 낫다.
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
| 24 | 네이티브 응답은 Axum이 Next 빌드의 `RELEASE_SHA`·`NEXT_PUBLIC_SITE_URL`로 돌고 `CSP_ENFORCE`·`CSP_REPORT_URI`가 없을 때만 같다 | 수용, 단계 5의 요구사항 |
| 25 | 헤더가 100개를 넘는 요청은 431. Node는 2,000개까지 받는다. `axum::serve`에 설정이 없어 고치려면 hyper 연결 루프를 직접 써야 한다(하지 않기로 했다) | 수용 |
| 26 | 요청 헤더를 읽는 시간 제한이 없다. Node는 60초 뒤 끊는다. Caddy 말고 다른 것이 3000 포트에 닿을 때만 문제다 | 수용 |
| 27 | UTF-8이 아닌 요청 대상은 hyper가 400으로 답한다 | 수용 |
| 28 | `/llms.txt`의 「오늘의 랭킹」 링크 여부를 Axum이 따로 60초 보관한다. Next는 같은 판정을 랭킹 페이지·사이트맵과 한 변수로 함께 쓴다. 카탈로그가 바뀐 뒤 1분 안에는 두 서버의 답이 다를 수 있다 | 수용 |
| 29 | 그 판정에 Next는 「컴백」 목록도 읽지만 결과에 영향이 없어 Axum은 읽지 않는다(쿼리 하나 적다) | 수용 |
| 30 | 로케일 llms: Next는 색인 가능 밈 id 집합을 Data Cache에 1시간 두고 카탈로그 수정 때 비운다. Axum은 요청마다 다시 읽는다. 실리는 밈은 양쪽 다 현재 행으로 다시 검사하므로, 최근 1시간 안에 색인 가능해진 밈이 Axum에 먼저 실리는 것만 다르다. 요청당 DB 부하는 `/llms.txt`와 같은 수준(전체 후보 스캔)이다 | 수용 |
| 31 | Next의 Data Cache에 남은 id 집합이 있으면 Next는 그 읽기가 실패해도 목록을 낸다. Axum은 읽기가 실패하면 빈 목록을 낸다(둘 다 200) | 수용 |
| 32 | JSON 안의 타임스탬프 문자열을 Axum은 항상 UTC로 받는다(sqlx가 세션 시간대를 UTC로 고정). Next는 DB 기본 시간대를 따른다. `/{locale}/llms-full.txt`의 번역 갱신 시각 줄에만 드러나고, 이 저장소의 Postgres 기본값은 UTC라 지금은 같다 | 수용 |
| 33 | 날짜 문자열 해석: Postgres가 쓰지 않는 형태(없는 날짜 `2026-02-30`, 시간대 없는 시각)를 V8은 숫자로 읽고 Axum은 날짜가 아닌 것으로 본다. DB에서 온 값으로는 닿지 않는다 | 수용 |

## 6. 단계 2 진행: R1 (공개 텍스트 경로)

브랜치 `torisKR/axum-routes-r1`. 대상 8개 중 6개를 옮겼다. 검증은 같은 시드 DB에서 실제 Next와 바이트 단위로 비교했고(`server/parity/README.md` "Text routes"), `cargo test`는 Next가 낸 본문을 픽스처(`server/tests/fixtures/r1/`)로 들고 있다.

### 캐시와 `proxy.ts`

- 여섯 경로 모두 Next에서 `force-dynamic`이다. 프리렌더·ISR이 없고, 응답 헤더는 핸들러가 넣는 `Cache-Control: public, max-age=3600`(실패 시 `no-store` + `Retry-After: 300`)뿐이다. Axum도 요청마다 렌더링한다.
- `proxy.ts`의 첫 매처는 `.txt`·`.xml`로 끝나는 경로를 건너뛴다. 그래서 이 경로들에는 `proxy.ts`가 붙이는 `Content-Language`가 없고(llms는 핸들러가 직접 넣는다), 적용되는 것은 www 호스트의 301뿐이다. Axum은 www 요청을 Next로 넘긴다.
- Next는 이 경로들의 본문을 압축하지 않는다(630 KB인 `/llms-full.txt`도). Axum도 압축하지 않는다.

### 이식한 TypeScript 동작(버그 포함)

1. **로케일 llms의 번역 순서는 정해져 있지 않다.** `getLocalizedFeaturedMemes`가 `trend_score` 정렬을 임베드된 `memes` 행(한 행)에 걸어, 최상위 쿼리에는 `ORDER BY`가 없다. 「트렌드 상위」가 아니라 Postgres가 읽은 순서대로 실리고, `LIMIT`에 걸리는 번역도 그 순서로 정해진다. 같은 DB에서 ANALYZE 전후로 순서가 뒤집히는 것을 확인했다. Axum은 같은 SQL을 준비하지 않은 문장으로 보내 Next와 같은 계획·같은 순서를 얻는다.
2. **제한 공개(`limited`) 밈도 번역이 검수됐으면 로케일 llms에 실린다.** 한국어 내보내기는 `approved`만 싣는다.
3. **`/llms-full.txt`의 별칭 줄.** 별칭이 전부 공백이면 `- 별칭: ` 뒤가 빈 줄이 그대로 나간다.
4. **내보내기 한도.** 후보가 50,000행을 넘으면 한국어 내보내기 넷은 503이고, 로케일 llms의 색인 집합은 오류 없이 50,000행에서 멈춘다.

### 프록시로 남긴 경로

- **`/api/oembed`.** `reserve_oembed_request()`를 부르는데 이 함수를 만드는 마이그레이션이 없다(`lib/database.types.ts`와 라우트·테스트에만 이름이 있다). `db/migrations`로 만든 DB에서는 로그인 안 한 요청은 401, 로그인한 요청은 전부 429라서 성공 경로에 닿을 수 없다. `components/meme-embed.tsx`가 모든 방문자에게 이 경로를 부르므로 제품 버그일 가능성이 크다(운영 DB에 함수가 따로 있는지는 확인하지 않았다). 성공 경로의 동치(할당량 호출, 플랫폼 요청, Next의 1시간 fetch 캐시)를 실제 스키마로 증명할 수 없어 옮기지 않았다. 함수를 마이그레이션으로 넣을지, 할당량 호출을 뺄지를 먼저 정해야 한다.
