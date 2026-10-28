# 한국어 우선 검색·인용·게시자 검수 정합성 — 2026-10-21

## 범위

이번 작업은 기존 밈캐치의 검색·상세 URL, 공개·검수 상태, 사용 안전 신호, Life signal, 영상 검증 조건을 유지하면서 **로컬 구현·테스트**를 수행한다. 기존 `main`의 미커밋·미추적 변경을 보존한다. 운영 배포, 운영 DB·환경변수 변경, 마이그레이션, 콘텐츠 일괄 수정, 새 광고 활성화, 광고 클릭, 영상 업로드, 재심사 제출, 유료 서비스 추가는 하지 않는다.

AI Gateway 제거는 앞선 [작업 기록](seo-gateway-removal-20261021.md)의 로컬 변경을 유지한다. 이전 Laya 환경변수를 다시 설정해도 원격 분류를 재개하지 않는다. 다른 기존 선택적 임베딩·관리자 공급자까지 제거됐다는 의미는 아니다.

## 구현 계약

### 독립적인 세 가지 판정

1. **공개 화면·색인 적합성**: 기존 공개 검수 상태와 내용 깊이 조건을 적용한다. 원본 출처와 실제 공개 가능한 미디어를 같은 delivery projection으로 계산한다. 자체 제작 해설 영상을 원본 출처나 유래 근거로 세지 않는다.
2. **사람의 게시자 검수**: 기존 `admin_audit_log`에 별도 검수 증거를 기록한다. 공개 승인, 글 길이, 링크 유무만으로 독창성·안전성·저작권·AdSense 적합성을 인증하지 않는다. 관리자 화면의 판정은 진단이며 공개·색인·광고 플래그를 변경하지 않는다.
3. **광고·계정 자격**: 운영 계정의 정지·심사·사이트 준비 상태와 광고 audience/runtime gate는 별개다. 이 패치는 정지 해제나 합격을 보장하지 않으며 광고를 켜지 않는다.

### 데이터 흐름

```text
공개 상태의 기존 밈 + 출처 + 콘텐츠
  → 묶음 public-media 조회 (실패 시 검증 미완료 자료를 허용하지 않음)
  → 원본 출처 / 공개 콘텐츠 / 자체 제작 해설 구분
  → 화면과 동일한 공개 설명·내용 깊이 판정
  → 상세·검색·탐색·사이트맵·RSS·AI용 텍스트

운영자 체크리스트 + 화면에서 본 문서 fingerprint
  → 서버 운영자 재확인 + 현재 문서 재조회
  → fingerprint 일치 확인
  → 기존 audit log에 검수 증거만 추가
  → 문서·날짜·출처·권리·안전 상태가 바뀌면 이전 검수는 오래됨
```

### 한국어와 크롤러

- `/`는 언어 헤더와 관계없이 한국어 대표 홈이다. 언어 선택과 기존 명시적 다국어 URL은 유지한다.
- 번역 상세는 검수되고 원문 개정과 맞으며 실제 공개할 내용이 있는 번역만 발견 경로에 넣는다. 한국어를 `x-default`로 둔다.
- 검색·사용자 요청 기반 열람 봇은 공개 URL을 허용하고 관리자·로그인 전용 경로는 차단한다. 학습 목적의 GPTBot, ClaudeBot, CCBot, Google-Extended는 분리해 차단한다. `robots.txt`는 접근 제어가 아니므로 기존 인증을 유지한다.
- Google-Extended는 Google Search/AI Overviews 접근을 제어하는 토큰은 아니지만 일부 Gemini grounding 사용에도 영향을 줄 수 있다. ‘학습만 막고 모든 AI 인용은 보장’한다고 표현하지 않는다. [Google 크롤러 안내](https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)
- `llms.txt`는 보조 공개 문서이며 Google·다른 답변 엔진의 인용이나 순위를 보장하지 않는다. [Google AI 기능 안내](https://developers.google.com/search/docs/appearance/ai-features)

### 상세와 구조화 데이터

- 첫 화면은 한 줄 뜻과 핵심 맥락 위주로 유지한다. 모바일 DOM에서는 사용 예·주의 맥락을 미디어보다 먼저 읽는다. 긴 유래와 근거는 기본 접힌 네이티브 `<details>`로 제공하며 내용은 서버 HTML에 남긴다.
- 외부 확산 관찰이 오래되면 현재 급상승이 아니라 **마지막 확산 관찰 / 상승 관찰 기록**으로 표시한다. 내부 조회·저장은 외부 SNS 전체 유행의 근거가 아니다.
- `WebPage`·`DefinedTerm`·`BreadcrumbList`를 실제 화면에 맞춘다. 밈 용어에 가짜 `Product`, 상품 가격, 리뷰, `FAQPage`를 추가해 경고 수만 줄이지 않는다.
- 자체 제작 `VideoObject`는 `privacy_status === "public"`, 정확한 불리언 `public_embed_verified === true`, 유효한 동일 영상 ID·썸네일·메타데이터가 모두 있어야 출력한다. 테스트 fixture를 실제 공개·재생 검증 기록으로 저장하지 않는다. [Google 구조화 데이터 정책](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)

## 읽기 전용 표본 진단

`scripts/publisher-readiness-pilot.mts`는 공개 anon 자격으로 최대 두 번의 제한된 GET만 수행한다. 우선 확인 대상은 새삥(`89b37mrx`)과 도마도마(`2au7br9f`), 이후 최근 공개 문서다. 최대 20건이며 부족해도 예시를 넣지 않는다. 원자료 재생·사실 확인이나 사람 검수를 대체하지 않는다.

- 초기 운영 공개 표본: 20건. 두 우선 대상 모두 포함. 본문 보완 진단 13건, 안전성 검수 시각 미확인 19건, 권리·전달 방식 보완 1건. 새 진단 형식의 사람 검수 증거는 20건 모두 미확인이다. 이는 이전에 사람이 아무 검수도 하지 않았다는 단정이 아니다.
- 로컬 공개 seed 표본: 17건뿐이다. 운영의 두 우선 대상은 없으며, 로컬 fixture와 운영 실자료를 구분한다.
- 이 숫자는 전체 사이트나 AdSense 판정이 아니라 **사전 분류 결과**다. 검수 도구 보완 이후 최종 결과와 검증 로그를 함께 확인해야 한다.
- 보고서의 `humanReviewCompleted`, `sourcePlaybackVerified`, `accountApprovalVerified`, `writesPerformed`는 모두 `false`다.

환경변수는 기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 읽는다. 비밀·service-role 자격은 파일럿에서 거부한다. 셸에 준비된 올바른 환경에서 다음처럼 실행한다. 기존 보고서 파일을 덮어쓰지 않는다.

```bash
node scripts/publisher-readiness-pilot.mts --local-read --out .local/publisher-local-new.json
# 공개 운영 DB를 읽는 경우에만 명시적으로 선택:
node scripts/publisher-readiness-pilot.mts --public-read --out .local/publisher-public-new.json
```

## 일정·비용·운영 조건

- 새 모델·패키지·작업 큐·스케줄러·유료 서비스를 추가하지 않는다. 기존 DB와 캐시 재생성 비용은 남는다.
- 검수 페이지는 기존 100행 목록과 최신 audit 1,000행 상한을 유지한다. 공개 요청에서 관리자 검수 로그를 조회하지 않는다.
- 한국어 AI 텍스트 export는 기존 페이지당 1,000행, 총 50,000 후보 상한과 미디어 helper 내부 묶음 한도를 유지한다. 다국어 추천·커버리지 조회는 200행 단위로 필요한 적격 항목 수 또는 실제 마지막 페이지까지 확인한다. 꽉 찬 50,000행 상한은 거짓 빈 목록 대신 조회 불가로 처리한다. 조회 실패를 정상적인 빈 코퍼스 200으로 숨기지 않는다.
- 한국어 홈의 외국어 alternate 확인은 요청 안에서 중복 제거되지만, 운영 실카탈로그에서의 cold-cache 응답 시간과 원장 내부 batch 수는 이번 로컬 테스트로 입증하지 않았다. 새 운영 활성화 전에 별도 계측한다.
- 새 환경변수는 없다. `ADSENSE_AUTO_ADS_ENABLED=false`, `MEME_CHAT_GENERATION_ENABLED=false`로 로컬 검증한다. 운영 환경 파일·Vercel 설정은 그대로 둔다.
- 계정 정지 기간에는 사이트 리뷰가 일시 중지될 수 있다. 이 코드 작업은 계정 정지를 해결하지 않는다. 앞선 계정 읽기에서 확인한 상태와 오늘의 코드 검증은 구분한다. [AdSense 계정 정지 안내](https://support.google.com/adsense/answer/2659114)
- ‘몇 글자/몇 게시물 이상이면 합격’ 같은 Google의 고정 기준을 만들지 않는다. 독자적 설명·정확한 근거·실제 사용자 가치와 계정 정책 준수를 별도로 확인한다. [AdSense 사이트 준비 안내](https://support.google.com/adsense/answer/7299563)

## 검증 상태

### 코드·빌드

- 최종 전체 회귀: `pnpm exec vitest run --maxWorkers=2` → **470개 파일, 4,178개 통과, 6개 건너뜀**. 초기 기본 병렬 실행의 9개 시간 초과는 같은 테스트를 제한 병렬도로 재실행해 모두 통과했으며, 테스트 timeout을 늘려 숨기지 않았다.
- `pnpm exec tsc --noEmit` → 통과. 빌드에서 잡힌 테스트 fixture의 빈 배열/`null` 추론 오류 4곳을 정확한 fixture 타입으로 보완한 뒤 다시 확인했다.
- `pnpm lint` → 오류 0, 기존 경고 7개(이미지 최적화와 기존 artifact의 미사용 import). 최종 추가·수정 QA/fixture 파일의 scoped ESLint도 통과했다.
- `pnpm build` → 종료 코드 0, 컴파일·타입 검사·116개 정적 페이지 생성 완료. 다른 정적 경로의 기존 `metadataBase` fallback 경고 및 빌드 중 홈 조회 경고 1건은 남았다. 실제 로컬 REST 홈 쿼리는 200/6행이고, 홈에는 적격 카드 3개가 표시됐다. 빌드 성공을 운영 DB·원장 연동 성공으로 확대하지 않는다.
- Node QA 회귀: `node --test scripts/qa-publisher-pages.test.mjs scripts/qa-meme-cards.test.mjs` → **29개 통과**. CDP 대기 조건은 HTMLElement를 직렬화하지 않고 불리언으로 평가한다.
- `git diff --check` → 통과. 공개 projection과 검수 액션의 독립 재검토에서 보고된 차단 항목은 수정 후 해소 판정을 받았다.

### 실제 로컬 브라우저

- 격리 Chrome 프로필, 광고 host와 모든 비읽기 요청을 전송 전에 차단했다. 사용자 기존 프로필·광고 클릭은 사용하지 않았다.
- 홈·가이드·소개·탐색·릭롤 시드 상세를 320×568, 375×812, 390×844(reduced motion), 1440×900에서 확인했다. **20개 화면 모두** HTTP 200, 단일 H1, 가로 넘침 없음, 광고 스크립트 0개였다.
- 상세는 사용 예가 미디어보다 앞서고 유래·자료가 처음에 접혀 있었다. 키보드 Enter로 두 자료 영역을 열고 출처 링크에 초점을 옮겼다. reduced-motion 설정 일치, 상세 실행 중 애니메이션 0개를 확인했다. JavaScript 비활성화 상태에서도 제목·요약·JSON-LD가 남았다.
- **브라우저 종합 진단은 완전 통과가 아니다.** 기존 개발 서버 `127.0.0.1:3025`에서는 runtime/network/control 오류가 0개였지만, 로컬 DB의 제작 영상 공개 projection 미설치에 따른 서버 콘솔 오류 4개가 상세에 전달됐다. 미검증 영상은 계속 차단된다. 이 경고를 무시해 합격 처리하거나 로컬/운영 마이그레이션을 적용하지 않았다.
- 로컬 DB를 붙인 프로덕션 모드 `127.0.0.1:3026`에서는 기존 프로덕션 CSP가 localhost DB 클라이언트 연결을 막는다. 이를 실제 운영 버그로 단정하거나 프로덕션 CSP를 느슨하게 바꾸지 않았다. 개발 UI 검증과 프로덕션 빌드·스키마 검증을 구분한다.
- JavaScript를 의도적으로 끈 단계에서만 발생하는 **정확히 Script 유형 + 빈 오류 문자열**은 별도의 `expectedNoJsScriptBlocks`에 기록한다. 다른 스크립트·Document·XHR·유의미한 오류는 여전히 실패다.
- 기존 `Permissions-Policy tools` origin-trial 경고와 개발용 reduced-motion 안내가 남아 있다. 실제 환경의 모든 콘솔이 깨끗하다고 주장하지 않는다.

주요 증거는 `.local/seo-readiness-20261021/`에 있다:

- `public-pilot-final.json`, `local-pilot-final.json`
- `dev-browser/publisher-page-qa-x9J69q/report.json` — 개발 UI/상세 20화면과 알려진 projection 경고
- `browser/publisher-page-qa-P0so18/report.json` — 프로덕션 모드/로컬 DB CSP 제한 포함

### Google 코드 모드와 영상 gate

- 3026 빌드의 실제 JSON-LD 4개와 화면 제목·요약만 Google Rich Results Test **코드 모드**에 제출했다. localhost URL 테스트나 공개 배포를 하지 않았다.
- [최종 코드 모드 결과](https://search.google.com/test/rich-results/result?id=6Ew4gXrZUQ1ooPuo5BPHlg): **유효한 탐색경로 1개, Organization 1개**, 선택적 로고 URL 경고 없음. `WebPage`/`DefinedTerm`이 지원 리치 결과 목록에 없다는 것을 스키마 오류로 취급하지 않는다.
- 화면의 제목·요약과 WebPage/DefinedTerm이 일치했다. canonical과 Organization 로고는 실제 사이트 도메인을 가리켰다. 처음 기존 개발 서버의 localhost 로고에서 난 경고와 이 최종 결과를 구분한다.
- 시드 상세의 `VideoObject`와 iframe은 모두 0개였다. 공개 임베드가 없어 **실제 공개 영상 재생 성공은 미검증**이다. 정상/비정상/비공개/검증 불리언 위조/다른 영상 metadata에 대한 gate는 회귀 테스트로 검증했다. fixture를 운영 재생 증거로 저장하지 않았다.
- 운영 URL의 Google 재크롤·색인·리치 결과 노출, Search Console 성과, AdSense 합격은 이번 로컬 결과로 입증하지 않는다.

## 주요 변경 파일

아래는 이번 작업에서 다룬 경로다. 이미 다른 변경이 들어 있던 파일 전체를 이번 작업으로 간주하지 않는다. 같은 경로의 테스트도 함께 보완했다.

| 영역 | 구현 경로 |
| --- | --- |
| 한국어 대표 홈·번역 커버리지 | `proxy.ts`, `app/(default)/page.tsx`, `app/[locale]/page.tsx`, `lib/i18n-routing.ts` |
| 원본·번역 공개 projection | `lib/publication-export.ts`, `lib/meme-translations.ts`, `lib/localized-explore.ts`, `lib/home-editorial.server.ts` |
| 발견·인용 문서 | `app/sitemap.ts`, `app/robots.ts`, `app/feed.xml/route.ts`, 기본·다국어 `llms.txt` / `llms-full.txt` route, `lib/publication-markdown.ts` |
| 상세·설명·메타데이터 | 기본·다국어 `app/.../memes/[key]/page.tsx`, `app/(default)/about/page.tsx`, `components/meme-external-trend-evidence.tsx` |
| 운영자 진단·검수 | `lib/publisher-readiness.ts`, `lib/publisher-readiness.server.ts`, `lib/actions/publisher-readiness.ts`, `app/(default)/admin/publisher-readiness/page.tsx`, 같은 폴더의 `review-form.tsx` |
| 재실행 가능한 검증 | `scripts/publisher-readiness-pilot.mts`, `scripts/qa-publisher-pages.mjs`, `components/adsense-runtime.test.tsx`, 관련 회귀 테스트 |

기존 `components/json-ld.tsx`의 엄격한 `VideoObject` gate와 광고 runtime 구현은 완화하지 않았다. 이번 작업의 새 회귀 테스트와 브라우저 검증으로 계약을 확인한다.

## 롤백과 공개 전 남은 일

- 새 운영 배포나 마이그레이션이 없으므로 운영 롤백은 필요 없다.
- 로컬에서 되돌릴 때는 이번 변경 hunk만 검토해 역적용한다. 기존 dirty 파일 전체 `reset`/`checkout`/`restore`를 하지 않는다. AI Gateway 제거와 기존 공개 영상 검증 gate를 부수적으로 되돌리지 않는다.
- 운영 적용은 별도 승인 후 범위를 정해 수행한다. 실제 사용자에게 공개하기 전, 운영의 번역·공개 미디어 원장·성능을 별도로 확인한다.
- 표본 20건은 원자료·맥락·권리·안전·독자적인 설명을 운영자가 각각 검토해야 한다. 도구가 자동 승인하거나 내용을 일괄 덮어쓰지 않는다.
- 광고는 계정/사이트 자격과 제외 경로·운영자 차단·SPA 이동·동의 처리를 확인한 뒤 별도 판단한다. 실제 광고 클릭으로 테스트하지 않는다.
