# 홈 다크 web3 스킨 (.theme-ink) 설계

> 2026-07-22 · 승인: 사용자 (홈 전체 다크 web3 / 불꽃 오렌지 네온 유지 / Higgsfield 히어로 아트)

## 목표

- 홈(/)을 히어로부터 푸터까지 화려하고 모던한 다크 web3 룩으로 통일.
- 탐색·상세 등 콘텐츠 소비 페이지는 가독성 우선의 라이트 유지.
- DESIGN.md 규칙 준수: 보라 그라디언트 금지 — 시그니처 불꽃 오렌지를 네온·글래스로 확장.

## 아키텍처: 토큰 스코프

새 컴포넌트 없이 `.theme-ink` 클래스 하나로 전환한다(globals.css 말미).

- `.theme-ink`가 `--background/--surface/--border/--muted/--cat-*/--safety-*` 등
  전 컬러 토큰을 다크 검증값(AA)으로 오버라이드. `color-scheme: dark` 포함.
- 홈 `<main>`(서버)에 클래스를 직접 부여, 셸(헤더·푸터·하단탭)은 클라이언트
  컴포넌트라 `lib/use-ink-route.ts`의 `useInkRoute()`(pathname === "/")로 동일 판정.
  usePathname은 SSR에서도 동작해 하이드레이션 플래시 없음.
- 특이도 주의: `.theme-ink`는 `:root`와 같은 (0,1,0)이므로 반드시 모든 :root
  토큰 블록 **뒤에** 위치해야 한다.
- 푸터는 잉크 스킨일 때 `mt-16` 제거 — 마진 틈으로 라이트 body가 비치는 띠 방지.

## 히어로 아트 (Higgsfield)

- Nano Banana 2(Google, Gemini Flash급)로 생성한 불꽃 실크 오로라 아트
  `public/hero-art.webp`(1376×768, 19KB)를 CSS 오로라 아래(-z-20) 합성.
- 하단 linear 마스크로 잉크에 페이드 — 헤드라인 텍스트 대비 유지.
- 배경 이미지 레이어라 LCP(헤드라인 텍스트)에 영향 없음.

## web3 장식

- `.ink-grid`: 히어로 §12 미세 그리드 문법을 홈 본문 전체로 확장(정적).
- `.hover-glow-flame`: flame 네온 글로우 호버(box-shadow/border-color만) —
  둘러보기 카드·테마 칩·전체보기 CTA에 적용.
- 입문자 섹션: 크림 배경 → 반투명 글래스 패널(bg-surface/60 + backdrop-blur).

## 검증

- vitest 252/252 통과, eslint 클린, tsc 클린.
- Playwright 스크린샷: 데스크톱/모바일(375px) 홈 전 구간 다크 연속,
  /explore는 라이트 유지 확인.
