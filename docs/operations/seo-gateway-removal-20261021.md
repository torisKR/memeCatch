# SEO 정합성 수정과 AI Gateway 제거 — 2026-10-21

## 범위와 상태

대상은 catchmeme.com 프로젝트다. 기존 main 브랜치의 미커밋·미추적 변경을 보존하면서 이번 패치만 로컬에서 구현·검증했다. 운영 배포, 운영 DB 변경, 콘텐츠 일괄 수정, 새 크롤링, 영상 업로드, API 키 발급·회전·삭제, 결제·운영 플래그 변경은 하지 않았다.

정리 계획은 (1) Gateway 호출 제거와 기존 검색·자료 답변 보존, (2) 실제 크롤 오류를 회귀 테스트로 재현한 뒤 최소 수정, (3) 화면·구조화 데이터·사이트맵의 공개 조건 일치, (4) 독립 리뷰와 로컬 검증 순서였다. Product/Article 경고를 줄이기 위해 실제 문서 종류와 다른 스키마를 추가하지 않는다.

## 읽기 전용 진단 근거

- Ahrefs 기존 보고서: `https://app.ahrefs.com/site-audit/10225686/overview`. Health 95, AI Discoverability 83, machine readability 55. 1,774 URL 중 오류 URL 80개, 오류 발생 83건. 월간 크롤 크레딧 소진으로 최신 크롤은 미완료 상태였다. 새 크롤·내보내기·업그레이드는 실행하지 않았다.
- orphan 76개와 단일 내부 링크 271개가 보고됐다. 탐색 화면의 첫 24개 이후 접근이 클라이언트 무한 스크롤에 의존하고 `/timeline`, `/weekly` 등의 일반 링크가 부족했다.
- `Product schema` 누락 490개의 확인한 샘플은 밈 용어 문서였다. `Article` 누락 31개 샘플에는 언어별 홈·편집 정책도 포함됐다. 샘플 분류 오류와 실제 스키마 오류를 분리하며, 전체 490/31개를 전수 판정했다고 주장하지 않는다.
- 500 샘플은 `%`가 들어간 `2% 부족할 때` 계열 상세 2개였다. 현재 운영 로그에서 `failed to decode param`을 확인했다. 운영 오류를 로컬에서 재현 가능한 입력 경계로 좁혔으며, 운영 수정 완료로 간주하지 않는다.
- Schema.org 오류 11개는 커뮤니티 `DiscussionForumPosting.interactionStatistic.interactionType`의 타입 경고였다. 샘플의 LikeAction을 명시적 Action 객체로 바꿨다.
- `/memes/mahkwnk5-따봉`은 기존 보고서에서 sitemap 안의 `noindex` URL이었다. 기존 sitemap은 원시 source/media를 세고, 상세는 공개 미디어 필터 이후의 신호를 세는 불일치가 있었다.
- H1 누락 3개는 `/community/new`, `/products/new`, `/products/mine` 로그인 전용 페이지였다. 가짜 H1을 추가하는 대신 인증·색인 경계를 수정했다.

## 변경 내용

### AI Gateway 제거

- `classifyMemeIntent()`에서 원격 모델 호출, Gateway 인증·타임아웃·응답 파서·모델 선택을 제거했다. 제한된 로컬 힌트만 반환하며 `source: "fallback"`만 허용한다.
- 기존 이름·초성·별칭 검색, 공개 자료 조회, 기존 의미 검색 인터페이스, 취소·스트리밍 계약을 유지한다. 별도 생성 모델을 활성화하지 않았다. 이미 존재하던 다른 선택적 임베딩·관리자 AI 공급자는 삭제 대상이 아니다.
- 검색/챗 API에서 Gateway OIDC 전달을 제거했다. 이전 환경변수가 남아 있더라도 분류기 `fetch`가 0회임을 테스트한다.
- 홈·검색·챗 안내와 약관·개인정보처리방침에서 제거된 공급자 전송 안내를 정리했다. 호스팅·다른 기존 처리 목적까지 없어진 것처럼 설명하지 않는다.
- `.env.example`에서 `AI_GATEWAY_API_KEY`, `MEME_LAYA_ROUTING_ENABLED`를 제거했다. 실제 환경 파일과 Vercel 팀 키·계정은 변경하지 않았다.
- 챗봇 최종 조회도 공통 공개 출처 필터와 밈별 delivery 판정을 재사용한다. private/unlisted/removed 및 자체 제작 출처가 답변 카드의 원본 출처로 다시 나오는 것을 방지한다. 원장 실패를 삭제 증거로 취급하지 않는 기존 정책을 유지한다.

### 크롤·구조화 데이터

- 탐색에 서버 렌더 페이지 창과 실제 이전/다음 링크를 추가하고, 다음 무한 스크롤 시작 offset을 해당 페이지 뒤로 맞췄다. 검색 RPC 50건 제한, 검수·언어 조건을 유지한다. locale 탐색의 기존 후보 상한 1,200건도 유지한다.
- 기본 탐색의 페이지별 canonical과 CollectionPage JSON-LD를 일치시켰다. 필터·검색 변형은 noindex,follow이며 해당 CollectionPage JSON-LD를 중복 출력하지 않는다. 잘못된 페이지 번호와 범위 밖 요청은 메타데이터와 본문이 같은 정규화 결과를 사용한다.
- `%25`가 포함된 상세 문서 경로는 공개 존재 확인 후 안전한 ASCII 내부 alias로 rewrite한다. 브라우저 주소·공유 URL·저장 slug·정상 canonical을 바꾸지 않는다. 없는 문서의 404도 유지한다.
- rewrite 전후 다른 pathname으로 발생하던 로그인 링크 hydration 불일치도 수정했다. 상세의 첫 HTML은 동일 문서의 short-ID 경로, 마운트 후는 실제 경로를 사용한다. 일반 페이지의 무JS 복귀 경로는 보존한다.
- 커뮤니티 LikeAction을 `{ "@type": "LikeAction" }`로 표현한다. 반응 0건을 포함한 실제 수치는 그대로다.
- 사이트맵과 상세는 공개 설명 정리본·원본 출처·렌더 가능 미디어의 동일 입력을 사용한다. 자체 제작·비공개·삭제·임베드 불가 미디어 때문에 화면에서 noindex가 된 문서를 raw DB 점수로 사이트맵에 남기지 않는다.
- 공개 산문·태그만으로 통과하는 문서는 원장 조회를 생략한다. 경계 문서만 DB 페이지별 묶음으로 확인한다. 공통 helper의 내부 한도는 ID 200개, legacy TikTok 25개 단위, 최대 3개 병렬 lane이며 helper 1회가 DB 요청 1회를 뜻하지 않는다.
- 관계 DTO는 상세와 같은 `meme_sources(*)`, `meme_contents(*)`를 서버 내부에서만 읽는다. 선택적 제작 마이그레이션 컬럼이 없는 구형 로컬 스키마에서도 조회가 42703으로 깨지지 않으며, sitemap에는 적격 URL만 직렬화한다.
- 로그인 전용 3개 경로는 proxy에서 익명 요청에 명시적 307을 반환하고 페이지 metadata에 noindex,follow를 설정한다. 상품 수정 복귀 쿼리는 중복 없는 유효 UUID `edit`만 허용한다.

### 상세 응답 경로

- metadata/본문 사이 동일 DTO의 공개 미디어 조회를 React request cache로 공유한다. 사용자 간 영구 상세 캐시를 새로 만들지 않는다.
- 독립적인 원장 조회 lane과 상세 관련 조회를 병렬화했다. 기존 실패 시 임베드 차단과 공개 조건을 완화하지 않는다. 운영 TTFB 개선 폭은 아직 측정하지 않았다.
- `VideoObject`의 `privacy_status === "public"` 및 `public_embed_verified === true`, 유효한 영상 metadata 조건을 유지했다. 로컬 샘플에 검증된 제작 영상이 없으므로 VideoObject 0개가 정상이다. 이 작업은 실제 공개 영상 재생 검증 성공을 주장하지 않는다.

## 실제 변경 파일

아래 목록은 이번 패치가 다룬 경로다. 파일 전체가 이번 작업의 신규 변경이라는 뜻은 아니며 기존 dirty 변경을 포함한 파일을 통째로 되돌리면 안 된다.

- 공통 분류: `lib/meme-intent.ts`, `lib/meme-intent.server.ts`, `lib/meme-intent.server.test.ts`, `lib/meme-intent-evaluation.ts`, `lib/meme-intent-evaluation.test.ts`, `lib/meme-intent-evaluation.live.test.ts` (이제 오프라인 검증).
- 검색/챗 서버: `lib/meme-reference-search.server.ts`, `lib/meme-reference-search.server.test.ts`, `lib/meme-chat.server.ts`, `lib/meme-chat.server.test.ts`, `app/api/memes/chat/route.ts`, `app/api/memes/chat/route.test.ts`, `app/api/memes/semantic-search/route.ts`, `app/api/memes/semantic-search/route.test.ts`.
- 검색/챗 UI: `components/home/home-search.tsx`, `components/home/home-search.test.tsx`, `components/home/home-experience.test.tsx`, `components/meme-reference-search.tsx`, `components/meme-reference-search.test.tsx`, `components/meme-chatbot.tsx`, `components/meme-chatbot.test.tsx`, `lib/meme-chat-copy.ts`, `app/(default)/search/page.tsx`, `app/(default)/search/page.render.test.tsx`.
- 고지/환경 예시: `app/(default)/privacy/page.tsx`, `app/(default)/privacy/page.test.tsx`, `app/(default)/terms/page.tsx`, `app/(default)/terms/page.test.tsx`, `.env.example`.
- 탐색: `app/(default)/explore/page.tsx`, `app/(default)/explore/page.test.tsx`, `components/explore-grid.tsx`, `components/explore-grid.test.tsx`, `app/[locale]/explore/page.tsx`, `app/[locale]/explore/page.test.tsx`, `lib/explore-pagination.ts`, `lib/explore-pagination.test.ts`, `lib/localized-explore.ts`, `lib/localized-explore.test.ts`, `lib/i18n-global-explore.ts`.
- 상세/출처: `lib/sources/public-links.server.ts`, `lib/sources/public-links.server.test.ts`, `app/(default)/memes/[key]/page.tsx`, `app/(default)/memes/[key]/page.test.ts`, `app/[locale]/memes/[key]/page.tsx`, `app/[locale]/memes/[key]/page.test.ts`.
- 스키마/사이트맵: `components/json-ld.tsx`, `components/json-ld.test.tsx`, `app/sitemap.ts`, `app/sitemap.test.ts`.
- 경로/인증: `proxy.ts`, `proxy.test.ts`, `components/auth-menu.tsx`, `components/auth-menu.test.tsx`, `lib/safe-redirect.ts`, `lib/safe-redirect.test.ts`, 3개 로그인 전용 페이지와 각각의 `page.test.ts`.
- 기존 UI 회귀 기대 정합성: `app/layout.test.tsx`, `components/source-provenance.test.tsx`, `components/adsense-script.test.tsx`, `components/premium/global-daily-challenge.test.tsx`. 구현을 예전 장황한 UI로 되돌리지 않고, 접힌 통합 메뉴·실제 자료 수집일·공개 입력 광고 판정·빈 시장 정보 미노출을 검증하도록 테스트만 갱신했다.

## 검증과 한계

- 최종 전체 테스트: **465개 파일, 4,088개 통과, 6개 건너뜀**. `pnpm exec tsc --noEmit` 통과. `pnpm lint`는 오류 0개·경고 7개(이미지 최적화·기존 artifact의 미사용 import). 소스·스키마·영상 공개 조건 관련 별도 8개 파일 225개 테스트도 통과했다.
- 최종 `pnpm build` 종료 코드 0, 컴파일·타입 검사·116개 정적 페이지 생성 완료. 빌드에는 `metadataBase` fallback 경고와 운영 원장/홈 추천 조회 실패 진단이 남았다. 이 환경에서의 빌드 성공을 운영 서비스-role 연동·운영 원장 재검증 성공으로 표현하지 않는다.
- 독립 리뷰에서 발견된 3개 항목(무JS 로그인 복귀, 챗 출처 상태, 원장 호출 범위)은 수정 후 재리뷰에서 해소 판정을 받았다.
- 실제 로컬 HTTP: `/sitemap.xml` 200·48 URL, 이름 검색 200, 인코딩된 `%` 상세 200·정상 제목·리다이렉트 없음, 챗 200·retrieved·등록 항목 1개, 로그인 전용 3개 경로 307 확인.
- 범위 밖 탐색 페이지는 Next의 streaming redirect 한계로 AhrefsSiteAudit/Googlebot/Chrome 모두 200 + meta refresh가 남는다. 다만 이제 canonical은 정상화된 실제 페이지를 가리키고 robots는 noindex,follow이므로 요청한 잘못된 번호가 색인 대상으로 남지 않는다. 정상 base 페이지의 canonical·index,follow·CollectionPage URL은 서로 일치한다. 307을 만들기 위한 전역 metadata blocking이나 proxy DB 조회는 추가하지 않았다.
- Aside 실제 화면: Tab 이동, 홈 Enter 검색 결과 3개, 챗 등록 자료 답변, 상세 링크 이동을 확인했다. 화면의 WebPage/DefinedTerm 제목·요약이 일치하고 VideoObject가 없음을 확인했다. 브라우저 네트워크 이벤트 수집은 빈 결과여서 Gateway 무호출의 근거로 쓰지 않는다. 대신 코드·API 회귀 테스트에서 원격 분류 호출 제거를 확인했다.
- 모바일 390px와 OS reduced-motion 브라우저 설정은 해당 Aside 제어 표면에서 지원되지 않아 실제 UI 재검증을 완료하지 못했다. 관련 기존 컴포넌트 계약을 변경하지 않았다는 테스트와 실제 단말/브라우저 검증은 구분한다.
- 로컬 DB의 제작 영상 공개 projection은 미설치 상태다. 해당 경로는 fail-closed이며 운영 DB 마이그레이션으로 해결한 것처럼 보고하지 않는다.
- 이번 작업에서 Google 리치 결과 테스트를 새로 실행하지 않았다. 로컬 JSON-LD 파싱·타입·공개 영상 gate 회귀와 Google 외부 검증 완료는 구분한다.
- 로컬의 기존 service-role 설정이 현재 로컬 DB와 맞지 않아, 이번 dev 프로세스에만 `supabase status`의 현재 로컬 자격을 전달했다. 새 키를 만들거나 환경 파일에 비밀을 쓰지 않았다. `localhost:3025`로 확인하며 `127.0.0.1` 주소에서는 기존 출처 검사로 POST가 403이 될 수 있다.
- 운영 공개 카탈로그는 anon 읽기 전용으로 4,394행을 확인했다. raw depth 통과 452행 중 공개 산문·태그만으로 통과 12행, 원자료 의존 경계 440행·source/content 행 2,344개였다. DB 페이지별 경계 행은 5/46/257/85/47개다. 이는 후보 분포 확인이지 공개 원장 조회 완료나 전체 sitemap 생성 시간 측정이 아니다.
- Ahrefs 새 크롤을 돌리지 않았으므로 83개 오류 소멸·점수 상승·검색 노출 개선을 주장하지 않는다. 특히 문서 종류 오분류 경고를 점수만을 위해 가짜 Product/Article로 없애지 않는다.

## 스케줄·비용·롤백

- 새 스케줄러·모델·유료 기능은 없다. 기존 sitemap 재생성 1시간, 상세 10분, DB 목록 페이지 상한과 기존 source helper 배치 한도를 유지한다. Gateway/Laya 분류 호출 비용은 이 애플리케이션 코드에서 제거됐다. 기존 DB·Vercel·다른 선택적 공급자 비용까지 없어진다는 뜻은 아니다.
- 배포하지 않았으므로 운영 롤백 작업은 필요 없다. 기존 배포와 운영 플래그는 그대로다.
- 로컬 SEO 패치를 되돌려야 하면 위 경로의 이번 변경 hunk만 검토해 역적용한다. dirty worktree 전체 `reset`, `checkout`, 파일 단위 `restore`는 금지한다. Gateway 제거와 공개 영상 검증 게이트는 SEO 롤백과 분리해서 유지한다.
- Gateway를 다시 켜는 숨은 대체 모델·환경 플래그는 남기지 않았다. 예전 환경변수를 true로 바꾸는 것만으로 원격 분류가 재개되지 않는다.

## 공식 기준

- https://schema.org/interactionType — 기대 타입 Action.
- https://developers.google.com/search/docs/appearance/structured-data/product — 실제 상품 문서에 맞는 구조화 데이터.
- https://developers.google.com/search/docs/appearance/structured-data/article — 실제 기사 콘텐츠에 맞는 구조화 데이터.
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies — 화면·본문과 일치하는 표현.
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable — 일반 링크로 콘텐츠에 접근 가능해야 함.
- 현재 설치된 Next.js 16.3.4의 metadata/proxy/caching 문서를 구현 기준으로 사용했다. Google 문서의 InteractionCounter 예시가 문자열 URL을 사용하는 것과 Ahrefs의 Schema.org range 경고는 구분하며, 기존 표현이 모든 Google 검증에서 실패한다고 주장하지 않는다.
