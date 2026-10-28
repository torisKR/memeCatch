# Laya 홈 검색·챗봇 로컬 연동 기록

- 작성일: 2026-10-19 (Asia/Seoul)
- 범위: 로컬 구현·검증만
- 운영 배포·운영 환경변수·DB 변경·계정 설정: 범위 밖

## 고정 계약

- 서버 전용 의도 분류 모델: `convaiinnovations/laya-free`
- API: `POST https://ai-gateway.vercel.sh/v1/evaluate`
- 제공자 제한: `providerOptions.gateway.only = ["boundless"]`
- 다른 모델·제공자로의 폴백: 없음
- 요청당 호출: 최대 1회, 자동 재시도 없음
- 애플리케이션 제한 시간: 2초
- 채택 기준: 선택 확률 `>= 0.8`, 1·2위 확률 차이 `>= 0.15`
- 자체 중단 시각: `2026-10-31T00:00:00+09:00`

마지막 시각은 공식 행사의 정확한 종료 시각이 공개됐다는 뜻이 아니라, 과금 전환 위험을 피하기 위한 밈캐치의 보수적인 자체 정책이다. 모델은 선택형 의도만 반환하며 검색 결과, 밈의 유래·유행·안전성, 공개 여부 또는 순위를 만들거나 결정하지 않는다.

## 환경과 데이터 경계

```dotenv
MEME_LAYA_ROUTING_ENABLED=false
AI_GATEWAY_API_KEY=
MEME_CHAT_GENERATION_ENABLED=false
```

- Vercel 배포는 서버에 자동 주입되는 `VERCEL_OIDC_TOKEN`을 우선 사용한다.
- 로컬·외부 런타임만 `AI_GATEWAY_API_KEY`를 서버 환경에 주입한다. `NEXT_PUBLIC_` 변수나 브라우저 번들에 키를 넣지 않는다.
- Laya에는 한국어 명시적 제출의 길이를 제한한 현재 질문과 언어만 보낸다. 계정·고객지원·결제 정보, 대화 이력, 첨부 파일은 보내지 않는다.
- 개인정보나 제공자 정책상 금지된 내용이 의심되면 외부 분류를 생략한다. 이 사전 필터가 모든 민감정보를 탐지한다고 보장하지 않는다.
- 새 의도 분류 운영 로그에는 질문 원문을 남기지 않고, 고정된 분류·결과 수·오류 코드만 기록한다. 기존 서비스 전체에 질문 원문 로그가 전혀 없다고 주장하지 않는다.
- 모델·제공자의 무보관, 학습 미사용 또는 ZDR을 보장하지 않는다. 공개 모델 정보와 각 제공자 약관을 기준으로 안내한다.
- 인스턴스 메모리 기반 호출 제한은 최선 노력의 로컬 제한이며 전역 할당량으로 표현하지 않는다.
- 공유 Laya 제한은 클라이언트별 10분당 5회, 인스턴스별 1분당 20회다. 클라이언트 제한 키는 서버 안에서 해시하며 제공자에게 보내지 않는다. 제한에 걸려도 기존 검색은 유지한다.
- Laya 프로모션은 모델 호출에 관한 조건이다. Vercel 실행, 데이터베이스, 로그 등 기존 인프라 비용까지 무료라는 의미는 아니다.

## 기능 저하와 롤백

- 키 없음, 인증 실패, 429, 2초 초과, 낮은 확률, 응답 스키마 오류, 의미 검색 미준비 또는 자체 중단 시각 이후에는 기존 이름·별칭 검색과 등록 자료 기반 답변을 사용한다.
- 한국어 이외 언어는 기존 검색·챗봇 경로를 유지한다.
- 롤백은 `MEME_LAYA_ROUTING_ENABLED=false`로 수행한다. 이때 `MEME_CHAT_GENERATION_ENABLED=false`를 유지해도 공개 밈 검색 결과와 등록된 요약은 계속 제공해야 한다.
- 일반 `laya`나 유료 모델을 대신 호출하는 폴백, 자동 충전, 유료 부가 기능은 이 작업에서 설정하지 않는다.

## 검증 상태

아래 표는 2026-10-19 로컬 실행 결과다. 단위 테스트의 모의 응답을 실제 Laya 분류 정확도로 계산하지 않았다.

| 항목 | 상태 | 증거 |
| --- | --- | --- |
| 서버 분류기·스키마·오류 폴백 구현 | 로컬 테스트 통과 | 고정 모델·제공자, 비용 0 메타데이터, 채택 확률·차이, 입력 차단, 401/429/시간 초과/중단/무료 종료 검증 |
| 홈 명시적 제출 연결 | 로컬 테스트·UI 통과 | 입력·SSR·재마운트 무호출, 30초 일회성 제출 신호, 기존 GET URL, 한국어만 신호 생성 |
| 등록 자료 기반 챗봇 연결 | 로컬 테스트·UI 통과 | 뜻·유래·사용법·상황, 공개 상태 재확인, 출처, 취소·스트리밍 회귀; 생성은 명시적 true일 때만 허용 |
| 환경변수 예시와 개인정보·약관 고지 | 로컬 테스트 통과 | `.env.example`, `/privacy`, `/terms`; 서버 전용 키·전송 범위·무보관 미보장 고지 |
| 로컬 의미 검색 준비 | 로컬 HTTP·UI 통과 | 기존 17개 로컬 벡터와 번들 ONNX 재사용, 기존 검색 RPC 마이그레이션 1개만 로컬 DB 적용; 의미 검색 HTTP 200/hybrid 확인 |
| 합성 질문 50건 정확도 90% 이상 | 미검증 / 활성화 보류 | 50개 수동 라벨 합성 질문과 opt-in 평가기 구현. 실제 모델 채택 0건이므로 정확도 산출 불가 |
| 실제 AI Gateway 인증·Boundless 라우팅 | 실패 / 활성화 보류 | 기존 OIDC 만료, API 키 미설정. 1건 합성 호출 HTTP 실패; 성공 모델·제공자·비용 메타데이터 없음 |
| 모바일·키보드 UI | 로컬 UI 통과 | 390×844, 문서·본문 너비 390px, 홈 Enter 제출, 챗봇 실제 답변, Escape 닫기·열기 버튼 포커스 복귀 |
| 모션 감소 | 컴포넌트 테스트 통과 / 브라우저 설정 검증 미실행 | 브라우저 도구가 미디어 설정 변경을 제공하지 않음. OS 설정을 변경하지 않음 |
| 관련 회귀 테스트 | 통과 | 22개 파일 중 21개 통과·live 평가 1개 skip; 453 tests passed / 1 skipped |
| 타입 검사·대상 ESLint·diff 검사 | 통과 | `tsc --noEmit --incremental false`, 대상 파일 ESLint, `git diff --check` |
| 프로덕션 빌드 | 로컬 DB 기준 통과 | webpack 컴파일·타입 검사·정적 페이지 116/116·빌드 종료 코드 0. 운영 배포는 아님 |
| 운영 환경변수·배포·운영 요청 | 미실행 | 이번 범위에 포함하지 않음 |

실제 Gateway 요청을 검증하지 못한 상태에서는 “코드 구현 완료”와 “실서비스 연동 검증 완료”를 같은 의미로 보고하지 않는다.

실제 인증을 갱신하려는 전체 `vercel env pull`은 불필요한 다른 개발 시크릿까지 복제하므로 보안 승인에서 차단되어 실행하지 않았다. 이를 우회하지 않았다. 후속 검증에는 범위를 좁힌 OIDC 갱신 또는 서버에 안전하게 주입된 Gateway 키가 필요하며, 키를 채팅이나 저장소에 붙여넣지 않는다. `MEME_LAYA_ROUTING_ENABLED=false`를 유지한다. 무료 모델 공개 카탈로그의 가격 0 확인은 성공한 분류 요청이나 비용 검증을 대신하지 않는다.

### 로컬 실행에서 확인한 범위와 한계

- 실행 주소: `http://127.0.0.1:3024/`.
- 기존 로컬 Supabase DB/REST/Auth/Kong 컨테이너만 시작했다. 운영 DB 또는 다른 프로젝트 DB는 변경하지 않았다.
- 기존 `supabase/migrations/20261004002839_meme_reference_search_rank.sql`을 로컬 DB에만 적용했다. 새 운영 마이그레이션이나 콘텐츠 덮어쓰기는 없다.
- 상황 질문 API는 로컬 공개 카탈로그의 하이브리드 결과를 반환했고, 이름 검색과 뜻·유래 답변도 HTTP 200으로 확인했다. 로컬 개발 seed가 포함된 데이터이며 운영 콘텐츠의 품질·검색 순위 개선이나 전체 의미 검색 정확도를 검증했다는 뜻은 아니다.
- 실제 UI의 뜻 답변은 등록된 요약과 일치했다. 합성 질문만 사용했으며 생성 모델은 호출하지 않았다. 원문·날짜·영상 검증·유행·안전 상태를 새로 생성하거나 변경하지 않았다.
- 실제 UI에서 거대한 이름 검색 0건 패널이 하이브리드 결과 위를 가리는 문제를 발견해 작은 ‘이름·별칭 일치 없음’ 안내로 교체했다. 다국어 화면에는 상황 검색 가능성을 주장하지 않는다.
- 최종 로컬 IAB 흐름의 브라우저 warn/error 로그는 0건이었다. 앞선 별도 Aside 세션에서는 기존 analytics 요청의 로컬 JWT 오류(`PGRST301`) 1건이 관찰됐다. 모든 로컬 환경의 계측이 정상이라고 확대 해석하지 않는다.
- 일반 환경의 첫 빌드는 실행 환경에서 원격 Supabase DNS 접근에 실패했다. 이후 기존 개발 환경의 로컬 Supabase 설정을 프로세스에 주입한 프로덕션 빌드가 통과했다. `metadataBase` 미설정과 기존 편집 추천 로컬 쿼리 경고가 남아 있다. 이 결과는 운영 DB 연결이나 운영 빌드 환경의 성공을 검증한 것이 아니다.
- 캡처: `artifacts/laya/20261019/mobile-search.jpg`, `mobile-chat.jpg`.

## 데이터 흐름

```text
홈/검색 화면의 명시적 한국어 제출
  → 일회성 제출 신호 → 기존 semantic-search API
  → 공개 이름 검색 → 정확한 이름 일치면 그대로 반환
  → 공통 분류기(무료 opt-in·입력·언어·인증·기한·호출 제한)
  → 고정 선택값만 사용 → 기존 의미 검색 RPC 또는 이름 검색 폴백
  → 공개 DTO·기존 SQL 순위 → 기존 검색 화면의 카드

챗봇 현재 질문
  → 같은 검색·분류기(한 번) → 공개 상태 재확인
  → 등록된 요약/유래/사용 설명/주의점으로 짧은 답·상세 링크 구성
  → 기존 NDJSON 진행·취소·출처 계약 유지
```

상세 URL·canonical·JSON-LD·VideoObject·영상 공개/임베드 검증·검수·사용 안전 신호·Life signal 구현은 이번 기능에서 변경하지 않았다. 기존 관련 회귀 테스트도 함께 실행했다.

## 실제 변경 파일

기존 미커밋 작업이 많은 `main`을 유지했다. 아래는 이번 기능의 편집 범위이며, 다른 변경을 이 기능의 변경으로 집계하거나 되돌리지 않는다.

- 공통 분류·평가: `lib/meme-intent.ts`, `lib/meme-intent.server.ts`, `lib/meme-intent.server.test.ts`, `lib/meme-intent-evaluation.ts`, `lib/meme-intent-evaluation.test.ts`, `lib/meme-intent-evaluation.live.test.ts`.
- 검색 서비스/API: `lib/meme-vectors.ts`, `lib/meme-reference-search.server.ts`, `lib/meme-reference-search.server.test.ts`, `app/api/memes/semantic-search/route.ts`, `app/api/memes/semantic-search/route.test.ts`.
- 홈·검색 UI: `components/home/home-search.tsx`, `components/home/home-search.test.tsx`, `components/home/home-experience.tsx`, `components/home/home-experience.test.tsx`, `lib/home-copy.ts`, `lib/home-copy.test.ts`, `lib/meme-intent-submit.client.ts`, `lib/meme-intent-submit.client.test.ts`, `components/meme-reference-search.tsx`, `components/meme-reference-search.test.tsx`, `app/(default)/search/search-input.tsx`, `app/(default)/search/search-input.test.tsx`, `app/(default)/search/page.tsx`, `app/(default)/search/page.render.test.tsx`, `app/[locale]/search/page.tsx`, `app/[locale]/search/page.render.test.tsx`, `app/[locale]/search/page.test.ts`.
- 챗봇: `lib/meme-chat.server.ts`, `lib/meme-chat.server.test.ts`, `lib/meme-chat.ts`, `lib/meme-chat-copy.ts`, `components/meme-chatbot.tsx`, `components/meme-chatbot.test.tsx`, `app/api/memes/chat/route.ts`, `app/api/memes/chat/route.test.ts`.
- 설정·고지·기록: `.env.example`, `app/(default)/privacy/page.tsx`, `app/(default)/privacy/page.test.tsx`, `app/(default)/terms/page.tsx`, `app/(default)/terms/page.test.tsx`, 이 운영 기록과 로컬 검증 캡처.

## 실행·평가 재현

기존 개발 환경을 유지하고 다음 프로세스 전용 설정으로 실행했다. 새 비밀키나 `.env` 값을 저장하지 않았다.

```sh
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3024 \
MEME_CHAT_GENERATION_ENABLED=false MEME_LAYA_ROUTING_ENABLED=false \
MEME_SEMANTIC_SEARCH_ENABLED=true MEME_EMBEDDING_RUNTIME=bundled \
MEME_EMBEDDING_URL=http://127.0.0.1:3024/v1/embeddings \
pnpm exec next dev --webpack --hostname 127.0.0.1 --port 3024
```

추가로 기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, 번들 임베딩 내부 인증용 `CRON_SECRET` 설정을 재사용한다. 값은 출력하지 않는다. 새 임베딩 모델 다운로드나 의존성 설치는 없었다.

유효한 좁은 범위의 인증이 안전하게 준비된 이후에만 다음 평가를 실행한다. 이 명령은 실제 외부 요청을 하며 합성 질문 50개를 최소 3.1초 간격으로 사용한다. 평가기는 모델 응답이 0건이면 통과하지 않고, 전체 50건 미완료 또는 채택 정확도 90% 미만이면 활성화를 승인하지 않는다. 결과에는 질문·키·원시 제공자 응답을 기록하지 않는다.

```sh
MEME_LAYA_LIVE_EVAL=true pnpm exec vitest run lib/meme-intent-evaluation.live.test.ts
```

## 롤백

- 기능 중지: `MEME_LAYA_ROUTING_ENABLED=false` 유지/설정. 유료 생성 경로도 원치 않으면 `MEME_CHAT_GENERATION_ENABLED=false` 유지.
- 운영에는 아무것도 배포하지 않았으므로 운영 롤백은 필요 없다.
- 로컬에서는 이번 제출 신호·분류 옵션 없이도 기존 GET 검색과 제작 참고 검색의 호출 계약이 유지된다.
- DB 함수는 기존 검색용 비파괴 함수이며 이번 작업에서 새 테이블·콘텐츠를 만들지 않았다. 기존 콘텐츠나 다른 미커밋 변경을 삭제하는 롤백을 실행하지 않는다.

## 공식 참고 자료

- [Vercel AI Gateway Decision API](https://vercel.com/docs/ai-gateway/modalities/decision)
- [Laya 무료 제공 공지](https://vercel.com/changelog/laya-decision-model-now-available-on-ai-gateway-free-through-october-31)
- [Vercel AI 제품 약관](https://vercel.com/legal/ai-product-terms)
- [Boundless 이용약관](https://inference.boundless.network/terms)
