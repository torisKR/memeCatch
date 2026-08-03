# RELEASE_CHECKLIST

리뉴얼 범위를 배포로 확정하기 전에 통과해야 하는 목록.
갱신: 루프 016 (2026-08-04) · 대상: 브랜치 `renewal/loop-001`, 커밋 16개

## 게이트 A — 코드 검증 (매 루프 필수)

- [x] `npx eslint` — 0 error (5 warning은 전부 기존 `no-img-element`)
- [x] `npx tsc --noEmit` — 통과
- [x] `npx vitest run` — 77 파일 / **645 통과** (기준선 597 → +48)
- [x] `npx next build --webpack` — 성공
- [x] 변경된 코드에 회귀 테스트가 있다 — 루프 002·003·005·007·011·013·014 모두 신규 테스트 동반
- [ ] e2e 또는 핵심 route smoke **자동화** — 수동 브라우저 계측으로 대체 중. 프레임워크 미도입

## 게이트 B — 데이터 품질

- [x] `pnpm quality:check`가 CI에서 실행 가능하고 JSON 리포트를 낸다
- [ ] `DQ-C1-published-without-source` = 0 — **1,330건** (편집 작업, HG-001·DQ-007)
- [ ] `DQ-C2-dead-representative` = 0 — **14건** (화면 노출은 루프 002에서 차단, 데이터는 잔존)
- [ ] `DQ-C3-duplicate-canonical-title` = 0 — **38건** (HG-004)
- [ ] `DQ-C4-alias-title-collision` = 0 — **275건** (HG-004)
- [x] high 등급 검사가 기준선 대비 악화되지 않았다 — 전 루프에서 데이터 미변경이라 동일
- [x] 마이그레이션 없음 — 15회 전부 스키마·프로덕션 데이터 미변경

> **이 게이트는 코드로 닫을 수 없다.** 4개 critical 전부 데이터 작업이고 프로덕션
> 쓰기가 필요하다. 루프 001~015는 화면이 데이터를 **정직하게 표현**하도록 고쳤을 뿐,
> 데이터 자체는 건드리지 않았다.

## 게이트 C — 화면·접근성

- [x] 모바일 390×844 첫 뷰포트에 제목·한 줄 뜻·안전 신호·유행 상태가 보인다 — 정답 카드 top **79px** (기준선 1344px)
- [x] 안전 신호와 유행 상태가 서로 다른 라벨·설명을 갖는다 — 단, 안전 스케일의 `이미 늦음`은 축 혼재로 HG-002 대기
- [x] 출처 수·마지막 검수일·문서 상태가 한 블록에 보인다 — `TrustNote` (루프 003)
- [x] 모든 상태가 색상 외에 아이콘·텍스트로도 전달된다
- [x] 자동 접근성 검사에서 critical 위반 0 — Lighthouse Accessibility **100** (루프 011)
- [x] 접근성 회귀 CI 가드 — 대비 가드 2건, 실패 증명 완료 (루프 014)
- [x] 순위 숫자와 accessible name이 중복 읽히지 않는다 — aria-hidden 숫자 + sr-only 라벨로 분리 (루프 016)
- [ ] 하단 고정 요소가 본문을 덮지 않는다 — **제휴 도크가 덮음** (HG-005)
- [ ] keyboard-only로 모든 action 접근 — 미검증
- [ ] 360×800 / **768×1024** / 1440×900 회귀 — 768 미측정
- [ ] loading / empty / error / zero-result 상태 점검 — 미검증
- [ ] 200% 확대 · `prefers-reduced-motion` — 미검증

## 게이트 D — SEO·성능

- [x] 상세 title·description·canonical·OG가 화면 내용과 일치 — 15회 전부 canonical 불변 확인
- [x] canonical / hreflang / sitemap 회귀 없음
- [x] 구조화 데이터에 화면에 없는 주장이 없다 — JSON-LD 구조 불변
- [x] LCP 목표 충족 — `/` 143ms · `/rankings` 1062ms · 상세 1131ms (전부 ≤2500ms)
- [ ] CLS ≤ 0.1 — 상세 **0.12(콜드)** — 원인은 크기 미지정 제휴 광고 이미지 (HG-005·PERF-002)
- [ ] INP ≤ 200ms — 미측정 (상호작용 시나리오 필요)
- [x] SSR HTML에 영구 로딩 문구가 없다 — 재확인 결과 **결함 아님**: 해당 문구는 `loading.tsx`의 `sr-only` 접근성 알림이고 실제 순위 콘텐츠는 SSR에 존재한다 (루프 016)

## 게이트 E — 운영

- [x] `LOOP_STATE.md` 갱신 — 매 루프
- [x] `BACKLOG.md` 상태 갱신 — DONE 12 / READY 0 / BLOCKED 10
- [x] 결정·trade-off가 `DECISIONS.md`에 기록됨 — D-001~D-004, HG-001~HG-006
- [x] 검증 로그가 `artifacts/renewal/loop-NNN/`에 저장됨 — loop-001~015
- [x] HUMAN_GATE 항목이 승인 없이 배포되지 않았다 — 게이트 항목은 전부 문서까지만
- [x] push / merge / production deploy를 하지 않았다 — 로컬 커밋 15개만

---

## 결론

**배포 가능 여부: 코드 변경분은 게이트 A·C·D의 통과 항목 기준으로 배포 가능하다.**
15회 전부 프로덕션 데이터·스키마를 건드리지 않았고, 되돌리기는 커밋 되돌리기로 끝난다.

**단, 완료 선언은 불가하다.** 게이트 B의 critical 4건이 전부 미해결이고 이는 데이터
작업이라 코드로 닫히지 않는다. LOOP.md 완료 조건을 충족하지 못하므로
`CATCHMEME_RENEWAL_DONE`을 출력하지 않는다.

**막고 있는 것:** `DECISIONS.md`의 HG-001~HG-006. 결정 없이 진행 가능한 backlog는 0건이다.
