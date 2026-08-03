# 루프 023 — 감사 종합 (locale · 코드 · 데이터)

세 갈래 감사(로케일 4건, 코드 4건, 데이터 3건)를 합쳐 신규 backlog 후보 16건을 도출한다.
기존 ID와 충돌하지 않도록 `LOC-001~`, `A11Y-005~`, `DQ-012~`로 번호를 이어 붙였다
(기존 최대: `A11Y-004`, `DQ-011`, `LOC-` 접두는 신규).

---

## 0. 검증 이력 — 무엇을 직접 확인했고 무엇을 이어받았나

하위 감사 4건에 「안전 분류기 미가용, 결과를 직접 검증하라」는 경고가 붙어 있었다.
아래 항목은 이 문서 작성 중 **직접 재확인**했다.

| 확인 | 방법 | 결과 |
| --- | --- | --- |
| `meme_translations` 행 수 | anon GET `Prefer: count=exact` | `*/0` — **전 로케일 0행** |
| `meme_sources` 총계 / `unknown` | 동일 | 4,608 / **293** (감사 원문의 292는 오류) |
| `namu.wiki` 상태 분열 | 동일 | `unknown` **253** / `embeddable` **899** |
| `instagram.com` 분열 | 동일 | `unknown` **5** / `embeddable` **117** |
| `permission_needed`·`internal_only` | 동일 | 각 **0건** |
| 대표 콘텐츠 사용 불가 | 동일 | `dead` **11** + `region_blocked` **3** = **14** |
| 공개 문서 수 | 동일 | **3,904** |
| `copyright_status` enum | 스키마 + PostgREST 필터 | `link_only` 부재 확정 (`22P02`) |
| 중복쌍 표본 3쌍 | anon GET | 제목·연도 불일치 재현 |
| 로케일 상세 게이트 | 소스 정독 | `needsReview` 항상 false 확정 |
| generic `aria-label` 7곳 | 소스 정독 | 전건 재현 |
| `alt` / `rel` / `iframe title` | 소스 정독 | 전건 재현 |
| 라우트 상태 커버리지 | `find` 실측 | page 41 / error 4 / loading 28, loading 누락 13 |

**이어받고 재검증하지 않은 것** — 중복 19그룹 38건의 개별 승자 판정, YouTube oEmbed
200/401 응답, 언론사 26개 도메인 세부 분류. 각 후보에 `[미검증]`으로 표시했다.

---

## 1. 전제를 뒤집는 사실 하나

> **`meme_translations`가 프로덕션에서 0행이다.**
> `GET /rest/v1/meme_translations?select=meme_id` → `content-range: */0`

`lib/meme-translations.ts:230`이 `if (error || !data) return null`,
`app/[locale]/memes/[key]/page.tsx:242`가 `notFound()`.
→ **`/en|ja|zh|zh-tw/memes/*` 전 URL이 404다.**

로케일 감사 4건이 보고한 결함은 전부 사실이지만 **현재 사용자 노출은 0**이다.
이 문서는 그 사실을 반영해 `LOC-*` 후보의 「노출」을 낮추고 「재발 위험」을 높였다.
즉 **지금이 가장 싸게 고칠 수 있는 시점**이다 — 번역 운영을 켜는 순간 4개 로케일에
동시에 실현된다.

부수 확인: 로케일 상세가 hreflang·sitemap에 새지는 **않는다**.
`app/sitemap.ts:78` `getAvailableTranslationLocales`와 ko 상세
(`app/(default)/memes/[key]/page.tsx:82-84`)가 번역 행이 있을 때만 대체 URL을
만들기 때문이다. 다만 로케일 **홈** 4건은 무조건 등재된다(`LOC-005`).

---

## 2. 우선순위 축 (전부 1~5, 높을수록 지금 해야 함)

| 축 | 1 | 5 |
| --- | --- | --- |
| **노출** | 도달 0 (죽은 코드·운영자 전용) | 전 사이트·전 문서 |
| **피해** | 미관·일관성 | 오정보 확산·정보 완전 소실·권리 위험 |
| **착수** | `HUMAN_GATE` 결정 대기 | 게이트·DB 쓰기 없이 코드 한 곳 |
| **재발** | 구조상 다시 안 생김 | 가드 없음 + 이미 재발 이력 |

---

## 3. 후보 16건 (합계 내림차순)

| ID | 한 줄 | 노출 | 피해 | 착수 | 재발 | 합 |
| --- | --- | :-: | :-: | :-: | :-: | :-: |
| `A11Y-005` | generic 요소 `aria-label` 7곳 + 회귀 가드 | 2 | 4 | 5 | 5 | **16** |
| `LOC-002` | 로케일 상세 신뢰 표시 정합 (배지·근거·죽은 배너) | 1 | 4 | 4 | 5 | **14** |
| `DQ-015` | `link_only` 부재 — `unknown`이 두 뜻을 겸함 | 2 | 3 | 4 | 5 | **14** |
| `DQ-016` | `dead` 대표 14건 중 오탐 3건 + 재검증 파이프라인 부재 | 4 | 3 | 3 | 4 | **14** |
| `DQ-014` | `namu.wiki` 권리 상태 분열 (253 unknown / 899 embeddable) | 3 | 4 | 2 | 4 | **13** |
| `A11Y-006` | `markdown-body` `alt` 빈 폴백 — 정보 이미지의 조용한 강등 | 3 | 3 | 3 | 4 | **13** |
| `LOC-005` | sitemap이 빈 로케일 홈 4건을 priority 0.8/daily로 등재 | 3 | 2 | 4 | 4 | **13** |
| `DQ-013` | 중복쌍 간 `origin_year` 모순 6건 + 사실 오류 1건 | 3 | 4 | 2 | 2 | **11** |
| `LOC-001` | 로케일 표면 전체 미가동 — 켤 것인가 접을 것인가 | 2 | 3 | 2 | 5 | **12** |
| `LOC-003` | 언어 칩과 hreflang 집합이 서로 다른 배열에서 나옴 | 1 | 2 | 5 | 4 | **12** |
| `A11Y-010` | empty 상태 누락 5화면 | 3 | 3 | 3 | 3 | **12** |
| `A11Y-007` | 제휴 상품 이미지 `alt`가 제목을 중복 낭독 | 3 | 2 | 5 | 2 | **12** |
| `DQ-012` | 중복 19그룹 38건 — 문서 단위 병합이 불가능 | 4 | 3 | 1 | 2 | **10** |
| `A11Y-009` | `loading.tsx` 실질 공백 6세그먼트 | 2 | 2 | 4 | 3 | **11** |
| `A11Y-008` | `quiz-app` `target="_blank"` `rel` 누락 (유일) | 2 | 1 | 5 | 3 | **11** |
| `LOC-004` | 로케일만 `year_precision`을 안 본다 (영구 헤지) | 1 | 1 | 4 | 2 | **8** |

---

## 4. 후보 상세

### `A11Y-005` — generic 요소 `aria-label` 7곳 + 회귀 가드 (16)

`div`/`span`은 ARIA 명세상 `aria-label`이 지원되지 않는 generic role이다. 무시하는
스크린리더에서는 접근성 트리에 아무것도 남지 않는다. 가장 나쁜 것은
`components/premium/trend-alerts-bell.tsx:161`의 읽음/안 읽음 점 — **자식 텍스트가 0**이고
같은 항목의 아이콘은 `aria-hidden`(`:148`)이라, 이 `aria-label`이 상태를 전달하는
유일한 수단이다. 소실되면 프리미엄 사용자가 어떤 알림이 새 것인지 전혀 알 수 없다.
나머지 6곳은 관리자 로딩 스켈레톤(`aria-busy="true" aria-label="불러오는 중"`)으로
소실 정보가 「로딩 중」이라 피해는 작다. **루프 016에서 순위 숫자로 같은 패턴을 이미
한 번 고쳤고 이번이 세 번째 발견**이라, `role="status"` 7개보다 재발 가드 한 줄이
본체다.

- `components/premium/trend-alerts-bell.tsx:161`
- `app/(default)/admin/loading.tsx:3`, `admin/memes/loading.tsx:6`,
  `admin/memes/[id]/loading.tsx:6`, `admin/submissions/loading.tsx:6`,
  `admin/submissions/[id]/loading.tsx:6`, `admin/reports/loading.tsx:6`
- 가드: `rg -n --multiline --multiline-dotall -o '<(div|span)\b[^>]{0,400}?aria-label=' -g '*.tsx'` → `role=` 동반 여부 검사

정상 8곳(`role` 명시)은 손대지 않는다: `weekly-digest.tsx:86`, `life-gauge.tsx:33`,
`pwa-install.tsx:225`, `meme-embed.tsx:484`, `login-form.tsx:159`,
`generation-votes.tsx:140`·`:260`, `quiz-app.tsx:251`.

### `LOC-002` — 로케일 상세 신뢰 표시 정합 (14)

세 결함이 같은 40줄 안에 있어 한 변경으로 처리한다.

1. **검수 배지가 조건부처럼 쓰였지만 상수다.** `app/[locale]/memes/[key]/page.tsx:338`
   `{!needsReview && <span …>{copy.reviewed}</span>}`, `needsReview`는 `:253`
   `!isIndexableLocalizedMeme(meme)`. 그런데 데이터 진입점
   `lib/meme-translations.ts:232` `return isIndexableLocalizedMeme(localized) ? localized : null`이
   비색인을 이미 null로 떨구고 `page.tsx:242`가 `notFound()` 한다.
   → **렌더되는 모든 로케일 문서에서 `needsReview === false`, 초록 배지 100% 노출.**
   문구는 `Human-reviewed translation`(`:70`) / `人が確認した翻訳`(`:96`) /
   `人工审核翻译`(`:122`) / `人工審核翻譯`(`:147`).
2. **근거 상태 표기가 전무하다.** `components/trust-note.tsx`와
   `lib/source-links.ts:86 summarizeEvidence`는 `app/(default)/memes/[key]/page.tsx:38,388`
   **한 곳에서만** 쓰인다(`grep` 전수 확인). 로케일 상세는 출처 0건이면
   `page.tsx:427` `{sourceLinks.length > 0 && …}`로 사이드바가 통째로 사라진다.
   루프 003이 ko에서 얻은 3단계 고지와 제보 CTA가 전부 없다.
   `isIndexableLocalizedMeme`은 `meme_sources` 건수를 **전혀 보지 않으므로**
   (`lib/meme-translations.ts:204-209`) 「근거 0건 + 초록 검수 배지 + 침묵」 조합이
   구조적으로 성립한다. `lib/content-depth.ts:190,194,21`상 `description ≥ 400`(3점)
   + `origin ≥ 60`(2점) = `MIN_SCORE` 5점으로 출처 없이 색인 가능.
3. **경고 배너 3종과 noindex 분기가 도달 불가다.** `page.tsx:315-332`(machine/stale/
   incomplete `<aside>`), `:224`(`robots:{index:false}`), `:199-201`(`indexableVersions`
   필터, 항상 항등). `DETAIL_COPY`의 `machineTitle`·`staleTitle`·`incompleteTitle`과
   대응 body 6키 × 4로케일이 사문화 상태다. **렌더층은 "noindex로 보여준다",
   데이터층은 "숨긴다" — 두 정책이 어긋나 있다.**

`sourceLinks`(`:249`)가 `source_url` truthy 필터만 하는 것도 같이 남는다 —
`summarizeEvidence`의 URL 중복 제거·원본/맥락 구분이 없어 같은 URL 3개가 「출처 3건」이 된다.

### `DQ-015` — `link_only`가 스키마에 없다 (14)

`supabase/migrations/20260708004500_schema_v2.sql:15`
`create type copyright_status as enum ('unknown','embeddable','permission_needed','internal_only')`.
PostgREST가 `link_only`를 `22P02 invalid input value`로 거부한다(직접 확인).
그런데 `lib/actions/admin-sources.ts:184`가
`copyright_status: linkOnly ? "unknown" : "embeddable"` —
**관리자 플로우는 이미 `unknown`을 「링크만 허용」의 뜻으로 쓰고 있다.**
즉 `unknown` 293건은 「미판정」과 「링크 전용」 두 뜻이 섞여 있고 구분할 컬럼이 없다.
`permission_needed`·`internal_only`는 각 **0건**이라 enum 자체가 절반만 쓰인다.
`DQ-014`를 고치려면 이 의미 분리가 먼저다.

### `DQ-016` — `dead` 대표 14건 중 오탐 3건, 재검증 설비 없음 (14)

대상 14건 = `dead` 11 + `region_blocked` 3 (직접 확인). 전부 `platform=YouTube`,
`type=embed`, `moderation_status=approved`(공개 중). 14개 밈의 `meme_contents` 총합이
14행 — **어떤 문서에도 다른 재생 콘텐츠가 없다.** 대체 후보는 `meme_sources` 20행뿐이고
전부 `copyright_status=embeddable`.

- **대체 지정 가능 6건**: `f384zwnp`, `8usbz526`, `6x5vm3my`, `repzdxn4`, `329w7u7p`,
  `wgc93agj` — 대체는 namu.wiki 문서 링크라 임베드가 아닌 「출처에서 원본 보기」 폴백으로만 유효
- **오탐 후보 3건** `[미검증]`: `2j5tfqq7`, `7rnbewq7`, `6x5vm3my` — `availability=dead`인데
  oEmbed 200. 비공개 전환 전 재검증 필요
- **확정 유실 1건** `[미검증]`: `sdvd764t` (oEmbed 401). `7yaqepcn`·`yp9aj4pw`는
  `region_blocked`라 원본이 살아 있어 삭제 대상이 아니다
- 중복 2쌍이 섞여 있다: `xt52qg4j`/`rr8j2m8h`는 URL이 `YNOBV_uVzeY`로 동일,
  `repzdxn4`/`39fyk7an`은 같은 「애정남」 → 병합하면 실질 12건

**근본 원인은 14건이 아니라 `availability`를 갱신하는 재검증 경로가 없다는 것이다.**
오탐 3건은 「한 번 `dead`로 찍히면 되돌아오지 않는다」의 증거다.

### `DQ-014` — 같은 도메인이 두 권리 상태로 갈려 있다 (13)

| 도메인 | `unknown` | `embeddable` | 계 |
| --- | ---: | ---: | ---: |
| `namu.wiki` | **253** | **899** | 1,152 |
| `instagram.com` | **5** | **117** | 122 |

(전부 직접 확인) `unknown` 293건 중 namu.wiki가 253건(86.3%), instagram 5건,
나머지 35건이 국내 언론사 26개 도메인 `[미검증]`.
**`unknown` 293건만 정리하면 반대 방향으로 틀린 `embeddable` 1,016건이 남는다.**
도메인 정책 차이가 아니라 등록 경로 차이로 보이나, 등록 시점·경로 컬럼이 없어
확증할 수 없다. 언론사 35건은 `platform`이 TV 20 / Community 8 / News 7로 섞여 있어
도메인 단위 일관성이 없다 `[미검증]`.

**YouTube `unknown`은 0건이다** — 출처 2,715건 전부 `embeddable`. 「유튜브가 문제」라는
가설은 데이터로 반증된다.

### `A11Y-006` — `markdown-body`의 `alt` 빈 폴백 (13)

`components/markdown-body.tsx:55` `alt={alt ?? ""}`.
마크다운 저자가 `![](url)`로 alt를 비우면 **정보 이미지가 조용히 장식으로 강등**된다.
이 컴포넌트는 사용자·운영자가 쓴 본문(밈 설명·가이드)의 이미지를 렌더하므로 렌더
시점에 장식/정보를 구분할 근거가 없다. `?? ""`는 판단이 아니라 침묵이다.
작성 단계(제보 폼·관리자 폼)에서 alt를 필수화하는 쪽이 근본 해결이다.

전수 확인 결과 저장소에 `<img>` 15곳, **`alt` 누락 0건**, 무의미 alt(`"image"`·
파일명 등) **0건**, `next/image` 사용 **0건**. 나머지 12곳은 전부 적정 판정
(장식 `alt=""` + 인접 텍스트, 또는 부모의 `aria-label`/`aria-hidden`).

### `LOC-005` — sitemap이 빈 로케일 홈 4건을 등재한다 (13)

`app/sitemap.ts:133-140` `SEO_CONTENT_LOCALES.map(...)`이 `/en`·`/ja`·`/zh`·`/zh-tw`를
**조건 없이** `priority: 0.8`, `changeFrequency: "daily"`로 넣는다.
`meme_translations` 0행이므로 이 4개 홈의 밈 목록은 전부 빈 상태
(`app/[locale]/page.tsx:261` `featured.length > 0 ? … : copy.empty`)인데,
헤딩은 `Translated Korean memes` / `翻訳済みの韓国ミーム` 등 콘텐츠가 있다고 표방한다.
빈 페이지 4건을 매일 갱신되는 고우선 URL로 광고하는 셈이다.
로케일 **상세**는 새지 않는다(§1 참조) — 이 4건이 유일한 누출점이다.

### `DQ-013` — 중복쌍 간 `origin_year` 모순 6건 (11)

`#4 차도남/차도녀` 2010↔2011, `#5 야인시대 사딸라` 2003↔2002,
`#9 만찢남/만찢녀` 2012↔2016, `#10 펭수 펭하` 2019↔2020,
`#15 god 어머님께` 1999↔2000, `#16 그래 결심했어` 1994↔1993.
표본 3쌍을 직접 GET으로 재현했다 (`2eu27rzb` 1999 / `bzm4w8vy` 2000 등).

**병합 작업이 기존에 몰랐던 사실 오류를 드러낸다**: `bzm4w8vy`는 「어머님께」를
3집(2000)이라 서술하는데, 같은 DB의 `pgzywbqp`(god 촛불 하나, 2000)가 3집 타이틀을
「촛불 하나」라 적어 자기모순이다 `[미검증 — 본문 대조는 하위 감사 결과]`.
공개 문서 3,904건 중 `year_precision`이 전건 `unknown`이라 화면은 이미
「(추정)」으로 헤지돼 있지만(루프 007), 두 문서가 서로 다른 연도를 단언하는 상태 자체는
남는다.

### `LOC-001` — 로케일 표면을 켤 것인가 접을 것인가 (12)

`app/[locale]/` 2개 라우트(홈 + 상세 451줄) + `lib/meme-translations.ts` +
`lib/i18n-routing.ts`가 **프로덕션에서 한 번도 실행되지 않는다.**
0행 상태를 알리는 모니터가 없어, 언제부터 이랬는지도 알 수 없다.
선택지는 (a) 번역 운영을 켠다 — 그러면 `LOC-002~005`가 동시에 실현된다,
(b) 로케일 표면을 접고 sitemap 홈 4건을 뺀다, (c) 0행 알림만 붙이고 유지.
제품 방향 결정이라 **`HUMAN_GATE` 후보**로 올린다(기존 HG-001~007과 별건).

### `LOC-003` — 언어 칩과 hreflang이 다른 배열에서 나온다 (12)

`app/[locale]/memes/[key]/page.tsx:371` 언어 nav는 `versions`(무필터)를 돌고,
`:199-201` hreflang은 `indexableVersions`를 쓴다. 지금은
`getLocalizedMemeByShortId`가 비색인을 null로 떨궈 두 집합이 우연히 같지만,
그 게이트가 완화되면 「화면에는 링크가 있는데 hreflang에는 없는」 상태가 조용히 생긴다.
`versions`를 한 번 필터해 두 소비처가 같은 배열을 쓰게 하는 것이 단일 출처다.

**나머지 canonical/hreflang은 4개 로케일 전부 정합이다** — self-canonical
(`:203`, `:223`이 `buildLocalizedMetadata`의 기본 alternates를 통째로 덮음),
자기참조 hreflang 포함(`:180`), `zh-Hans`/`zh-Hant` 분리(`lib/i18n-routing.ts:31-32`),
ko↔로케일 상호 참조 대칭, `x-default`가 noindex를 가리킬 수 없음
(`isIndexableLocalizedMeme` → `isIndexableMeme(originalDepth)` 종속,
`lib/meme-translations.ts:208`). 여기서 더 손댈 것은 없다.

### `A11Y-010` — empty 상태 누락 5화면 (12)

공유 `EmptyState` 컴포넌트는 없고 화면별 개별 분기다. 커버된 곳:
`explore`(`components/explore-grid.tsx:280` 일러스트+제보 유도), `search`
(`page.tsx:73` + trending 폴백), `slang:258`, `timeline:165`,
`news`(`components/news-page-content.tsx:96`), `my`(`412`/`524`). 누락:

- `products` — `availableLinkCount`(`components/products-page-content.tsx:34`)를
  문구 인자로만 쓰고 0일 때 대체 UI가 없다. 링크가 전부 빠지면 헤더+제휴 고지만 남는다
- `news` 브리프 목록 — `components/news-page-content.tsx:118` `briefs.map(...)`에 폴백 없음
- `quiz` — 빈 문항이 `components/quiz-app.tsx:49` `throw new Error("empty")`로 **오류 UI**가 된다
- `weekly` — 섹션 숨김 전략이라 전 섹션이 동시에 비면 안내가 없다
- `admin/subscriptions` — empty 문구 미검출

### `A11Y-007` — 제휴 상품 이미지가 제목을 중복 낭독한다 (12)

`components/affiliate-product-image.tsx:34` `alt={productName}`인데 같은 카드의
`components/affiliate-product-card.tsx:57` `<h3>{product.productName}</h3>`가 동일
문자열을 이미 노출한다. 이미지가 상품명 이상의 정보를 주지 않으므로 `alt=""`가 정확하다.

### `DQ-012` — 중복 19그룹 38건, 문서 단위 병합이 불가능 (10)

`scripts/quality-check.mts:123`의 `normalizeTitle`(소문자화 + `\s\p{P}\p{S}` 제거)을
재현해 19그룹/38건 전부 2건짜리로 확인 — 리포트 수치와 일치 `[개별 판정은 미검증]`.
**19그룹 모두 동명이의가 아니라 구분자만 다른 진짜 중복이다**(`-`·`·`·`/`·따옴표·쉼표).
따라서 HG-004(a)는 「어느 것을 살릴지」가 아니라 「병합할 것인가」만 남는다.

HG-004 결정에 직접 영향:

- **자동 승자 선정이 안 통한다.** 근거·콘텐츠가 많은 쪽과 산문이 긴 쪽이 서로 다른
  그룹이 5건(#4·#6·#10·#13·#19) → 문서 단위가 아니라 **필드 단위 병합** 필요.
  추천안 C(수동)의 근거가 강화된다
- **#17 `4vcnfmsx`/`aw9bunnq`는 alias 충돌 275건과 같은 행이다** — (a)와 (b)를 따로
  처리하면 같은 행을 두 번 만진다
- **38건 전부 태그 0건** → (c) 태그 backfill을 (a)보다 먼저 하면 병합 후 재정리가
  발생한다. **(a) → (c) 순서 권장**
- 정규화가 구두점만 제거하므로 표기 자체가 다른 중복은 안 잡힌다 — **실제 중복 총량은
  38건보다 크다**

### `A11Y-009` — `loading.tsx` 실질 공백 6세그먼트 (11)

`app/(default)` 하위 page 41 / loading 28 / 누락 13 (직접 실측).
누락 13 중 서버 await 또는 `force-dynamic`이 확인돼 실제 공백인 것은 6개:
`admin/inquiries`, `admin/sources`, `admin/subscriptions`, `admin/users`,
`admin/users/[id]`, `premium`. 나머지 7개(`collections`, `editorial`,
`forgot-password`, `offline`, `pricing`, `reset-password`, `support`)는
정적이거나 폼 위주라 우선순위가 낮다.

같이 기록: `error.tsx`는 자체 보유 4개(`(default)`, `admin`, `my`, `submit`)뿐이고
나머지 37세그먼트는 그룹 루트로 폴백된다 — **경계는 상속되므로 미보호는 아니다.**
다만 외부 I/O를 직접 하는 `memes/[key]`, `explore`(`page.tsx:150,175` Supabase 쿼리),
`search`, `community` 계열, `premium`, `reset-password`, `support`는 자체 경계가
있으면 오류 문구를 맥락화할 수 있다.

### `A11Y-008` — `quiz-app` `rel` 누락 (11)

`components/quiz-app.tsx:337` `<Link href={memePath} prefetch={false} target="_blank">` —
`rel` 없음. `target="_blank"` 21곳 중 **유일한 예외**다(나머지 20곳 전부
`noopener noreferrer`). `memePath`가 내부 경로라 tabnabbing 실질 위험은 없고,
`next/link`는 `target="_blank"`에 rel을 자동 추가하지 않는다. 일관성 항목이다.

**`iframe title` 누락은 0건이다** — 5곳 전부 존재하고 동적 title도 폴백이 있다
(`coupang-dock.tsx:94`, `content-url-preview.tsx:239`, `meme-embed.tsx:440`·`:536`,
`admin/source-review-card.tsx:149`).

임무 범위 밖 관찰: `components/coupang-dock.tsx:94`는 서드파티 iframe인데 `sandbox`
없이 `referrerPolicy="unsafe-url"`이다. 쿠팡 파트너스 트래킹 요구로 보이나 별도 판단 필요.

### `LOC-004` — 로케일만 `year_precision`을 안 본다 (8)

ko는 `formatOriginYear(meme.origin_year, year_precision)`
(`app/(default)/memes/[key]/page.tsx:164-167`)로 `exact`/`year`일 때 단정 표기로
복귀하지만, 로케일 4종은 정밀도 인자를 받지 않고 영구 헤지다
(`app/[locale]/memes/[key]/page.tsx:67`, `:93`, `:119`, `:145` — 렌더 `:351`).
현재 전 문서 `unknown`이라 사용자에게 보이는 결함은 없고 방향이 보수적(과소주장)이라
정직성 위반도 아니다. **루프 013의 「로케일은 이미 다 됐다」 결론은 유효하다.**
운영자가 정밀도를 올려도 로케일만 헤지에 머무는 비대칭만 기록한다.

---

## 5. 기존 backlog·게이트와의 관계

| 기존 | 이번 감사가 더한 것 |
| --- | --- |
| `HG-004(a)` 중복 38건 | `DQ-012` — 필드 단위 병합 필요 근거 5건, (a)↔(b) 행 중복 1건, (a)→(c) 순서 |
| `HG-004(c)` 태그 backfill | 38건 전부 태그 0건 — (a) 이후로 미뤄야 함 |
| `DQ-007` 무출처 1,330건 | `DQ-014`·`DQ-015` — 출처가 있어도 권리 상태가 신뢰 불가 |
| `DQ-001`(루프 003) | `LOC-002` — **ko에서만 해소, 4개 로케일에 그대로 남아 있다** |
| `DQ-005`(루프 002) | 로케일 상세엔 `meme_contents` 렌더 자체가 없어 해당 없음. 단 회귀 가드도 없다 |
| `DQ-011`(루프 013) | `LOC-004` — 결론 유효, 정밀도 비대칭만 잔여 |
| `A11Y-*`(루프 010·011·014·016) | `A11Y-005` — generic role `aria-label` **3번째 재발**. 가드가 본체 |
| 신규 게이트 후보 | `LOC-001` — 로케일 표면 존치 여부 |

---

## 6. 확인하지 못한 것

- 중복 19그룹의 개별 승자 판정과 본문 사실 오류 — 텍스트 대조만 했고 `meme_contents`
  URL 대조는 안 했다
- YouTube oEmbed 200/401 응답 (오탐 3건·확정 유실 1건 판정의 근거)
- 언론사 26개 도메인 35건의 실제 약관
- `copyright_status`가 등록 경로별로 갈린 이유 — 등록 시점·경로 컬럼이 스키마에 없다
- `meme_translations`가 언제부터 0행인지 — 이력 테이블 없음
- 로케일 상세의 실사용 지표 — 404이므로 애초에 측정값이 없다

프로덕션은 GET만 수행했고 쓰기 0건, 소스 코드 변경 0건이다.
