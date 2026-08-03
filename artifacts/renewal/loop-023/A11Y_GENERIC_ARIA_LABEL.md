# generic 요소 aria-label 잔여 감사 (루프 023)

## 방법

```
rg -n --multiline --multiline-dotall -o '<(div|span)\b[^>]{0,400}?aria-label=' \
   -g '*.tsx' -g '!*.test.tsx' app components lib
```

`aria-label` 총 출현 168건 / 86파일(`grep -rn "aria-label" app components | wc -l`).
그중 `<div>`·`<span>`에 붙은 것만 12곳. `role`이 명시돼 generic이 아닌 곳은 제외했다:

| 위치 | role | 판정 |
| --- | --- | --- |
| `components/weekly-digest.tsx:86` | `role="img"` | 정상 |
| `components/life-gauge.tsx:33` | `role="img"` | 정상 |
| `components/pwa-install.tsx:225` | `role="region"` | 정상 |
| `components/meme-embed.tsx:484` | `role="status"` | 정상 |
| `app/(default)/login/login-form.tsx:159` | `role="tablist"` | 정상 |
| `components/generation-votes.tsx:140` | `role="group"` | 정상 |
| `components/generation-votes.tsx:260` | `role="img"` | 정상 |
| `components/quiz-app.tsx:251` | `role="progressbar"` | 정상 |

`<button>`/`<a>`/`<nav>`/`<section>`/`<aside>`/`<ol>`/`<svg role="img">`/`Alert`
(`components/ui/alert.tsx:29` = `role="alert"`) 는 과제 범위 제외 또는 라벨 지원 요소다.

## 남은 위반 2건

### 1. 안 읽음 점 — `components/premium/trend-alerts-bell.tsx:161`

```tsx
{alert.read_at === null && (
  <span
    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
    aria-label="안 읽음"
  />
)}
```

**심각도: HIGH.** 루프 016에서 고친 랭킹 순위 배지와 동일한 패턴이며 더 나쁘다 —
이 `<span>`은 **자식 텍스트가 0**이라 `aria-label`이 무시되는 스크린리더에서는
접근성 트리에 아무것도 남지 않는다(순위 배지는 최소한 시각적 맥락이 남았다).
결과적으로 읽음/안 읽음 구분이 스크린리더 사용자에게 **완전히 소실**된다.
같은 파일의 위쪽 아이콘 `<span aria-hidden>`(148행)과 대비되는, 의도된 정보 전달용
요소다. 프리미엄 알림 목록이라 사용자 노출 경로에 있다.

수정 방향(참고): `role="img"` 부여, 또는 `<span className="sr-only">안 읽음</span>`
텍스트 노드 추가. 후자가 role 없이도 항상 읽힌다.

### 2. 관리자 로딩 스켈레톤 6곳 — `<div aria-busy="true" aria-label="불러오는 중">`

| 파일:줄 |
| --- |
| `app/(default)/admin/loading.tsx:3` |
| `app/(default)/admin/memes/loading.tsx:6` |
| `app/(default)/admin/memes/[id]/loading.tsx:6` |
| `app/(default)/admin/submissions/loading.tsx:6` |
| `app/(default)/admin/submissions/[id]/loading.tsx:6` |
| `app/(default)/admin/reports/loading.tsx:6` |

```tsx
<div aria-busy="true" aria-label="불러오는 중" className="space-y-6">
```

**심각도: LOW.** 같은 generic+aria-label 패턴이지만 (a) 화면은 운영자 전용이고
(b) 소실되는 정보가 "로딩 중"이라 후속 콘텐츠 등장으로 대체 인지가 가능하다.
다만 `aria-busy` 역시 generic role에서는 노출이 보장되지 않으므로,
고칠 경우 `role="status"` 하나면 라벨과 busy가 동시에 유효해진다(6파일 동일 수정).

## 회귀 가드 제안

`aria-label`을 `role` 없는 `div`/`span`에 다는 패턴은 세 번째 재발이다
(루프 016 랭킹 배지 → 이번 2건). 위 rg 한 줄을 `quality:check` 또는 lint 규칙
(`jsx-a11y/prefer-tag-over-role` 계열이 아니라 자체 규칙)로 고정하면 재유입이 막힌다.
