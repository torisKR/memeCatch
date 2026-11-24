# 화면 계층과 인증을 Rust로 옮기는 계획

작성 2026-11-24. `PLAN.md`의 단계 6(인증)·7(화면)에 해당한다. 기준 커밋 `origin/main` 4f8609c19.
숫자는 전부 이 저장소에서 다시 만들 수 있다: 재고는 `inventory/inventory.mjs`, 동치는 `server/parity/pages/pages.mjs`.

## 1. 결론

- **렌더링 방식: 서버가 완성된 HTML을 내는 템플릿(Maud) + 페이지당 작은 스크립트 하나.** 브라우저에 WebAssembly를 보내지 않는다.
- 두 파일럿(`/about`, 한국어 `/memes/[key]`)을 이 방식으로 만들었고, 실제 Next와 같은 DB에서 **상태·리디렉션·헤더·`<head>`·JSON-LD·본문 글자·링크·이미지·`<main>` 마크업이 일치**한다(42개 요청, 5절).
- 실험실 측정에서 Axum 쪽이 나쁜 지표는 없었다. `/about`: LCP 1.54초 → 0.91초, 자바스크립트 351 KB → 4.4 KB(전송 기준).
- **브라우저 쪽 동작은 Rust가 되지 않는다.** 메뉴·폼·퀴즈 같은 동작은 프레임워크 없는 자바스크립트로 다시 쓴다. "전부 Rust"를 브라우저 안까지 뜻한다면 Leptos islands가 차선이고, 그 값은 3절에 적었다.
- 페이지는 **기본으로 꺼져 있다**(`AXUM_PILOT_ROUTES`로만 켜진다). B0에서 모든 페이지가 쓰는 틀(헤더 메뉴·언어 선택·계정 메뉴·하단 내비·챗봇·설치 안내 등)이 Axum 페이지에서 Next와 같이 동작하게 됐고, 브라우저로 누르며 비교하는 동작 게이트가 생겼다(5.1절). 밈 문서는 아직 "유래" 절까지만 그린다.

## 2. 재고 조사

표 전체는 `inventory/`에 있다(`pages.md`, `client-components.md`, `third-party.md`, `server-dependencies.md`, `auth.md`, `batches.md`). 아래는 요약이다.

| 항목 | 수 | 비고 |
| --- | --- | --- |
| 페이지 (`app/**/page.tsx`) | 66 | 요청 시 렌더 46, 정적 12, ISR 4(3,600초 3개·86,400초 1개), 경로별 정적 생성 4 |
| 색인 대상 | 38 | 항상 색인 28, 문서별 판정 10(`/memes/[key]`, `/[locale]/*`, `/rankings` 등). 나머지: robots.txt 차단 23(운영자 20·`/login`·`/my`·`/submit`), noindex 5 |
| 클라이언트 컴포넌트 | 121개 24,517줄 | `useState` 76개, `useEffect` 54개. 500줄 이상 8개(퀴즈 759, 임베드 748, 탐색 그리드 703, 내 정보 609, 제보 폼 602 등) |
| 그중 어느 페이지도 쓰지 않는 것 | 12 | `ui/carousel`(embla), `ui/live-caret-input`(703줄), `trending-carousel` 등. 옮기지 않는다 |
| 레이아웃이 모든 페이지에 얹는 클라이언트 컴포넌트 | 14 | 헤더·메뉴·언어 선택·계정 메뉴·하단 내비·챗봇·PWA 설치·내비 진행 표시 등 |
| 서버 액션 | 파일 15개, 함수 58개 | `"use server"`로 시작하는 파일 기준 |
| 라우트 핸들러 | 53 | 이 중 7개가 이미 Axum |
| 쿼리 플래너 호출 | `.from("…")` 254곳, `.rpc(` 86곳, 파일 109개 | 플래너 자체는 `plan.ts` 428줄 + `execute.ts` 796줄 |
| `next/cache` | `unstable_cache` 3곳, `revalidateTag` 12곳, `revalidatePath` 62곳 | 태그 2개: `public-meme-catalog`, `public-social-platform-counts` |
| `next/og` 이미지 | 파일 4개 | 밈 공유 카드, 기본 카드, 퀴즈 카드, 카드 내보내기 |
| i18n 사전 | 파일 12개 2,729줄 | 화면 언어 19개, 번역 문서 언어 4개(en·ja·zh·zh-tw) |
| 임베딩 모델 | 파일 1개 | `lib/meme-embedding-runtime.server.ts` |

### 브라우저에서 도는 서드파티 코드

| 무엇 | 어디서 | Rust 페이지에서 |
| --- | --- | --- |
| `motion` | 파일 15개, 레이아웃을 통해 64개 페이지 | CSS 애니메이션·전환으로 바꾼다(파일럿의 정답 카드가 그렇게 돼 있다) |
| `lucide-react` | 파일 9개 | 템플릿 안의 인라인 SVG(파일럿에서 그대로 옮김) |
| `three` | 파일 2개, 홈만 | 홈에서만 늦게 불러오는 스크립트로 남긴다. 정지 이미지로 바꿀지는 홈을 옮길 때 정한다 |
| `react-markdown`(+remark 2개) | 파일 1개, 페이지 1개 | 서버에서 Markdown을 HTML로 바꾼다(Rust 크레이트 추가가 필요하다) |
| `embla-carousel-react` | 쓰지 않는 `ui/carousel`뿐 | 버린다 |
| `next/link`·`next/navigation` | 파일 38·40개 | 보통 `<a>`와 전체 페이지 이동. 클라이언트 라우터는 두지 않는다 |
| Google Analytics | 루트 레이아웃 | **Rust가 될 수 없다.** gtag 스크립트를 `async`로 그대로 불러온다(파일럿 구현) |
| AdSense 로더 | 충실한 밈 문서 | **Rust가 될 수 없다.** 서버가 "광고 가능"만 표시하고 스크립트가 운영 호스트에서만 로더를 붙인다(파일럿 구현, 운영 호스트에서는 미확인) |
| 서비스 워커(Serwist) | `app/sw.ts` | **Rust가 될 수 없다.** Next가 사라질 때 손으로 쓴 작은 `sw.js`(오프라인 화면·아이콘)로 바꾼다. 그때까지는 Next의 `/sw.js`를 그대로 프록시한다 |
| YouTube·TikTok·Instagram 임베드 | `meme-embed` 등 | iframe은 그대로다. 포스터는 서버가 그리고, 누르면 iframe으로 바꾸는 스크립트만 둔다 |

### 인증 (better-auth 1.7.20)

이메일·비밀번호(인증 메일 필수, 최소 12자, 가입 뒤 자동 로그인 없음), 비밀번호 재설정, Google, Kakao(`genericOAuth`), TikTok(자체 경로 + 매직 링크), 가입 전후 훅(차단 도메인, 프로필 동기화), 메일 발송 웹훅. 비밀번호 해시는 두 가지다: 이전 저장소에서 온 bcrypt(`$2a$`·`$2b$`·`$2y$`)와 better-auth의 scrypt. 테이블 `user`·`session`·`account`·`verification`은 마이그레이션이 아니라 better-auth가 실행 중에 만든다(열 목록은 `inventory/auth.md`). 브라우저가 직접 부르는 엔드포인트는 `/api/auth/get-session`과 `/api/auth/sign-in/social`이고, 나머지는 서버 액션이 `auth.api.*`로 부른다.

## 3. 결정과 근거

후보 넷을 같은 기준으로 봤다. 측정한 것과 문서에서 읽은 것을 구분해 적는다.

| 기준 | **템플릿(Maud) + 스크립트** | Askama 템플릿 | Leptos SSR (islands) | Dioxus fullstack |
| --- | --- | --- | --- | --- |
| 크롤러가 받는 HTML | **측정**: `<main>`이 요소 단위로 Next와 같다. 메타데이터는 항상 `<head>` | 같을 수 있다(미측정) | 섬마다 `<leptos-island>` 요소가 끼고, 기본값인 순서 없는 스트리밍은 자바스크립트가 있어야 조각이 제자리에 온다. 메타 태그를 `<head>`에 두려면 `async` 모드가 필요하다(문서) | 하이드레이션용 데이터를 HTML에 함께 싣는다. 섬 방식이 아니라 "CSR 기본" 쪽이라고 문서가 밝힌다 |
| 페이지당 WebAssembly | **0** | 0 | **측정**: 버튼 하나짜리 섬이 wasm 86.0 KB(brotli 31.9 KB) + 글루 JS 22.3 KB(brotli 4.3 KB). 문서의 탭 예제는 약 200 KB | **측정**: 버튼 하나가 wasm 394.4 KB(brotli 137.0 KB) + JS 97 KB. 문서의 TodoMVC는 최적화 후 234 KB |
| 페이지당 자체 JS | **측정**: 5.1 KB(gzip 4.4 KB) 한 파일 | 같다 | 위 글루 + 섬 코드 | 위 |
| TSX를 기계적으로 옮기기 | Next가 실제로 낸 HTML을 Maud 소스로 바꾸는 스크립트(`html-to-maud.mjs`, 86줄)로 정적 마크업을 만든다. 조건·반복은 손으로 | HTML을 그대로 붙여 넣을 수 있어 변환기가 필요 없다. 대신 컴포넌트 조합이 함수가 아니라 매크로·include다 | `view!`가 JSX와 가장 비슷하다. 훅은 시그널로 다시 써야 한다 | `rsx!`. 훅 이름이 비슷하지만 다시 써야 한다 |
| Tailwind 4·기존 CSS | **측정**: `app/globals.css`를 고치지 않고 같은 컴파일러(4.3.3)로 Rust 소스를 훑어 60.7 KB(brotli 10.9 KB). Next는 `/about`에 146.6 KB, 밈 문서에 210.6 KB | 같다 | 같다(Rust 소스를 훑는 것은 같다) | 같다 |
| 빌드 | 크레이트 2개 추가(`maud`, `maud_macros`). wasm 도구 없음. **측정**(개발용 Mac, 15코어): 서버 전체 릴리스 빌드 28초, 바이너리 7.1 MB, 이미지 147.5 MB. 2-CPU ARM VM에서는 재지 않았다. 이미지는 지금처럼 CI에서 빌드하는 편이 맞다 | 비슷하다 | 빌드가 둘이다(서버 + wasm32). `cargo-leptos`, `wasm-bindgen`, `wasm-opt`가 필요하다 | `dx` CLI와 wasm 빌드가 필요하다 |
| 프록시 뒤의 페이지 단위 전환 | **측정**: `Routes::add` 그대로. 문서 요청만 답하고 `RSC` 요청은 Next로 넘긴다 | 같다 | 가능하다. 다만 Leptos 라우터와 하이드레이션 스크립트가 Next와 한 페이지에 섞이지 않게 페이지 전체를 넘겨야 한다 | 같다 |
| 유지 상태 | 0.27.0(2025-02-02)이 마지막 릴리스. 저장소는 살아 있다(2026-11-14 커밋, 미출시 변경 있음) | 0.16.1(2026-09-04) | 0.8.23(2026-10-31), 0.9.0-rc1 진행 중 | 0.7.10, 0.8.0-alpha.3 진행 중 |

**왜 템플릿인가.** 이 사이트에서 값이 큰 것은 크롤러가 받는 HTML과 Core Web Vitals다. 템플릿은 둘 다 측정으로 확인됐고, 나머지 후보는 그 위에 wasm 다운로드와 두 번째 빌드를 얹는다. 섬 하나만 있어도 페이지마다 brotli 36 KB가 붙는데, 지금 Axum 페이지가 보내는 스크립트 전체가 4.4 KB다.

**Maud와 Askama 사이.** Askama는 만들어 보지 않았다. 문서로 판단하면 둘의 차이는 조합 방식이다. 컴포넌트 121개와 서버 컴포넌트를 함수로 옮기는 편이 맞아서 Maud를 골랐다. Maud가 방치되면 템플릿을 Askama나 hypertext로 옮기는 일은 기계적이다.

**이 방식이 나쁜 점.**

1. 브라우저 동작은 자바스크립트로 남는다. 서버와 브라우저가 타입을 공유하지 않는다.
2. 클라이언트 라우터가 없어 모든 이동이 전체 페이지 요청이다(CSS·JS는 캐시된다).
3. 큰 클라이언트 컴포넌트 8개는 다시 쓰는 일이지 옮기는 일이 아니다.
4. 생성된 CSS(`server/assets/site.css`)를 커밋한다. 클래스 이름을 바꾸고 `build-ui.mjs`를 돌리지 않으면 스타일이 빠진다. CI에 `--check`를 넣어야 한다(지금은 없다).

파일럿이 이 방식을 무너뜨린 곳은 없었다. 바꿔야 할 신호는 "스크립트가 페이지당 수십 KB를 넘고 상태 관리가 필요해지는 페이지가 여럿"일 때다. 그때는 그 페이지들만 Leptos islands로 가는 것이 차선이다.

## 4. 설계

### 페이지 하나가 옮겨지는 방식

- **코드 위치**: `server/src/pages/<page>.rs`, 크면 `pages/<page>/{mod,view,…}.rs`. `mod.rs`는 조회·판정·응답, `view.rs`는 마크업. 공통 틀은 `document.rs`(head와 문서 뼈대), `chrome.rs`(헤더·푸터·하단 내비), `json_ld.rs`.
- **데이터**: 플래너를 옮기지 않고 **`with_identity`를 거친 직접 SQL**로 쓴다. 플래너는 254곳이 쓰는 동적 질의 조립기라서 Rust로 옮기면 타입 없는 질의 조립기를 하나 더 갖게 된다. 파일럿의 밈 문서는 관계까지 한 질의로 읽는다. RLS는 그대로 적용된다(익명 역할). 대가: 질의마다 Next와 같은 행을 읽는지 게이트로 확인해야 한다.
- **캐시**: ISR·`unstable_cache` 자리에 프로세스 안 캐시(`pages/cache.rs`, 시간 제한, 실패는 저장하지 않음)를 둔다. 운영자 액션이 Next에 있는 동안은 `revalidateTag`가 Axum에 닿지 않으므로 **제한 시간이 유일한 한계**다. 그래서 짧게 둔다(파일럿: 색인 문서 수 5분, 밈 문서는 캐시 없음). 운영자 액션이 Rust로 오면 같은 프로세스에서 캐시를 비운다. `Cache-Control`은 페이지마다 Next가 내던 값을 그대로 낸다. 메모리 256 MB 한도 때문에 키가 있는 캐시에는 크기 상한을 둔다.
- **메타데이터·JSON-LD**: 페이지가 `Head` 값을 만들고 `document.rs`가 Next와 같은 순서로 쓴다. JSON-LD는 키 순서와 `<` 이스케이프까지 Next와 같다. 항상 응답의 첫 부분에 있다.
- **i18n**: 문서 언어는 URL 접두어만 따른다(`proxy.ts`와 같다). 사전 2,729줄은 손으로 옮기지 않고 TypeScript 사전을 JSON으로 뽑아 Rust가 읽는 생성 단계를 둔다. `Content-Language`와 `<html lang dir>`은 페이지가 낸다.
- **서버 액션**: 액션은 `POST` 엔드포인트가 된다. 폼은 보통 HTML 폼으로 보내고 결과는 리디렉션이다. 같은 출처 검사(`Origin`·`Sec-Fetch-Site`)와 기존 `SignedInUser`·`Operator` 추출자를 쓴다. Next의 액션 id는 빌드마다 달라 Rust 페이지가 부를 수 없으므로 **폼이 있는 페이지는 그 액션과 함께 옮긴다.**
- **스크립트**: `server/ui/`의 프레임워크 없는 자바스크립트. 입력은 `data-*` 속성으로 받는다. 스크립트 없이도 문서는 완성돼 있어야 한다.
- **혼재 기간의 규칙**: Axum은 문서 요청(`RSC` 헤더 없음, `Sec-Fetch-Mode` 없음 또는 `navigate`)만 답한다. Next의 클라이언트 라우터가 보내는 요청은 Next로 간다. 그래서 Next 화면 안에서 이동한 방문자는 옮긴 페이지도 Next 판으로 본다. 크롤러와 새로 연 탭은 Axum 판을 본다.

### 페이지 동치 게이트 (`server/parity/pages/pages.mjs`)

대상 URL마다 브라우저·Googlebot·Yeti로 두 서버에 물어 상태, `Location`·`Refresh`, 응답 헤더, `<html lang dir>`, `<title>`, 모든 `<meta>`, canonical·hreflang·피드·manifest·아이콘 링크, JSON-LD(파싱해서 데이터로), 보이는 글자, 링크, 이미지, `<main>` 마크업을 비교한다. 대상 목록은 각 경우가 무엇인지도 적어 두므로(200·308·404, index·noindex, native·proxied) 시드가 그 경우를 더 만들지 못하면 실패한다.

무시하는 것과 이유(스크립트 맨 위 세 목록, `server/parity/README.md`):

- 홉 단위 헤더, Next 캐시 내부 헤더, Next의 스타일시트 파일 이름이 든 `Link` 미리 불러오기 헤더.
- `NOT_PORTED`: 파일럿이 아직 그리지 않는 절. Next 문서에서 잘라 낸 뒤 비교하고 몇 개를 잘랐는지 출력한다.
- `ACCEPTED`: 정해 둔 차이. 지금은 404 문서 하나다(5절).
- 스크립트를 실행하지 않는다. 불러온 뒤의 동작과 픽셀은 보지 않는다.

### 인증

- **유지하는 것**: 네 테이블과 쿠키 형식. 기존 세션과 비밀번호 해시가 그대로 통해야 한다. Rust는 이미 better-auth가 낸 세션 쿠키를 읽는다(`server/src/auth.rs`).
- **옮기는 순서**: ① `get-session`과 세션 연장(지금 Rust는 읽기만 한다) → ② 로그아웃 → ③ 이메일 로그인(bcrypt·scrypt 검증) → ④ 가입·인증 메일·비밀번호 재설정(`verification` 테이블, 메일 웹훅, 가입 전후 훅) → ⑤ Google·Kakao → ⑥ TikTok 매직 링크. 로그인·가입 폼(서버 액션)은 ③·④와 함께 간다.
- **OAuth state·PKCE**: better-auth는 state와 `codeVerifier`를 `verification` 테이블에 두고 `oauth_state` 쿠키를 쓴다. 공급자마다 시작 경로와 콜백을 **한 번에** 넘기고, 콜백에서 Rust가 만든 state가 아니면 Next로 넘긴다. 그러면 전환 순간에 진행 중이던 로그인도 끝난다. state 형식을 흉내 낼 필요가 없다.
- **진행**: ①(세션 읽기·연장)과 ②(로그아웃)는 A1에서 옮겼다(`PLAN.md` 12절, 브랜치 `torisKR/axum-auth-a1`). ③(이메일 로그인)과 ④(가입·인증 메일·재설정)의 HTTP 경로는 A2에서 옮겼다(`PLAN.md` 16절, 브랜치 `torisKR/axum-auth-a2`). 폼과 서버 액션은 B6에서 함께 간다. ⑤(Google·Kakao)의 시작과 콜백은 A3에서 함께 옮겼다(`PLAN.md` 17절, 브랜치 `torisKR/axum-auth-a3`). 두 서버의 state가 같은 바이트라 어느 쪽에서 시작한 로그인이든 어느 쪽에서든 끝난다. 위의 "Rust가 만든 state가 아니면 Next로" 대신 이 방식을 택했고, `server/tests/auth_oauth_cross.rs`가 양방향을 본다. Rust가 연장한 세션을 better-auth가 받는지와 연장 시점은 `server/tests/auth_session_cross.rs`가 양방향으로 본다.
- **실제 better-auth로 시험할 것**: Rust가 낸 세션을 better-auth가 받는지(반대 방향은 이미 있다), 해시 양방향(두 형식), 인증·재설정 토큰 양방향, 세션 연장 시점, 가짜 공급자 서버로 OAuth 전체 흐름을 양쪽에서 돌려 DB 행과 쿠키 비교.
- **확인하지 못한 것**: scrypt 매개변수와 state 행의 정확한 형식은 패키지 소스로 일부만 확인했다. 운영 DB에 `service_role` 읽기 권한이 있는지는 PLAN.md 5절의 미확인 항목 그대로다.

### 작업 순서

크기는 `inventory/batches.md`(앞 묶음에서 센 파일은 다시 세지 않는다).

| 묶음 | 페이지 | 새로 필요한 UI | 클라이언트 컴포넌트 | 병렬 | 비고 |
| --- | --- | --- | --- | --- | --- |
| B0 공통 틀 | 없음 | 30개 3,313줄 | 18 | 틀이 끝나야 나머지가 시작된다 | 헤더 메뉴·언어 선택·계정 메뉴·하단 내비·챗봇·PWA 설치의 스크립트, i18n 생성 단계, 캐시, CI의 CSS 검사. **이것이 끝나야 어떤 페이지든 켤 수 있다** |
| B1 정적 문서 | 10 | 20개 2,521줄 | 1 | 페이지마다 따로 | `/about`(완료), 약관·개인정보·편집 원칙·가이드·문의 |
| B2 목록·탐색 | 17 | 48개 8,253줄 | 21 | 목록 / 탐색·검색 / 퀴즈로 셋 | 색인 대상이다. 카드 컴포넌트를 처음 옮긴다 |
| B3 밈 문서(한국어) | 1 | 34개 5,653줄 | 16 | 절 단위로 | **B1·B2에서 방식이 확인된 뒤.** 파일럿이 첫 화면까지 돼 있다. 남은 11개 절, 미디어, 번역 hreflang |
| B4 홈 | 1 | 15개 3,879줄 | 7 | 단독 | three.js 장면 |
| B5 번역 문서 | 7 | 7개 1,298줄 | 0 | B3 뒤 | 4개 언어의 색인 규칙 |
| B6 로그인·계정·제보·커뮤니티 | 10 | 29개 5,137줄 | 13 | 인증 이관과 묶어서 | 폼과 액션이 함께 간다 |
| B7 운영자 | 20 | 51개 9,122줄 | 20 | 화면 단위로 | **마지막.** 색인되지 않고 액션 파일 7개(2,261줄)가 달려 있다. 여기까지 오면 `revalidateTag`가 필요 없어진다 |

마지막에 남는 것: `next/og` 이미지 4종, 임베딩 모델, 서비스 워커. Next를 내리기 전에 대체물을 정해야 한다(PLAN.md 3절).

## 5. 파일럿 결과

실제 Next(16.3.4, standalone)와 Axum을 같은 시드 DB(`server/parity/pages/seed.sql`)에 붙여 측정했다.

### 동치

`pages.mjs` 14개 대상 × 3개 사용자 에이전트 = 42개 요청 전부 일치.

| 경우 | 대상 | 결과 |
| --- | --- | --- |
| 정적 문서 | `/about` | 일치. 색인 문서 수(13건)까지 같다 |
| 있는 밈, 색인 기준 통과 | `pgrich01`, 한글 슬러그 `pgkor003`, 사건 기록 `pgevt004` | 일치. JSON-LD 4개(Organization·WebPage·DefinedTerm·BreadcrumbList) |
| 색인 기준 미달 | `pgthin02` | 양쪽 `noindex, follow`, JSON-LD는 브레드크럼만 |
| 정규 URL이 아님 | 짧은 id, 옛 슬러그, 쿼리 포함, 소문자 퍼센트 인코딩, `%2D` | 양쪽 308, `Location`·`Refresh`·본문 같음 |
| 없는 밈 | `zzzzzzzz`, `zzzzzzzz-nothing` | 양쪽 404·`noindex`. 본문은 정해 둔 차이 |
| 파일럿이 다루지 않는 형태 | 미디어가 있는 밈, 편집 밈 | Axum이 Next 응답을 그대로 전달 |
| 경로 끄기 | `AXUM_DISABLED_ROUTES=page-about,page-meme,page-assets` | 전 대상이 Next 화면. `parity.mjs`로 바이트 단위 일치 |

`/about` 전체 화면 캡처(모바일 412×3,482픽셀)는 1,434,584픽셀 중 657픽셀만 다르다(챗봇 캐릭터의 움직이는 GIF 자리). 밈 문서는 옮긴 부분까지 눈으로 봐서 같다.

정해 둔 차이 하나: **없는 밈의 404 문서.** Next는 미리 렌더한 파일을 보낸다. `<body>`가 스크립트 실행 전까지 비어 있고 `<html>`에 `lang`이 없으며 `s-maxage=31536000`이 붙는다. Axum은 같은 안내를 HTML로 보내고 `no-store`다. 상태·제목·`noindex`는 같다.

### 찾은 것

- Next는 **브라우저와 Googlebot에게 제목·설명·canonical·hreflang·robots를 `<body>` 안에 스트리밍**하고 스크립트로 옮긴다. Yeti·Bingbot·미리보기 봇에게만 `<head>`에 넣는다. Axum은 누구에게나 `<head>`에 넣는다.
- Next의 `/about`은 본문 `<main>`이 숨긴 조각에 들어 있다가 스크립트로 제자리에 온다.
- `/about` 원문에 띄어쓰기가 하나 빠져 있다("1990년대부터오늘까지"). 파일럿은 그대로 옮겼다. 고치려면 TypeScript 쪽에서 고친다.
- `sec-fetch-mode: cors`로 없는 밈을 요청하면 Next는 200을 낸다(`proxy.ts`가 조회를 건너뛴다). Axum은 그런 요청을 Next로 넘겨 같은 답이 나간다.

### 측정

문서 크기(압축 전 / gzip 6):

| | Next | Axum | 설명 |
| --- | --- | --- | --- |
| `/about` | 73,671 / 16,894 B | 27,903 / 8,004 B | Next 문서의 40,530 B가 RSC 데이터(같은 내용을 한 번 더 싣는다) |
| 밈 문서 | 172,227 / 32,351 B | 39,142 / 9,650 B | **같은 조건이 아니다.** Next 쪽 87,981 B가 RSC 데이터, 36,836 B가 파일럿이 안 그린 절이다. 옮긴 부분의 마크업은 39,554 B 대 38,999 B로 같다. 절을 다 옮기면 Axum 문서는 약 76 KB가 된다 |

Lighthouse 13.6.0, 모바일, 느린 4G·CPU 4배 모의, 3회 중앙값, 두 서버 앞에 같은 gzip 프록시:

| | 점수 | FCP | LCP | TBT | CLS | 자체 요청 | JS 전송 | CSS 전송 | wasm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/about` Next | 100 | 1,535 ms | 1,540 ms | 24 ms | 0 | 60 | 351,220 B (25개) | 45,132 B | 0 |
| `/about` Axum | 100 | 905 ms | 905 ms | 2 ms | 0 | 7 | 4,410 B (1개) | 14,681 B | 0 |
| 밈 문서 Next | 80 | 1,534 ms | 5,307 ms | 43 ms | 0 | 72 | 401,878 B (30개) | 45,132 B | 0 |
| 밈 문서 Axum | 100 | 905 ms | 905 ms | 6 ms | 0 | 8 | 4,410 B (1개) | 14,681 B | 0 |

Next의 LCP는 회차마다 갈렸다(`/about` 1,540·1,535·5,010 ms, 밈 문서 5,307·1,534·5,436 ms). Axum은 세 번 다 905 ms였다. 콘솔 오류는 양쪽 다 없었다.

**파일럿이 나쁜 곳**: 지표로는 없다. 다만 이 비교는 Axum에 유리하게 기울어 있다. Axum 페이지는 헤더 메뉴·언어 선택·계정 메뉴·챗봇·저장이 동작하지 않고, 밈 문서는 11개 절이 없다. 그 스크립트와 마크업이 붙으면 숫자는 올라간다.

### 밈 문서에서 아직 없는 것

B3(5.4절)에서 모두 옮겼다. 파일럿 때 없던 것은 페이지 순서대로: 반응 막대, 카드 내보내기 버튼, 관련 영상, 비슷한 밈, 같은 분류·같은 해 링크, 출처 패널(분류·연도·태그, 출처 링크, 신뢰 안내, 보강 제보 폼), 로그인 권유, 마켓 패스포트, 참고 자료 목록, 판정 근거, 수명 안내, 댓글. 그리고 다음 형태의 문서는 Axum이 그리지 않고 Next에 넘긴다: 미디어(`meme_contents`)가 있는 밈, 검수된 번역이 있는 밈(hreflang), 자체 제작 밈, 편집 밈 8개와 그 별칭, DB 조회 실패.

B0 전에는 헤더 메뉴·언어 선택·로그인 상태·챗봇·밈 저장이 동작하지 않았다. B0에서 모두 옮겼다(5.1절).

### 5.1 B0: 모든 페이지가 쓰는 틀

2026-11-24, 브랜치 `torisKR/axum-ui-b0`. 페이지는 여전히 하나도 켜지 않았다(`AXUM_PILOT_ROUTES`).

**옮긴 것.** 레이아웃이 모든 페이지에 얹는 것 전부: 헤더와 메뉴, 언어 선택(URL이 있는 언어는 그 페이지로, 없는 언어는 제자리에서 틀만 바꾼다), 계정 메뉴(일반 사용자·운영자. Next의 틀에는 운영자 링크가 없고 Axum도 같다), 하단 내비, 휴대폰에서 스크롤할 때 헤더·하단 막대 숨기기, 검색 단축키 `/`, 이동 표시줄, 푸터, 챗봇 런처와 패널, PWA 설치 안내(iPhone 시트 포함), 유입 경로 기록, 포인터 효과, 밈 저장 진입점(비로그인은 이 기기에 남기고 로그인 안내 모달, 로그인은 `toggle_save`로 저장하고 알림). 마크업은 `server/src/pages/chrome/`, 동작은 `server/ui/*.js` 한 파일씩이다. 틀이 부르는 API(`/api/auth/*`, `/api/db/query`, `/api/memes/chat` 등)는 지금 주인인 서버가 답한다. 여기서 옮기지 않았다.

**규칙.** 스크립트 없이도 페이지가 완결된다. 열릴 때만 있는 것(메뉴 패널, 계정 메뉴, 챗봇 패널, 로그인 안내, 설치 안내)은 `<template>`에 두고 스크립트가 넣었다 뺀다. 그래서 크롤러가 보는 글자·링크는 Next와 같다. 스크립트는 `data-*`만 읽고, 클라이언트 라우터는 없다. `lib/attribution.ts`·`lib/scroll-chrome.ts`·`lib/meme-chat-stream.ts`·`lib/source-links.ts`는 다시 쓰지 않고 빌드 때 TypeScript에서 그대로 옮겨 싣는다(`scripts/build-ui.mjs`).

**i18n.** `scripts/build-i18n.mjs`가 `lib/i18n*.ts`·`lib/meme-chat-copy.ts`와 `components/save-button.tsx`의 `SAVE_COPY`를 `server/i18n/frame.json`으로 내보내고, Rust가 그것을 넣어 빌드한다. 19개 언어, `dir`(아랍어 `rtl`). TypeScript를 바꾸고 다시 만들지 않으면 `--check`가 실패한다(CI의 `server` 작업). 컴포넌트 안에 적힌 작은 표 몇 개(하단 내비의 "홈"·"최신", 헤더의 "최신 밈", 메뉴의 "글로벌 피드"·"밈 스튜디오")는 `chrome`의 해당 마크업 옆에 옮겨 적었다.

**캐시.** `pages/cache.rs`에 키가 있는 캐시 `Keyed`를 더했다: 항목마다 시간 제한, 전체 바이트 상한(넘으면 만료된 것, 그다음 오래된 것부터 버린다). 첫 사용처는 다른 언어의 틀(`FRAME_FRAGMENT_TTL` 1시간, `FRAME_FRAGMENT_MAX_BYTES` 4 MB). 시간 제한은 쓰는 곳마다 이름 있는 상수로 둔다.

**동작 게이트.** `server/parity/behaviour/`(Playwright). 시나리오 하나를 Next와 Axum에 똑같이 돌리고, 둘 다 같은 단언을 통과해야 통과다. 휴대폰·데스크톱 폭, 비로그인·로그인(일반·운영자). 최종 실행: next-mobile 33·next-desktop 31·axum-mobile 33·axum-desktop 31 통과, 실패 0(나머지 20개는 한 폭에만 있는 동작이라 건너뛴다). 기능마다 스크립트를 일부러 비우면 해당 시나리오가 실패하는 것도 확인했다(메뉴·언어·계정·저장·챗봇·설치 안내·이동 표시·스크롤·검색·유입 경로·조회 기록 11개). 푸터와 하단 내비는 스크립트가 없다. 새 페이지의 시나리오를 더하는 법은 `server/parity/README.md`.

**측정.** 스크립트 `site.js` 16,474 B(gzip), B0 전 2,177 B. 가장 큰 것은 챗봇 3.5 KB, 공통 2.4 KB, `lib/attribution` 2.2 KB, 저장 2.2 KB(부분별 크기는 `build-ui.mjs --sizes`). 스타일시트 13,588 B(gzip), B0 전 12,455 B. 문서는 `/about` 56,394 / 13,783 B(압축 전 / gzip), 밈 문서 68,349 / 15,585 B로, B0 전(27,903 / 8,004 B)보다 커졌다. 대부분 열릴 때 쓰는 템플릿이다. Next는 73,671 / 16,894 B와 172,227 / 32,351 B다.

Lighthouse 13.6.0(5절과 같은 조건, 3회 중앙값):

| | 점수 | FCP | LCP | TBT | 자체 요청 | JS 전송 | CSS 전송 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/about` Next | 81 | 1,535 ms | 5,000 ms | 35 ms | 62 | 351,220 B (25개) | 45,132 B |
| `/about` Axum | 100 | 906 ms | 906 ms | 0 ms | 9 | 18,725 B (1개) | 15,823 B |
| 밈 문서 Next | 100 | 1,534 ms | 1,534 ms | 49 ms | 63 | 393,883 B (28개) | 45,132 B |
| 밈 문서 Axum | 100 | 906 ms | 906 ms | 0 ms | 11 | 18,725 B (1개) | 15,823 B |

Next의 LCP는 이번에도 회차마다 갈렸다(`/about` 5,072·5,000·1,535 ms, 밈 문서 1,534·1,533·5,435 ms).

**페이지 게이트.** 틀이 붙은 두 페이지로 42개 요청 전부 일치, 페이지 경로를 끄면(`AXUM_DISABLED_ROUTES=page-about,page-meme,page-assets`) 42개 전부 Next 화면으로 일치. `pages.mjs`는 이제 사이트맵이나 URL 목록 파일을 받고(`--concurrency`, `--examples`), 차이를 종류별로 센다. 시드 DB의 사이트맵 50개 URL × 3개 에이전트 150개 요청이 일치했다. 운영 규모 데이터로는 돌리지 않았다.

**시험 환경에서 알아낸 것.** Next의 API는 자기 주소(`http://localhost:<포트>`)나 빌드에 넣은 `NEXT_PUBLIC_SITE_URL`에서 온 요청만 믿는다(`lib/origin.ts`, `X-Forwarded-Host`는 보지 않는다). 그래서 Axum을 다른 포트에 두면 로그인 상태 조회가 403이 된다. 운영처럼 Axum을 사이트 주소에 두고 Next를 그 뒤에 두면 된다. 원본 검사는 하나도 느슨하게 하지 않았다.

**다음 묶음이 알아야 할 것.**
- 페이지 하나를 켜려면: `pages/mod.rs`의 `router`에 경로 추가, `routes::ROUTE_IDS`와 `PAGE_ROUTE_IDS`에 id 추가, `document::page`로 틀을 두르고, 페이지 전용 동작은 `server/ui/<기능>.js`로(`build-ui.mjs`의 `UI_FILES`에 추가), 문자열은 `build-i18n.mjs`의 `FILES`로, 그 페이지의 대상을 `pages/targets.txt`에, 시나리오를 `behaviour/scenarios/`에. 두 게이트가 통과한 뒤 운영 규모 데이터에서 사이트맵으로 `pages.mjs`를 돌리고 나서 켠다.
- 켜는 스위치는 `AXUM_PILOT_ROUTES` 하나다(이름은 그대로 둔다. `docker-compose.axum.yml`이 이 이름으로 넘긴다, `PLAN.md` 차이 73). `AXUM_DISABLED_ROUTES`가 이긴다.
- 다른 언어로 된 페이지(B5)는 `document::page`에 로케일을 받게 하면 된다. 틀은 이미 19개 언어를 그린다.

### 5.2 B1: 정적 문서

2026-11-24, 브랜치 `torisKR/axum-ui-b1`. 켠 페이지는 없다. 각 페이지는 경로 id를 `AXUM_PILOT_ROUTES`에 적어야 켜진다.

| 페이지 | 경로 id | 다룬 URL 형태 |
| --- | --- | --- |
| `/contact` | `page-contact` | 그대로, 쿼리, 끝 슬래시(308), `/en/contact`(404) |
| `/editorial` | `page-editorial` | 그대로, 쿼리, 끝 슬래시 |
| `/guides` | `page-guides` | 그대로, 쿼리, 끝 슬래시, `/en/guides`(404) |
| `/guides/{slug}` | `page-guide` | 다섯 편 모두, 쿼리, 끝 슬래시, 없는 slug(Next의 404) |
| `/privacy`, `/terms` | `page-privacy`, `page-terms` | 그대로, 쿼리, 끝 슬래시 |
| `/offline` | `page-offline` | 그대로, 쿼리 |
| `/missing-public-meme` | `page-missing-meme` | 그대로(404, 정해 둔 차이) |
| 퇴역 상품 | `page-retired-products` | `/retired-products`(쿼리, 끝 슬래시), `/products`, `/products/x`, `/go/products(/x)`, `/en`·`/ja`·`/zh`·`/zh-tw` 아래, `/products/export?locale=ja`, `/zh-tw/retired-products`(빈 404), `/admin/creator-products(/x)`(308), `/en/products(/x)`(Next의 308), `/products/x.png`·`/ar/products`(Next의 404) |

모든 형태를 `GET`과 `HEAD`로 보낸다. 페이지 게이트는 이제 `HEAD`의 상태·헤더·빈 본문도 비교한다. 결과: 페이지를 켜면 189개 요청 전부 일치, 끄면 189개 전부 Next 화면으로 일치. 동작 게이트(`documents.spec.mjs`): 페이지마다 틀(메뉴·포커스·챗봇·제자리 언어 전환)과 페이지 자신의 링크(가이드 목록과 글, 문의의 메일 링크, 오프라인의 다시 시도, 퇴역 상품 카드), 두 서버 네 프로젝트에서 13개씩 52개 통과.

B1에는 폼도 서버 액션도 없다(문의는 `mailto:` 링크다). 그래서 옮긴 `POST` 엔드포인트가 없다.

Lighthouse(5절과 같은 조건, 3회 중앙값), `/guides/usage-signals`: Next 100점, FCP·LCP 1,535 ms, TBT 17 ms, 자체 요청 59개, JS 353,623 B(26개). Axum 100점, FCP·LCP 906 ms, TBT 0 ms, 자체 요청 9개, JS 18,722 B(1개).

Next가 하는데 이 이식이 하지 않는 것: 없다고 본다. 남은 차이는 `PLAN.md` 74~77(퇴역 상품 카드의 캐시 시간, 410 문서의 스타일시트 링크, 빌드 때 렌더한 문서의 연도, 옮겨 적은 마크업).

### 5.3 B2 목록·탐색 (진행 중)

2026-11-24, 브랜치 `torisKR/axum-ui-b2`(8개), `torisKR/axum-ui-b2b`(나머지). 17개를 모두 옮겼다. 켠 페이지는 없다. 목록의 밈 카드(`components/meme-card.tsx`)는 `server/src/pages/meme_card.rs` 하나로 모든 목록이 쓴다.

| 페이지 | 경로 id | 다룬 URL 형태와 상태 | 결과 |
| --- | --- | --- | --- |
| `/originals` | `page-originals` | 그대로, 쿼리, 끝 슬래시, `/en/originals`(404) | 페이지 게이트 일치, 틀과 목록 링크 |
| `/originals/edition/{slug}` | `page-original-edition` | 세 편, 쿼리, 끝 슬래시, 없는 slug(Next의 200·noindex) | 일치, 링크 복사·카드 PNG·그림 링크·다음 작품 |
| `/memes` | `page-memes` | 1쪽, 쿼리, 2쪽, 퍼센트 인코딩한 쪽, 마지막 쪽(36), 끝을 넘는 쪽, `?page=1`, `0`·`02`·`abc`·빈 값·두 번(모두 Next의 200), 끝 슬래시, 빈 목록, 못 읽는 목록 | 일치. 쪽 넘기기·쪽 번호·밈 열기 |
| `/collections` | `page-collections` | 그대로, 쿼리, 끝 슬래시, `/en/collections`(404) | 일치, 틀 |
| `/collections/{slug}` | `page-collection` | 열두 모음, 카드 3장 미만 모음(소개만), 쿼리, 끝 슬래시, 없는 slug(404), 못 읽음(500) | 일치. 카드 열기(맥락 쿼리), 영상 정지 화면, 그림 실패 시 포스터, TikTok·Instagram 플레이어(Esc·닫기·초점·재생 불가), 검수 안 된 게시물엔 플레이어 없음 |
| `/weekly` | `page-weekly` | 그대로, 쿼리, 끝 슬래시, `/en/weekly`(404), 못 읽음(빈 결산) | 일치. 두 줄·분포 막대·`weekly_click` |
| `/timeline` | `page-timeline` | 그대로, 쿼리, 끝 슬래시, `/en/timeline`(404), 못 읽음(안내 문구) | 일치. 무한 스크롤(네 해씩), `#decade-…` 주소, 연대 탭(휴대폰), `timeline_click` |
| `/slang` | `page-slang` | 그대로, `?era=2010s`·`risky`·모르는 값, 끝 슬래시, `/en/slang`(404), 못 읽음(준비 중) | 일치. 탭 제자리 전환·뒤로 가기·주소의 탭·표제어 |
| `/explore` | `page-explore` | 그대로, 쿼리, 네 정렬과 모르는 정렬, 카테고리(AI 밈 포함)·난이도·생애주기·연도·미디어·출처 네 가지, 모르는 값(칩에 그대로), 검색(큐레이션 카드, 결과 없음), 끝 슬래시, `/en/explore`(B5의 영어 페이지), 못 읽음(오류 안내) | 일치. 무한 스크롤 두 번 뒤 "밈 더 보기", 창 실패와 다시 시도, 미리보기 확인 실패 띠와 재확인, 끝, 결과 없음과 제보 링크, 필터 제자리 전환(패널·초점 유지)·정렬·출처·초기화·검색·지우기·뒤로 가기 |
| `/global` | `page-global` | 세 탭, 대소문자가 다른 탭·두 번 적은 탭(둘 다 YouTube), 쿼리, 끝 슬래시, `/en/global`(404), 빈 피드, 못 읽음(오류 안내) | 일치. 탭 이동·`aria-current`·뒤로 가기, 썸네일 실패 시 제목 카드(정지 화면, 저장된 표지), 상세 열기 |
| `/meme-cards` | `page-meme-cards` | 두 쪽과 끝을 넘는 쪽, 잘못되거나 두 번 적은 쪽(1쪽), 봉인된 카드, 쪽마다 공개한 카드, 비활성·노란 밈의 카드(안내), 카드가 아닌 id, 쿼리, 끝 슬래시, 못 읽음(Next에 넘김, B2-13) | 일치. 고르기(`replaceState`, `aria-pressed`, 제목 초점), "바로 공개"와 긁어서 35% 공개, 불러오기 실패와 다시 시도, 없어진 카드, 로그인 링크, 로그인해서 보유하기와 소장 표시, 섞기, 열 수 없는 카드 안내 |
| `/news` | `page-news` | 그대로, 쿼리, 끝 슬래시, `/en/news`(404), 하이라이트가 있는 세대·없는 세대(3개 미만), 못 읽음(하이라이트 없음) | 일치. 연령대 바로가기(`#age-…`)·뒤로 가기, 하이라이트 표 수와 `generation_news_click`, 브리핑 출처 새 탭 |
| `/quiz`, `/quiz/r/{token}` | `page-quiz`, `page-quiz-result` | 그대로, 쿼리, 끝 슬래시, `/en/quiz`(404), 모드마다의 토큰, 최다·최소 문항, 모두·하나도 못 맞힌 토큰, 쿼리 붙은 토큰, 풀리지 않는 토큰 다섯 가지(Next에 넘김) | 일치. 모드 시작, 클릭과 1~4·Enter로 10문항, 정오답 표시와 해설 링크, 점수·등급·연대·오답 복습, `quiz_start`·`quiz_complete`, 결과 링크 복사, 성적표 PNG 내려받기, 출제 실패와 다시 시도, 친구 도전장(같은 문제 세트, 점수 비교, 새 문제로) |
| `/rankings` | `page-rankings` | 그대로, 쿼리, 끝 슬래시, `/en/rankings`(Next의 다른 페이지), 실시간 판, 추세가 얇을 때(최신 목록), 보일 것이 없을 때(안내, noindex), 못 읽음, `/llms.txt` | 일치. 세 탭(라벨 클릭, 화살표 키), 항목 열기 |
| `/search` | `page-search` | 그대로, 결과(큐레이션 카드 포함), 결과 없음(제보 안내), 두 번 적은 `q`, 공백만인 `q`, 끝 슬래시, `/en/search`(Next의 다른 페이지), 못 읽음(급상승 없음, 검색은 Next에 넘김) | 일치. 입력이 주소와 본문을 제자리에서 바꿈, 자동완성(화살표·Enter·Esc, 다시 초점), 최근·인기 검색어(저장·삭제·전체 지우기), `search_submit`·`search_no_result` 한 번씩, 상황 검색(키워드 모드 결과, 취소, 실패) |
| `/studio` | `page-studio` | 그대로, 쿼리, 끝 슬래시, `/en/studio`(404), 못 읽음(데이터를 읽지 않아 그대로) | 일치. 작업 공간 전환, 분위기·형식 선택과 아이디어 3개(요청 본문), 토픽을 따르는 제목과 복사, 실패 문구(429, 네트워크), 토픽을 따르는 참고 밈 검색, 권리 확인, 이미지 밈(잘못된 파일, 출력 크기, 렌더, PNG 저장, 고치면 다시 렌더), 사전 카드(주소 검사, 렌더, 저장), 종류를 바꾸면 처음부터 |

시드: `server/parity/pages/b2-seed.sql`(목록과 카드 그림 경우마다 24건, 연도 360건), `server/parity/directory-catalog.mjs sql`(정렬 픽스처의 3,562건). 모든 대상(591개 요청)이 켜면 일치하고 끄면(`AXUM_DISABLED_ROUTES`) 전부 Next 화면으로 일치한다. 목록을 못 읽는 상태에서는 B2 URL 219개 요청이 일치한다.

**`/memes`의 가나다순은 ICU4X다.** `icu_collator` 2.4(한국어, 1차 강도, 숫자 정렬)로 정렬하고, 실제 `sortDirectory`가 Next 이미지의 Node(22.23.5, ICU 78.3)에서 3,562개 제목에 낸 순서와 같아야 한다(`server/tests/directory_order.rs`). 한 제목도 다르게 놓이지 않았다. 숫자 정렬을 끄면 536개, 강도를 3차로 올리면 14개가 어긋나 시험이 실패한다.

스크립트(gzip): `ui/card.js` 1,001 B, `ui/timeline.js` 1,103 B, `ui/slang.js` 743 B, `ui/originals.js` 1,841 B. `site.js`는 모든 페이지가 한 파일을 받으므로 20,079 B이고, 예산 30 KB 안이다. `/memes`·`/collections`·`/weekly`는 카드 스크립트 말고 자기 스크립트가 없다.

Lighthouse 13.6.0(5절과 같은 조건: 모바일, 느린 4G·CPU 4배 모의, 3회 중앙값, 두 서버 앞에 같은 gzip 프록시, Axum은 디버그 빌드):

| | 점수 | FCP | LCP | TBT | 자체 요청 | JS 전송 | CSS 전송 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/collections/challenge` Next | 81 | 1,536 ms | 5,155 ms | 29 ms | 75 | 359,513 B (27개) | 45,132 B |
| `/collections/challenge` Axum | 100 | 906 ms | 906 ms | 0 ms | 9 | 22,328 B (1개) | 19,492 B |
| `/memes` Next | 100 | 1,536 ms | 1,536 ms | 30 ms | 59 | 351,220 B (25개) | 45,132 B |
| `/memes` Axum | 100 | 906 ms | 906 ms | 0 ms | 9 | 22,328 B (1개) | 19,492 B |

Next의 LCP는 이번에도 회차마다 갈렸다(모음 5,155·1,536·5,285 ms, `/memes` 1,536·1,536·5,214 ms). Axum은 여섯 번 모두 905~910 ms였다.

Next와 남은 차이는 `PLAN.md`의 B2 절(B2-1~B2-14).

**릴리스 빌드와 실제 크기 데이터.** 2026-11-24, `cargo build --release`의 Axum과 Next 운영 빌드를 3,666건(정렬 픽스처 3,562건 포함) 시험 DB에 붙여 페이지마다 10회 요청의 중앙값을 쟀다. 대부분은 1~33 ms로 Next(1~25 ms, 일부는 Next의 데이터 캐시 적중)와 같은 수준이고 디버그 빌드와도 몇 ms 차이였다. 하나가 달랐다. `/explore?sort=popular`가 디버그와 릴리스 모두 약 2.1초였다. 원인은 빌드가 아니라 질의다. 창 질의는 준비된 문장이라 Postgres가 일반 계획을 쓰고, 일반 계획에서는 탐색 색인의 텍스트 배열(약 3,600개)에 붙인 `$n::uuid[]` 변환이 훑는 행마다 다시 일어난다(3,666행 × 3,600개). 시드가 작으면 드러나지 않는다. 변환을 스칼라 부분 질의로 한 번만 하게 고쳐 23 ms가 됐다(`server/src/pages/explore/query.rs`). 쓴 릴리스 빌드는 지웠다.

| 페이지 | Next | Axum 디버그 | Axum 릴리스(고친 뒤) |
| --- | --- | --- | --- |
| `/memes` | 7 ms | 1 ms | 1 ms |
| `/explore` | 16 ms | 14 ms | 14 ms |
| `/explore?sort=popular` | 16 ms(캐시 없이 첫 요청 197 ms) | 2,229 ms(고치기 전) | 23 ms |
| `/search?q=밈` | 25 ms | 22 ms | 33 ms |
| `/rankings` | 5 ms | 1 ms | 1 ms |
| `/timeline` | 8 ms | 4 ms | 1 ms |

**한 페이지만 쓰는 스크립트는 따로 싣는다.** `site.js`는 모든 페이지가 받으므로 무거운 페이지 스크립트(`ui/explore.js`, `ui/meme-cards.js`, `ui/quiz.js`, `ui/search-page.js`, `ui/studio.js`)는 `assets/pages/<이름>.js`로 따로 만들어 그 페이지만 `site.js` 뒤에 불러온다(`scripts/build-ui.mjs`의 `PAGE_FILES`, `Head::script`). gzip으로 `site.js` 20,248 B, `explore.js` 5,437 B, `meme-cards.js` 7,761 B, `quiz.js` 9,759 B, `search-page.js` 6,024 B, `studio.js` 8,781 B다. 페이지 묶음은 저장소의 순수 모듈(`lib/`, `components/studio/meme-artifacts.ts`, 두 페이지가 함께 쓰는 `ui/reference-search.js`)을 함께 싣고(`import`는 묶음 안의 `lib` 읽기로 바뀐다), `track`은 `core.js`가 `window.memecatch`로 내놓는다.

### 5.4 B3 한국어 밈 문서

2026-11-24, 브랜치 `torisKR/axum-ui-b3`. 켠 페이지는 없다(`page-meme`은 `AXUM_PILOT_ROUTES`에 적어야 켜진다).

**옮긴 것.** 파일럿이 "유래"까지 그리던 문서의 나머지 절 전부: 카드 내보내기(`ui/export.js`, 문구는 `frame.json`의 `export`로 19개 언어, 제자리 언어 전환을 따른다), 비슷한 밈(`getRelatedMemes`와 `ContinueStream`, 카드는 `titleSize=detail`), 같은 분류·같은 해 링크, 출처 패널(분류·연도·태그, 출처 링크, 신뢰 안내 다섯 상태, 함께 채운 사람, 보강 제보 폼 `ui/contribute.js`), 로그인 권유(`ui/invite.js`), 마켓 패스포트, 참고 자료 목록, 판정 근거와 수명 안내, 댓글 자리(`CommunityGate`), 모음 이어보기(`?ctx=`). 문서 형태: 미디어가 있는 밈(`resolveMemeDelivery` 전체, `MemeEmbed`의 YouTube·TikTok·Instagram·Facebook·Threads·그림·안내, 관련 영상과 '더 보기', 공유 이미지 `?v`의 대표 사진, `ui/embed.js`), 검수된 번역이 있는 밈(hreflang·`og:locale:alternate`), 자체 제작(카드 SVG data URL을 바이트 그대로, 스토리보드 탭 `ui/house.js`), 편집 밈 8개(`i18n/curated.json`)와 별칭. 코드는 `server/src/pages/meme_detail/`의 절마다 한 파일이다.

**서버 액션.** 보강 제보의 `submitMemeContribution`을 `POST /api/memes/contribution`(경로 id `meme-contribution`)으로 옮겼다. 반응 막대와 댓글은 커뮤니티가 켜진 빌드에만 있고 서버 액션을 쓰므로, 그때는 문서 전체를 Next로 넘긴다(운영은 꺼져 있다). 제보 경로를 끄면 제보가 열린 동안 문서는 Next로 간다.

**남은 것.** 켜기 전에 `Dockerfile.server`가 두 플래그를 넘겨야 한다(`PLAN.md` B3-6). 미디어 스냅숏 실패 상태는 시드로 만들 수 없어 비교하지 못했다(B3-8).

**게이트.** 페이지 게이트는 밈 문서의 모든 형태(충실·얇음·한글 슬러그·사건 기록·제한·출처 다섯 상태·기여자·패스포트·번역·자체 제작·편집 밈 8개와 행이 있는 편집 밈·별칭·모음 맥락 네 경우·미디어 14건)를 포함한 456개 요청이 켜면 일치, 끄면(`AXUM_DISABLED_ROUTES`) 전부 Next 화면으로 일치했다. 목록을 못 읽는 상태에서는 B2의 ISR 페이지(`/weekly`, `/slang`) 6개 URL 18개 요청만 다르고(Next가 저장된 사본을 낸다) 밈 문서는 모두 일치한다. 동작 게이트는 네 프로젝트에서 338개 통과, 22개 건너뜀(한 폭에만 있는 동작), 16개 실패다. 실패는 전부 B2의 `lists.spec.mjs` 연표·은어 시나리오이고 Next와 Axum에서 똑같이 실패한다. B3 시드 행을 공개 목록에서 빼도 연표 실패는 남아 이 데이터베이스 상태(마이그레이션의 2026년 밈)에 묶인 것이다(`PLAN.md` B3-12). `meme.spec.mjs`의 B3 시나리오 19개(GA 이벤트 둘 포함)는 네 프로젝트 모두 통과하고, `ui/export.js`·`contribute.js`·`invite.js`를 비우면 각자의 Axum 시나리오가 실패한다.

**측정.** Lighthouse 13.6.0(5절과 같은 조건: 모바일, 느린 4G·CPU 4배 모의, 3회 중앙값, 두 서버 앞에 같은 gzip 프록시, Axum은 디버그 빌드):

| | 점수 | FCP | LCP | TBT | CLS | 자체 요청 | JS 전송 | CSS 전송 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 충실한 문서 `pgrich01` Next | 78 | 1,206 ms | 6,087 ms | 35 ms | 0 | 71 | 401,834 B (30개) | 45,197 B |
| 충실한 문서 `pgrich01` Axum | 100 | 906 ms | 906 ms | 5 ms | 0 | 12 | 27,168 B (1개) | 20,449 B |
| 영상 문서 `pgvid012` Next | 74 | 1,208 ms | 7,433 ms | 196 ms | 0.002 | 70 | 401,834 B (30개) | 45,197 B |
| 영상 문서 `pgvid012` Axum | 100 | 905 ms | 905 ms | 5 ms | 0.002 | 11 | 27,168 B (1개) | 20,449 B |

Next의 LCP는 이번에도 회차마다 갈렸다(충실한 문서 1,208·6,161·6,087 ms, 영상 문서 7,673·6,488·7,433 ms). Axum은 여섯 번 모두 904~907 ms였다. `site.js`는 24,918 B(gzip)로 예산 30 KB 안이다.

시드는 `server/parity/pages/b3-seed.sql`(문서 10건과 기여자·시장·번역·관련 영상), 대상은 `targets.txt`에 밈 문서 경우마다. 동작 시나리오는 `behaviour/scenarios/meme.spec.mjs`. 차이는 `PLAN.md`의 B3 절(B3-1~B3-12).
### 5.5 B4: 홈

2026-11-24, 브랜치 `torisKR/axum-ui-b4`. `GET /`(`page-home`)를 옮겼다. 켜지 않았다.

**옮긴 것.** `app/(default)/page.tsx`가 그리는 전부: 세 장의 스토리와 그 사이에 고정되는 3D 장면(스토리 변형), 오늘의 밈 퀴즈, 최근 공개 밈 덱(필터·카테고리·다음 선택 미리보기, 얇으면 큐레이션 밈으로 채움), 안전 쇼케이스, 자가진단, 사용 신호, 참여 경로, 편집 기준, 밈대결(세 기간과 YouTube 정지 화면), 번역판 안내, JSON-LD(`WebSite`, `DefinedTermSet`), hreflang 다섯과 `x-default`. 마크업은 `server/src/pages/home/`, 동작은 `server/ui/home.js`(`assets/pages/home.js`, gzip 12,408 B)다. `home-scroll-binding.ts`와 `lib/daily-quiz.ts`는 다시 쓰지 않고 페이지 묶음에 그대로 싣는다. 각 절의 다섯 언어 문구는 `server/i18n/home.json`이라 B5의 `/{locale}` 홈이 같은 코드를 쓴다.

**3D 장면.** 같은 렌더러 소스와 같은 three(0.186.1)를 `build-ui.mjs`의 새 `bundle` 항목이 Rolldown으로 ES 모듈 하나(`assets/pages/home-scene.js`, gzip 149,301 B)로 묶고, `ui/home.js`가 Next와 같은 때(캔버스 자리가 화면에 들어올 때) `import()`한다. 정적 그림으로 남는 조건과 모션 감소·일시 정지·레이아웃·보기 초기화·컨텍스트 손실은 컴포넌트와 같다(`PLAN.md` B4-4).

**페이지 게이트.** 9요청(대상 3개 × 에이전트 3, `HEAD` 포함)이 켬·밈대결 시드·얇은 덱·빈 카탈로그·못 읽는 카탈로그·C1의 업스트림 없는 모드에서 일치하고, 끄면 전부 Next 화면으로 일치한다. 저장된 언어 쿠키의 302는 Next가 답한다(`PLAN.md` B4-2).

**동작 게이트.** `home.spec.mjs` 18개 시나리오, 네 프로젝트 70 통과·2 건너뜀: 틀(메뉴·챗봇·언어 전환), 스토리 링크와 검색, 장면(신호 선택과 Esc, 렌더러 준비 뒤 레이아웃·재생·보기 초기화, 모션 감소, 메모리 적은 기기의 정적 그림), 덱(입력 필터·전체 검색 링크·결과 없음과 초기화·Enter, 카테고리·미리보기 넘기기), 쇼케이스 세 탭, 자가진단 다섯 문항(판정·링크 유무·대체어 복사·점수·다시 풀기), 오늘의 퀴즈(비로그인 기록·새로고침 뒤 유지·`quiz_complete`, 로그인 상태의 `db/query` 계획 두 개가 바이트까지 같음, 실패하면 카드가 사라짐), 밈대결 탭, 번역판 안내(영어 브라우저, 저장된 언어의 302, 한국어). 스크립트를 끄면 Axum의 13개가 실패한다.

Lighthouse 13.6.0(5절과 같은 조건: 모바일, 느린 4G·CPU 4배 모의, 3회 중앙값, 두 서버 앞에 같은 gzip 프록시):

| | 점수 | FCP | LCP | TBT | 자체 요청 | JS 전송(장면 빼고) | 3D 장면 | CSS 전송 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` Next | 69 | 1,208 ms | 5,913 ms | 388 ms | 67 | 351,369 B (28개) | 시작했으나 측정 끝까지 받지 못함 | 45,273 B |
| `/` Axum | 91 | 1,058 ms | 1,058 ms | 384 ms | 13 | 37,193 B (2개) | 151,629 B (측정 중 받음) | 30,950 B |

Next의 LCP는 세 번 다 5,910~6,238 ms, Axum은 1,056~1,248 ms였다. Axum의 TBT는 대부분 측정 안에서 받아 실행한 three.js다(Next는 같은 청크를 요청만 하고 측정이 끝났다). 문서는 gzip 36,003 B 대 35,462 B.

Next와 남은 차이는 `PLAN.md`의 B4 절(B4-1~B4-13).

## 6. 확인하지 못한 것과 위험

확인하지 못한 것:

- 운영 규모의 데이터. 시드 4건과 마이그레이션의 10건으로만 비교했다. 색인 판정이 3,905건에서 Next와 같은지는 모른다.
- 운영 환경: Cloudflare 압축, 2-CPU ARM VM에서의 빌드 시간(개발용 Mac에서만 쟀다), 운영 호스트에서의 광고 로더.
- 스크립트의 동작. 불러와지고 콘솔 오류가 없다는 것만 봤다. 클릭 동작을 브라우저에서 시험하지 않았다.
- 로그인한 상태의 화면, 한국어 밖의 언어, 데스크톱 폭의 화면 캡처.
- Askama와 Leptos SSR로 만든 페이지(wasm 크기와 문서로만 판단했다).

전체 이관을 실패하게 만들 가능성이 큰 위험 셋:

1. **브라우저 동작이 조용히 달라진다.** 121개 컴포넌트의 동작을 자바스크립트로 다시 쓰는데, 지금 게이트는 스크립트를 실행하지 않는다. B0를 시작하기 전에 브라우저로 누르고 비교하는 동작 시험(Playwright)이 있어야 한다.
2. **데이터 계층이 어긋난다.** 340곳의 플래너 호출을 SQL로 다시 쓰면 RLS·정렬·캐시 시차에서 문서 몇 건의 `noindex`나 JSON-LD가 Next와 달라질 수 있고, 이 사이트에서는 그것이 곧 색인 사고다. 묶음을 켜기 전마다 운영 백업을 복원한 DB에서 사이트맵 전체 URL로 게이트를 돌려야 한다.
3. **두 서버가 함께 사는 기간이 길다.** 그동안 Next 안에서 이동한 방문자는 Next 판을, 새로 들어온 방문자는 Axum 판을 본다. 캐시 무효화가 프로세스를 넘지 못하고, 세션 연장과 OAuth가 두 서버에 걸친다. 묶음 순서를 지켜 기간을 줄이고, 인증은 공급자 단위로 한 번에 넘긴다.

## 7. 출처

| 주장 | 출처 | 확인한 버전 |
| --- | --- | --- |
| 각 크레이트의 최신 버전과 날짜 | `https://crates.io/api/v1/crates/{leptos,dioxus,maud,askama,wasm-bindgen,axum}` (2026-11-24 조회) | leptos 0.8.23, dioxus 0.7.10, maud 0.27.0, askama 0.16.1 |
| Leptos islands: `<leptos-island>` 요소, 정적 24 KB·섬 166 KB·탭 예제 약 200 KB | Leptos Book, "Guide: Islands" `https://book.leptos.dev/islands.html` | 0.8 |
| Leptos SSR 모드: 기본은 순서 없는 스트리밍, 자바스크립트 필요, 메타 태그에는 `async`·blocking | Leptos Book, "Async Rendering and SSR Modes" `https://book.leptos.dev/ssr/23_ssr_modes.html` | 0.8 |
| Dioxus는 "CSR 기본, 일부 데이터만 서버 캐시" 방식이고 하이드레이션 데이터를 HTML에 싣는다 | Dioxus 0.7 문서, Fullstack "Server-Side Rendering" `https://dioxuslabs.com/learn/0.7/essentials/fullstack/ssr` | 0.7 |
| Dioxus wasm: TodoMVC 2.36 MB → 234 KB | Dioxus 0.7 문서, "Optimizing" `https://dioxuslabs.com/learn/0.7/guides/tips/optimizing` | 0.7 |
| Maud: 0.27.0에서 axum 0.8 지원, 그 뒤 미출시 변경 | `https://github.com/lambda-fairy/maud/blob/main/CHANGELOG.md`, 저장소 커밋 기록 | 0.27.0 |
| Next가 스트리밍하지 않는 크롤러 목록 | `node_modules/next/dist/shared/lib/router/utils/html-bots.js` | Next 16.3.4 |
| wasm 크기 측정 | 이 작업에서 만든 최소 예제 셋(leptos 0.8.23 `hydrate`, `islands`; dioxus 0.7.10 `web`), `opt-level="z"`·LTO·`wasm-opt -Oz` | wasm-bindgen 0.2.130 |
