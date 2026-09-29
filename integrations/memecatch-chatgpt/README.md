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

## 이벤트 연결

Vercel의 공개 `/api/mcp`는 검색·UI용이며 이벤트 기능을 광고하지 않습니다. 이벤트 중계는 **지속 실행되는 단일 서버와 영속 디스크**가 필요합니다. `.env.example`의 설정을 비밀 저장소로 제공하고, HTTPS 프록시 뒤에서 별도 서버를 실행합니다. 수평 확장·서버리스·여러 프로세스가 같은 상태 파일을 공유하는 방식은 지원하지 않습니다.

1. 운영자 bearer 인증, GitHub 웹훅 비밀값, 32바이트 상태 암호화 키, 실제 ChatGPT가 제공한 콜백의 정확한 HTTPS origin을 설정합니다. 비밀값은 Git에 넣지 않습니다.
2. GitHub `torisKR/memeCatch`의 웹훅 목적지에 이 서버의 `/github/webhook`을 연결합니다. 이벤트는 `workflow_run`, `push`, `issues`만 선택합니다.
3. 인증된 MCP 2.0 클라이언트가 `events/list`, `events/subscribe`를 호출합니다. 필터는 `repository: torisKR/memeCatch`로 고정합니다.
4. 서버는 서명된 challenge를 전송하고 2xx 응답의 동일 challenge를 확인한 뒤 구독을 활성화합니다.
5. 실제 CI 실패 또는 테스트 이슈로 이벤트 수신과 AI 작업 시작을 확인합니다. 확인 전에는 ‘AI 자동 실행 연결 완료’라고 표시하지 않습니다.

콜백은 허용한 HTTPS origin과 공용 IPv4만 허용합니다. IPv6 전용 콜백은 현재 지원하지 않습니다. DNS를 각 전송 시 검증하고 연결 IP를 고정하며 TLS 호스트 검증을 유지합니다. 리다이렉트는 따라가지 않습니다. Standard Webhooks 서명, 영속 중복 방지, 최대 5회 재전송, 구독 만료, 410 해지·413 전송 중단, 비밀값 교체 시 2분 동안 이중 서명을 구현합니다. 과거 이벤트 재생을 지원하지 않아 cursor는 항상 null입니다. 상태 파일은 AES-256-GCM으로 암호화합니다.

기본 구독은 24시간이며 최대 7일입니다. `ttlMs: null`도 유한 구독으로 승인하고 실제 만료 시각을 반환합니다. 큐는 최대 1,000건이며 용량이 찬 경우 GitHub에 실패 응답을 반환하므로 원본 웹훅을 재전송해야 합니다. bearer 인증은 단일 비공개 운영자용입니다. 여러 사용자 또는 공개 배포에는 별도 OAuth와 사용자별 권한 검증이 필요합니다.

## ChatGPT 등록과 운영

ChatGPT의 실제 Developer mode/플러그인 등록 화면에서 `/api/mcp`를 등록하고 도구 호출, 앱 검색, 사이드바·대화 패널 렌더링을 확인합니다. 앱 등록, GitHub 권한·웹훅 연결, Cloud 환경 생성은 계정 기능 및 실제 권한 부여가 필요합니다. 로컬 패키지를 만든 것만으로 이 작업들이 활성화되지 않습니다.

`operator-hub.md`에는 프로젝트, Cloud, Living Pages, dot의 준비 내용과 현재 연결 상태를 기록합니다. 일반 프로젝트 텍스트 자료를 네이티브 Living Page라고 부르지 않고, 일반 프로젝트를 새 ChatGPT Space 기능이 완전히 활성화된 것으로 표시하지 않습니다.

## 참고한 공식 규격

- OpenAI Plugin Extensions: `https://developers.openai.com/plugins/build/extensions`
- ChatGPT UI: `https://developers.openai.com/plugins/build/chatgpt-ui`
- MCP Events: `https://developers.openai.com/plugins/build/mcp-events`
- 패키징: `https://developers.openai.com/plugins/build/plugins`
- MCP 2.0 HTTP: `https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http`
- MCP Apps: `https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx`
