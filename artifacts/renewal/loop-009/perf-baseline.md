# PERF-001 — Core Web Vitals 랩 기준선 (루프 009)

측정: 2026-08-04 · Chrome DevTools MCP performance trace · 390×844
CPU throttling 1x · Network throttling none (랩 상한값 — 실사용자 값은 더 나쁘다)

재실행 명령 (도구 추가 없이 이미 연결된 MCP 사용):
  1) preview_start {name: "prod-preview"}   → http://localhost:3100
  2) mcp__plugin_ecc_chrome-devtools__new_page {url}
  3) resize_page {width:390, height:844}
  4) performance_start_trace {reload:true, autoStop:true}

## 결과

| route | LCP | 목표 2500ms | CLS | 목표 0.1 |
| --- | ---: | :---: | ---: | :---: |
| `/` (홈) | 143ms | PASS | 0.00 | PASS |
| `/rankings` | 1062ms | PASS | 0.00 | PASS |
| `/memes/uefmryky` (상세) | 1131ms | PASS | **0.12** | **FAIL** |

## DES-001 전후 비교 — 상세 route

| | LCP | CLS |
| --- | ---: | ---: |
| before (프로덕션, 구 레이아웃) | 1308ms | **0.21** |
| after (로컬 프로덕션 빌드) | 1131ms | **0.12** |

CLS가 0.21 → 0.12로 **43% 개선**됐다. 정답 카드를 그리드 밖으로 올리면서 외부 임베드가
본문 위에서 로드되며 텍스트를 밀어내던 구조가 사라진 결과다.

주의: 두 측정의 네트워크 조건이 달라(프로덕션 vs localhost) **LCP는 엄밀한 비교가
아니다.** CLS는 레이아웃 기인이라 비교 가능하다.

## 미측정 (not_run)

- **INP**: 트레이스에 상호작용이 없어 값이 나오지 않는다. 측정하려면 검색 입력·탭 전환
  같은 실제 조작을 넣은 시나리오가 필요하다.
- `/explore`: 이번 루프 범위 밖.
- 필드(실사용자) 지표: CrUX에 이 페이지 데이터가 없다("no data for this page in CrUX").
  트래픽이 임계치를 넘어야 생긴다.

## 남은 문제

상세 route의 CLS 0.12가 목표 0.1을 여전히 초과한다 → `PERF-002`로 등록.
DevTools의 CLSCulprits 인사이트가 원인 분석 진입점이다.
