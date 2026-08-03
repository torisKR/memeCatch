# RELEASE_CHECKLIST

리뉴얼 범위를 배포로 확정하기 전에 전부 통과해야 하는 목록. 루프마다 갱신한다.
현재 상태: **루프 001 기준선 — 미완료.**

## 게이트 A — 코드 검증 (매 루프 필수)

- [x] `npx eslint` — 0 error (2026-08-03: 0 error / 5 기존 warning)
- [x] `npx tsc --noEmit` — 통과
- [x] `npx vitest run` — 통과 (71 파일 / 605 테스트)
- [x] `npx next build --webpack` — 성공
- [ ] e2e 또는 핵심 route smoke test — **미도입**
- [ ] 변경된 코드에 회귀 테스트가 있다

## 게이트 B — 데이터 품질

- [x] `pnpm quality:check`가 CI에서 실행 가능하고 JSON 리포트를 낸다
- [ ] `DQ-C1-published-without-source` = 0 — **현재 1,330건**
- [ ] `DQ-C2-dead-representative` = 0 — **현재 14건**
- [ ] `DQ-C3-duplicate-canonical-title` = 0 — **현재 38건**
- [ ] `DQ-C4-alias-title-collision` = 0 — **현재 275건**
- [ ] high 등급 검사가 기준선 대비 악화되지 않았다
- [ ] 마이그레이션이 있다면 forward + rollback + backfill dry-run이 검증됐다

## 게이트 C — 화면·접근성

- [ ] 모바일 390×844 첫 뷰포트에 제목·한 줄 뜻·안전 신호·유행 상태가 보인다
      — **현재 정답 카드 top 1,344px**
- [ ] 안전 신호와 유행 상태가 서로 다른 라벨·설명을 갖는다
- [ ] 출처 수·마지막 검수일·문서 완성 상태가 한 번의 탭 이내에 보인다
- [ ] 모든 상태가 색상 외에 아이콘·텍스트로도 전달된다
- [ ] 하단 고정 요소가 본문을 덮지 않는다 — **현재 제휴 도크가 덮음**
- [ ] keyboard-only로 모든 action에 접근 가능
- [ ] 자동 접근성 검사에서 critical 위반 0 — **도구 미도입**
- [ ] 360×800 / 768×1024 / 1440×900 스크린샷 회귀 확인 — **미측정**

## 게이트 D — SEO·성능

- [ ] 상세 문서의 title·description·canonical·OG가 실제 화면 내용과 일치한다
- [ ] canonical / hreflang / sitemap 회귀 없음
- [ ] 구조화 데이터에 화면에 없는 주장이 없다
- [ ] SSR HTML에 영구 로딩 문구·빈 라벨이 남지 않는다
      — **`/rankings` DOM에 “랭킹을 불러오고 있어요” fallback이 남아 있어 재확인 필요**
- [ ] LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1 또는 기존 대비 악화 없음 — **기준선 미측정**

## 게이트 E — 운영

- [ ] `LOOP_STATE.md` 갱신
- [ ] `BACKLOG.md` 상태 갱신
- [ ] 결정·trade-off가 `DECISIONS.md`에 기록됨
- [ ] 검증 로그가 `artifacts/renewal/loop-NNN/`에 저장됨
- [ ] HUMAN_GATE 항목이 승인 없이 배포되지 않았다
- [ ] push / merge / production deploy는 명시적 권한을 받았다

---

## 완료 선언 조건 (LOOP.md 「중단 조건 · 완료」)

위 전 항목 통과 + 모든 critical/high backlog가 done 또는 명시적 rejected일 때만
`<promise>CATCHMEME_RENEWAL_DONE</promise>`를 출력한다.
