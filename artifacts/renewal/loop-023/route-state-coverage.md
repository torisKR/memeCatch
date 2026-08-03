# loop-023 — `app/(default)` route별 error / loading / empty 상태 커버리지

조사 대상: `app/(default)` 아래 `page.tsx`를 가진 세그먼트 41개.
근거: 파일 존재 여부(`find`) + 각 page/컴포넌트의 렌더 분기 실제 코드.

## 0. 요약

| 항목 | 수치 |
| --- | --- |
| `page.tsx` 보유 세그먼트 | 41 |
| 자체 `error.tsx` 보유 | 4 (`(default)`, `admin`, `my`, `submit`) |
| 자체 `loading.tsx` 보유 | 28 |
| `loading.tsx` 없음 | 13 |
| 전역 폴백 | `app/global-error.tsx`, `app/(default)/error.tsx`, `app/(default)/loading.tsx`, `app/(default)/not-found.tsx` 존재 |

`app/(default)/error.tsx`가 그룹 루트에 있으므로 **error 경계 자체는 모든 route가 상속**한다.
아래 "error.tsx 없음"은 *자체 경계가 없어 루트 경계로 폴백* → 오류 시 해당 route의 레이아웃 문맥 없이
그룹 전체가 대체 UI로 바뀐다는 뜻이다.

## 1. 자체 `error.tsx`가 없는 세그먼트 (37개)

루트 `app/(default)/error.tsx`로만 폴백된다.

`about`, `admin/inquiries`, `admin/memes`, `admin/memes/[id]`, `admin/reports`,
`admin/sources`, `admin/submissions`, `admin/submissions/[id]`, `admin/subscriptions`,
`admin/users`, `admin/users/[id]`, `collections`, `collections/[slug]`, `community`,
`community/[id]`, `community/new`, `editorial`, `explore`, `forgot-password`, `login`,
`memes/[key]`, `news`, `offline`, `onboarding`, `premium`, `pricing`, `privacy`,
`products`, `quiz`, `rankings`, `reset-password`, `search`, `slang`, `support`,
`terms`, `timeline`, `weekly`

(`admin/*` 하위는 `app/(default)/admin/error.tsx`를 상속하므로 실질 폴백 품질은 다른
공개 route보다 낫다.)

### 자체 error 경계가 실제로 필요해 보이는 곳 (근거: 외부 I/O를 직접 수행)

| 세그먼트 | 근거 |
| --- | --- |
| `memes/[key]` | 상세 데이터 조회 실패 시 그룹 전체가 오류 화면으로 대체 |
| `explore` / `search` | Supabase 쿼리 직접 수행(`explore/page.tsx` 150·175행 `sq.in`/`q.in`) |
| `community` / `community/[id]` / `community/new` | 서버 액션 + DB 조회 |
| `premium` | `getPremiumEntitlement()` · `registerCurrentBillingIdentity()` 호출 |
| `reset-password` / `support` | `createClient()` 호출 |

## 2. `loading.tsx`가 없는 세그먼트 (13개)

| 세그먼트 | 서버에서 await 하는가 | 판정 |
| --- | --- | --- |
| `admin/inquiries` | `await requireOperatorPage(` + supabase | **필요** |
| `admin/sources` | `force-dynamic` + supabase | **필요** |
| `admin/subscriptions` | `await requireOperatorPage(` | **필요** |
| `admin/users` | `await listUsers(` + `force-dynamic` | **필요** |
| `admin/users/[id]` | `await getUserDetail(` + `force-dynamic` | **필요** |
| `premium` | `await getPremiumEntitlement(` 등 + `force-dynamic` | **필요** |
| `reset-password` | `await createClient(` | 낮음(폼 위주) |
| `support` | `await createClient(` | 낮음(폼 위주) |
| `collections` | 정적 상수(`COLLECTIONS`)만 사용 | 불필요 |
| `editorial` | 정적 문서 | 불필요 |
| `forgot-password` | 정적 폼 | 불필요 |
| `offline` | 정적 | 불필요 |
| `pricing` | 정적 | 불필요 |

즉 **실제 공백은 6개**: `admin/inquiries`, `admin/sources`, `admin/subscriptions`,
`admin/users`, `admin/users/[id]`, `premium`.
(admin 하위는 `app/(default)/admin/loading.tsx`가 상위 세그먼트 경계로 존재하지만,
자식 세그먼트 이동 시에는 적용되지 않는다.)

## 3. Empty 상태 커버리지

공유 `EmptyState` 컴포넌트는 **없다** (`components/` 내 해당 파일·심볼 0건). 각 화면이 개별 분기한다.

### 명시적 empty 분기가 있는 곳

| 화면 | 근거 |
| --- | --- |
| `explore` | `components/explore-grid.tsx:280` `items.length === 0` → 일러스트 `/brand/state-empty-search.webp` + "결과가 없어요" / "이 조건의 밈이 아직 없어요" + 제보 유도 |
| `search` | `search/page.tsx:73` `query && results.length === 0` 분기, 112행 `trending.length > 0` 폴백 |
| `slang` | `slang/page.tsx:258` `!hasTerms` 분기 |
| `timeline` | `timeline/page.tsx:165` `decades.length === 0` 분기 |
| `news` | `components/news-page-content.tsx:96` `highlights.length > 0 ? … : copy.noVotes` |
| `my` | `my-content.tsx:412` `saved.length === 0`, `:524` `submissions.length === 0` |
| `rankings`, `collections/[slug]`, `community`, `community/[id]`, `memes/[key]`, `submit`, `support`, `admin/{inquiries,memes,reports,sources,submissions,users/[id]}`, `admin`(대시보드) | "없습니다/없어요" 계열 문구 존재 |

### empty 분기가 누락되었거나 암묵적인 곳

| 화면 | 상태 | 근거 |
| --- | --- | --- |
| `products` | **empty 분기 없음** | `components/products-page-content.tsx`에서 `availableLinkCount`(34행)를 계산하지만 61행 문구 인자로만 쓰고 0일 때의 대체 UI가 없다. `activeEditorial.length > 0`(69행)은 섹션을 숨기기만 한다 → 링크가 0이면 헤더+고지만 남은 빈 페이지 |
| `news` (브리프 목록) | 부분 | 96행 highlights만 폴백. 118행 `briefs.map(...)`은 빈 배열이면 아무것도 렌더하지 않음 |
| `weekly` | 섹션 숨김 전략 | `components/weekly-digest.tsx:11` 주석대로 "섹션별로 비어 있을 수 있음 → 독립적으로 숨김/폴백". 전 섹션이 동시에 비면 안내 없음 |
| `collections` (목록) | 분기 없음 | 정적 상수 기반이라 실사용 상 비지 않음 → 위험 낮음 |
| `quiz` | 오류로만 처리 | `components/quiz-app.tsx:49` `questions.length === 0` → `throw new Error("empty")`. 빈 상태가 오류 UI로 표시됨 |
| `admin/subscriptions` | 확인된 empty 문구 없음 | "없습니다" 계열 grep 미검출 |

## 4. 우선순위 제안

1. `loading.tsx` 6건 추가 (`admin/inquiries`, `admin/sources`, `admin/subscriptions`, `admin/users`, `admin/users/[id]`, `premium`) — 전부 `force-dynamic` 또는 서버 await가 확인됨.
2. `products` empty 상태 — `availableLinkCount === 0`일 때 대체 UI. 현재 코드에 분기 자체가 없다.
3. `memes/[key]`·`explore`·`search`에 자체 `error.tsx` — 오류가 그룹 루트로 튀지 않게.
4. `quiz`의 빈 문항을 오류가 아닌 empty로 분리(`quiz-app.tsx:49`).

skipped: 공유 `EmptyState` 컴포넌트 추출 — 현재 문구·일러스트가 화면마다 달라 추상화 이득이 없다. 3개 이상이 같은 형태로 수렴하면 그때.
