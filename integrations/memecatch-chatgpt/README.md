# 밈캐치 ChatGPT 연결 패키지

이 패키지는 밈 검색 UI와 MCP 서버, GitHub 이벤트 중계 코드를 제공합니다. **코드 실행 검증과 ChatGPT 계정의 실제 앱 등록은 서로 다른 완료 단계입니다.**

검색은 `https://catchmeme.com/llms-full.txt`의 공개 본문 일부를 사용합니다. 사이트 전체 사전 검색이 아니며, 데이터베이스 관리자 키·OpenAI API 키는 필요하지 않습니다. 사용 안전도 미확인·위험 항목은 기본 검색에서 제외합니다. 원문에 있는 유래의 불확실성도 그대로 표시합니다.

## 실행

Node.js 22.18 이상에서 별도 의존성 설치 없이 실행할 수 있습니다.

```sh
npm test
npm start
# 로컬 브라우저에서만 UI를 미리 보는 경우
npm run preview
```

- 로컬 MCP 주소: `http://127.0.0.1:8787/mcp`
- 로컬 UI 미리보기: `http://127.0.0.1:8787/preview`
- 운영 앱의 공개 MCP 주소: `https://catchmeme.com/api/mcp` — 실제 배포/응답 검증 결과는 운영 허브 참조.
- MCP 2.0: `2026-07-28`; 도구/리소스는 `2025-11-25`, `2025-06-18`, `2025-03-26`의 초기 연결을 각각 협상합니다. 이전 클라이언트가 버전 헤더를 생략하면 규격에 따라 `2025-03-26`으로 처리합니다.
- UI 도구 `open_memecatch`: `_meta.ui.resourceUri`, 사이드바 `global` 및 대화 패널 `thread` 진입점.
- `.mcp.json`은 배포된 HTTPS 운영 주소를 기본으로 사용합니다. 로컬 서버 테스트 설정은 `.mcp.local.json`에 있습니다.
- `.app.json`의 앱 ID는 실제 등록 후 받은 ID로만 작성합니다. 가짜 ID는 포함하지 않았습니다.

## 운영 이벤트 연결

운영 이벤트 서버는 `https://catchmeme.com/api/mcp-operator`입니다. 공개 검색 앱과 별도로 운영자 로그인에 연결되는 OAuth 2.1 인증을 사용합니다. 기존 밈캐치 운영자 권한을 확인하고 CI 실패·main 변경·이슈 변경만 구독합니다. 코드 쓰기 권한은 없습니다. ChatGPT CIMD, PKCE S256, 정확한 redirect/resource 검증, 일회성 인증 코드와 갱신 토큰 교체를 지원합니다.

Vercel 함수는 Supabase `mcp_operator_state`에 암호화된 구독·전송 큐·인증 상태를 저장합니다. 일반 사용자와 익명 사용자는 이 테이블과 상태 함수에 접근할 수 없습니다. 처리 잠금은 90초이며, 만료되거나 다른 소유자의 잠금으로 상태를 덮어쓸 수 없습니다. 전송은 요청 종료 뒤 최대 2건, 재시도는 `/api/cron/mcp-events`가 5분 간격으로 수행합니다. 중복 방지와 유한 구독 만료는 별도 프로세스 없이 유지됩니다.

운영 환경 변수는 `MCP_EVENT_STATE_KEY`(32바이트 base64), `MCP_GITHUB_WEBHOOK_SECRET`, `MCP_EVENT_CALLBACK_ORIGINS`, 기존 `CRON_SECRET`입니다. `.env.example`의 `EVENT_*` 값은 아래 단독 서버용입니다. 운영 키를 소스나 채팅에 복사하지 않습니다. 상태 키를 변경하면 기존 구독과 OAuth 토큰을 복구할 수 없으므로 보존해야 합니다.

GitHub 웹훅 주소는 `https://catchmeme.com/api/mcp-operator/github`이며 `workflow_run`, `push`, `issues`만 선택합니다. 정확한 ChatGPT callback origin은 실제 구독 요청에서 확인한 후 허용합니다. 와일드카드를 사용하지 않습니다. 운영 배포·웹훅 수신·계정 OAuth 연결·challenge 검증·실제 AI 시작은 각각 확인해야 합니다. 코드 및 DB 검증만으로 실제 AI 시작 완료를 표시하지 않습니다.

## 단독 서버 이벤트 연결

Vercel의 공개 `/api/mcp`는 검색·UI용이며 이벤트 기능을 광고하지 않습니다. 아래 단독 서버 방식의 이벤트 중계는 **지속 실행되는 단일 서버와 영속 디스크**가 필요합니다. `.env.example`의 설정을 비밀 저장소로 제공하고, HTTPS 프록시 뒤에서 별도 서버를 실행합니다. 수평 확장·서버리스·여러 프로세스가 같은 상태 파일을 공유하는 방식은 지원하지 않습니다.

1. 운영자 bearer 인증, GitHub 웹훅 비밀값, 32바이트 상태 암호화 키, 실제 ChatGPT가 제공한 콜백의 정확한 HTTPS origin을 설정합니다. 비밀값은 Git에 넣지 않습니다.
2. GitHub `torisKR/memeCatch`의 웹훅 목적지에 이 서버의 `/github/webhook`을 연결합니다. 이벤트는 `workflow_run`, `push`, `issues`만 선택합니다.
3. 인증된 MCP 2.0 클라이언트가 `events/list`, `events/subscribe`를 호출합니다. 필터는 `repository: torisKR/memeCatch`로 고정합니다.
4. 서버는 서명된 challenge를 전송하고 2xx 응답의 동일 challenge를 확인한 뒤 구독을 활성화합니다.
5. 실제 CI 실패 또는 테스트 이슈로 이벤트 수신과 AI 작업 시작을 확인합니다. 확인 전에는 ‘AI 자동 실행 연결 완료’라고 표시하지 않습니다.

콜백은 허용한 HTTPS origin과 공용 IPv4만 허용합니다. IPv6 전용 콜백은 현재 지원하지 않습니다. DNS를 각 전송 시 검증하고 연결 IP를 고정하며 TLS 호스트 검증을 유지합니다. 리다이렉트는 따라가지 않습니다. Standard Webhooks 서명, 영속 중복 방지, 최대 5회 재전송, 구독 만료, 410 해지·413 전송 중단, 비밀값 교체 시 2분 동안 이중 서명을 구현합니다. 과거 이벤트 재생을 지원하지 않아 cursor는 항상 null입니다. 상태 파일은 AES-256-GCM으로 암호화합니다.

기본 구독은 24시간이며 최대 7일입니다. `ttlMs: null`도 유한 구독으로 승인하고 실제 만료 시각을 반환합니다. 큐는 최대 1,000건이며 용량이 찬 경우 GitHub에 실패 응답을 반환하므로 원본 웹훅을 재전송해야 합니다. bearer 인증은 단일 비공개 운영자용입니다. 여러 사용자 또는 공개 배포에는 별도 OAuth와 사용자별 권한 검증이 필요합니다.

## ChatGPT 등록과 운영

2026-09-30 KST(2026-09-29 UTC)에 현재 계정의 개인용 **밈캐치** 앱 생성·설치·연결과 읽기 도구 3개를 확인했습니다. 실제 앱 ID는 `app_6abc25cbe7ec8191a395e5a623abb2a6`입니다. `/api/mcp`를 인증 없음으로 등록하며, 공개 사전 자료만 조회합니다. 앱 설치 상세 화면의 ‘채팅에서 사용해 보기’로 선택할 수 있습니다. 현재 대화에서 `open_memecatch`와 `get_meme` 실제 실행을 확인했습니다. 패널 전체 렌더링은 별도 확인이 남아 있습니다.

등록 시 UI 리소스의 `ttlMs`/`cacheScope`를 요구하는 MCP 2 클라이언트와 2025년 MCP 초기 연결을 모두 지원합니다. GitHub 권한·웹훅 연결, Cloud 환경 생성, 네이티브 Page 및 Dots는 별도의 실제 연결 단계이며, 현재 완료 상태는 `operator-hub.md`를 참조하세요.

`operator-hub.md`에는 프로젝트, Cloud, Living Pages, dot의 준비 내용과 현재 연결 상태를 기록합니다. 일반 프로젝트 텍스트 자료를 네이티브 Living Page라고 부르지 않고, 일반 프로젝트를 새 ChatGPT Space 기능이 완전히 활성화된 것으로 표시하지 않습니다.

## 참고한 공식 규격

- OpenAI Plugin Extensions: `https://developers.openai.com/plugins/build/extensions`
- ChatGPT UI: `https://developers.openai.com/plugins/build/chatgpt-ui`
- MCP Events: `https://developers.openai.com/plugins/build/mcp-events`
- 패키징: `https://developers.openai.com/plugins/build/plugins`
- MCP 2.0 HTTP: `https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http`
- MCP Apps: `https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx`
