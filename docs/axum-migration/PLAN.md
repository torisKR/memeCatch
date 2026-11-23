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
- 연결 예산: Postgres `max_connections=30`. Next 풀 8 + 데드라인 풀 2, 워커·백업이 나머지를 쓴다. Axum 풀은 기본 4(`AXUM_DB_POOL_MAX`).
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
- 경로별 되돌리기: `AXUM_DISABLED_ROUTES=<경로 id,...>`에 적힌 경로는 Axum이 처리하지 않고 Next로 넘긴다. 재배포 없이 컨테이너 재시작으로 적용된다.

## 3. 단계

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 0 | Axum 크레이트, Next로의 스트리밍 리버스 프록시, DB 신원 계층, 헬스체크, 패리티 하네스, Docker·CI | 이번 작업 |
| 1 | R2/객체 저장소 + `/api/media/signed`, better-auth 세션 판독·운영자·크론 가드, 공개 읽기 경로 1차 | 이번 작업 |
| 2 | 나머지 공개 읽기 경로(llms.txt, 피드, oembed, 탐색 미리보기, 밈 카드, 퀴즈) | 대기 |
| 3 | 크론 경로, 미디어 업로드·MPE 업로드(R2 쓰기), 분석 이벤트, 운영자 API | 대기 |
| 4 | `proxy.ts` 로직(www 리디렉션, 로케일, 정규 URL 리디렉션, 소프트 404, 인증 게이트)을 Axum 미들웨어로 | 대기 |
| 5 | 운영 전환: 컴포즈·자동배포 에이전트 수정 | 사용자 승인 필요 |
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
