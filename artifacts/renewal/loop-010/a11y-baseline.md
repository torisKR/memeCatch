# A11Y-001 — 접근성·품질 기준선 (루프 010)

측정: 2026-08-04 · Chrome DevTools MCP `lighthouse_audit` · device=mobile · mode=navigation
route: `/memes/[key]` (uefmryky)

재실행 (도구 추가 없이 이미 연결된 MCP 사용):
  mcp__plugin_ecc_chrome-devtools__navigate_page {url}
  mcp__plugin_ecc_chrome-devtools__lighthouse_audit {device:"mobile", mode:"navigation"}

## 점수

| 카테고리 | 로컬 프로덕션 빌드 | 프로덕션 |
| --- | ---: | ---: |
| Accessibility | **97** | **97** |
| Best Practices | 73 | 77 |
| SEO | 69 | 69 |
| Agentic Browsing | 96 | 87 |

## 실패 항목과 판정

| 항목 | 로컬 | 프로덕션 | 판정 |
| --- | :---: | :---: | --- |
| `color-contrast` | ❌ 1건 | ❌ 1건 | **실제 결함** → A11Y-002 |
| `is-crawlable` | ❌ | ❌ | **의도된 동작** — 얇은 문서 noindex(DQ-002/HG-001) |
| `third-party-cookies` | ❌ 4건 | ❌ 4건 | 알려진 트레이드오프 — Instagram·TikTok 공식 임베드 |
| `errors-in-console` | ❌ 6건 | ✅ 0건 | **로컬 계측 아티팩트** — 아래 참조 |
| `inspector-issues` | ❌ 2건 | ❌ 1건 | 대부분 위 third-party-cookies에서 파생 |

### 실제 결함 — color-contrast 2.82:1

```
selector : body.theme-ink > div.fixed > div.relative > button.no-press
foreground: #ffffff   background: #ff6b47   14px bold
측정 2.82:1   WCAG AA 요구 4.5:1
```

흰 글자 + 브랜드 accent(`#ff6b47`) 조합이 작은 굵은 글씨에서 AA를 통과하지 못한다.
브랜드 색 자체를 건드리는 문제라 루프에서 단독 확정하지 않고 A11Y-002로 올린다.

### 로컬에서만 나온 CSP 오류는 결함이 아니다

로컬 프리뷰는 `next start`가 `.env.production`을 읽어 `NEXT_PUBLIC_SITE_URL`이
`https://catchmeme.com`을 가리키는데 페이지는 localhost에서 서비스된다. 그래서
미디어 이미지가 교차 출처가 되어 CSP에 걸린다. **프로덕션에서는 동일 출처라
`errors-in-console`이 0건(score 1)이다.** 프로덕션을 함께 측정하지 않았다면 없는
버그를 보고할 뻔했다.

## 미충족 (A11Y-001 잔여)

- 핵심 4개 route 중 **1개만** 측정했다(`/`, `/explore`, `/rankings` 미측정).
- **CI에서 자동 실행되지 않는다.** DevTools MCP는 사람이 붙어 있는 세션 도구다.
  CI 게이트가 필요하면 별도 러너 도입이 필요하다.
