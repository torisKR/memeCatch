# 홈 검색·자료 기반 챗봇 선택 배포 — 2026-10-19 KST

## 승인과 경계

최신 직접 사용자 요청 “Vercel에 너가 직접 진행해주고 배포까지 진행해줘”에 따라 이번 검색·챗봇 기능의 웹 배포와 사후 검증을 수행한다. 이전 로컬 전용 제한은 이 웹 배포에 한해 갱신됐다. DB 쓰기·콘텐츠 승인·영상 업로드·새 API 키·결제·유료 설정 변경은 포함하지 않는다.

- Vercel 플러그인의 팀 조회는 빈 목록, 프로젝트 배포 조회는 해당 scope 403이었다. 같은 팀/프로젝트를 지정한 기존 CLI 인증은 정상 동작했다. 다른 계정/프로젝트로 바꾸지 않았다.
- 팀: `team_oPZMzjgHthJ47mXr8qra27Zg` / `ironjustlikethatgmailcoms-projects`.
- 프로젝트: `prj_fWt03H8a0rZtoDuCxczV7NhM4OEd` / `memecatch`.
- 배포 전 운영: `dpl_G2mQDPdqQ6J6w7uHkJv92Ecrfvof`, `schema-video-dfd210e89545`.
- 미커밋 변경이 많은 루트 `main`은 보존하며, 루트 전체를 업로드하지 않는다.

## 선택 배포 입력

이전 `/private/tmp` 운영 동결본은 사라져 Vercel의 현재 배포 `src` 파일 목록과 파일 SHA-1을 기준으로 다시 복원했다. 1,807개 파일 중 로컬에서 해시가 동일한 1,688개만 재사용하고, 나머지 119개는 같은 배포의 읽기 전용 파일 API로 가져와 해시를 확인했다. 환경변수 값을 내려받지 않았다.

- 유일한 배포 입력: `/private/tmp/memecatch-laya-build.MAbO2e`.
- SOURCE: `/private/tmp/memecatch-laya-source.qmfDUk` — 검증 전용, 배포하지 않음.
- 릴리스: `laya-routing-42610f71ce36`.
- BUILD 지문: 1,819개 항목 / SHA-256 `42610f71ce362b2d62486f6a976a540989c0bf6ab123e3880371a31109d280a2`.
- 선택 델타: 41개 경로. `artifacts/release/20261019-laya/assembly/candidate2/changed-files.txt` 참조.
- `assembly/candidate/`는 실패한 중간 진단이다. **최종 입력과 근거는 `assembly/candidate2/`만 사용한다.**

홈은 승인된 단일 검색창 계약을 유지하도록 조립했다. 기존 운영 `HomeDiscovery`의 두 번째 검색 폼만 제거하고 카테고리·덱은 유지했다. 운영 CSS 전체를 미커밋 버전으로 교체하지 않고 새 홈 검색에 필요한 15개 클래스만 병합했다. 상세 UI·JSON-LD·영상 공개 검증·전역 셸·결제·관리자·수집 워커 변경은 포함하지 않는다.

## Vercel 인증 보완

공식 Vercel 문서의 빌드/함수 런타임 차이에 맞춰 API Route에서 `VERCEL === "1"`일 때만 `x-vercel-oidc-token`을 서버 내부 컨텍스트에 전달한다. 16 KiB 초과·제어문자·본문의 위조 값은 무시한다. 분류기는 요청 토큰을 로컬/빌드 환경 토큰보다 우선한다. 토큰은 응답·NDJSON·운영 분류 로그에 넣지 않는다.

전체 `env pull` 및 `env run`은 다른 비밀까지 노출할 수 있어 실행하지 않았다. 새 Gateway API 키를 만들지 않았다. 대신 검증된 배포 소스 안의 opt-in 평가기를 배포 빌드에 주입된 기존 OIDC로 실행하도록 배포 전용 설정을 사용한다.

## 활성화 정책

- 런타임 `MEME_LAYA_ROUTING_ENABLED=false`.
- 런타임 `MEME_CHAT_GENERATION_ENABLED=false`.
- 기존 웹 릴리스 보호 값 `SOURCE_REFRESH_ENABLED=false`, `SOURCE_REVIEW_ATOMIC_ENABLED=true` 유지.
- 프로젝트 공용 환경변수를 추가·수정하지 않고 이 배포의 build/runtime override만 지정한다.
- 배포 전용 `buildCommand`: 합성 1문항 smoke → smoke가 채택 응답을 얻은 경우만 전체 50문항 평가 → 기존 프로덕션 빌드.
- 평가 실패 시에도 웹은 플래그를 끈 채 빌드할 수 있지만, 이를 모델 인증·정확도 성공으로 보고하지 않는다. 평가 로그를 별도 확인하고 활성화 여부를 판정한다.
- 무료 모델 `convaiinnovations/laya-free`, `only: ["boundless"]`, 2초, 재시도 없음, 비용 0 메타데이터 검사, 자체 종료 시각을 유지한다. 배포 직전 공개 모델 카탈로그 HTTP 200과 input/output 가격 0을 재확인했다.
- `--prod --skip-domain`으로 먼저 배포한다. READY·HTTP 검증 후 같은 배포를 승격한다. `--skip-domain`은 운영 대상 배포의 생성이며 로컬 검증으로 표현하지 않는다.

## 배포 전 증거

- 최종 조립본: Vitest 22개 파일 중 21개 통과·live 평가 1개 skip, 450 tests passed / 1 skipped.
- 최종 조립본 전체 TypeScript와 대상 ESLint 통과.
- 검증 전후 immutable BUILD 지문 동일.
- OIDC 추가 부분은 루트 6개 파일 251개 테스트 통과, 별도 검토에서 인증/비노출 경계 확인.
- 배포 전 운영 의미 검색은 합성 상황 질문에 HTTP 200/hybrid/3개 공개 결과를 반환했다. 이 관찰은 기존 순위의 정확도나 개선을 보장하지 않는다.

## 운영 결과

### 첫 배포와 실제 Gateway 시험

- `dpl_B2UnbQKSV7dQQkfuvBVxBYTrXbPU` / `laya-routing-42610f71ce36`.
- 웹 빌드 완료: 2026-10-19 09:01:43 UTC, Vercel 배포 완료 09:03:05 UTC.
- 도메인 미연결 HTTP 8건 통과 후 09:11:35 UTC(18:11:35 KST)에 운영 승격했다. 공개 도메인 HTTP 8건도 통과했다.
- 이름 검색 2건/keyword, 상황 질문 3건/hybrid, 자료 기반 챗봇 응답, 약관·개인정보 고지 및 상세 2개를 확인했다.
- 도마도마·새삥 지코 상세는 기존 `Organization`, `WebPage`, `DefinedTerm`, `BreadcrumbList`를 유지했고 `VideoObject`는 0건이다. 이 검사는 실제 영상 공개·재생 검증을 새로 완료했다는 뜻이 아니다.

빌드 내부 Gateway 합성 1문항은 `http_error`, 채택 0건으로 실패했다. 전체 50문항은 실행하지 않았다. 실제 HTTP 상태와 오류 원인은 집계 로그로 확정할 수 없으며 모델·제공자·비용 응답도 검증하지 못했다. Vercel의 웹 READY와 실제 Laya 연동 성공을 구분한다. 따라서 Laya와 생성 모델은 계속 비활성화한다.

프로젝트 Gateway Logs 화면은 로그인 상태가 아니었다. Vercel의 표준 Google 로그인 전환은 자동 보안 검토에서 계정 로그인 권한 미확인을 이유로 차단됐다. 다른 브라우저·CLI 등으로 이 거절을 우회하지 않는다. 기존 `ironjustlikethat@gmail.com` 계정의 Vercel 로그인과 로그 읽기만 별도 질문으로 요청했다. 새 키·권한·결제 설정은 만들지 않는다.

### 실제 UI 검증에서 발견한 챗봇 모호성

`새삥 뜻`이 [`새삥 챌린지`](https://catchmeme.com/memes/gat35546-%EC%83%88%EC%82%A5-%EC%B1%8C%EB%A6%B0%EC%A7%80)와 [`새삥 챌린지 (지코)`](https://catchmeme.com/memes/89b37mrx-%EC%83%88%EC%82%A5%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20(%EC%A7%80%EC%BD%94)) 중 첫 항목을 단정적으로 답하는 회귀를 발견했다. 해당 첫 항목의 BE'O·이영지 요약은 공개 출처 제목의 Zico와 맞지 않는 기존 콘텐츠 품질 문제다. 이번 작업에서 운영 DB를 수정하거나 중복을 병합하지 않았다. 중복 병합/분리와 기존 요약 교정은 별도 콘텐츠 검수가 필요하다.

`meaning`·`origin`·`usage`의 보수적인 질문 접미사만 제거해 subject를 확인하고, 전체 제목 또는 제목-prefix가 유일할 때만 해당 필드를 답하도록 로컬에서 수정했다. 모호하거나 일치하지 않으면 고정 안내와 공개 카드 최대 3개를 반환하며 생성 모델을 호출하지 않는다. 특정 밈 ID 하드코딩·검색 순위 변경은 없다.

추가 수정은 candidate2 불변 BUILD에 아래 두 파일만 덧댄 candidate3이다.

- SOURCE: `/private/tmp/memecatch-laya-chatfix-source.vVCdgy` — 검증 전용.
- BUILD: `/private/tmp/memecatch-laya-chatfix-build.SbyUpj` — 후속 배포 입력.
- 릴리스: `laya-chatfix-0dae4504ca23`.
- 1,819개 항목 / SHA-256 `0dae4504ca23796656f7e3825471f965adfdd668856d99af7b0b98032d9f7206`.
- 정확한 델타: `lib/meme-chat.server.ts`, `lib/meme-chat.server.test.ts`.
- 455 tests passed / 1 live evaluation skipped, 전체 TypeScript·대상 ESLint 통과, 검증 전후 BUILD 지문 동일.

교정 배포 `dpl_6VNcGNmQ5Xt8aFXossTYPX6arxhg`를 09:19:23 UTC에 `--skip-domain`으로 생성했다. 일반 프로덕션 빌드는 09:20:52 UTC에 완료됐다. 실제 HTTP 9건 검증과 승격 결과는 아래에 실행 후 기록한다. candidate3에서는 이미 실패한 Gateway 요청을 반복하지 않고 일반 웹 빌드만 수행한다.

교정본 코드와 릴리스 게이트는 별도 검토에서 actionable P1/P2 0건으로 승인됐다. 검토자가 챗봇 111개 테스트·전체 TypeScript·대상 ESLint·배포 스크립트 구문 검사를 재실행해 통과했다. 이는 실제 Gateway 활성화 승인이 아니다.

### 최종 운영 상태

- 최종 배포: `dpl_6VNcGNmQ5Xt8aFXossTYPX6arxhg`, READY.
- 최종 릴리스: `laya-chatfix-0dae4504ca23`.
- 운영 URL: https://catchmeme.com/.
- 교정 배포 URL: https://memecatch-b9aepqgx2-ironjustlikethatgmailcoms-projects.vercel.app.
- 도메인 미연결 HTTP 9건 모두 통과: 2026-10-19 09:23:56 UTC.
- 운영 승격/프로젝트·alias 확인: 09:24:23 UTC(18:24:23 KST).
- 운영 도메인 HTTP 9건 모두 통과: 09:25:18 UTC.
- `새삥 뜻`: 고정된 모호성 안내와 공개 후보 2개, 특정 요약을 단일 답으로 단정하지 않음.
- `새삥 챌린지 (지코) 뜻`: 해당 공개 항목 1개, 등록 summary와 답변 일치.
- 이름 검색·상황 의미 검색·약관·개인정보·상세 2개와 기존 JSON-LD 유지 확인.
- 실제 브라우저에서도 최종 홈과 모호성 안내를 확인했고, 수집된 콘솔 error/warn은 0건이었다.
- `MEME_LAYA_ROUTING_ENABLED=false`, `MEME_CHAT_GENERATION_ENABLED=false` 유지. 실제 Gateway 성공·50문항 정확도·실제 모델/제공자/비용 응답은 **미검증**이다.
- DB·콘텐츠 승인/수정·영상 업로드·결제/유료 설정·새 API 키 변경 0건. 기존 dirty `main`과 무관한 변경은 보존했다.

최종 근거는 `artifacts/release/20261019-laya/deployment/correction/`의 `staged-deployment.json`, `staged-http-checks.json`, `promotion-result.json`, `live-http-checks.json`이다. 첫 배포의 Gateway 실패 증거는 상위 `deployment/gateway-preflight.json`에 별도로 보존했다. 전체 변경 경계는 candidate2의 41개 경로와 candidate3의 정확한 2개 교정 델타로 확인할 수 있다.

### UI 검증 범위와 제한

첫 배포의 실제 브라우저에서 홈의 단일 검색창·상황 검색 카드·챗봇 진행/응답·Escape 닫기와 실행 버튼으로의 초점 복귀를 확인했다. 관찰한 콘솔 error/warn은 0건이었다. 브라우저에 남은 번체 중국어 UI 선호는 화면의 언어 선택으로 한국어로 맞췄다.

390×844 viewport override를 요청했으나 현재 in-app browser 문서의 실제 폭은 638px로 측정됐다. 따라서 이 실행을 390px 모바일 통과로 보고하지 않는다. 모션 감소의 실제 브라우저 에뮬레이션도 지원 확인이 되지 않았으며, 관련 회귀 테스트 통과와 실제 디바이스/설정 검증을 구분한다.

## 보안 주의

프로젝트 상세 API를 한 번 비필터 조회했을 때 응답에 기존 자동화 보호 우회 설정 값이 포함되어 도구 기록에 노출됐다. 값을 이 문서·코드·아티팩트로 복사하지 않았고 다시 출력하지 않는다. 이후 관리 API 응답은 필요한 비민감 필드만 선별한다. 기존 자동화에 영향을 줄 수 있어 임의 폐기/회전하지 않았으며, 소유자가 기존 우회 값의 교체 필요성을 검토해야 한다.

## 롤백

새 웹 릴리스에 문제가 있으면 기존 READY 배포 `dpl_G2mQDPdqQ6J6w7uHkJv92Ecrfvof`를 같은 프로젝트에서 promote하고 `catchmeme.com` alias·릴리스 헤더·검색 응답을 재확인한다. DB 쓰기가 없으므로 역마이그레이션은 필요하지 않다. 이 절차는 아직 롤백을 실행했다는 뜻이 아니다.

## 공식 참고

- [Vercel Decision HTTP API](https://vercel.com/docs/ai-gateway/modalities/decision)
- [Vercel OIDC 인증](https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc)
- [Vercel 배포 승격](https://vercel.com/docs/deployments/promoting-a-deployment)
