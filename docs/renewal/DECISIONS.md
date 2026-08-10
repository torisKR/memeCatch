# DECISIONS

루프에서 내린 결정과, 사람이 결정해야 하는 `HUMAN_GATE` 항목을 기록한다.

---

## 루프 001에서 내린 결정 (자동 확정 가능 범위)

### D-001 — 새 DQI를 만들지 않고 `lib/content-depth.ts`를 재사용한다

LOOP.md는 0~~100점 DQI를 제안하지만, 이 저장소에는 이미 같은 목적의 0~~13점 스코어러
`lib/content-depth.ts`가 있고 `app/sitemap.ts`·상세 `robots`·광고 게재 판정이 전부
이 함수를 단일 기준점으로 쓴다. 점수 체계를 새로 만들면 “색인에서 빠진 문서 수”와
“품질 리포트의 저품질 문서 수”가 갈리고, 1인 운영에서 두 기준을 동기화하는 비용이
계속 발생한다.

**결정:** 품질 검사기는 `contentDepth()`를 그대로 import해 쓴다. 점수 체계를 바꿔야
할 이유가 생기면 그 함수 하나만 고치면 전 소비처가 함께 움직인다.
**되돌리는 방법:** `scripts/quality-check.mts`의 import를 별도 스코어러로 교체.

### D-002 — 품질 검사기는 `anon` 키로만 읽는다

`service_role`이 아니라 공개 키를 쓴다. 두 가지 이유:
(1) 최소 권한 — 이 도구는 어떤 쓰기도 하지 않는다.
(2) RLS를 통과한 뒤의 데이터를 보므로 **검사 대상이 실제 공개 화면과 일치한다.**

부수 효과로, 로컬 `.env.production`의 `SUPABASE_SERVICE_ROLE_KEY`가 401을 반환하는
것을 발견했다(anon 키는 200). service_role을 쓰는 기존 운영 스크립트가 지금 동작하지
않을 수 있다 → `LOOP_STATE.md` 위험 6번.

### D-003 — `tsconfig.json`에 `allowImportingTsExtensions`를 켠다

Node 24가 `scripts/*.mts`를 타입 스트리핑으로 직접 실행하므로 import 경로에 실제
확장자가 필요하다. `noEmit: true`가 이미 켜져 있어 이 옵션은 `tsc`의 검사 범위만
넓히고 빌드 산출물에는 영향이 없다. 대안(스크립트를 `.mjs`로 낮추기)은 검사기가
`lib/content-depth.ts`를 타입 안전하게 재사용하지 못하게 만들어 D-001을 깬다.

### D-004 — 루프 001은 제품 UI·프로덕션 데이터를 변경하지 않는다

LOOP.md 「최초 루프: 변경보다 기준선 확립」. 발견한 문제를 임의로 고치지 않고
backlog로 넘긴다. 실제 변경은 루프 002부터.

### D-005 — 저장은 Plus 급상승 알림의 암묵적 watch 의사표시로 해석한다 (루프 052)

별도 watch 테이블·토글·외부 푸시 채널을 만들지 않는다. 이미 사용자가 저장한 밈은
재방문 의도를 표현한 것이므로, active Plus 기간에는 그 밈이 `rising`일 때 기존의 개인
인앱 알림함에 `saved_rising` 신호를 넣는다. 저장하지 않은 밈은 기존 관심사 기반
`rising` 흐름을 그대로 쓴다.

**선택 이유:** 이 방식은 기존 `saved_memes`의 사용자 범위, `has_active_plus()`의 서버
권한 판정, `trend_alerts`의 RLS·30일 보존·상위 15개 제한을 그대로 재사용한다. 새
개인정보 수집, 새 notification provider, 사용자별 설정/해제 UI를 만들지 않아 1인 운영
비용을 낮춘다. 저장 밈은 category 후보에서 제외해 같은 밈이 같은 실행에 두 번 오지
않게 한다.

**정직성 경계:** `(user_id, meme_id, kind)` unique와 30일 보존은 동일 밈의 즉시
재알림을 억제한다. 따라서 UI는 "급상승하면 알림"까지만 말하며 반복 재상승 알림을
약속하지 않는다.

**되돌리는 방법:** migration 적용 전에는 파일을 제외한다. 적용 뒤에는
`fan_out_trend_alerts()`를 이전 정의로 복원하고 `saved_rising` 행만 삭제할 수 있다;
기존 `rising` 알림과 RLS 정책은 독립적으로 보존된다.

### D-006 — 글로벌 Plus 경로는 실제 정적 route만 locale prefix한다 (루프 053)

가격 페이지에 locale prefix를 붙이는 것은 검색·공유·언어 전환에서 동일 언어의 Plus 가치를
보이는 데 필요하다. 하지만 전체 route에 기계적으로 prefix를 붙이면 번역 page가 없는
`/en/explore`·`/th/pricing` 같은 404를 만든다.

**결정:** `localizedStaticPath()`의 allowlist를 실제 다국어 정적 route인 `/`와 `/pricing`으로
한정한다. 동적 밈 상세는 기존 translation availability-aware 경로를 유지하고, 나머지 UI-only
locale은 cookie 기반 unprefixed route를 유지한다. pricing metadata와 sitemap은 동일 `SEO_ROUTE_LOCALES`
목록을 사용해 canonical/hreflang 불일치를 막는다.

**되돌리는 방법:** localized pricing page·sitemap entries·allowlist 사용처를 함께 제거하면 기존
cookie-localized `/pricing` 한 경로로 돌아간다. billing API와 DB에는 변경이 없다.

### D-007 — 저장 재발견은 Plus Meme Vault의 서버 필터로 제공한다 (루프 054)

무제한 저장은 찾을 수 없으면 개인 사전/작업 자산이 되지 못한다. client에서 현재 50개
페이지를 필터하면 Plus의 무제한 약속과 충돌하고, free 계정이 URL로 server filter를 우회하면
기능 경계도 무너진다.

**결정:** `/my`의 private server query에서 active Plus만 title/summary와 `safety_level`을
필터한다. `saved_memes` RLS를 유지하고, embedded `memes!inner` + referenced-table filter를
사용해 parent saved row를 정확히 제한한다. URL query는 raw PostgREST grammar에 들어가기 전
문자 allowlist로 정규화한다. 필터가 있을 때만 head-only total count를 추가해 전체 보관 수와
검색 결과 수를 구분한다.

**되돌리는 방법:** `saved-library.ts`, `/my` query filter, Vault UI/copy만 함께 제거하면 기존
최근 저장순 pagination으로 복귀한다. saved data·folder/note RPC·billing entitlement·schema에는
변경이 없다.

### D-008 — 잠긴 export의 Plus CTA도 locale-safe public pricing을 쓴다 (루프 055)

고급 template·story format·3x export는 실제 Plus 가치를 바로 보여 주는 진입점이다. 이 시점에
`/premium` 같은 공용 대시보드로 보내면 가격, 혜택, checkout 설명을 같은 언어로 계속 읽을 수 없다.

**결정:** `ExportButton`은 직접 URL을 조립하지 않고 `exportUpgradeHref()` →
`localizedStaticPath("/pricing", locale)`를 사용한다. 이는 루프 053의 실제 정적 route allowlist를
재사용하므로 SEO locale은 `/en|ja|zh|zh-tw/pricing`, UI-only locale은 `/pricing`을 사용한다.
접근성 close label도 copy table에 넣어 한국어 고정을 제거한다.

**되돌리는 방법:** helper 호출과 locale copy 항목만 되돌리면 이전 export dialog 동작으로 돌아간다.
export entitlement enforcement, billing, checkout, DB에는 영향이 없다.

### D-009 — 번역 모델 호출과 production insert를 분리한다 (루프 056)

Machine translation은 reviewed-only 공개 경계를 지켜도, model 호출과 linked Supabase insert를
동일한 `--apply`에 묶으면 생성한 draft를 먼저 검증·검토할 수 없다.

**결정:** `--emit-artifact`는 sitemap/linked query를 read-only로 사용하고 local SQL file만
exclusive-create·append한다. 각 row는 기존 atomic SQL의 source snapshot lock·`status='machine'`을
그대로 쓴다. artifact 디렉터리의 존재하는 `(meme_id, locale)`은 재선정하지 않으며, `--apply`와
동시에 실행할 수 없다. 실제 SQL 적용과 reviewed status 승격은 운영자 절차로 남긴다.

**되돌리는 방법:** CLI artifact flags와 helper만 제거하면 기존 dry-run/explicit apply 양갈래로
돌아간다. 이 루프는 production DB write를 수행하지 않았으므로 data rollback은 필요 없다.

### D-010 — 저장 밈 재발견은 안전 신호를 행동 분류로 보수적으로 축소한다 (루프 057)

구독 가치가 단순 저장 개수에 머물면 사용자가 현재 어떤 자산을 다시 꺼낼지 판단해야 한다. 그러나
`green/yellow/gray/red`는 “추천 가능” 하나로 합칠 수 없는 안전 신호다.

**결정:** owner-scoped `saved_memes`의 제한된 서버 join만 사용해, green+rising/active만 ready,
yellow+rising/active만 context check, 그 밖의 lifecycle 또는 gray/red는 archive/revisit로
분리한다. 상위 목록은 trend score와 저장 시각으로 안정적으로 정렬하고 bucket당 3개로 제한한다.
모든 private data fetch는 server에서 끝내고, browser fetch·saved/billing/alert write·새 migration을
추가하지 않는다. 가격 UI에는 동일한 기능 효과를 명시하되, 반복 알림이나 자동 사용 권고는 약속하지 않는다.

**되돌리는 방법:** radar helper/component/page slot 및 pricing copy만 함께 제거하면 기존 Plus dashboard와
saved library로 돌아간다. saved rows·RLS·billing·alerts·schema에는 변경이 없다.

### D-011 — global alert recovery는 existing onboarding과 safe return을 재사용한다 (루프 058)

새 interests route나 client write endpoint를 만들지 않는다. 기존 onboarding은 이미 authenticated
server action과 `safeNext` redirect boundary를 갖고 있는데, alert bell만 존재하지 않는 route를 가리켰다.

**결정:** alert CTA는 `/onboarding?next=/premium`으로 이동해 한 번의 설정 뒤 사용자가 온 Plus
dashboard로 돌아오게 한다. form/metadata의 모든 새 UI 문자열은 `MY_COPY`에 넣고, display category와
age label은 기존 profile copy를 재사용한다. server action의 category allowlist, age optional behavior,
profile write, auth/redirect semantics는 고치지 않는다.

**되돌리는 방법:** link constant와 onboarding copy consumption/metadata function만 되돌리면 이전 route와
Korean UI로 복귀한다. profiles·auth·schema·analytics 데이터에는 rollback이 없다.


### D-012 — submit locale은 trusted request context에서만 결정한다 (루프 059)

제보 흐름은 browser form·client preview·server action·RPC가 만나는 지점이다. locale hidden field를
추가하면 번역 대상의 언어와 권한/입력 검증 경계가 한 form payload에 섞이고, client copy만 바꾸면
server validation 오류가 고정 한국어로 남는다.

**결정:** page metadata와 server action은 각각 `getRequestLocale()`를 사용하고, form은 active UI
locale의 `SUBMIT_COPY`만 렌더한다. `SUBMIT_COPY`는 validation·async·preview·success/error 카피의
단일 source이며, `zh-tw`는 기존 Chinese fallback을 쓴다. badge는 optional display label만 받고
status class/기본 label source는 바꾸지 않는다.

**불변 경계:** Zod field limits/HTTPS rule, authenticated user 확인, supported oEmbed server recheck,
`meme-uploads/${user.id}/` attachment prefix, RPC error mapping, TikTok OAuth state와 `safeNext`는
변경하지 않는다. machine translation, schema/migration, analytics, production write도 추가하지 않는다.

**되돌리는 방법:** `SUBMIT_COPY` consumer와 optional badge label만 되돌리면 기존 UI 문구로
복귀한다. submission data, RLS, RPC, auth, upload object에는 rollback이 없다.

### D-013 — Daily Signal은 provider-neutral relay와 명시적 opt-in으로 시작한다 (루프 068)

Plus의 현재 급상승·저장 밈·주간 브리프는 dashboard를 열어야만 전달되는 pull-only 구조다. 특정
이메일 업체를 코드에 고정하면 credential·법적 고지·bounce/unsubscribe 운영이 제품 코드와
결합되고, 이 checkout에는 어떤 발송 provider도 설정되어 있지 않다.

**결정:** `plus_digest_preferences`에서 사용자가 직접 수신을 켜고 언어를 선택한다. `plus_digest_deliveries`
는 `(user_id, KST delivery_date)` idempotency ledger로만 동작하며, provider-neutral JSON relay에
`delivery_id`를 idempotency key로 전달한다. provider URL/from/token이 없으면 cron은 queue/claim/send를
실행하지 않고 `not_configured`를 반환한다. 메일은 기존 reviewed/current 콘텐츠와 green/yellow 신호만
사용하고, production 적용 전에는 mock relay와 source-contract로만 검증한다.

**되돌리는 방법:** pricing/dashboard 설정과 cron route를 제거하고, migration을 적용하지 않은 상태로
유지하면 기존 pull-only Plus 흐름으로 돌아간다. 이미 발송된 외부 메일은 relay provider의 보존·철회
정책을 따른다.

---

## HUMAN_GATE — 사람 결정 대기

### HG-001 — 공개 문서의 96.3%가 충실도 미달인 상태를 어떻게 할 것인가

**결정 필요 사항**
공개 문서 3,904건 중 3,759건이 `content-depth` 기준 미달이라 색인·광고 대상이
145건뿐이고, 「아직 정리 중」 배너가 사실상 전 사이트에 뜬다. 평균 고유 산문 173자,
하한 250자. 최상위 문서조차 `description`이 127자 수준이다.

**선택지**

|     | 안                          | 내용                                                         |
| --- | --------------------------- | ------------------------------------------------------------ |
| A   | 임계값을 실제 분포에 맞춘다 | `MIN_PROSE_CHARS`를 250 → 150 등으로 낮춰 색인 대상을 늘린다 |
| B   | 콘텐츠를 보강한다           | 상위 트래픽 문서부터 산문을 채운다. 임계값 유지              |
| C   | 둘로 나눈다                 | 색인 임계값(낮춤)과 「정리 중」 배너 임계값(유지)을 분리한다 |

**각 선택지의 사용자 영향**

- A: 검색 유입 회복이 가장 빠르다. 다만 얇은 문서가 색인·광고에 들어가 “저품질
  화면에 광고 게재”를 피하려던 원래 설계 의도가 약해진다.
- B: 품질은 가장 좋지만 1인 운영에서 3,759건 보강은 현실적으로 수개월 단위다.
  그동안 색인은 145건에 머문다.
- C: 사용자에게는 “확인된 만큼만 공개” 메시지를 유지하면서 색인만 넓힌다. 다만
  기준이 둘이 되어 D-001의 단일 기준점 원칙이 약해진다.

**데이터·법적 위험**
A/C는 얇은 문서가 검색 결과에 노출되므로 검색엔진 품질 평가 위험이 있다. 광고
게재 판정과 묶여 있어 게시자 정책(인벤토리 가치)도 함께 검토해야 한다.

**운영 비용** A: 낮음 / B: 매우 높음 / C: 중간

**추천안: C.** 색인 임계값을 낮추되 「정리 중」 배너와 광고 게재는 현행 기준을
유지한다. 이유: 검색 유입은 지금 회복되어야 B의 재원(트래픽 기반 우선순위)이
생기는데, 광고·배너 기준을 함께 낮추면 사용자 신뢰와 게시자 정책을 동시에 건드린다.

**되돌리는 방법** `lib/content-depth.ts`의 임계값 상수 되돌리기 + 사이트맵 재생성.

---

### HG-002 — 안전 등급 스케일에서 `이미 늦음`을 분리할 것인가

**결정 필요 사항**
`lib/labels.ts:10`의 안전 등급이 “써도 됨 / 맥락 주의 / **이미 늦음** / 쓰면 위험”이다.
`이미 늦음`은 안전성이 아니라 시의성이고, 유행 상태에는 이미 `식는 중`·`추억 밈`이
있다. LOOP.md가 명시적으로 사람 결정으로 넘긴 항목이다. 대상 문서 168건.

**선택지**

- A: 현행 유지 (안전 스케일에 그대로 둔다)
- B: `gray`를 안전 스케일에서 빼고 유행 상태로 옮긴다. 안전은 3단계로
- C: 라벨만 바꾼다 — `이미 늦음` → `지금은 잘 안 씀`

**사용자 영향** B가 개념적으로 가장 정확하지만 168건의 안전 등급을 재판정해야 하고,
`/about`·`/editorial` 설명 문서와 `lib/i18n-my.ts` 등 로케일 문구가 함께 바뀐다.
C는 비용이 가장 낮으나 축 혼재는 그대로 남는다.

**데이터·법적 위험** 낮음. 다만 안전 등급 체계 변경은 편집 원칙 변경이라 공개
문서(`/editorial`)와 일치해야 한다.

**운영 비용** A: 0 / B: 높음 / C: 낮음

**추천안: B**, 단 `HG-003`(usage_context 재판정)과 함께 한 번에 처리한다. 두 작업
모두 168~3,310건의 안전 신호를 다시 보는 일이라 따로 하면 같은 문서를 두 번 만진다.

**되돌리는 방법** `lib/labels.ts` 되돌리기 + 마이그레이션 롤백.

---

### HG-003 — 상황별 사용 신호 84.8%가 동일값인 문제를 어떻게 처리할 것인가

**결정 필요 사항**
공개 문서 3,310건에서 `usage_context`의 4개 상황 값이 전부 같다(3,298건은 전부
`green`). 화면은 상황별 판정처럼 보여주지만 데이터는 단일값이다.

**선택지**

- A: 데이터를 재판정한다 (상황별로 실제 값을 채운다)
- B: 화면을 데이터에 맞춘다 — 단일값 문서는 상황별 표를 숨기고 전역 신호만 보여준다
- C: 「상황별 판정 미확인」 상태를 신호 체계에 추가한다

**사용자 영향** A는 3,310건 재판정이라 1인 운영에서 비현실적이다. B는 지금 당장
정직해지지만 상황별 가이드라인이라는 서비스 차별점이 대부분 문서에서 사라진다.
C는 “아직 확인 안 됨”을 드러내 LOOP.md 「불완전함을 숨기지 않되 무엇이 부족한지
구체적으로」에 부합한다.

**데이터·법적 위험** 중간 — 직장/가족 맥락에서 “써도 됨”이라고 잘못 안내하면
사용자가 실제 손해를 볼 수 있다. 특히 `red`·`gray` 문서 271건에서 4칸 동일값은 위험하다.

**운영 비용** A: 매우 높음 / B: 낮음 / C: 중간

**추천안: C + 우선순위 A.** 신호 체계에 `미확인`을 추가해 단일값 문서를 정직하게
표시하고, 재판정은 상위 트래픽 문서와 `red`·`gray` 문서부터 순차 진행한다.

**되돌리는 방법** 표시 계층 변경은 코드 되돌리기. 데이터 재판정은 `meme_revisions`
스냅샷으로 복원.

---

### HG-004 — 중복 문서 38건 · alias 충돌 275건 · 태그 0건을 프로덕션에서 고칠 것인가

**결정 필요 사항**
LOOP.md는 대량 문서 병합·삭제와 프로덕션 backfill을 모두 `HUMAN_GATE`로 규정한다.
해당 작업: (a) 정규화 제목 중복 19그룹 38건 병합, (b) alias 충돌 275건 정리,
(c) 전 문서 태그 backfill.

**선택지**

- A: 전부 자동 backfill (dry-run 후 일괄 적용)
- B: 운영자 검토 큐로 넘겨 수동 확정
- C: (c) 태그만 자동, (a)(b)는 수동

**사용자 영향** 중복·alias는 검색 품질에 직접 영향. 태그는 관련 밈 추천 품질에 영향.
**데이터·법적 위험** 병합은 되돌리기 어렵다. slug가 사라지면 기존 검색 유입이
깨지므로 영구 리다이렉트와 sitemap 갱신이 필수다(LOOP.md 절대규칙 7).
**운영 비용** A: 낮지만 위험 / B: 높음 / C: 중간

**추천안: C.** 태그 backfill은 되돌리기 쉽고 삭제가 없어 dry-run + 일괄 적용이
합리적이다. 중복 병합은 URL이 사라지는 작업이라 38건을 사람이 직접 본다.

**되돌리는 방법** 태그: 매핑 행 삭제. 병합: `meme_revisions` 스냅샷 + 리다이렉트 유지.

---

### HG-005 — 쿠팡 제휴 도크가 본문을 덮는 배치를 바꿀 것인가

**결정 필요 사항**
제휴 도크(`aside.fixed.bottom-16`)가 상세 대표 임베드 하단과 랭킹 4위 카드를 덮는다.
LOOP.md는 광고·후원 위치 변경을 `HUMAN_GATE`로 규정한다.

**선택지**

- A: 현행 유지
- B: 고정 해제 — 본문 흐름 안 특정 지점에 배치
- C: 고정 유지 + 본문 하단 패딩을 도크 높이만큼 확보

**사용자 영향** C가 가장 작은 변경으로 겹침을 없앤다. B는 노출이 줄어 수익에 영향.
**데이터·법적 위험** 낮음. 다만 “광고” 고지 문구는 어느 안에서도 유지해야 한다.
**운영 비용** 모두 낮음.
**추천안: C.** 수익 구조를 건드리지 않고 겹침만 제거한다.
**되돌리는 방법** 패딩 값 되돌리기.

---

### HG-006 — 분석 이벤트 9종을 추가할 것인가 (루프 015에서 신규)

**결정 필요 사항**

LOOP.md 「분석 이벤트」가 요구하는 13종 중 **4종만** 구현돼 있다. 이벤트 추가는
LOOP.md가 `HUMAN_GATE`로 규정한 「사용자 데이터 수집 범위 확대」에 해당하므로
명세와 개인정보 검토까지만 만들고 확정하지 않는다.

| LOOP.md 이벤트                  | 현재 | 비고                                 |
| ------------------------------- | :--: | ------------------------------------ |
| `search_submitted`              |  ✅  | `search_submit(query, result_count)` |
| `search_zero_result`            |  ✅  | `search_no_result(query)`            |
| `search_result_opened`          |  ✅  | `search_result_click(query, to)`     |
| `meme_shared`                   |  ✅  | `share_click`                        |
| `search_reformulated`           |  ❌  | 검색 재입력률 측정 불가              |
| `filter_applied`                |  ❌  | 탐색 필터 사용 패턴 불명             |
| **`meme_source_opened`**        |  ❌  | **상세 → 출처 확인 전환 측정 불가**  |
| `usage_context_opened`          |  ❌  | 상황별 신호 실제 열람률 불명         |
| **`correction_report_started`** |  ❌  | **정정 제보 진입 측정 불가**         |
| `correction_report_submitted`   |  ❌  | 제보 완료율 불명                     |
| `meme_saved`                    |  ❌  | 저장 전환 불명                       |
| `submission_started`            |  ❌  | 제보 퍼널 불명                       |
| `submission_completed`          |  ❌  | 제보 퍼널 불명                       |

**왜 지금 중요한가**

루프 003은 근거 0건 문서에서 검수 주장을 걷어내고 「출처를 아시면 알려 주세요」 CTA를
넣었다. 루프 006은 랭킹에 표본 경고를 붙였다. **둘 다 "정직해지면 사용자가 떠나는가,
아니면 오히려 참여하는가"를 검증해야 하는 변경인데, 지금은 측정 수단이 없다.**
LOOP.md가 핵심 지표로 꼽은 「상세 → 출처 확인」과 「상세 → 정정 제보」가 정확히
비어 있는 두 칸이다.

**선택지**

|     | 안                                                            | 범위                                   |
| --- | ------------------------------------------------------------- | -------------------------------------- |
| A   | 13종 전부 구현                                                | 제보·저장·필터 퍼널까지                |
| B   | **2종만** — `meme_source_opened`, `correction_report_started` | 루프 003·006의 효과 검증에 필요한 최소 |
| C   | 현행 유지                                                     | 추가 수집 없음                         |

**각 선택지의 사용자 영향** A는 퍼널 전체가 보이지만 수집 범위가 크게 넓어진다.
B는 이번 리뉴얼의 핵심 가설(정직한 표시가 참여를 해치지 않는가) 하나만 검증한다.
C는 앞으로도 트래픽 근거 없이 우선순위를 정해야 한다 — `BACKLOG.md`의 트래픽
가중치가 계속 추정값으로 남는다.

**데이터·법적 위험**

- 제안하는 2종은 **개인정보를 담지 않는다**: `meme_source_opened(short_id, platform)`,
  `correction_report_started(short_id, from)`. 둘 다 공개 URL에 이미 드러나는 값이다.
- 반면 **기존 `search_submit(query)`·`search_no_result(query)`는 원문 검색어를 보낸다.**
  LOOP.md는 「원문 검색어를 무조건 저장하지 말고 개인정보 가능성을 검토한다」고
  명시한다. 사용자가 검색창에 이름·연락처를 넣는 경우가 있어 **이건 이미 있는 위험**이다
  → 별건으로 검토 필요(아래 권고).
- 개인정보처리방침(`/privacy`)에 수집 항목이 반영돼야 한다.

**운영 비용** A: 중간 / B: 낮음 / C: 0

**추천안: B + 기존 검색어 수집 재검토.**
2종만 추가해 이번 리뉴얼의 효과를 검증하고, 그와 별개로 **원문 검색어 전송을
길이 제한·해시·상위 N개 화이트리스트 중 하나로 낮추는 안**을 함께 검토하기를 권한다.
새 이벤트를 늘리는 것보다 이미 나가고 있는 원문 검색어가 개인정보 관점에서 더 큰
노출이다.

**되돌리는 방법** `track()` 호출부 제거 + `GtagEvent` 유니온에서 삭제. GA4에 이미
수집된 데이터는 별도 보존기간 설정으로 처리한다.

---

### HG-007 — ISR 세그먼트의 soft-404를 어떤 비용으로 고칠 것인가 (루프 019에서 신규)

**결정 필요 사항**
존재하지 않는 밈 URL이 200 + not-found UI로 응답하고 ISR 캐시에 저장된다(SEO-001).
라우터 수준 404는 정상이며, `experimental.globalNotFound` + ISR 세그먼트 조합에서만
발생한다(Next 16.2.10). 조사 상세: `artifacts/renewal/loop-019/seo-001-investigation.md`

**선택지**

- A: `/memes/[key]`를 force-dynamic으로 — soft-404 해소, **ISR 캐시 상실**(상세 전체 매 요청 SSR, LCP·DB 부하)
- B: 다음 Next 패치 업그레이드에서 재검 — 해소 여부 불확실, 검증 비용
- C: proxy에서 미존재 short_id 선제 404 — 모든 상세 요청에 DB 조회 지연 추가
- D: 현상 유지 — soft-404 잔존, 색인 오염 위험 지속

**추천안: B, 그때까지 D.** A·C는 성능 비용이 결함 영향보다 크다. 삭제·비공개 문서
URL이 색인에 남는 위험은 sitemap 제외 + noindex가 부분적으로 완화한다.
**되돌리는 방법** A/C는 코드 되돌리기. B는 버전 고정.

---

### HG-008 — 「밈 아님」 공개 문서 처리 방침 (루프 023에서 신규)

**결정 필요 사항**
층화 표본 50건 중 9건(18%)이 밈이 아니라 오디션 우승 사건·발매곡·게임 용어·소비자
사건·실존 스트리머다. **9건 전부 approved**이고 상위 3건의 trend_score가 309~335로
랭킹 최상단이다. 경계 판정까지 합치면 27건(54%)이 「이 서비스가 다루는 대상인가」를
다시 물어야 한다. 목록: `artifacts/renewal/loop-023/sample-review-synthesis.md` §3.

**선택지**

- A: 비공개 전환(internal로 내림) — URL 소멸, 검색 유입 상실
- B: 별도 카테고리/코너 분리(「밈은 아니지만 알아야 할 사건」) — URL 유지, taxonomy 확장
- C: 현행 유지
  **사용자 영향** A는 상위 트래픽 문서가 사라진다. B는 정직하면서 유입을 지킨다.
  **데이터·법적 위험** C는 「밈 사전」 표방과 콘텐츠의 불일치가 지속된다. 실존 인물
  문서(`vkb5ctmz`)는 별도 위험.
  **운영 비용** A: 낮음 / B: 중간(분류 기준 명문화 필요) / C: 0
  **추천안: B.** 단, 판정 기준을 먼저 `/editorial`에 명문화해야 재현 가능하다(HG-008
  착수 전 선행 작업). 표본 밖 전수 판정은 그 기준으로 별도 배치.
  **되돌리는 방법** 분류 필드 되돌리기(B), moderation 상태 되돌리기(A).

---

### HG-009 — 카드 신호 구성·불완전 문서 4필드 확장 (루프 043에서 정식 등재)

**결정 필요 사항** (디자인·편집 판단 2건 묶음)
(a) DES-006: 카드에 category·lifecycle·usage signal이 동시 노출돼 §6 「과도한 경쟁」
지적 대상 — 어떤 신호를 뺄지는 정보 우선순위 결정.
(b) DES-009: DocStatusNote를 §4의 4필드(확인 완료/추가 확인 중/마지막 검수/제보 필요)
로 확장 — 「마지막 검수」 필드는 검수 시점의 공식 노출 확대라 편집 표면 결정.
설계안: artifacts/renewal/loop-024/incomplete-doc-v2.md

**선택지** (a) A: 현행 / B: 카드에서 lifecycle 제거(상세에서만) / C: usage signal만 유지
(b) A: 현행 / B: incomplete-doc-v2 설계안 적용
**추천안** (a) B — 카드의 핵심 질문은 「지금 써도 되나」이므로 안전 신호 우선,
lifecycle은 상세 정답 카드가 이미 담당. (b) B — 단 「마지막 검수」는
updated_at이 아니라 실제 검수 시점 필드가 생긴 뒤에(현재 스키마엔 없음).
**되돌리는 방법** 둘 다 컴포넌트 되돌리기.

---

## 결정 확정 (2026-08-04, 루프 047) — 운영자 위임 판정

> 사용자 지시: "너가 직접 판단해서 결정해줘" (2026-08-04). 이에 따라 HG-001~009를
> 아래와 같이 확정한다. 각 항목의 근거는 위 게이트 본문의 분석을 따른다.

| 게이트 | 결정                                                                                                                               | 실행 상태                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| HG-001 | **C** — 색인 임계만 150자로 분리, 배너·광고 게재는 250자 유지                                                                      | 루프 047 구현                                                                       |
| HG-002 | **B** — `이미 늦음`을 안전 스케일에서 유행 상태로 이동(안전 3단계)                                                                 | **결정만 확정.** 168건 재판정이 필요해 HG-003 재판정과 묶어 별도 배치 루프에서 실행 |
| HG-003 | **C + 우선순위 A** — 동일값 문서는 「상황별 판정 미확인」 정직 표시, 재판정은 red/gray·상위 트래픽부터                             | 표시 계층은 루프 047 구현, 재판정은 별도 배치                                       |
| HG-004 | **C** — (c) 태그만 자동(제안서 권고대로 **R2만**, 1,142행), (a) 병합 38건·(b) alias 275건은 수동 유지                              | R2 backfill 루프 047 적용 + getRelatedMemes 정렬 수정                               |
| HG-005 | **C** — 도크 고정 유지 + 본문 하단 패딩 확보                                                                                       | 루프 047 구현                                                                       |
| HG-006 | **B** — `meme_source_opened`·`correction_report_started` 2종만 추가 + 기존 원문 검색어 64자 절단 + /privacy 반영                   | 루프 047 구현                                                                       |
| HG-007 | **B, 그때까지 D** — Next 패치 대기, soft-404 UI noindex 보장으로 완화                                                              | noindex 루프 047 확인·보강                                                          |
| HG-008 | **B** — 「밈은 아니지만 알아야 할 사건」 분리. 선행 조건인 판정 기준 명문화(/editorial)부터 다음 루프에서, 9건 재분류는 그 후 배치 | 결정 확정, 실행 후속                                                                |
| HG-009 | **(a) B** — 카드에서 lifecycle 제거(상세 정답 카드가 담당), **(b) 조건부 보류** — 「마지막 검수」는 실제 검수 시점 필드 신설 후    | (a) 루프 047 구현                                                                   |

**판정 원칙**: ① 게이트 본문의 추천안이 45루프 간 축적된 실측에 기반하므로 원칙적으로
채택하되, ② 대량 편집 판단(168건 재판정·38건 병합·9건 재분류)은 자동화하지 않고
수동/배치 절차를 유지하며, ③ 되돌리기 비용이 낮고 실측 검증이 가능한 것만 즉시 실행한다.

### D-014 — 글로벌 번역 요청은 기존 Plus 요청 경계로 연결하고, 공개 피드는 reviewed-only로 유지한다 (루프 069)

한국어 canonical 상세에서 제공하는 글로벌 번역 요청은 새로운 번역 저장·공개 경로가 아니라,
현재 `meme_translations`의 reviewed/current 가용성을 계산해 빠진 SEO locale만 기존
`TranslationPriorityButton`과 `/api/translation-priority`로 연결한다. 저장 밈·active Plus·owner scope·
공개 밈 재검증은 기존 서버 경계를 유지하며, 운영자의 GPT 보조 검수와 승인/CAS 없이는 번역이 공개되지 않는다.

`llms.txt`와 sitemap·hreflang·공개 상세의 공통 정책은 reviewed/current/complete만 public surface에
포함하는 것이다. machine 또는 stale draft는 operator-private workflow에만 남고 공개 페이지·검색·AI
discovery feed에 노출하지 않는다고 명시한다. 이번 루프에서는 번역 생성, DB write, production migration,
배포를 하지 않았고, 이 정책을 향후 번역 배치와 Plus 수요 큐의 invariant로 유지한다.

### D-015 — Plus 컬렉션 브리프는 개인 활용용 private export로만 제공한다 (루프 070)

저장 밈 컬렉션을 구독자의 실질적인 작업 산출물로 만들기 위해, 기존 owner-scoped `saved_memes`를
최대 100개의 Markdown 브리프로 변환한다. 브리프에는 개인 메모가 들어가므로 `private, no-store`와
attachment 응답으로만 제공하고, public URL·sitemap·검색·AI feed에는 노출하지 않는다.

브리프에 포함되는 밈은 현재 `approved`·`limited` 공개 행으로 제한한다. 요청 locale의 reviewed/current
번역이 없으면 언어를 속이지 않도록 한국어 원문 fallback을 명시한다. 새 DB write·migration·service-role
경로는 만들지 않고, Plus entitlement와 기존 saved_memes RLS를 권한의 단일 기준으로 사용한다.

### D-016 — Daily Signal은 이메일과 in-app 카드를 같은 reviewed/current 후보 계약으로 공유한다 (루프 071)

외부 relay credential과 production migration이 아직 승인되지 않은 동안에도 Plus 구독 가치가
대시보드에서 끊기지 않도록, `/premium`에 최근 36시간의 `rising`·`saved_rising` 신호를 보여주는
서버 렌더링 카드를 추가한다. 이메일과 in-app은 delivery channel만 다르고, 후보 필터·saved 우선순위·
최대 3개·green/yellow·approved/limited·현재 reviewed 번역·locale-safe 링크는 동일한
`buildPlusDailySignalCandidates()`를 사용한다.

이 카드는 새 콘텐츠를 생성하거나 자동 게시하지 않으며, free branch에는 signal query와 UI를 전달하지
않는다. 이메일 opt-in/ledger/relay는 별도 운영 게이트로 유지하고, Supabase migration/RLS/RPC·실제
발송·수신을 관찰하기 전에는 production 완료로 선언하지 않는다.

### D-017 — Global Meme Daily는 5개 locale의 reviewed/current 후보를 KST schedule로 고정하고 완료를 서버에서 판정한다 (루프 072)

Plus 구독 반복 사용을 만들기 위해 `/daily`와 `en`·`ja`·`zh`·`zh-tw` localized route에서 매일
3문제를 제공한다. 날짜 경계는 `Asia/Seoul`로 고정하고, schedule은 approved/limited이며 한국어 원문과
4개 글로벌 locale 번역이 모두 reviewed·원문 revision current·필수 필드 complete인 밈만 포함한다.
매일 12개 후보를 한 번 고정하고 날짜·locale·후보 순서 기반 deterministic generator로 문제를 만들므로
재방문·언어 변경 때 같은 날짜의 콘텐츠가 임의로 바뀌지 않는다. 후보가 부족하면 억지로 한국어를
번역처럼 표시하지 않고 unavailable 상태를 보여준다.

완료 API는 클라이언트에서 `locale`만 받고 user id·challenge date·meme ids는 세션과 서버 schedule에서
파생한다. Plus entitlement와 현재 KST 날짜를 security-definer RPC에서 다시 확인하고, completion
원장은 `(user_id, challenge_date)`를 유일 키로 하여 재전송을 idempotent하게 처리하며 streak를 서버에서
계산한다. 직접 table write는 차단하고 authenticated RPC만 허용한다.

이 결정은 로컬 코드·source contract·HTTP boundary까지 검증했지만, migration/RLS/RPC 적용과 실제
authenticated Plus 성공·DB reset·production deploy는 별도 운영자 게이트로 남긴다. 공개 quiz에는
 machine/stale/missing 번역을 fallback하지 않는다.

### D-018 — 글로벌 카드 export는 reviewed/current 번역만 쓰고, locale·캐시 경계를 서버에서 확정한다 (루프 073)

글로벌 상세에서 공유용 Plus 산출물을 제공할 때 기존 한국어 export를 복제하거나 클라이언트가 제목·요약을
보내도록 하지 않는다. `ExportButton`은 `en`·`ja`·`zh`·`zh-tw`만 query로 전달하고, 서버는 `approved`/
`limited` 공개 밈을 다시 읽은 뒤 exact `reviewed` 번역의 필수 필드와 원문 `updated_at` revision 일치를
검증한다. missing·machine·stale·incomplete 번역은 한국어 fallback 대신 404로 닫아 글로벌 사용자가
검수되지 않은 텍스트를 게시용 카드로 오인하지 않게 한다. 지원하지 않는 locale query는 400이다.

성공 PNG는 기존 entitlement와 template/format/scale 제한을 유지하면서 `private, no-store`,
`Content-Language`, `Vary: Cookie`, `X-Content-Type-Options: nosniff`와 attachment filename을 제공한다.
canonical export 경로의 query locale은 proxy가 `ko`로 덮어쓰지 않도록 문서 언어로 보존한다. 새 migration,
DB write, service-role, 자동 게시, 외부 AI 호출은 추가하지 않는다. 실제 production 배포와 authenticated
Plus premium download는 별도 승인·관찰 게이트로 남긴다.

### D-019 — Daily Share Pack은 기존 Signal·export를 조합하고, share-ready 검수본에서만 사용자 동작을 연다 (루프 074)

구독자의 반복 가치를 “신호를 읽는 것”에서 “검수된 카드와 설명을 바로 공유하는 것”까지 확장하되 새
콘텐츠 생성·외부 SNS 연동·자동 게시를 만들지 않는다. `/premium` 서버는 기존 `dailySignalLocale`에
맞는 후보를 구성하고, 원문 또는 해당 locale 번역의 `title`·`summary`·`description`·`origin`이
비어 있지 않고 reviewed/current일 때만 `shareReady`를 true로 전달한다. usage note와 caution은 같은
검수 레코드에서만 가져온다.

클라이언트는 title·summary·safety·lifecycle·entitlement를 요청 body로 보내지 않는다. share 버튼의
한 번의 사용자 동작 안에서 same-origin `minimal/card/1x` PNG를 받아 Web Share file capability를 먼저
확인하고, 지원하지 않으면 locale caption/safety text를 clipboard에 복사한 뒤 PNG를 다운로드한다. 서버
export가 402/404/503이면 share sheet를 열지 않는다. 로케일 카드의 tagline·safety·lifecycle 라벨도
서버 정적 copy map으로 결정한다.

이 결정은 로컬 unit/targeted/full/build/HTTP boundary까지 검증했지만, authenticated Plus native share,
실제 모바일 OS share sheet, production deploy는 별도 운영자 게이트다. migration·DB write·credential·
external API POST·자동 게시를 추가하지 않는다.

### D-020 — Global Translation Desk의 분모는 live public catalog이고 offline batch와 분리한다 (루프 075)

관리자 coverage는 `artifacts/renewal/loop-050`의 448/1,520행을 그대로 live 공개 수치처럼 사용하지 않는다.
서버가 operator 권한을 확인한 뒤 `memes.moderation_status in ('approved', 'limited')`인 공개 밈과 그 밈에
연결된 locale 번역만 읽어 live catalog의 분모를 만든다. 1,000행 경계는 range pagination으로 넘기며,
source revision instant가 다르거나 status가 `stale`이면 `stale`로 우선 분류한다. `reviewed/current`,
`machine/current`, `stale`, `missing`은 서로 겹치지 않도록 순수 분류기에서 계산한다.

coverage query는 update/insert/delete, GPT 호출, claim RPC, revalidation을 하지 않는다. 조회 실패는
빈 coverage로 표시하지 않고 오류 상태로 보여준다. 누락 행은 오프라인 draft 생성과 사람 검수의 작업 대상일
뿐이며, 이 루프에서 자동 번역·자동 승인·sitemap/hreflang 공개를 추가하지 않는다. 기존 GPT-5.6-sol
`reasoning.effort=high` 보조 검수와 운영자 CAS 승인만 public publication boundary로 유지한다.

### D-021 — 누락 글로벌 번역은 GPT 휘발성 preview로만 보강하고, 호출 전후 원문·번역 상태를 재검증한다 (루프 076)

글로벌 catalog의 누락 번역을 줄이기 위해 운영자가 선택한 공개 `approved`·`limited` 원문을
`gpt-5.6-sol`과 `reasoning.effort=high` strict schema로 미리 볼 수 있게 한다. 입력에는 서버가
재조회한 원문만 넣고, GPT가 만든 결과는 브라우저에 반환할 뿐 DB row·감사 로그·RPC·revalidation·
공개 surface에 저장하지 않는다. 기존 `machine`·`reviewed`·`stale` 행은 모두 `(meme_id, locale)`
identity로 제외해 중복 초안을 만들지 않는다.

90초까지 걸릴 수 있는 GPT 호출 중 source revision이 바뀌거나 번역 row가 새로 생길 수 있으므로,
호출 직후 원문을 public 상태로 재조회하고 `updated_at`과 번역 부재를 다시 확인한다. 불일치하면
초안을 폐기하고 운영자에게 새로고침을 요구한다. UI는 명시적 클릭·로딩·오류·읽기 전용 필드와
“저장·발행되지 않음, 사람 검수 필요” 경계를 표시한다. 실제 OpenAI key, authenticated operator,
Supabase RLS/DB, 번역 적용과 production deploy는 별도 운영 게이트로 남긴다.

### D-022 — Plus Global Scout는 알림·퀴즈와 분리된 read-only 일일 발견 덱으로 제공한다 (루프 077)

Daily Signal은 최근 36시간 `rising`/`saved_rising` 알림이고 Global Meme Daily는 KST 날짜별 문제·완료
기록이므로, Plus의 글로벌 콘텐츠 공급 병목을 해결하는 이번 표면은 읽기 전용 “오늘 확인할 밈” 덱으로
한정한다. active Plus 서버 분기에서만 `memes`와 필요한 `meme_translations`를 읽고 ReactNode를 만들며,
free branch에는 query·RSC data·카드를 만들지 않는다. UI locale이 5개 SEO 콘텐츠 locale 밖이면 기존
`dailySignalLocale` 해석 결과(기본 `en`) 하나를 query·copy·slug·link에 함께 사용한다.

후보는 `approved`/`limited`, `green`/`yellow`, `rising`/`active`이며 source title·summary·description·origin이
완전해야 한다. `ko`는 canonical source를 사용하고, 다른 4 locale은 exact locale·`reviewed`·source
revision과 같은 시각·localized slug와 필수 4필드가 모두 있는 translation만 사용한다. missing·machine·
stale·incomplete는 빈 후보로 제외하며 한국어·다른 locale로 fallback하지 않는다. source는 관심사 필터가
있으면 그 카테고리에서만, 없으면 글로벌 풀에서 trend desc + id asc로 최대 240개를 읽어 overfetch하고,
관심사 결과가 5개 미만이어도 비관심사 후보로 보충하지 않는다. 이는 개인화 범위를 숨기지 않고 empty를
정직하게 보여주기 위한 선택이다.

선발 순서는 KST `YYYY-MM-DD`와 source ID의 deterministic rank를 먼저 사용하고 trend score와 ID를 tie-break로
사용한다. 따라서 같은 날짜·입력 순서에서는 결과가 재현되고 날짜가 바뀌면 덱이 회전할 수 있으며 최대 5개다.
source 조회·translation 조회 오류는 `unavailable`, 성공했지만 적격 카드가 없으면 `empty`로 구분한다.
카드는 safety/lifecycle·검수/현재성 증명과 locale-safe 상세 링크를 보여주지만 저장·감사·RPC·재검증·외부
게시·AI 호출은 하지 않는다. 실제 Supabase/RLS, authenticated Plus QA와 production deploy는 별도 승인 게이트다.

### D-023 — Plus 번역 요청은 owner-scoped fulfillment center로 닫고, 완료를 current reviewed로 재확인한다 (루프 078)

새 discovery surface를 추가하는 대신 기존 `plus_translation_requests`의 사용자 가치를 완결한다. active Plus
서버 페이지가 명시적 owner ID로 자기 요청만 읽어 `requested`·`in_review`·`completed`·`dismissed` 상태와
시각·정확한 SEO locale 상세 링크를 보여준다. free·만료 Plus·빈 owner는 요청 테이블과 fulfillment DTO를
조회하지 않는다. 성공한 빈 결과와 query 오류는 각각 `empty`와 `unavailable`로 분리한다.

`completed`는 DB status만 믿지 않고 exact locale의 `meme_translations.status = 'reviewed'`와
`source_updated_at === memes.updated_at`를 다시 확인한다. 원문이 바뀌었으면 `stale`로 표시하며 검수되지 않은
번역을 ready로 가장하지 않는다. 요청·claim·human CAS 공개·완료 알림 trigger는 기존 운영 경계를 재사용하고,
새 API·AI 호출·자동 번역·자동 게시·client DB write는 추가하지 않는다.

직접 PostgREST select 우회로 만료 사용자가 과거 요청을 읽지 못하도록 `plus_translation_requests_self_read`
정책은 `user_id = auth.uid()`와 `has_active_plus(auth.uid())`를 모두 요구한다. operator read/update 정책은
유지한다. 실제 migration 적용, RLS/RPC/trigger 실행, Plus 요청→operator 승인→알림 E2E와 production deploy는
인증·DB·운영 승인 게이트로 남긴다.

### D-024 — Plus alert self-read는 owner와 active entitlement를 함께 요구한다 (루프 079)

앱 라우트가 만료 Plus를 차단해도 PostgREST가 별도 경로이므로, private `trend_alerts`와
`plus_saved_context_alerts`의 authenticated self-read policy는 `user_id = auth.uid()`만으로 충분하지 않다.
새 forward migration은 두 정책을 owner identity와 `has_active_plus(auth.uid())`의 AND 조건으로 재생성한다.
historical migration은 수정하지 않고 operator/service flow·read-marking RPC·browser write grant는 유지한다.
실제 migration 적용과 active/expired/cross-owner JWT select는 운영 게이트다.

### D-025 — Plus Global Action Inbox는 기존 read models를 우선순위 있는 다음 행동으로 합친다 (루프 080)

Plus 사용자가 Global Scout, Daily Signal, 번역 이행 센터를 각각 해석하지 않도록 새 저장 모델 없이
서버에서 최대 5개의 unique action을 만든다. 우선순위는 `translation_ready`, `saved_signal`,
`new_reviewed`이며 trend score·timestamp·meme ID로 deterministic tie-break를 적용한다. 웹 요청 locale을
콘텐츠 기준으로 사용하고, non-Korean은 exact reviewed/current locale만 허용한다. email preference locale은
기존 Daily Signal 설정으로 남겨 두어 웹 콘텐츠와 이메일 설정을 섞지 않는다.

완료되지 않은 번역 요청은 상태만 보여주고 detail link를 만들지 않는다. free·signed-out·expired branch에는
private inbox DTO/query를 만들지 않으며, empty·unavailable·partial failure를 별도로 표시한다. 새 table,
RPC, cron, AI call, client DB write, auto-publish, migration은 추가하지 않는다. authenticated Plus/live DB
관찰과 production deploy는 별도 운영 게이트다.

### D-026 — Plus Action Inbox의 활용 완료는 KST 날짜별 owner-scoped 멱등 원장으로 닫는다 (루프 081)

Action Inbox가 단순 상세 링크에 머물지 않도록 카드에서 검수된 텍스트를 복사·공유하고, 사용자가
앱 안에서 활용 완료를 표시할 수 있게 한다. 완료 기록은 `user_id`, `meme_id`, KST 기준
`completion_date`를 복합 키로 사용해 같은 밈을 같은 날 여러 번 세지 않는다. 오늘 완료한 밈은 서버
read model에서 제외하고, summary RPC가 오늘 완료 수와 연속 활용 일수를 계산한다.

완료 table은 authenticated select도 owner + `has_active_plus(auth.uid())`로 제한하고, insert는
browser grant 없이 `security definer` RPC만 허용한다. RPC는 서버에서 현재 사용자·KST 날짜를 결정하고
공개 `approved`/`limited` 밈만 기록한다. 클라이언트가 사용자·날짜·콘텐츠 사실을 제출하지 않으며,
완료는 외부 SNS 게시 증명이 아니다.

이번 루프에서는 migration 파일과 로컬 API/UI 계약만 만들고 Supabase 적용·RLS/JWT E2E·deploy·외부
게시를 수행하지 않는다. 기존 reviewed/current 콘텐츠와 locale-safe 링크 경계는 유지한다.

### D-027 — 글로벌 번역은 사람 제공 pack을 4-locale·source-locked artifact로 먼저 받는다 (루프 082)

현재 MLX endpoint가 없어 새 번역 문구를 생성할 수 있고 실제 외부/사람 번역이 들어오는 경우를
구분해야 한다. 따라서 `scripts/translation-intake.mjs`는 JSON pack을 report-only로 읽고, 각 밈의
`en`·`ja`·`zh`·`zh-tw` 완결 여부, worklist membership, 중복 `(meme_id, locale)`, 동일 source
snapshot, 기존 target-language/source-fidelity validator를 확인한다. 검증되지 않은 문구를 만들거나
자동 발행하지 않는다.

`--emit-artifact`는 반드시 `--require-complete`와 함께 사용해야 하며, locale별 SQL은 기존
`buildAtomicInsertSql()`을 재사용해 source revision lock, 공개 상태 확인, machine status,
`reviewed_at = null`, `on conflict do nothing`을 유지한다. 기본 실행은 파일을 쓰지 않는다.
실제 사람 번역 pack 제공, 운영자 CAS 검수·발행, Supabase 적용과 production deploy는 별도 게이트로 남긴다.

### D-028 — Plus Action Inbox의 다음 가치는 기존 카드들을 Creator Pack으로 묶되, 공유·다운로드에서 멈춘다 (루프 083)

Loop 081의 활용 완료 루프 위에 새 패널이나 저장 모델을 추가하지 않고, 기존 Action Inbox의 최대 5개
action을 그대로 Creator Pack으로 묶는다. 기존 `translation_ready > saved_signal > new_reviewed`,
중복 제거, 오늘 완료 제외, locale-safe detail link와 exact reviewed/current 콘텐츠 경계를 재사용한다.

각 항목은 기존 `buildPlusDailySharePack()`과 localized card export route를 통해 caption·safety note·PNG를
만든다. Web Share가 파일 묶음을 지원하면 통합 caption과 함께 한 번 공유하고, 그렇지 않으면 통합 caption을
clipboard에 복사하고 성공한 PNG만 개별 다운로드한다. 일부 export 실패는 성공/실패 수로 분리해 전체 성공처럼
표현하지 않는다.

Creator Pack은 외부 SNS API POST, 자동 게시, 새 migration/RPC/cron/DB mutation을 하지 않는다. authenticated
Plus populated 화면, 실제 OS share sheet, production deploy는 별도 운영 게이트이며 local component contract와
production build/browser signed-out boundary만 이번 루프에서 확인한다.

### D-029 — Creator Pack의 완료는 명시적 receipt 확인으로만 기록한다 (루프 084)

Creator Pack 생성·공유·다운로드는 사용 의도의 증명이 아니므로 기존 `/api/plus/action-inbox/complete`를 자동 호출하지
않는다. export가 성공한 항목만 임시 receipt에 보관하고, 사용자가 “활용 완료로 기록”을 누른 때에만 기존 owner + active
Plus·KST·멱등 completion API를 성공 항목별로 순차 호출한다. 부분 실패는 성공 항목을 제거하고 실패 항목을 receipt와
재시도 CTA로 남긴다. 개별 카드 완료와 receipt 완료가 겹치면 로컬 상태에서도 해당 항목을 제거해 중복 요청을 막는다.

이번 루프는 새 table/RPC/migration/cron/외부 게시를 추가하지 않았다. 또한 translation ready action은 요청 콘텐츠
locale과 정확히 같은 fulfillment locale일 때만 만든다. 다른 언어의 localized link가 현재 화면에 섞이는 것은 글로벌
공급량보다 우선하는 신뢰 경계이므로, Loop 082 canonical intake guard와 448/1,520 human pack 보완은 별도 다음 후보로
남긴다. authenticated Plus receipt/API·RLS와 production deploy는 운영 게이트다.

### D-030 — Unifi 정산 응답은 권한 전환 전에 필수 필드를 fail-closed로 검증한다 (루프 085)

Unifi status lookup은 `transactionId`, `orderId`, `storeId`, finite `orderAmount`,
`orderCurrencyCode`를 모두 요구하고 provider transaction ID가 요청 ID와 같아야 한다. 누락·빈 값·형식 오류는
`unifi_pay_status_invalid_response`로 올려 webhook이 retryable 5xx를 반환하게 한다. 조회 자체가 성공했지만
store·금액·통화가 configured 상품과 다르면 재시도 대상이 아닌 200 ignored로 처리한다. 정확히 일치하는 거래만
기존 owner/link 귀속과 멱등 권한 처리로 넘어간다.

`isExpectedUnifiPayTransaction()`에도 같은 방어 검증을 중복해 mock·향후 호출자·provider parser 변경이 빈 필드를
통과시키지 못하게 한다. 이번 루프는 결제 호출·권한 DB write·migration·구독 모델 변경을 하지 않았고,
`gpt-5.6-sol` + `high` 관리자 검수와 `store: false` 계약도 변경하지 않았다. 실제 Unifi sandbox/live,
authenticated Plus/RLS, Supabase 적용, production deploy는 운영 승인 뒤 별도로 검증한다.

### D-031 — Plus 개인 피드는 detail indexability와 같은 locale-safe gate를 사용한다 (루프 086)

Plus `MyFeed`는 글로벌 콘텐츠를 약속하면서 canonical 한국어 카드로 조용히 대체하지 않는다.
`ko`는 기존 source ranking을 유지하고, `en`·`ja`·`zh`·`zh-tw`는 exact locale의 `reviewed`
translation이 source revision과 현재이고 필수 localized prose/slug가 완전하며, 원문이
`isIndexableMeme()` depth·공개 상태를 통과할 때만 `isIndexableLocalizedMeme()`를 통해 카드로
투영한다. 이 조건은 기존 localized detail route와 동일한 404 방지 계약이다.

source는 번역 판정 전에 최대 60개 overfetch하고 trend/published 순서와 `id` tie-breaker를
유지한다. 관심사 목록이 비어 있으면 fresh 선택을 직접 수행할 수 있고, nonempty 관심사
조회가 성공-empty인 경우에만 fresh로 폴백한다. 조회 실패는 `unavailable`, source 부재는
`empty-source`, source는 있지만 해당 언어 공개 번역이 없으면 `empty-coverage`로 분리한다.

loader는 active Plus 조기 반환 후 쿠키 없는 `createStaticClient()`만 사용한다. UI-only
locale은 실제 상세 route가 없는 언어임을 숨기지 않고 명시적으로 English content로 라벨링하며
`/en/...`으로 보낸다. `zh-tw` 상태 문구는 `zh` fallback과 별도 번체 copy다. 카드의
category/safety chrome 전체 번역과 번역 생성·검수·발행은 별도 루프/운영 게이트다.

### D-032 — Plus 첫 화면의 구독 성과는 “오늘의 활용 결과”로 묶고, 완료는 명시적으로만 기록한다 (루프 087)

Plus의 기존 read model들을 새 패널과 새 추천 산식으로 복제하지 않는다. Action Inbox를 첫 업무
영역으로 올리고 기존 Creator Pack을 `ready → prepared → complete` 결과 흐름으로 표현한다.
`empty`와 `unavailable`은 성공 상태로 포장하지 않으며, 초기 완료 수 또는 마지막 카드 완료 뒤에는
“오늘의 결과 완료”를 남겨 사용자가 무엇을 얻었는지 알 수 있게 한다.

카드 생성·공유·다운로드는 실제 사용의 증거가 아니므로 completion API를 호출하지 않는다. 성공 카드만
임시 receipt에 보관하고, 사용자가 확인 버튼을 눌렀을 때 기존 owner-scoped·KST·멱등 API를 그대로
사용한다. 부분 실패 항목은 receipt에 남겨 재시도한다. 이 루프는 새 table/RPC/migration/cron,
자동 게시, AI 호출을 추가하지 않는다.

결과 copy는 `ko`·`en`·`ja`·`zh`·`zh-tw`에 모두 제공하고 Traditional Chinese Action Inbox는
전용 override를 둔다. active Plus가 Plus 전용 Daily에 진입할 때는 upgrade 문구 대신 첫 문제 시작
문구를 사용한다. authenticated Plus populated data·native share·RLS와 production deploy는
별도 운영 게이트다.

### D-033 — Plus 번역 수요는 명시적 machine 초안으로만 운영 검수 큐에 넘긴다 (루프 088)

Plus translation priority queue에서 아직 번역 행이 없는 요청을 기존 claim/detail 경로로 바로 보내면
운영자가 편집할 행이 없어 수요가 공급으로 이어지지 않는다. 반대로 GPT 결과를 자동 insert하면 원문 revision,
사람 검수, 공개 발행의 경계가 무너진다.

**결정:** 누락 요청은 exact locale·meme focus를 가진 번역 desk로 보내고, gpt-5.6-sol high source-only
preview를 읽기 전용으로 만든다. 운영자가 title·summary·description·origin·usage·caution·aliases를 직접
편집한 뒤 명시적으로 저장할 때만 현재 공개 원문 revision과 operator 권한을 다시 확인하고 단일 `machine`
행을 insert한다. `localized_slug`는 번역 제목에서 결정적으로 만들고 `provider=openai`,
`model=gpt-5.6-sol`, `prompt_version=1`, `reviewed_at/reviewed_by=null`을 기록한다.

저장 후에는 관리자 번역 큐와 밈 편집 경로만 재검증한다. public detail, sitemap, hreflang, Plus ready
consumer는 `reviewed`·current gate를 통과하기 전까지 갱신하지 않는다. duplicate, source revision drift,
private source, non-operator는 mutation 없이 거절하며, unique conflict는 다른 운영자의 저장으로 안내한다.

이번 루프는 새 migration/table/RPC/cron, production DB write, 자동 발행, 외부 게시, deploy를 수행하지 않았다.
실제 operator session에서의 GPT 호출과 machine→reviewed human approval은 운영 게이트다.

**되돌리는 방법:** `saveMissingMemeTranslationDraft`와 focus query/UI link/form/test를 제거하면 기존
read-only preview와 기존 translation review queue로 돌아간다. `meme_translations` schema와 기존 public
review gate는 변경하지 않았으므로 저장된 machine row는 기존 운영자 delete/review 흐름으로 처리한다.

### D-034 — 누락 번역 초안도 claim 성공 뒤에만 운영 검수 focus로 이동한다 (루프 089)

Loop 088의 누락 번역 `초안 만들기`는 exact focus route로 이동했지만 Plus 요청을 `in_review`로 바꾸지
않았다. 운영자 작업 상태가 `requested`에 남으면 수요 큐와 실제 공급 작업이 어긋나고, fulfillment 상태를
오해하게 만든다.

**결정:** `TranslationPriorityQueue`의 missing row를 링크가 아닌 claim-aware action으로 만든다. 기존
`claimTranslationPriority` server action이 성공한 경우에만 `/admin/translations?locale=<locale>&focus=<memeId>`로
이동하고, 실패하면 큐에 오류를 표시하며 route와 GPT 호출을 시작하지 않는다. 이미 translation row가 있는
요청은 기존 claim 후 `/admin/memes/<memeId>` 경로를 유지한다.

이 변경은 새로운 migration/table/RPC를 추가하지 않고 기존 `claim_translation_priority_request`를 재사용한다.
GPT 검수는 계속 `gpt-5.6-sol` + `reasoning.effort=high` + strict JSON + `store=false`이며, preview는
no-write, 저장은 운영자 명시 행동, 공개는 human `reviewed/current` gate 이후라는 경계를 바꾸지 않는다.
authenticated operator/live RPC·GPT 호출·machine→reviewed 승인과 production deploy는 별도 운영 게이트다.

**되돌리는 방법:** missing row의 버튼을 focus `Link`로 되돌리고 기존 `claimTranslationPriority` 호출을
기존 translation row 분기에만 남기면 된다. schema·공개 정책·번역 행 자체는 변경하지 않는다.

### D-035 — legacy translation batch는 provenance와 source hash를 보존한 채 reviewable artifact로만 넘긴다 (루프 090)

Loop 052의 완전한 4-locale machine batch는 현재 intake의 `meme` 입력 계약과 달리 `source` 객체,
`source_snapshot_hash`, Postgres `+00` timestamp를 사용했다. 이를 사람이 만든 pack으로 잘못 변환하거나
새 번역을 조용히 생성하면 provenance와 공개 경계를 잃는다.

**결정:** intake는 canonical `meme`와 legacy `source`를 모두 읽되, source snapshot hash를 다시 계산하고
제공된 hash와 다르면 거절한다. pack provenance의 `gpt-5.6-luna` model은 `provider=openai`와 함께
보존하며 row-level metadata가 우선한다. `+00` offset은 검증만 허용하고 원문 문자열은 그대로 둔다.
artifact header는 `reviewable translation pack`으로 표기하고, 결과 SQL은 기존 source-lock·idempotent
`machine` insert만 사용한다.

기존 canonical artifact에 이미 있는 동일 `(meme_id, locale)`는 duplicate로 차단한다. 이번 루프의 실제
공급량은 448/1,520에서 변하지 않았고, production DB write·human reviewed publication·sitemap/Plus ready
전환은 하지 않았다. 사용자가 요청한 `gpt-5.6-sol high`는 관리자 server-only review contract로 유지하며,
`gpt-5.6-luna` legacy draft를 sol 결과로 이름 바꾸지 않는다.

**되돌리는 방법:** `translation-intake.mjs`의 legacy source/default metadata adapter와 해당 회귀를
제거하면 기존 canonical `meme` pack만 허용하는 Loop 082 계약으로 돌아간다. SQL schema와 public gate는
변경하지 않는다.

### D-036 — Plus 활용 receipt는 기존 completion과 분리하되 한 RPC에서 원자적으로 기록한다 (루프 091)

기존 `plus_meme_use_completions`는 오늘의 사용 수·연속 일수와 Action Inbox 호환에 필요한 최소 원장이다.
여기에 channel·exact locale·artifact·성과·개인 메모를 직접 섞으면 기존 읽기 모델과 새 private
outcome 기록의 책임이 불명확해지고, completion만 남은 legacy row를 다시 쓰기 어렵다.

**결정:** `plus_meme_use_receipts`를 별도 1:1 테이블로 두고 `(user_id, meme_id, completion_date)`
복합 unique/FK로 기존 completion과 연결한다. `record_plus_meme_use_receipt` 하나가 active Plus,
approved/limited meme, `ko` source 또는 non-ko reviewed/current translation을 다시 확인한 뒤 두
행을 원자적으로 insert한다. 같은 KST key의 재시도는 기존 receipt와 최신 progress를 반환하며 값을
덮어쓰지 않는다. 직접 completion RPC의 authenticated execute는 회수해 receipt RPC를 쓰기 경계로
남긴다.

receipt에는 사용자가 직접 입력한 URL·성과·개인 메모만 저장하고 서버는 URL을 fetch하지 않으며 SNS
자동 게시를 하지 않는다. summary RPC는 최근 7일 KST 범위의 집계만 반환하고 URL·개인 메모는 반환하지
않는다. UI는 완료 버튼에서 inline form을 열고 최종 저장 때만 API를 호출하며, Creator Pack 준비·공유·
다운로드는 활용 증거로 간주하지 않는다.

**되돌리는 방법:** production 적용 전에는 migration과 receipt API/UI/loader/copy를 함께 제외하면 기존
completion-only 흐름으로 돌아간다. 적용 후에도 receipt FK cascade와 별도 table 덕분에 기존 completion
원장은 보존된다. 이번 루프에서는 migration 실행·기존 데이터 backfill·public release를 하지 않았다.

### D-037 — 번역 artifact는 machine-only SQL만 허용하고 reviewed 전이는 checker에서 거부한다 (루프 092)

기존 Loop 050 artifact에는 번역 INSERT 뒤 `meme_translations.status`를 `reviewed`로 승격하는 UPDATE가
섞여 있었다. 행 수·중복·locale 검사가 통과해도 이 SQL을 실행하면 사람 검수 없이 공개 gate를 만족할 수
있으므로, “검수 가능한 draft”와 “공개 가능한 reviewed row”를 같은 artifact에 둘 수 없다.

**결정:** offline checker는 실행 가능한 statement를 읽기 전용으로 검사하되 `meme_translations` 대상
UPDATE·DELETE·MERGE와 CALL/RPC 형태를 오류로 분류한다. INSERT도 `status='machine'`이고
`reviewed_at`·`reviewed_by`가 null인 경우만 허용한다. source-locked atomic insert와 conflict guard는
그대로 재사용하며, 4개 locale의 clean fixture만 `--require-complete`를 통과시킨다. historical unsafe
artifact는 수정·삭제하지 않고 fail-closed inventory로 남긴다.

관리자 GPT 검수는 계속 `gpt-5.6-sol` + `reasoning.effort=high` + strict JSON + `store=false`의
source-only preview이고, 운영자가 명시적으로 저장한 `machine` row만 기존 CAS review queue로 넘긴다.
이번 루프에는 OpenAI 호출, Supabase write, human review/publication, sitemap/Plus ready 전환을 포함하지
않는다.

**되돌리는 방법:** checker의 mutation/review promotion gate와 회귀 테스트를 제거하면 이전 행 수 중심
검사로 돌아가지만, historical artifact를 자동 적용하거나 공개시키는 복구는 하지 않는다. 공개 전이는
기존 operator review action과 `reviewed/current` gate를 통해서만 수행한다.

### D-038 — Plus 성과 후속은 기존 Outcome Ledger 안에서 owner의 미입력 메모만 한 번 보충한다 (루프 093)

Loop 091의 private receipt는 활용 완료 시점의 channel·locale·artifact와 선택적 성과 메모를 남겼지만,
성과를 나중에 입력할 수 없어 사용자의 작업 기억이 완료 시점에서 끊겼다. 새 대시보드를 만들거나
기존 receipt 생성 RPC를 수정하면 첫 기록과 회고의 책임이 섞이고 immutable receipt 경계가 약해진다.

**결정:** 최근 7일 owner-scoped receipt 최대 5건을 기존 Outcome Ledger 안에 표시하고 성과 미입력
행을 우선한다. `record_plus_meme_use_performance`는 세션 사용자·active Plus·receipt 소유권·비어
있는 performance note를 서버에서 확인한 뒤 한 번만 note를 채운다. 기존 값은 덮어쓰지 않고 직접 table
update 권한도 주지 않는다. client에는 제목·날짜·채널·언어·산출물·성과만 보내며 `result_url`와
`private_note`는 보내지 않는다. 저장 실패 시 입력값은 UI에 남기고, 성공 시 7일 대기 수를 즉시 줄인다.

5개 핵심 locale의 copy는 각각 제공하고, URL fetch·SNS 자동 게시·AI 호출·translation/publication
gate·production DB 적용은 이 루프의 범위에서 제외한다. migration은 파일로만 남기며 authenticated
JWT/RLS/실제 receipt fixture는 운영 게이트로 남긴다.

**되돌리는 방법:** production 적용 전에는 follow-up migration/API/loader/UI/copy를 함께 제거하면
Loop 091의 immutable receipt와 집계만 남는다. 적용 후에도 note update는 receipt row의 nullable
performance field에 한정되고 기존 receipt 생성·completion 원장은 변경하지 않는다.

### D-039 — 관리자 GPT 검수는 gpt-5.6-sol + high 계약 drift를 호출 전에 차단한다 (루프 094)

관리자 번역 검수는 운영자가 최종 승인하기 전의 reviewable draft를 만드는 server-only 보조 경로다.
모델이 바뀌거나 낮은 reasoning 설정으로 호출되면 검수 품질과 감사 metadata가 달라질 수 있으므로,
환경변수 override에 의존하지 않고 `gpt-5.6-sol`과 `reasoning.effort=high`를 고정한다. Responses
요청은 `store=false`와 strict JSON schema를 함께 사용한다.

**결정:** `reviewMemeTranslationWithGpt`와 누락 번역 preview는 request 전에 model/reasoning 계약을
확인한다. 계약이 맞지 않으면 `requestOpenAiStructured`·`admin_audit_log`·번역 저장을 실행하지 않고
오류를 반환한다. GPT 결과는 폼에만 채워지는 preview이며 자동 저장·자동 발행하지 않고, 저장된 행도
`machine` 상태에서 운영자 human `reviewed/current` 승인 gate를 거친다.

이번 루프에는 `OPENAI_API_KEY` 설정, 실제 OpenAI 호출, Supabase write, 공개 발행, production deploy를
수행하지 않았다. 기존 `OPENAI_REVIEW_MODEL`이 남아 있어도 무시한다.

**되돌리는 방법:** 일반 검수 경로의 guard와 regression만 제거하면 이전 호출 흐름으로 돌아가지만,
고정 model/reasoning/store 계약과 human publication gate는 유지해야 한다.

### D-040 — canonical intake는 historical unsafe artifact를 공개 공급에서 격리한다 (루프 095)

여러 번의 번역 루프가 같은 `(meme_id, locale)` key를 반복 생산할 수 있고, Loop 050에는
번역 INSERT 뒤 reviewed 승격이나 기타 forbidden mutation이 섞인 historical SQL이 남아 있다.
행 수만 합치면 unsafe row를 current supply로 세거나 새 pack을 잘못 중복 처리할 수 있다.

**결정:** `translation-intake`는 `--existing-artifact-dir`를 통해 artifact를 읽기 전용으로
병합하고, conflict guard·machine status·review promotion·파일 단위 checker 오류를 기준으로
safe/unsafe row를 분리한다. 기존 key는 safe/unsafe 여부와 무관하게 새 입력과 충돌시키고,
unsafe row는 coverage에 포함하지 않는다. 별도 historical directory의 오류는 격리 집계로
남겨 clean 새 pack의 machine-only artifact emit은 허용하지만, emit 대상 directory 자체의
unsafe row·parse 오류는 fail-closed 한다.

입력은 new/duplicate-existing/duplicate-input/source-mismatch/out-of-worklist로 분류하고
locale별 missing before/after/delta를 JSON으로 남긴다. 이 도구는 SQL을 실행하지 않으며,
machine→human reviewed 전이·공개 발행·Supabase 적용·OpenAI 호출을 수행하지 않는다.

**되돌리는 방법:** Loop 095의 intake preflight helper·옵션·회귀 테스트를 함께 제거하면
Loop 094의 단일 artifact directory 중복 gate로 돌아간다. historical artifact 자체는
수정·삭제하지 않는다.

### D-041 — Plus Next Move는 구조화된 1회 평가만 개인 추천에 반영한다 (루프 096)

자유 텍스트 성과 메모만으로는 사용자의 다음 선택을 안정적으로 정렬하기 어렵고, 추천 모델이
개인 메모·게시물 URL 같은 민감한 receipt 필드를 읽게 만들 위험이 있다. 별도 콘텐츠 피드나
알림을 하나 더 만드는 것은 기존 Plus surface와 중복된다.

**결정:** `plus_meme_use_receipts.performance_rating`에 `hit|neutral|miss`만 추가하고,
세션 사용자·active Plus·본인 receipt·빈 rating을 RPC에서 확인한 뒤 최초 1회만 저장한다. 최근
28일·최대 50건만 읽어 후보별 `hit=+1`, `neutral=0`, `miss=-1`로 계산하며, 점수가 같으면 기존
Action Inbox 순서를 유지한다. 평가가 3건 미만이면 `learning` 상태로 표시하고, 오늘 완료한 밈은
후보에서 제외한다. Next Move DTO와 UI에는 후보의 공개 title/summary/href와 평가 신호만 전달하고
`performance_note`, `private_note`, `result_url`은 전달하지 않는다.

평가는 기존 7일 Outcome Follow-up 안에 입력하며, 성공 시 부모 Action Inbox의 로컬 rating seed를
갱신해 같은 화면에서 추천을 재정렬한다. 새 migration이 아직 적용되지 않은 rolling deploy에서는
기존 performance note 조회를 legacy select로 유지하고, rating lane만 unavailable로 표시한다.
이 루프는 migration 파일과 local tests만 추가하며 production DB 적용·실제 receipt/rating 저장·
공개 발행·deploy는 운영 게이트로 남긴다.

**되돌리는 방법:** rating migration/API/28일 loader/Next Move UI와 회귀 테스트를 함께 제거하면
Loop 093의 note-only Outcome Follow-up으로 돌아간다. 기존 receipt 생성·completion·성과 메모 원장은
변경하지 않는다.

### D-042 — 글로벌 검색은 noindex self-canonical과 reviewed/current exact-locale 연결을 사용한다 (루프 097)

검색 결과 페이지는 사용자가 탐색하는 동적 query surface이지, 번역 콘텐츠를 대표하는 indexable
문서가 아니다. 따라서 `/en|ja|zh|zh-tw/search`는 locale self-canonical과 `noindex, follow`만
제공하고 hreflang·x-default·sitemap cluster에는 넣지 않는다. 검색 후보와 인기 칩은 기존 한국어
`search_memes` RPC 계약을 유지한다.

번역 결과는 `meme_translations -> memes!inner` batch read 뒤 `reviewed`, source revision current,
필수 필드, 원문 content-depth, public moderation gate를 모두 적용한다. 통과한 exact locale만
localized detail href/title/summary를 사용하며, 그 외에는 한국어 canonical href와 locale별
원문 라벨, `lang="ko"`를 함께 렌더한다. 조회 오류도 안전한 한국어 폴백으로 처리해 machine/stale
내용이나 존재하지 않는 locale URL을 노출하지 않는다.

언어 선택은 `/search?q=...`의 query를 유지하고, `zh-tw` 검색 카피는 번체를 직접 제공한다. 서버
컴포넌트에서 클라이언트 검색 입력으로 넘기는 카피는 직렬화 가능한 문자열만 허용한다.

이번 루프는 번역 생성·OpenAI 호출·human publication·production Supabase write·sitemap 공개·
production deploy를 수행하지 않았다. 공개 reviewed 번역 공급은 448/1,520 그대로다.

**되돌리는 방법:** `/[locale]/search` route/loading, `getLocalizedSearchMemes`, search copy,
header/routing/query-preservation 변경과 회귀 테스트를 함께 제거하면 Loop 096 이전의 root-only
검색으로 돌아간다. 기존 localized detail gate와 한국어 `search_memes` RPC는 유지한다.

### D-043 — Plus Outcome Snapshot은 서버 집계 결과를 첫 화면에, 원장 상세는 기존 surface에 둔다 (루프 098)

Plus가 실제로 제공하는 차별점은 밈 목록 자체가 아니라 `추천 → 사용 → 결과 기록 → 다음 추천`의 개인
작업 기억이다. 이 값이 Action Inbox 내부의 접힌 `<details>`에만 있으면 구독자가 첫 방문에 효과를
확인하기 어렵다. 반대로 receipt 원장이나 개인 메모를 첫 화면에 그대로 올리면 개인정보와 복잡성이
불필요하게 커진다.

**결정:** `/premium` active Plus 헤더 바로 아래에 owner-scoped server read model의 집계값만 렌더링하는
`PlusOutcomeSnapshot`을 둔다. 오늘 활용 수·연속 일수·최근 활용 수·성과 입력 대기 수·평가 수와 채널·
언어·산출물별 최다 사용 항목만 표시하고, 최다 사용을 효과가 좋았다는 의미로 해석하지 않는다. `ready`,
`empty`, `unavailable`을 분리하며 실패를 0으로 대체하지 않는다. Action Inbox는 명시적 anchor로
연결하고, 기존 7일 상세 요약은 유지하되 기본 펼침으로 전환한다.

UI-only locale은 영어 copy로 fallback하고 `en|ja|zh|zh-tw` public content locale을 새로 만들지 않는다.
Snapshot은 `receipt_id`, `meme_id`, `result_url`, `performance_note`, `private_note`를 전달하거나
렌더링하지 않는다. 신규 API·RPC·migration·POST·자동 게시를 추가하지 않으며, production migration/
RLS/authenticated Plus 검증은 별도 운영 게이트다.

**되돌리는 방법:** `PlusOutcomeSnapshot`, dashboard slot, snapshot copy/tests와 7일 요약의 `open`을
함께 제거하면 Loop 096의 Action Inbox 내부 요약 surface로 돌아간다. 기존 outcome read model과
completion/rating 원장은 변경하지 않는다.

### D-044 — 번역 coverage의 누락 수는 기존 locale 작업 화면으로만 연결한다 (루프 099)

coverage 표의 `누락` 수는 public approved/limited 분모에서 계산되지만, 실제 누락 원문 작업 화면은
locale 필터가 선택된 경우에만 렌더된다. 숫자를 그대로 두면 운영자가 같은 locale을 다시 선택해야 하고,
새로운 global tranche UI를 만들면 offline artifact와 live DB 공급을 혼동할 위험이 있다.

**결정:** 양수 누락 수는 `/admin/translations?locale=<locale>`로 연결해 기존
`listMissingMemeTranslations`·`MissingTranslationDraftPreview` 경로를 재사용한다. 링크 accessible name은
언어명·누락 수·작업 의도를 표시하고, 0건은 숫자만 유지한다. 이 변경은 새 action/RPC/DB write/GPT 호출/
publication을 추가하지 않으며, source-readiness 계산이나 Plus completion/public eligibility 계약을
축약하지 않는다.

**되돌리는 방법:** `MissingCountLink`와 coverage panel의 누락 셀 회귀 테스트를 제거하면 Loop 098 이전의
숫자-only coverage 표로 돌아간다. 기존 locale filter, missing list, public reviewed/current gate는 유지한다.

### D-045 — Plus 첫 화면은 오늘의 1컷으로 action을 먼저 닫고, 번역 공개는 원문 depth gate를 공유한다 (루프 100)

Plus는 이미 snapshot·Action Inbox·7일 outcome·Next Move를 제공하지만, 첫 화면에서 이 정보를 동시에 시작하면
사용자는 오늘 무엇을 만들어야 하는지 다시 해석해야 한다. Creator Pack도 파일을 만들었다는 상태만 보여주면 실제
게시 전 결과 확인이 늦어진다.

**결정:** active Plus `/premium`은 기존 eligible 정렬의 첫 action 하나를 `one_cut`으로 먼저 보여준다. 기존
localized export를 호출해 실제 PNG blob preview와 캡션/상세 링크를 보여주고, native share·clipboard·download
fallback 뒤에도 활용 완료는 자동으로 기록하지 않는다. 사용자가 채널을 선택해 명시적으로 receipt를 저장해야
현재 카드를 제거하고 다음 action으로 넘어간다. one-cut receipt는 채널·artifact만 빠르게 확인하며, URL·성과·개인
메모 입력은 기존 full receipt 모드에 남긴다. Action Inbox의 기본 모드는 기존 full inbox로 유지한다.

번역 fulfillment의 `ready`는 번역 reviewed/current/필수 필드뿐 아니라 원문 `isIndexableMeme` depth gate도
통과해야 한다. 번역이 완료됐더라도 원문 산문·근거가 부족하면 `source_incomplete`로 표시하고 localized detail
link와 Action Inbox action을 만들지 않는다. 이로써 Plus의 “사용 가능” 상태와 public localized page의 404/noindex
계약이 같은 판정점을 공유한다.

이번 루프는 신규 migration·RPC·GPT 호출·번역 생성·publication·자동 게시를 추가하지 않았다. blob preview는
client export 결과를 일시적으로 보여줄 뿐 저장하지 않으며, authenticated Plus/RLS·실제 receipt 저장은 운영 QA
게이트로 남긴다.

**되돌리는 방법:** `mode="one_cut"`, dashboard action-first slot, compact receipt, preview state와
`source_incomplete` depth gate 및 관련 회귀 테스트를 함께 제거하면 Loop 099 이전의 full Action Inbox와
번역 fulfillment 상태로 돌아간다. 기존 export/completion/translation public gate의 나머지 계약은 유지한다.

### D-046 — 글로벌 Explore는 reviewed 24-card deck으로 시작하고 Scout는 원문 depth gate를 공유한다 (루프 101)

글로벌 홈·검색이 있어도 번역된 밈을 발견할 기본 선반이 없으면 locale 상세는 검색어를 아는 방문자에게만
열린다. 반대로 처음부터 필터·검색 facet·무한 스크롤을 복제하면 query URL 공간과 서버/클라이언트 쿼리
drift가 커지고, 번역 coverage 부족과 DB 장애를 같은 빈 화면으로 표현할 위험이 있다.

**결정:** `/en|ja|zh|zh-tw/explore`는 exact locale `reviewed`·source revision current·필수 필드·원문
`isIndexableMeme`를 통과한 카드만 최대 24개 서버 렌더한다. 24개 이상일 때만 `active`·indexable로 보고,
미달은 `coverage-empty`, 읽기 실패는 `unavailable`로 구분한다. query variant는 self-canonical·
`noindex,follow`이고, 24개 이상인 locale만 sitemap과 explore hreflang cluster에 넣는다. 한국어
`/explore`는 기존 필터/무한 스크롤을 그대로 둔다.

Plus Global Scout는 동일한 원문 depth 신호를 select하고 `isIndexableMeme`를 적용한다. Scout의 기존
5개 제한, safety/lifecycle 조건, deterministic 날짜 순서, Plus entitlement, locale translation gate는
변경하지 않는다. 이로써 Scout의 localized detail href가 public detail gate와 다른 상태를 만들지 않는다.

이번 루프는 translation 생성·human publication·Supabase write/migration·OpenAI call·deploy를 수행하지
않았다. 실제 locale별 production coverage가 바뀌면 sitemap active threshold와 route metadata를 다시
검증해야 한다.

**되돌리는 방법:** localized explore route/card/loader/copy, route allowlist·header/bottom nav 링크와
sitemap threshold를 함께 제거하면 기존 home/search-only global discovery로 돌아간다. Scout source-depth
projection과 테스트는 별도로 되돌릴 수 있지만, 되돌릴 경우 Scout/detail 공개 게이트 불일치가 재발한다.

### D-047 — Plus Weekly Brief는 resolved content locale과 localized detail trend anchor를 함께 사용한다 (루프 102)

기존 주간 변화 브리프는 trend metric 계산은 유지했지만 후보 텍스트를 원문 `memes` 행에서 직접 가져왔다.
글로벌 `/premium`에서 URL만 locale-aware이고 제목은 한국어일 수 있으며, 번역이 없거나 stale인 밈도
추이 카드 후보가 될 수 있었다. localized detail에는 한국어 상세에만 있던 Plus trend anchor도 없었다.

**결정:** `ko`는 canonical source를 유지한다. 그 외에는 UI locale을 SEO content locale(`en|ja|zh|zh-tw`)로
해석한 뒤, exact reviewed/current translation·필수 4필드·localized slug와 원문 `approved|limited`·
`isIndexableMeme`를 모두 통과한 후보만 주간 brief에 넣는다. 상위 후보가 탈락하면 다음 적격 후보로 채우고,
한국어 fallback은 만들지 않는다. 기존 KST 7일 positive delta·green·rising/active·surfaced exclusion·
최대 3개 순서는 보존한다. 후보/번역/metric/중복제외 조회 오류는 `unavailable`, 번역 부족은
`coverage_empty`, 후보 없음과 이력 부족은 각각 별도 상태로 렌더한다. free branch는 weekly query를
실행하지 않는다.

주간 CTA는 localized slug를 사용하고, localized detail에도 동일한 `MemeTrendPanel`을 렌더해
`#trend-panel-title` 목적지를 보장한다. `zh-tw`는 주간 브리프 전용 번체 카피를 갖는다. 이번 루프는
번역 생성·OpenAI 호출·DB write/migration·publication·deploy를 추가하지 않았으며 authenticated Plus
후보와 실제 RLS는 운영 게이트로 남긴다.

**되돌리는 방법:** `buildPlusWeeklyBriefCandidates`와 Premium weekly source/translation query를 제거하고
기존 canonical candidate mapping으로 되돌리면 된다. localized detail의 `MemeTrendPanel`, coverage/error
copy와 회귀 테스트도 함께 되돌려야 CTA anchor 계약이 사라진다.
### D-048 — Weekly Brief는 source 오류와 no-change를 빈 history로 합치지 않는다 (루프 102 reviewer remediation)

Plus Weekly Brief의 empty state는 사용자에게 다음 행동을 결정하게 하는 신호이므로 데이터 상태를
추측해서는 안 된다. saved/interest source query가 실패하면 locale과 무관하게 `unavailable`로
렌더하고, 후보에 두 날짜 이상의 metric history가 있지만 delta가 0 이하이면
`insufficient_history`가 아닌 `no_change`로 구분한다. 실제 history가 두 날짜 미만일 때만
`insufficient_history`를 사용한다. 이 분리는 무료 branch의 no-weekly-read와 기존 positive-delta
추천 계약을 변경하지 않는다.

**되돌리는 방법:** `resolvePlusWeeklyBriefCoverageState`의 source-error 호출과
`buildPlusWeeklyDeltaBrief`의 `historyCandidateCount`/`no_change` 분기를 제거하고, 해당 회귀
테스트와 `emptyNoChange` copy를 함께 되돌린다.

### D-049 — Plus의 다음 가치 증명은 새 기능이 아니라 one-cut 결과 흐름으로 고정한다 (루프 103)

Plus에는 이미 Action Inbox, Creator Pack, receipt, Outcome Snapshot, Weekly Brief, Global Daily와 여러
보조 surface가 있다. 이 상태에서 독립 기능을 더 추가하면 첫 화면의 행동 우선순위가 흐려지고, 구독 가치가
늘어났다는 증명보다 기능 목록만 늘어날 위험이 있다.

**결정:** pricing과 active/upgrade dashboard는 “검수된 밈 선택 → 게시용 카드 준비 → 실제 사용 기록”을
가장 강한 결과 약속으로 사용한다. existing one-cut Action Inbox와 Outcome Snapshot을 그대로 연결하고,
checkout locale 보존과 여섯 개 privacy-safe funnel event만 추가한다. 이벤트에는 PII·meme identifier·private
note·result URL을 넣지 않는다. 결제 entitlement·webhook·DB schema는 변경하지 않는다.

**되돌리는 방법:** result-first pricing/dashboard copy, checkout form의 locale field/API next mapping,
PLUS-030 analytics union·호출과 관련 regression test/artifact를 함께 제거하면 된다. 기존 one-cut/receipt/
Outcome Snapshot 동작은 유지한다.

### D-050 — 다음 Plus 수직은 새 기능이 아니라 격리 preview activation proof다 (루프 104)

Loop 103 이후에는 Action Inbox·Creator Pack·receipt·Outcome Snapshot을 더 추가하지 않는다. 구독 가치의
다음 증거는 `/en/pricing`에서 실제 entitlement가 활성화되고, 검수된 current 영어 밈 한 장이 one-cut 카드와
명시적 receipt로 끝난 뒤 새로고침에도 남는지 확인하는 것이다.

**결정:** clean release candidate와 격리 preview Supabase에서만 completion/receipt migration, active·expired·
cross-owner JWT/RLS, Unifi test payment/webhook, privacy-safe analytics 수신을 검증한다. production write,
번역 publication, OpenAI live call, deploy는 별도 승인 없이는 수행하지 않는다. preview DB·결제 테스트 권한·
reviewed/current 영어 fixture·clean RC가 없으면 `human_gate`에서 멈춘다.

**되돌리는 방법:** preview activation evidence와 ACT-001 backlog entry를 제거하고, Loop 103의 local
code-complete 상태와 기존 운영 게이트 목록으로 되돌린다. production 데이터에는 영향이 없다.

### D-051 — PLUS-031은 새 기능이 아니라 one-cut 결과 순서의 presentation remediation이다 (루프 105)

ACT-001 human gate를 우회해 Plus 기능 표면을 늘리지 않는다. 다만 기존 one-cut의 실제 DOM 순서가
`준비 CTA → 추천 밈`으로 뒤집혀 있어, 이미 승인된 D-049 결과 흐름의 이해를 방해했다.

**결정:** 새 상태·DB/API/schema·copy를 추가하지 않고 `one_cut`에서만 `ActionCard` 목록을 Creator Pack 준비 블록보다 먼저 렌더한다. 기본 `inbox` 순서는 유지하며, one-cut receipt는 준비 블록 뒤·ActionCard 밖에 렌더한다.
기존 reviewed/current locale projection, export/preview, compact receipt, completion/RPC와 privacy-safe analytics는
그대로 유지한다. 이 변경은 production activation 증거를 대체하지 않으며 ACT-001 human gate는 계속 유지한다.

**되돌리는 방법:** `plus-global-action-inbox.tsx`의 두 JSX 블록 순서를 원래대로 되돌리고, PLUS-031 order
regression과 loop-105 artifacts/docs를 함께 제거한다. 데이터나 production 상태에는 영향이 없다.

### D-052 — 글로벌 coverage-empty는 번역 fallback 대신 한국어 원본 탐색으로 이어진다 (루프 106)

`/en|ja|zh|zh-tw/explore`는 exact locale reviewed/current·원문 depth 공개 게이트를 유지하며, 번역이
충분하지 않을 때 한국어 원문을 해당 locale 페이지처럼 보여주지 않는다. 다만 coverage-empty 방문자를
메시지에서 끝내면 글로벌 discovery의 다음 행동이 끊긴다.

**결정:** `coverage-empty` 상태에서만 locale copy로 표시한 `/explore` 링크를 제공한다. active 카드,
unavailable 오류, metadata/canonical/robots와 no-fallback 공개 계약은 변경하지 않는다. 번역 생성·publication,
Supabase write와 production deploy는 이 결정의 일부가 아니다.

**되돌리는 방법:** localized Explore copy의 original action field와 coverage-empty Link, LOC-018 회귀 테스트 및
loop-106 artifacts/docs를 함께 제거한다. 공개 데이터와 production 상태에는 영향이 없다.

### D-053 — One-Cut은 활용 기록 뒤 결과 회고까지 닫아야 한다 (루프 107)

실제 Premium dashboard는 one-cut 추천과 receipt를 제공하지만, 성과 메모·hit/neutral/miss 후속 UI는
full inbox의 7일 요약 안에서만 렌더되어 pending metric만 남는 dead end가 있었다.

**결정:** 새 데이터 모델이나 API를 만들지 않고, `outcomeFollowUps.status === "ready"`인 one-cut에서만
기존 `PlusOutcomeFollowUp`을 Creator Pack·receipt 뒤에 렌더한다. 기존 owner-scoped performance/rating API,
privacy copy와 Next Move callback을 재사용하며 locked/empty/unavailable와 default inbox 순서는 유지한다.
이 변경은 실제 authenticated Plus/RLS/receipt persistence 증거를 대체하지 않으며 ACT-001 gate를 유지한다.

**되돌리는 방법:** one-cut ready branch의 `PlusOutcomeFollowUp` 연결과 PLUS-032 regression, loop-107
artifacts/docs를 함께 제거한다. 데이터·production 상태에는 영향이 없다.

### D-054 — Plus 번역 수요는 human intake gate와 report-only로 정렬한다 (루프 108)

관리자 Plus 번역 큐의 요청 수만으로는 사람이 제공한 번역 pack의 source snapshot·worklist·중복·unsafe
상태와 현재 공급 부족을 함께 판단할 수 없다. 반대로 요청 데이터를 번역 생성기나 publication 경계에 직접
연결하면 private demand와 public supply가 섞이고, 운영자 승인 전 자동 발행 위험이 생긴다.

**결정:** 기존 `translation:intake` JSON report와 operator-safe aggregated demand export를
`scripts/translation-demand-report.mjs`에서 읽기 전용으로 결합한다. 네 locale의 missing before/after/delta와
Plus active/actionable 요청을 함께 출력하고, exact source revision·locale로 `missing`·`stale`·`review_needed`·
`ready`·`unknown`을 분류한다. 공급이 막힌 상태를 먼저 정렬하되 request count·timestamp·meme ID·locale로
결정론적 tie-break를 적용한다. 기존 intake gate 오류는 실패 상태로 보존하며 owner ID·private note·번역
본문은 report DTO에 복사하지 않는다.

이 도구는 Supabase/RPC write, OpenAI 호출, SQL artifact 생성·실행, machine→reviewed 승인, public
publication을 수행하지 않는다. 실제 demand export와 human translation pack은 별도 운영 gate다.

**되돌리는 방법:** `scripts/translation-demand-report.mjs`, 해당 contract test/package scripts,
LOC-019 backlog와 Loop 108 artifact/docs를 함께 제거하면 된다. 기존 intake와 Plus queue 계약은 유지된다.

### D-055 — one-cut 평가 결과는 같은 화면의 Next Move로 즉시 확인한다 (루프 109)

Loop 107에서 one-cut에 활용 후 평가를 연결했지만, 기존 `Next Move`는 full inbox에만 렌더되어 평가가
추천을 바꿔도 구독자가 그 효과를 확인하려면 다른 surface로 이동해야 했다.

**결정:** one-cut의 초기 화면은 추천·카드 준비·receipt·outcome follow-up 순서를 유지한다. `outcomeRatings`
에 기존 행이 있거나 현재 session의 rating API 저장이 성공한 경우에만 follow-up 뒤에 기존
`PlusNextMove`를 렌더한다. 부모의 local rating state가 `buildPlusNextMove`를 다시 계산하므로 새로고침 없이
다음 후보와 signal을 보여준다. 실패/잘못된 응답은 local state를 바꾸지 않아 Next Move를 노출하지 않는다.

full inbox의 기존 노출, owner-scoped API/RLS, privacy-safe recommendation DTO, empty/unavailable 상태는
그대로 둔다. 새 DB table/RPC/migration/analytics field/private outcome field와 production activation은 이
결정에 포함되지 않는다.

**되돌리는 방법:** `plus-global-action-inbox.tsx`의 one-cut `shouldRenderNextMove` gate와 follow-up 뒤 JSX,
PLUS-033 regression 및 Loop 109 artifact/docs를 함께 제거하면 된다. 기존 rating 저장과 full inbox Next Move는
유지된다.

### D-056 — 글로벌 Plus 번역 요청은 확인된 상태에서만 기존 요청함으로 연결한다 (루프 110)

글로벌 상세의 `TranslationPriorityButton`은 이미 active Plus가 저장한 밈의 번역 검수를 요청할 수 있게 하지만,
요청 직후 다음 행동이 없어 요청이 실제 fulfillment 확인으로 이어지지 않았다. 반대로 존재하지 않는 상태를
`requested`로 추정하면 사용자에게 잘못된 요청 진행을 주장하게 된다.

**결정:** `requested`·`in_review` 상태가 GET 또는 성공 POST 응답으로 확인된 경우에만 기존
`/premium#plus-translation-fulfillment-title`로 이동하는 link를 보여준다. POST 2xx payload의 status가 없거나
허용 목록 밖이면 `unavailable`과 retry copy를 사용하고 tracking link를 만들지 않는다. current reviewed,
free, signed-out, terminal/unavailable 상태는 기존 경계를 유지한다.

link label은 기존 Premium copy의 `ko`·`en`·`ja`·`zh`와 `zh-tw` fallback을 사용한다. 별도 localized premium
route, 새 API/DB/schema/migration, 번역 자동 발행, owner/request/private field 노출은 추가하지 않는다.

**되돌리는 방법:** `TranslationPriorityStatusMessage`와 `requestDeskHref`, PLUS-034 regression, locale `track`
copy 및 Loop 110 artifact/docs를 함께 제거하면 된다. 기존 translation request RPC/RLS와 fulfillment desk는 유지된다.

### D-057 — 글로벌 상세는 기존 Use Kit으로 읽기에서 활용까지 닫는다 (루프 111)

글로벌 localized detail은 Save·번역 요청·Export까지 제공하지만, Plus 구독자가 밈을 실제로 써 보는
행동으로 넘어가려면 Use Kit을 다시 찾아야 했다. 별도 discovery 목록이나 새 recommendation model을
추가하면 기존 Premium surface와 중복된다.

**결정:** 상세 action row 아래에 기존 `#meme-use-kit-title`로 이동하는 locale-safe CTA를 둔다. CTA는
entitlement를 중복 조회하지 않고 기존 Use Kit을 진입점으로 사용하며, free/signed-out은 기존 locked
panel과 locale-safe pricing route를 유지한다. active Plus에서는 기존 copy-all/per-format copy에
native Web Share와 clipboard fallback을 연결하고, 성공 뒤 session-only prepared status를 표시한다.
AbortError와 clipboard 실패는 완료로 오인하지 않는다.

Use Kit 입력은 상세에 이미 표시된 reviewed/current localized facts만 허용한다. 새 DB/API/RPC/schema/
persistence/AI/private payload, automatic translation fallback, production payment, human publication은
이 결정에 포함되지 않는다. 5개 locale copy와 기존 Save·translation/export·canonical·safety 경계를
그대로 둔다.

**되돌리는 방법:** `MemeUseKitEntry`, detail wiring, share/prepared state, PLUS-035 regression,
locale kit copy와 Loop 111 artifact/docs를 함께 제거하면 된다. 기존 Use Kit locked/active surface와
다른 Premium dashboard 흐름은 유지된다.

### D-058 — Global Daily 완료는 기존 Use Kit으로 이어져야 한다 (루프 112)

Global Meme Daily는 reviewed/current 글로벌 밈을 학습시키지만, 완료 뒤 score와 streak만 보여 주어
구독자가 방금 확인한 밈을 실제 활용하는 다음 행동이 끊겼다. 새 추천 목록이나 별도 생성 surface를
추가하면 기존 localized detail과 Use Kit의 검수·privacy 경계를 중복하게 된다.

**결정:** 성공적인 local completion과 서버의 already-completed re-entry에서만 score/streak 아래에
첫 challenge meme의 기존 localized detail route와 `#meme-use-kit-title`을 잇는 locale-safe CTA를
보여준다. CTA는 Daily가 이미 반환한 reviewed/current title·short ID·localized slug를 사용하며,
completion POST/response·streak 계산·기존 analytics event와 5개 locale copy/route/canonical 경계를
그대로 유지한다. signed-out·locked·unavailable 상태에는 CTA를 추가하지 않는다.

새 DB/API/RPC/schema/persistence/analytics event/OpenAI/payment surface, 자동 번역 발행, private
payload 노출, production completion write는 이 결정에 포함되지 않는다. authenticated Plus/RLS와
human translation review/publication은 기존 운영 게이트로 남긴다.

**되돌리는 방법:** `CompletionPanel`의 next-step CTA, PLUS-036 regression, locale continuation copy와
Loop 112 artifact/docs를 함께 제거하면 된다. 기존 Global Daily completion, detail Use Kit, locked
pricing gate와 다른 Premium 흐름은 유지된다.

### D-059 — checkout confirmation은 기존 첫 One-Cut으로 이어진다 (루프 113)

결제 복귀 화면에서 서버 entitlement 확인과 `router.refresh()`만 제공하면, 활성 구독자가 결제 직후
첫 Plus 가치를 다시 탐색해야 한다. 새 추천·결제 상태 판정·데이터 저장 surface를 추가하지 않고도
기존 Global Action Inbox가 첫 행동의 단일 진입점이다.

**결정:** `?checkout=return`에서 서버 entitlement가 `isPremium: true`로 확인된 경우에만 기존
`/premium#plus-global-action-inbox-title` anchor CTA를 결제 확인 문구와 함께 표시한다. 자동 이동은
하지 않는다. entitlement 확인 전·polling 오류·timeout·signed-out·일반 `/premium`에는 CTA가 없다.
기존 polling/refresh/provider/privacy 경계와 5개 locale copy를 유지하며, 루프 103부터 존재한
`plus_checkout_returned` 계측은 변경하지 않는다. 새 DB/API/RPC/schema/persistence/payment 상태
판정/analytics event/OpenAI/publication은 이 결정에 포함되지 않는다.

**되돌리는 방법:** `CheckoutReturnStatus`의 confirmed CTA와 `startOneCut` copy, PLUS-037 regression,
Loop 113 artifact/docs를 함께 제거하면 된다. 기존 checkout confirmation polling과 Plus Action Inbox는
유지된다.

### D-060 — 글로벌 검색 coverage-empty는 한국어 원문 탐색으로만 명시적으로 복구한다 (루프 114)

글로벌 locale 검색이 한국어 결과를 반환해도 해당 언어의 reviewed/current 공개 번역이 없으면,
사용자는 결과를 읽을 수는 있지만 다음 탐색 행동을 선택할 수 없었다. 한국어 원문을 조용히
현지화 결과로 표시하면 언어 신호와 검색 품질을 속이게 된다.

**결정:** query 결과가 1건 이상이고 query-localized eligible result가 0건이며 exact translation
lookup 상태가 `coverage-empty`인 경우에만 locale copy의 Korean original Explore CTA를 표시한다.
CTA target은 정확히 `/explore`다. localized result가 있거나 lookup이 `unavailable`이거나
query 결과가 없으면 CTA를 숨긴다. 기존 `Korean original` label·원문 링크, reviewed/current/
depth 공개 gate, query search, canonical·robots·hreflang 및 analytics를 유지한다.

이 결정은 번역 생성·자동 fallback·publication, 새 DB/API/RPC/schema/persistence, OpenAI 호출,
결제/analytics event, production write/deploy를 포함하지 않는다. 번역 공급 **448/1,520**과
LOC-007/LOC-010 운영 gate는 그대로 유지한다.

**되돌리는 방법:** `getLocalizedSearchMemesResult` 상태 반환, `shouldOfferLocalizedSearchRecovery`,
검색 페이지의 coverage-empty CTA, LOC-020 regression 및 Loop 114 artifact/docs를 함께 제거하면 된다.
기존 localized search와 Korean original fallback은 유지된다.

### D-061 — 글로벌 검색 coverage-empty는 기존 번역 옵션으로도 명시적으로 연결한다 (루프 115)

Loop 114의 Explore recovery만으로는 사용자가 기존 한국어 상세의 번역 영역을 다시 찾아야 했다. 검색
의도는 수요를 기존 Plus 번역 desk로 연결하기 가장 강한 순간이지만, coverage 부족을 준비된 번역처럼
표시해서는 안 된다.

**결정:** query 결과가 1건 이상이고 lookup이 성공한 `coverage-empty`이며 localized result가 0건인
경우에만 기존 Korean original Explore CTA와 locale copy translation-options CTA를 함께 표시한다.
새 CTA는 첫 결과의 canonical `memePathFrom(short_id, slug)#global-translation-title`로 연결한다.
번역 준비·자동 발행·Plus entitlement를 주장하지 않는다. active/unavailable/zero-result에서는 두
CTA를 숨긴다. 기존 Korean fallback label/link, detail의 `TranslationPriorityButton`
save-required/free/signed-out/Plus/request-status gate, query/metadata/analytics/submit 경계를
그대로 유지한다. 새 DB/API/RPC/schema/persistence/translation/OpenAI/payment surface는 추가하지
않는다.

**되돌리는 방법:** `translationOptions` copy, 첫 결과 anchor 계산, 두 번째 CTA, LOC-021 tests/artifacts/
docs를 함께 제거하면 된다. 기존 Loop 114 Explore recovery와 detail translation surface는 유지된다.

### D-062 — empty Action Inbox는 저장한 ready-now 밈으로만 Plus Next Move를 보강한다 (루프 116)

One-Cut 이후 rating 학습은 이미 있었지만, 오늘 후보가 전부 완료되면 Action Inbox가 empty가 되어
저장한 current/green 밈을 다시 활용할 명시적 다음 행동이 없었다.

**결정:** Action Inbox가 `empty`이고 owner-scoped completion read가 available일 때만 기존
SavedReuseRadar의 readyNow candidate를 PlusNextMove input으로 사용한다. ko는 canonical;
en/ja/zh/zh-tw는 `getLocalizedMemeByShortId`가 exact reviewed/current/required/depth gate를
통과한 경우에만 localized content/link를 사용한다. UI locale이 SEO content locale이 아니면
existing `resolvePlusContentLocale`를 통해 en으로 정규화한다. missing/stale/query failure/
active/unavailable/rating unavailable에서는 fallback을 숨기거나 기존 상태를 유지한다. fallback
DTO는 savedAt/collection/private note를 전달하지 않고 `#meme-use-kit-title`로 연결한다. 새
DB/API/RPC/schema/migration/write/analytics event는 없다.

**되돌리는 방법:** `projectSavedRevisitNextMoveItem`, saved signal copy, `nextMove.items`,
premium saved fallback loader, PLUS-038 tests/artifact/docs를 제거한다. 기존 Action Inbox,
SavedReuseRadar, PlusNextMove는 유지한다.

### D-063 — 게시 채널을 먼저 고르고, 성공한 Creator Pack 뒤에만 One-Cut receipt를 연다 (루프 117)

기존 Creator Pack은 범용 card를 준비한 뒤 receipt에서 실제 게시 채널을 다시 물었다. 이 순서는
구독자가 결과물을 바로 사용할 수 있는지 확인하기 어렵고, One-Cut의 generic completion action은
준비 성공 전 receipt를 열 수 있었다.

**결정:** Creator Pack 생성 전에 9개 게시 채널을 선택하게 하고, `instagram`·`tiktok`·`youtube`는
기존 story export, `threads`·`x`·`community`·`messaging`·`blog`·`other`는 기존 card export를
사용한다. One-Cut에서는 준비 전 generic `Mark used`를 숨기며, 성공한 export가 있을 때만 명시적
Creator Pack receipt action을 표시한다. receipt의 channel은 선택값으로 미리 채우되 사용자가
수정할 수 있고 artifact는 `creator_pack`으로 고정한다. share 취소·partial export·clipboard
실패는 prepared/downloaded 상태로만 남긴다. preview는 intrinsic ratio를 보존한다.

기존 locale/reviewed/current/safety/entitlement export와 outcome receipt POST를 재사용하며,
새 DB/API/RPC/schema/migration/production write/analytics event/OpenAI/publication은 이 결정에
포함하지 않는다. `ko`·`en`·`ja`·`zh`·`zh-tw` copy를 유지하고 번체 Creator Pack copy는 별도
override로 둔다.

**되돌리는 방법:** `creatorPackFormatForChannel`, channel selector 및 One-Cut receipt gate,
intrinsic preview class, five-locale Creator Pack copy, PLUS-039 tests/artifacts/docs를 함께
제거하면 된다. 기존 generic inbox completion과 Creator Pack export는 유지한다.

### D-064 — 성과가 충분히 양수인 게시 채널만 Creator Pack 기본값으로 추천한다 (루프 118)

Loop 117은 게시 채널을 준비 단계에서 선택하게 했지만, 사용자의 최근 결과를 다음 선택에
반영하지 않아 반복 사용의 학습 루프가 끊겨 있었다.

**결정:** 기존 `plus_meme_use_receipts`의 owner-scoped 최근 28일 rating과 channel을 읽어
전체 rating 3건 이상, 후보 채널별 2건 이상인 경우에만 추천한다. `hit`은 +1, `neutral`은
0, `miss`는 -1로 점수화하고, 양수인 후보만 남긴다. 동률은 hit-rate, sample count, 최근
완료일, 고정 채널 순서로 결정해 매번 같은 입력에 같은 결과를 낸다. rating query 오류나
invalid channel은 unavailable로 닫고 추천하지 않는다.

추천값은 Creator Pack channel의 초기값일 뿐이다. 사용자가 직접 바꾼 뒤 늦게 도착한 rating
응답은 수동 선택을 덮지 않는다. 기존 story/card export, `creator_pack` receipt, 5 locale
copy와 reviewed/current·entitlement·privacy 경계를 재사용하며 새 DB/API/RPC/schema/migration/
production write/analytics/OpenAI/publication은 추가하지 않는다.

**되돌리는 방법:** `plus-outcome-channel-recommendation.ts`와 해당 rating channel projection,
Creator Pack 초기 추천/status copy, race/threshold 회귀 및 PLUS-040 artifact/docs를 제거한다.
기존 수동 채널 선택·Creator Pack export·receipt 흐름은 유지한다.

### D-065 — 검수된 상황별 예문만 Scenario One-Cut 공유 문구로 전달한다 (루프 119)

기존 Plus Creator Pack은 검수된 제목·요약·안전 안내와 카드 파일은 준비했지만, 사용자가
실제 대화 상황에 맞는 한 줄을 고르는 단계가 없었다. 새 문장을 생성하면 관리자 검수와
글로벌 번역 공급 경계를 우회할 수 있다.

**결정:** 공통 usage example parser로 비어 있지 않은 최대 3개 항목만 통과시키고, 한국어는
canonical source, 외국어는 source_updated_at이 원문 updated_at과 같은 reviewed translation
row의 예문만 사용한다. Action Inbox의 Scout·Translation Fulfillment·Daily Signal facts로
전달된 예문을 One-Cut에서 선택하게 하고, 선택한 text를 기존 localized caption·safety·detail
link와 함께 share text/preview에 포함한다. 예문이 없으면 새 문장을 만들지 않는 상태를
표시하고 기존 generic pack만 준비한다.

기존 entitlement·reviewed/current·safety·Creator Pack export·explicit receipt 경계를
재사용하며 새 DB/API/RPC/schema/migration/production write/analytics/OpenAI/publication은
추가하지 않는다. 관리자 GPT 보조 검수는 gpt-5.6-sol + high reasoning strict contract와
human approval/publication gate를 유지한다.

**되돌리는 방법:** usage-examples parser, Scout/Fulfillment/Daily Signal propagation,
Creator Pack usageExample input/share text와 One-Cut selector/copy, PLUS-041 tests/artifacts/docs를
함께 제거하면 기존 제목·요약 기반 Creator Pack으로 돌아간다.

### D-066 — One-Cut은 기본 한 장을 유지하고, 명시적 opt-in에서만 밈별 Scenario Pack을 만든다 (루프 120)

Loop 119의 상황별 예문 선택은 첫 One-Cut 밈 하나에만 적용됐다. 반대로 `/premium`의 전체
Action Inbox를 그대로 노출하면 첫 행동이 다시 기능 목록으로 분산되고, 다중 pack에서 단일
example index를 재사용하면 서로 다른 밈의 문맥이 섞인다.

**결정:** `/premium`은 기존처럼 첫 밈 한 장을 기본 One-Cut으로 보여준다. 후보가 두 개 이상일
때만 사용자가 `include more` checkbox를 명시적으로 선택할 수 있고, 그때 Creator Pack에
추가 후보를 포함한다. 선택 상태는 `memeId`별 map으로 관리하며, 각 item의 bounded reviewed
`usageExamples`를 독립 선택한다. 선택한 문구는 해당 item의 share text/preview에만 전달하고,
예문이 없는 item은 새 문장을 만들지 않는 상태를 표시한다.

기존 `reviewed/current/exact-locale/no-fallback`, channel-to-format export, explicit receipt,
owner/entitlement/privacy 경계를 재사용한다. 새 DB/API/RPC/schema/migration/write/analytics/
OpenAI/publication 자동화는 추가하지 않는다. 실제 authenticated Plus·RLS·payment·live
translation supply는 이 local presentation/read vertical의 증거가 아니다.

**되돌리는 방법:** `includeAdditionalCreatorPackItems` 상태와 5 locale copy, item별
`usageExampleIndexes` projection, PLUS-042 tests/artifact/docs를 제거하면 Loop 119의 단일
One-Cut으로 돌아간다. 기존 Creator Pack/export/receipt 흐름은 유지한다.

### D-067 — 글로벌 번역 큐는 route-unlock 후보를 먼저 보여주고 장애를 empty로 축소하지 않는다 (루프 121)

현재 `/admin/translations`의 누락 목록은 원문 `updated_at`만으로 정렬되어, 번역 후 실제 공개
locale route를 열 가능성이 높은 문서를 운영자가 먼저 찾는 계약이 없었다. 또한 Plus 번역 수요
RPC 오류가 `[]`로 변환되어 “요청 없음”처럼 보일 위험이 있었다.

**결정:** 기존 `isIndexableMeme()`의 source depth·근거·미디어·태그 신호를 read-only로 재사용해
`routeUnlockCandidate`를 계산한다. 공개 `approved`/`limited` 원문 전체를 스캔하고 후보를 먼저,
그 안에서는 source revision 최신순과 `memeId` 고정 순서로 정렬한다. `focusMemeId`가 있으면
해당 누락 행을 limit 안에 첫 행으로 예약해 claim 이후 검수 액션을 보존한다. 후보 표시는 reviewed 번역,
실제 route 200, sitemap 등록, publication을 뜻하지 않으며, 번역 초안·GPT preview·운영자 검수·
승인은 기존 human gate에서만 일어난다. RPC 오류는 `unavailable` alert로 empty와 분리한다.

새 DB/API/RPC/schema/migration/write/자동 번역/자동 publication/analytics는 추가하지 않는다.
글로벌 공급 수치 `448/1,520`은 live 데이터가 아니라 checker artifact로만 보고한다.

**되돌리는 방법:** `lib/translation-worklist.ts`와 테스트, missing source projection의
`routeUnlockCandidate`와 정렬, 관리자 상태 배지, priority queue `error` prop 및 LOC-022 문서를
제거하면 기존 최신순 목록과 empty-only UI로 돌아간다. 기존 GPT 검수·저장·승인 액션은 유지한다.

### D-068 — Plus activation은 먼저 local JWT/RLS/receipt를 실제로 관통 검증한다 (루프 122)

Loop 117~121의 Plus 구현은 서버 계약과 컴포넌트 mock을 통과했지만 실제 인증 사용자·RLS·receipt
재조회 증거가 없었다. 새 UI를 더하는 대신 existing migration과 seeded public meme을 이용해 local
Supabase에서 activation 핵심 경로를 검증한다.

**결정:** `scripts/plus-activation-local.mjs`는 `127.0.0.1:54321` 또는 `localhost:54321`만
허용하고 `LOCAL_SUPABASE_ANON_KEY`·`LOCAL_SUPABASE_SERVICE_ROLE_KEY`만 읽는다. 임시 Auth user와
reviewed/current English translation fixture를 생성한 뒤 active Plus receipt·idempotent retry·
outcome summary·owner isolation·free/canceled rejection을 검사하고 finally에서 정리한다.
`supabase db push --local`은 local migration만 적용하며 `db reset`, production DB write, payment,
translation publication, deploy는 이 루프의 범위가 아니다.

이 증거는 production activation이나 실제 고객 구독 가치의 시장 검증으로 확대하지 않는다. full
ACT-001에는 clean RC, 격리 preview, 결제 테스트 자격증명, production-like migration/RLS matrix가
여전히 필요하다.

**되돌리는 방법:** `scripts/plus-activation-local.mjs`, package script, ACT-001-LITE docs/artifact를
제거하고 local Supabase migration history는 별도 local reset/재생성으로 되돌린다. production에는
변경이 없으므로 production rollback은 필요하지 않다.

### D-069 — Prepared Creator Pack 결과는 receipt 이후에도 session-only로 재사용한다 (루프 123)

One-Cut Creator Pack의 export가 성공한 뒤 사용자가 다시 공유하거나 카드 하나만 다시 저장하려면
동일한 결과를 다시 fetch/export해야 했다. receipt를 저장할 때 prepared item을 전부 제거하면 Plus의
반복 사용 가치도 사라진다.

**결정:** 성공한 `{ item, blob }` 결과를 브라우저 세션 state에 유지하고, 명시적인 `Share prepared
cards`와 카드별 `Save card again` control을 제공한다. receipt가 저장되면 미완료 item만 completion
대상에서 제거하지만 retained Blob은 제거하지 않는다. partial export 실패 수와 native share 취소
상태를 유지하고, 재공유 promise가 끝날 때까지 share/download/create 중복 실행을 차단한다.

이 state는 새로고침·기기 변경·사용자 간 공유를 지원하지 않는다. 새 DB/API/RPC/schema/migration/
receipt write/analytics/OpenAI/publication은 추가하지 않으며 기존 reviewed/current·human receipt
경계를 재사용한다. 5개 locale의 action/status copy는 기존 Premium copy에 추가한다.

**되돌리는 방법:** `preparedCreatorPackFiles`, 재공유/재다운로드 control, busy/failure state와
PLUS-043 regression/docs를 제거하면 기존 export 후 일회성 결과 UI로 돌아간다. 기존 Creator Pack
export·receipt 저장 경로와 DB 경계는 유지한다.

### D-070 — Plus Outcome History는 기존 receipt를 bounded read model로 다시 보여준다 (루프 124)

Outcome Snapshot과 Follow-up은 최근 집계와 대기 중인 최대 5건을 닫지만, 사용자가 실제로 남긴
receipt·평가를 날짜와 채널별로 다시 찾는 개인 작업 기억은 제공하지 않았다.

**결정:** active Plus만 기존 `plus_meme_use_receipts`를 최근 KST 30일·최대 50건으로 읽고,
completion date desc·receipt id asc의 결정론적 순서로 `/premium`에 표시한다. 채널·평가 필터는
client-side read-only 상태로 처리하고, 제목·날짜·채널·언어·산출물·성과 메모 상태·canonical
detail link만 노출한다. `result_url`·`private_note`는 select와 DTO에서 제외한다.

RLS가 owner + active Plus 범위를 강제하고 loader는 user id를 받지 않으므로 다른 사용자의 receipt를
확장 조회하지 않는다. non-Plus/empty/query error는 각각 locked/empty/unavailable로 분리하며,
새 API/RPC/schema/migration/write/analytics/OpenAI/publication은 추가하지 않는다. 글로벌 locale
history도 현재 번역을 추측해 잘못된 locale route를 만들지 않도록 canonical detail path로 연결한다.

**되돌리는 방법:** `PlusOutcomeHistory`, history loader/domain parser, history copy와 Premium wiring,
PLUS-044 tests/docs를 제거하면 기존 Snapshot + Follow-up 표면으로 돌아간다. receipt/rating table,
RLS, completion/rating API는 변경하지 않는다.

### D-071 — Daily Signal은 읽기용 상세가 아니라 오늘의 One-Cut을 직접 연다 (루프 125)

Daily Signal 이메일의 후보가 기존 상세 경로로만 연결되면 사용자는 다시 `/premium`에서 실행할
밈을 찾아야 한다. 또한 인증 proxy가 query를 잃으면 이메일에서 시작한 focus 후보가 로그인 뒤
사라진다.

**결정:** 이메일 CTA는 기존 delivery server가 통과시킨 reviewed/current 후보의 id와 발송 locale을
`/premium?focus=...&locale=...&from=daily_signal`로 전달한다. Premium 서버는 safe focus만 파싱하고,
owner-scoped entitlement·completion·safety·reviewed/current 조건을 통과해 실제 Action Inbox에
있는 후보만 첫 One-Cut으로 승격한다. unknown/stale/completed/unsafe focus는 기존 deterministic
순서로 fallback한다. 인증 proxy는 path와 원래 query 전체를 safe `next`에 넣고, 원래 query는
중복 전달하지 않는다. 로컬 UI locale보다 이메일의 명시 locale을 우선해 메일에서 선택한 언어를
유지한다.

`plus_one_cut_ready`·`plus_one_cut_prepared`·`plus_receipt_saved`는 기존 analytics surface를
재사용하되 locale/count/channel/artifact kind/idempotency flag만 보내며 개인 식별자, 원문, URL,
receipt id, private note는 보내지 않는다. 새 DB/API/RPC/schema/migration/결제/AI 생성/번역 자동
공개는 추가하지 않는다. 이메일·대시보드의 5 locale copy와 기존 human translation publication
gate를 유지한다.

**되돌리는 방법:** `buildPlusDailySignalPremiumPath`와 locale/focus parser, Daily Signal email CTA,
`preferredMemeId` sorting, proxy `authReturnPath`, three funnel event calls와 PLUS-045 tests/docs를
제거하면 기존 상세 링크·기본 Action Inbox 순서·기존 login next 동작으로 돌아간다. 기존 delivery
reviewed/current gate, Creator Pack/export/receipt, entitlement/RLS는 유지한다.

### D-072 — 실행 가능한 Next Move만 One-Cut 큐 안에서 즉시 활성화한다 (루프 126)

ratings가 고른 Next Move가 상세 Use Kit으로만 이동하면 구독자는 추천을 실제 실행 순서로 옮기기
위해 Action Inbox를 다시 찾아야 한다. 반대로 saved-revisit 후보나 이미 Creator Pack/receipt 작업이
진행 중인 후보까지 자동으로 큐를 바꾸면 사용자의 현재 작업을 잃을 수 있다.

**결정:** `PlusGlobalActionInbox`가 `mode="one_cut"`이고 Next Move 후보가 현재 local Action Inbox에
존재하며 Creator Pack 준비·prepared Blob 재사용·pending receipt 작업이 없을 때만 `PlusNextMove`에
`onActivate`를 전달한다. activation은 서버 write나 URL 변경 없이 해당 `memeId`를 첫 카드로 재배치하고
include-more/example 선택을 초기화한다. 상태는 기존 role=status live region으로 알리고 첫 카드에
focus를 돌려 키보드 사용자가 이동 결과를 즉시 확인하게 한다. full inbox, empty/saved-revisit,
completed/unavailable, busy/prepared 상태는 기존 internal detail link를 유지한다.

이 결정은 ratings 계산·reviewed/current/no-fallback·entitlement/RLS·Creator Pack/export/receipt
경계를 변경하지 않는다. 새 DB/API/RPC/schema/migration/write/analytics/OpenAI/publication 자동화는
추가하지 않는다. 인증된 Plus populated 화면과 실제 receipt/payment는 별도 human gate로 남긴다.

**되돌리는 방법:** `onActivate`, activation/status copy, reorder/focus state와 PLUS-046 회귀/docs를
제거하면 Next Move는 기존 상세 Use Kit link만 제공한다. 기존 ratings, Action Inbox, Creator Pack,
receipt 및 server boundary는 그대로 유지한다.

### D-073 — zh Plus 수요는 route-unlock 누락 worklist의 앞단에만 주입하고, preview·저장·발행은 분리한다 (루프 127)

Plus 번역 요청과 글로벌 route-unlock 후보를 별도 화면에 두면 zh 운영자가 수요와 공급 사이를 수동으로
왕복해야 하고, machine 초안 저장 뒤 다음 후보를 다시 찾아야 한다. 반대로 요청 큐를 자동 번역·자동
발행으로 연결하면 기존 human gate와 source revision 계약을 약화시킬 수 있다.

**결정:** 서버 페이지가 기존 `list_translation_priority_queue` read RPC에서 zh의
`translationStatus === null` meme ID만 읽어 `listMissingMemeTranslations`에 전달한다. worklist는
기존 `isIndexableMeme()` 기반 정렬을 먼저 수행한 뒤 Plus ID를 stable partition하고, 그 안에서
`updatedAt desc`·`memeId asc`를 유지한다. `focusMemeId`는 priority 여부와 관계없이 최종 결과의 첫
행으로 예약하고 fixed limit을 적용한다. RPC 오류는 priority ID를 만들지 않으면서 별도 unavailable
표면으로 남겨 “요청 없음”으로 축소하지 않는다.

zh 운영자 lane은 Plus 배지와 현재 후보만 표시한다. 버튼을 누른 행에만 기존
`previewMissingMemeTranslationWithGpt`를 호출하고, gpt-5.6-sol/high·source revision·재조회 gate를
그대로 사용한다. 저장은 기존 CAS `saveMissingMemeTranslationDraft`로 `machine` 행만 만든다. 저장
성공 후 client state가 다음 행을 선택하지만 GPT를 자동 호출하지 않고, reviewed 상태·public locale
route·sitemap·publication은 별도 사람 승인에서만 발생한다.

새 DB/API/RPC/schema/migration/자동 번역/자동 publication/analytics를 추가하지 않는다. 현재
translation checker의 `448/1,520`은 공급 완료나 live route proof가 아니며, authenticated operator
session과 production write/deploy는 이 결정의 범위 밖이다.

**되돌리는 방법:** `prioritizeTranslationWorklistRows`와 priorityMemeIds 전달, zh operator lane의
active/next 상태·배지·회귀 테스트와 LOC-023 문서를 제거하면 기존 route-unlock worklist와 별도 Plus
queue 화면으로 돌아간다. 기존 GPT preview, machine CAS save, human review/publication 경계는 유지한다.

### D-074 — Plus Outcome History는 receipt locale의 공개 번역 상태를 검증한 뒤에만 localized replay link를 만든다 (루프 128)

기존 Outcome History는 receipt가 en/ja/zh/zh-tw여도 한국어 canonical detail path만 보여주었다. 사용자가 실제로 사용한 언어의 reviewed/current 결과를 다시 열 수 없었고, 반대로 번역 상태를 확인하지 않고 locale path를 만들면 stale 또는 machine-only 문서가 공개 재생 경로처럼 보일 수 있었다.

**결정:** history loader는 기존 owner-scoped 30일·최대 50건 receipt query에 source meme의 충실도 신호와 번역 행을 nested로 함께 읽는다. `ko`는 canonical path를 사용하고, 비한국어 receipt는 exact locale의 `status=reviewed` 행에 비어 있지 않은 `reviewed_at`·`reviewed_by` 감사 메타데이터가 있는지 확인한 뒤 `overlayMemeTranslation()`으로 적용하고 `isIndexableLocalizedMeme()`를 통과할 때만 `localizedMemePath()`를 사용한다. source revision이 stale하거나 번역 행이 없거나 필수 산문/충실도/감사 게이트를 통과하지 못하면 한국어 canonical fallback을 사용한다. nested translation 관계 자체가 null/비정상이면 그 row만 `unavailable`로 닫고 fake href를 만들지 않는다. source meme relation이 없거나 history query가 실패하면 기존 전체 `unavailable` fail-closed를 유지한다.

DTO에는 `href`와 `localized`·`korean-fallback`·`unavailable` 상태만 추가하며 `result_url`·`private_note`는 계속 select/DTO/UI에서 제외한다. UI는 localized 상세, 한국어 원문, 번역 링크 확인 불가를 5개 locale copy로 표시하고 unavailable row를 clickable `href`로 렌더하지 않는다. 새 DB/API/RPC/schema/migration/write/AI/publication 자동화는 추가하지 않으며, reviewed 번역의 실제 공급·human publication·production deploy와 인증된 Plus receipt는 별도 게이트다.

**되돌리는 방법:** `resolvePlusOutcomeHistoryLink()`와 nested translation select, history link status DTO/parser, 5 locale status copy 및 PLUS-047 회귀를 제거하면 기존 canonical-only history로 돌아간다. receipt/RLS, 공개 번역 gate, payment/entitlement 및 publication 경계는 변경하지 않는다.

### D-075 — 성과가 검증된 결과만 Outcome Replay One-Cut으로 되돌린다 (루프 129)

Outcome History가 기록을 보존해도 다음 방문에는 상세 링크만 제공해, 사용자가 성공한 결과를 다시
만드는 반복 루프가 끊겼다. 반대로 과거 receipt만 믿고 현재 상태가 바뀐 밈을 다시 추천하면 안전·공개·
언어 계약을 우회할 수 있다.

**결정:** history loader는 owner-scoped 최근 30일 receipt를 기존 localized/current link 판정과 함께
현재 `approved/limited`, indexable source, `green/yellow`, `rising/active`, performance `hit`,
exact receipt locale 조건으로 재검증한다. `ko`는 canonical path, 비한국어는 reviewed/current exact
locale path만 replay eligible로 만든다. eligible row에는 public short id와 이전 channel만 추가하고
receipt id/private note/result URL은 DTO·UI·analytics에서 제외한다. history CTA는
`replay`, `replay_locale`, `from=outcome_history` 단일 query로 만들고, proxy와 Premium page 모두
중복·URL-shaped·Daily Signal marker 혼합을 거부한다.

검증된 replay item은 현재 Action Inbox 후보와 별도로 삽입하되 최고 우선순위로 정렬하고, UI locale이
receipt locale과 달라도 item locale을 유지한다. 이전 channel을 Creator Pack 기본값으로 미리 채우며
기존 One-Cut 준비·export·receipt·funnel을 그대로 사용한다. 오늘 완료 ID가 있거나 completion read가
unavailable이면 replay만 fail-closed로 제외하고 일반 신호는 유지한다.

새 DB/API/RPC/schema/migration/write/AI/publication 자동화는 추가하지 않는다. 실제 authenticated Plus
receipt/RLS, production 번역 발행·operator 검수·payment·deploy는 별도 human gate로 남긴다.

**되돌리는 방법:** `loadPlusOutcomeReplayItem()`, replay routing/proxy allowlist, `outcome_replay`
action kind, history CTA/metadata, prior channel prefill와 PLUS-048 회귀/docs를 제거하면 Outcome
History는 localized detail link만 제공하고 Action Inbox는 기존 후보만 사용한다. receipt/RLS,
Creator Pack/export/receipt API와 공개 번역 gate는 그대로 유지한다.

### D-076 — Paid-value activation은 target-generated evidence가 있는 read-only preflight로만 READY를 허용한다 (루프 130)

Loop 122의 local Auth/JWT/RLS fixture와 Loop 129의 local replay surface만으로는 실제 preview 결제에서
entitlement와 One-Cut receipt/outcome까지 이어지는 경로를 입증할 수 없다. 단순 `true` 환경변수, 401/403
응답, 로컬 migration 파일 목록, 임의의 release JSON은 잘못된 key·오래된 배포·미검토 개인정보 문서를
숨길 수 있다.

**결정:** ACT-001-RC는 production write/payment/deploy를 하지 않는 read-only CLI로 한정한다. Supabase는
anon key만으로 추측하지 않고 scoped authenticated preview JWT를 요구하며, OpenAPI catalog와 실제
authenticated `limit=0` core read가 모두 유효해야 한다. core는 실제 `billing_*`, completion, receipt
테이블과 client RPC를 사용하고, outcome rating은 receipt column/RPC로만 판정한다. supporting relation은
ready gate가 아니라 `supportingDegraded` 진단으로 분리한다.

preview 증거는 clean working tree/commit SHA, Unifi test-mode의 payment·entitlement·eligible action·receipt·
outcome 단계, provider/outcome/retention privacy 검토, target migration ledger를 포함해야 한다. 각 증거
artifact는 root 내부 상대 경로의 실제 바이트 SHA-256·검증 timestamp·realpath containment를 통과해야 하고,
미래/30일 초과/URL/symlink 탈출 artifact는 거부한다. 모든 public route는 manual redirect GET으로 확인하고
세 route의 `X-MemeCatch-Release-Sha`가 동일한 evidence commit과 일치해야 한다. 이 조건을 충족하지 못하면
`BLOCKED`로 남기며, 이번 루프는 local code_complete만 기록한다.

**되돌리는 방법:** `plus-activation-preflight.mjs`·contract test·package script·release SHA header와
ACT-001-RC docs를 제거하면 기존 ACT-001-LITE/local gate만 남는다. 결제·Supabase migration/RLS/RPC·privacy
정책 자체는 변경하지 않는다.

### D-077 — Plus 요청 locale을 글로벌 번역 worklist와 Action Inbox에서 끝까지 보존한다 (루프 131)

Plus 사용자가 요청한 번역은 `requested → in_review → completed`와 reviewed/current 공개 조건을 거쳐야
실제 fulfillment가 된다. 그런데 관리자 missing worklist의 수요 우선화가 `zh`에만 연결되어 있었고, ready
번역을 현재 UI locale과 비교해 필터링하면 `en` UI의 일본어 요청처럼 이미 준비된 유료 결과가 사라졌다.

**결정:** 관리자 페이지는 `listTranslationPriorityQueue`의 현재 선택 locale 행 중 `translationStatus=null`만
`missingTranslationPriorityMemeIds`로 전달해 네 SEO locale에 동일한 수요 우선화를 적용한다. machine/stale
행은 missing draft가 아니라 기존 검수 큐에서 처리한다. Action Inbox는 fulfillment item의 `state=ready`를
먼저 검증한 뒤 UI locale과 다른 item도 포함한다. 같은 밈에 여러 ready locale이 있으면 현재 UI locale을
우선하고, 그 외에는 changedAt·requestId·locale 순으로 deterministic하게 하나를 선택한다.

카드의 locale label과 exact localized href/share text로 사용자가 어떤 언어의 결과를 받는지 명시한다. 새
runtime table/API/schema와 production 적용은 추가하지 않고, locale-scoped RPC source migration artifact만
추가한다. production migration apply/write/AI/publication 자동화는 수행하지 않으며, stale/source-incomplete/machine
행과 human review/publication gate는 유지한다. 실제 reviewed 공급량·authenticated Plus/RLS·production
publication은 이 결정으로 증명되지 않는다.

**되돌리는 방법:** `missingTranslationPriorityMemeIds` 호출을 제거하고 기존 `zh` 조건을 복원하며,
`addReadyTranslations`의 exact UI locale 필터와 locale label 회귀를 되돌리면 된다. 기존 fulfillment state,
localized routing, completion/privacy 및 operator publication 경계는 그대로 둔다.

### D-078 — 글로벌 번역 공급은 source-locked machine pack으로만 다음 검수 단계에 넘긴다 (루프 132)

글로벌 route와 Plus fulfillment UI를 먼저 늘려도 reviewed/current translation row가 없으면 구독자에게
실제 결과를 제공할 수 없다. 반대로 운영 DB에 바로 번역을 넣으면 원문 revision drift, 언어 validator 오류,
검수 전 공개를 놓칠 수 있다.

**결정:** 한 번에 작은 공개 후보를 선택해 live source page의 `updated_at`·원문 필드·source snapshot hash를
고정하고, `en`·`ja`·`zh`·`zh-tw` 각 한 건의 machine draft만 JSON pack으로 보존한다. `translation:intake`는
worklist·source revision·duplicate·locale/fidelity·완결성을 먼저 검사하고, 통과한 경우에만 기존 reviewable
SQL artifact를 생성한다. SQL은 source CAS와 approved/limited guard, locale allowlist, `status='machine'`,
`reviewed_at/reviewed_by=null`, `on conflict do nothing`을 유지한다.

이번 루프의 pack은 operator가 `gpt-5.6-sol` high로 검수·승인해야 하며, 승인 전에는 reviewed/current 공개,
Supabase 적용, sitemap/hreflang 반영, Plus fulfillment 완료로 간주하지 않는다. live `/en/explore`와
`/en/pricing`가 404인 현재 production은 local route 결과로 덮어쓰지 않고, 배포 전 상태로 명시한다.

**되돌리는 방법:** Loop 132의 JSON pack과 생성된 SQL artifact를 operator queue에 제출하지 않고 보관 또는
폐기하면 된다. production schema·data·translation status·public route는 이 결정으로 변경하지 않는다.

### D-079 — One-Cut은 결과 URL을 요구하고 Outcome History는 저장된 결과만 다시 연다 (루프 133)

Plus의 활용 영수증이 단순히 “사용했다”는 자기 보고로 끝나면 구독자의 반복 가치가 약하다. 기존
plus_meme_use_receipts.result_url 저장 경로는 있었지만 compact One-Cut 화면에서 입력을 받지 않았고,
owner-scoped Outcome History가 해당 필드를 조회하지 않아 저장된 결과도 다시 열 수 없었다.

**결정:** One-Cut receipt form은 기존 URL 검증을 재사용하고 mode=one_cut 계약에서 유효한 http: 또는
https: URL을 필수로 받는다. API가 빈 결과 URL을 RPC 이전에 거부하며, 일반 bulk receipt는 선택 URL과
기존 호환성을 유지한다. History는 기존 owner-scoped query에 result_url만 추가하고, parser가 protocol과
형식을 다시 확인한 뒤 URL을 DTO로 전달한다. UI는 저장된 URL만 target=_blank·noopener 외부 링크로
표시하고, legacy/no-URL row는 링크 없음 상태로 표시한다.

URL을 서버에서 가져오거나, 외부 플랫폼 게시를 검증하거나, 자동 게시·새 migration·새 persistence를
추가하지 않는다. 결과 URL은 사용자가 입력한 private receipt 데이터이므로 authenticated Plus/RLS와
production schema 상태가 확인되기 전에는 실제 고객 결과로 주장하지 않는다.

**되돌리는 방법:** One-Cut의 mode/required URL 검증과 form field를 제거하고, History select·parser·DTO·result
link/copy를 이전 상태로 복원하면 된다. 기존 receipt RPC와 result_url column은 삭제하지 않는다.

### D-080 — Plus Outcome Snapshot은 저장된 결과의 존재 수만 보여주고 실제 URL은 History에서만 연다 (루프 134)

Loop 133의 One-Cut 결과 URL은 private Outcome History에서 다시 열 수 있지만, 첫 화면에서 결과 축적을
확인할 수 없으면 사용자는 Plus를 추천·기록 도구로만 인식할 수 있다.

**결정:** Premium RSC는 이미 owner-scoped·protocol 재검증을 통과한 History DTO에서 History 상태와
`resultUrl` 존재 수만 계산해 Snapshot에 전달한다. Snapshot은 다섯 locale의 결과 수 metric을 표시하고,
양수일 때만 기존 `#plus-outcome-history-title` anchor로 이동하는 CTA를 만든다. `empty` History만 0건을
표시하며 `locked`·`unavailable`은 Snapshot을 unavailable로 닫아 조회 실패를 0건으로 위장하지 않는다.
결과 URL 값·receipt ID·private note는 Snapshot props에 넣지 않는다.

새 DB/API/RPC/schema/migration/write/analytics/OpenAI/publication은 추가하지 않는다. 실제 URL의 외부
플랫폼 존재·게시 성공·고객 receipt/RLS는 이 집계로 증명하지 않으며 authenticated Plus와 production deploy는
별도 human gate로 남긴다.

**되돌리는 방법:** `resultUrlCount` 계산·Snapshot metric/CTA·5 locale copy와 Loop 134 regression/docs를
제거하면 Snapshot은 기존 활용·평가 지표만 표시한다. Loop 133의 receipt 저장·History URL parser·외부
링크 동작은 그대로 유지한다.

### D-081 — 미평가 Outcome History는 기존 rating 경로를 다시 열고 Snapshot은 서버를 재조회한다 (루프 135)

Loop 134가 저장 결과의 존재 수를 첫 화면에 노출한 뒤에도 History의 `Not rated` row는 평가 입력으로
이어지지 않았다. 이미 `record_plus_meme_use_rating`과 `/api/plus/outcome-ledger/rating`이 owner와
active Plus를 검증하므로 새 쓰기 경로를 만들지 않고 이 경로를 재사용한다.

**결정:** History DTO에는 기존 owner-scoped query에서 나온 opaque `receiptId`만 추가한다. 평가가 없는
row에만 5 locale CTA를 열고 `hit`·`neutral`·`miss`를 선택하게 한다. 클라이언트는 응답의 `updated`,
`receiptId`, `performanceRating`이 모두 기대값일 때만 row를 rated로 바꾸고 `router.refresh()`를 호출해
서버 Snapshot의 rating count를 다시 읽는다. 실패 시 row는 미평가 상태로 남긴다.

`awaitingPerformanceCount`는 `performance_note is null`을 세는 기존 7일 summary 계약이고 rating은 별도
신호다. 따라서 rating 저장이 성과 메모 대기 수를 감소시킨다고 주장하지 않는다. private note·성과 본문,
result URL 값과 replay/link 안전 조건은 그대로 두며, locked/empty/unavailable 및 이미 평가된 row에는
CTA를 만들지 않는다. 새 schema/API/RPC/migration/analytics/OpenAI/publication은 추가하지 않는다.

**되돌리는 방법:** History의 `receiptId` 전달·rating CTA·rating response handler·`router.refresh()`와
5 locale copy 및 Loop 135 회귀/증적을 제거하면 기존 History 표시로 돌아간다. 기존 rating migration,
RPC, API 및 Snapshot 집계는 삭제하지 않는다.

### D-082 — 글로벌 번역 공급은 수요·색인 가능 원문·coverage를 하나의 다음 행동으로 묶는다 (루프 136)

Plus 번역 요청 큐와 로케일별 coverage 표를 따로 보여주면 운영자는 요청량은 알 수 있어도 해당 원문이
글로벌 route 공급을 늘릴 수 있는 문서인지 즉시 판단하기 어렵다. 반대로 모든 누락을 route-unlock 후보로
표시하면 얇은 문서를 공급 대상으로 오인할 수 있다.

**결정:** 현재 locale 작업 큐는 기존 `list_translation_priority_queue`를 유지하고, Control Tower는
active `plus_translation_requests`를 전역 read-only 경로로 별도 조회한다. demand는 Data API `max_rows`
경계를 넘도록 1000행 단위로 페이지네이션해 전부 집계하고, translation status는 200 meme ID 배치로
읽는다. 해당 public `memes` source가 `isIndexableMeme()`을 통과하고 `translationStatus === null`인
`locale + memeId`만 `routeUnlockCandidate`로 표시한다. 우선순위는 route-unlock 후보, 누락, Plus 요청량,
최근 요청일, meme ID, locale의 deterministic 순서를 따른다. 새 Control Tower는 네 SEO locale의
reviewed/current·machine/review-needed·stale·missing 수치와 Plus 수요를 합쳐 `plus_missing` →
`plus_review` → `review` → `stale` → `missing` → `ready` 다음 행동을 기존 관리자 URL에 연결한다.

priority/coverage 조회 실패는 empty/zero로 축약하지 않는다. Control Tower는 읽기 전용이고, GPT preview는
운영자의 명시적 클릭에서만 기존 고정 `gpt-5.6-sol` high 계약으로 실행되며, machine 저장·reviewed 공개·
Supabase 적용·sitemap/route 공급·production deploy는 이 결정으로 일어나지 않는다. live global route가
현재 404인 상태를 local 200 결과로 덮어쓰지 않는다.

**되돌리는 방법:** Control Tower 렌더와 `routeUnlockCandidate` source enrichment를 제거하고 기존
priority/coverage 패널만 유지한다. 기존 `isIndexableMeme()` worklist, RPC, GPT review, CAS/publication
경계와 데이터는 변경하지 않는다.

### D-083 — 번역 coverage 공백에서도 Plus 첫 One-Cut은 exact-current 영어 fallback으로 유지한다 (루프 137)

Plus의 핵심 구독 가치는 이미 Action Inbox에서 검수된 밈을 Creator Pack으로 준비하고 실제 사용 결과까지
기록하는 흐름에 있다. 요청 로케일의 reviewed translation이 없다는 이유로 이 흐름 전체를 empty로 만들면
번역 publication이 완료되기 전 글로벌 구독자의 첫 행동이 사라진다.

**결정:** `ko`·`en`이 아닌 지원 로케일에서 요청 로케일의 Global Scout deck이 empty일 때만 동일한
`public/safe/content-depth/current` source에 대해 영어 `status=reviewed` translation을 추가 조회한다.
영어 후보는 `buildPlusGlobalScoutDeck({ locale: "en" })`로 만들어 item locale을 영어로 보존한다. 따라서
Action Inbox와 Scout의 detail URL은 `/en/memes/...`가 되고, 화면에는 콘텐츠 언어를 표시한다. 요청 로케일에
eligible card가 하나라도 있으면 fallback을 실행하지 않는다. 요청 locale translation read가 실패하면
기존 `unavailable` 상태를 유지한다. optional 영어 fallback read 자체가 실패하면 공급 상태를 확인할 수
없으므로 `unavailable`로 fail-closed 한다.

이 fallback은 번역을 생성·저장·reviewed 승격하지 않으며, 영어 row도 source revision 일치와 기존
`buildPlusGlobalScoutDeck` gate를 통과해야 한다. 새 DB/API/RPC/schema/migration/write/analytics/OpenAI/
publication/deploy는 추가하지 않는다. 관리자 검수는 기존 고정 `gpt-5.6-sol`, reasoning high, `store=false`
계약을 유지한다. 콘텐츠 언어 표시는 사용자가 현지 번역으로 오인하지 않도록 하는 필수 disclosure다.

**되돌리는 방법:** `loadPlusGlobalScout`의 optional 영어 query와 `item.locale` 기반 route/disclosure를
제거하고 기존 요청 로케일 empty 동작으로 되돌린다. source gate, Action Inbox/Creator Pack, receipt/RLS 및
translation publication 경계는 변경하지 않는다.

### D-084 — Premium 첫 화면에서 기존 Global Daily를 직접 소비하게 한다 (루프 138)

Loop 137의 exact-current 영어 fallback은 첫 카드의 공급 문제를 해결했지만, Premium 구독자가 실제
콘텐츠를 익히려면 별도 `/daily` 경로로 이동해야 했다. 새로운 추천 deck을 추가하면 Global Scout·Daily
Signal과 중복되고, 별도 학습 모델을 만들면 검수 계약이 분산된다.

**결정:** active Plus Premium page가 기존 `loadGlobalDailyChallenge(globalDailyLocale)`를 읽기 전용으로
병렬 로드하고, 기존 `GlobalDailyChallenge`를 Action Inbox/Outcome Snapshot 다음에 직접 렌더한다. 이
component의 3문제·reviewed/current/safety gate·completion API·streak·첫 `#meme-use-kit-title` handoff를
그대로 재사용한다. challenge node가 있는 경우에만 기존 `/daily` 링크 카드를 대체하고, `unavailable`은
준비 중 상태로 그대로 표시한다. `standalone /daily`·free/non-Premium dashboard·새 DB/API/RPC/schema/
migration/write/AI/publication/deploy는 변경하지 않는다.

이 결정은 “구독 직후 실제 콘텐츠를 소비할 수 있음”을 local UI surface와 component interaction으로
증명하지만, authenticated Plus/RLS의 실제 schedule/translation 공급과 completion write를 증명하지 않는다.

**되돌리는 방법:** Premium loader의 Global Daily read, Dashboard prop/placement, 관련 회귀 테스트를
제거하고 기존 `/daily` 링크 카드를 복원한다. 기존 Daily challenge 구현·completion API·streak·Use Kit
handoff와 데이터는 변경하지 않는다.

### D-085 — Global Daily 완료 뒤 검수된 Market Passport로 글로벌 맥락을 연결한다 (루프 139)

Premium에서 Global Daily를 소비한 뒤 바로 Use Kit으로 보내면 사용 행동은 이어지지만, 글로벌 서비스의
핵심 차이인 원산지·활성 시장·현지 사용 주의·검수된 변형을 같은 세션에서 확인하기 어렵다. 새 글로벌
추천 deck이나 별도 학습 저장소를 추가하면 Global Scout/Daily Signal과 중복되고 검수 데이터 경계가
분산된다.

**결정:** active Plus Premium page가 기존 `loadGlobalDailyChallenge` 결과의 첫 문항 원본 ID를
확인한 경우에만 기존 read-only `getMemeMarketPassport`를 읽는다. `ready`·`completed`에서만 조회하고,
`GlobalDailyChallenge`의 완료 panel에 기존 `MemeMarketPassport`를 전달해 완료 또는 already-completed
상태에서만 렌더한다. `QuizQuestion.meme`에는 optional `id`를 추가하고 Global Daily만 채워 첫 문항의
원본을 식별한다. Passport builder는 합성 KR/ko origin을 `profiles`에 넣지 않고 실제 reviewed profile과
reviewed variant만 payload에 포함한다. passport 데이터가 없으면 `empty`, read 실패는 `unavailable`로
닫으며, 기존 완료 POST/streak/Use Kit handoff와 standalone `/daily`는 변경하지 않는다.

새 DB/API/RPC/schema/migration/write/AI/publication/deploy는 추가하지 않는다. free/non-Premium·signed-out·
locked·unavailable에서는 passport query를 하지 않는다. authenticated Plus/RLS의 실제 schedule·passport
공급·completion write는 이 결정으로 증명하지 않는다.

**되돌리는 방법:** Premium의 passport read와 `GlobalDailyChallenge.marketPassport` prop, optional question
metadata 및 관련 회귀 테스트를 제거하고, 필요하면 builder의 synthetic origin compatibility를 별도 결정으로
복원한다. 기존 Global Daily 문제·completion API/streak·Use Kit과 실제 reviewed Market Passport 데이터는
변경하지 않는다.

### D-086 — Premium Global Daily 완료 화면은 기존 3문항 전체를 Review Shelf로 재사용한다 (루프 140)

Loop 139의 Passport handoff는 첫 문항만 Use Kit으로 연결했다. 같은 challenge에서 검수·current 조건을 이미
통과한 두 번째·세 번째 문항을 버리면 구독자가 결제한 세션의 콘텐츠 소비 범위가 1개로 축소되고, already-
completed 재방문에도 다시 배울 항목이 남지 않는다.

**결정:** active Premium page가 `showReviewShelf`를 명시적으로 켜고, `GlobalDailyChallenge`의 완료 또는
already-completed panel에서 기존 3문항을 원래 순서로 렌더한다. 각 항목은 `options[answerIndex]`의 정답
의미, 기존 safety copy, `localizedMemePath(locale, shortId, slug)` exact-locale 상세 링크를 사용한다. 기존
첫 문항 Market Passport와 Use Kit handoff는 유지한다.

문항 builder와 review shelf는 `answerIndex`, 4개 option, 필수 meme text를 검증한다. 계약이 깨지면 loader는
`unavailable`, UI shelf는 비노출로 닫으며 빈 의미 텍스트를 만들지 않는다. `useId()` heading label, composite
list key, `min-h-11` link target을 사용한다. standalone `/daily`는 prop 기본값 false로 기존 동작을 유지한다.

새 DB/API/RPC/schema/migration/write/AI/analytics/dependency/publication/deploy는 추가하지 않는다. 이 결정은
local Premium subscription-value surface와 회귀 테스트를 증명하지만 authenticated Plus/RLS, 실제 completion
write, Passport·translation 공급과 production deploy를 증명하지 않는다.

**되돌리는 방법:** Premium page의 `showReviewShelf` prop과 완료 panel shelf, question contract validator와
관련 회귀 테스트를 제거하면 기존 첫 문항 Passport·Use Kit handoff만 남는다. Global Daily loader, completion
API/streak, standalone `/daily`와 저장 데이터는 변경하지 않는다.

### D-087 — Global Daily 후보는 localized detail과 같은 source-depth 계약을 사용한다 (루프 141)

Loop 140의 Review Shelf는 공급된 세 문항을 모두 복습하게 했지만, 후보 builder의 원문 게이트가 localized
detail route의 `isIndexableMeme()`와 분리되어 있었다. 그러면 5개 locale reviewed/current translation이 있어도
원문이 얇은 밈이 Global Daily에 들어가고, Review Shelf의 locale detail CTA가 실제 공개 상세 계약과 어긋날 수 있다.

**결정:** `GlobalDailyBaseMeme`를 기존 `ContentDepthInput`과 결합하고 `buildGlobalDailyCandidate()`에서
`isIndexableMeme(base)`를 함께 통과시킨다. server loader는 `usage_note`, `caution`, `usage_examples`,
`meme_sources`, `meme_contents`, `meme_tags_map`을 읽어 기존 scorer가 실제 source depth를 계산하게 한다.
Premium Review Shelf의 각 문항 CTA는 기존 `localizedMemePath()`에 `#meme-use-kit-title`을 붙인다.
`showReviewShelf`가 켜진 경우 first-only legacy next-step은 숨기고, malformed shelf는 shelf와 fallback을
모두 닫는다. standalone `/daily`는 opt-in을 전달하지 않아 기존 handoff를 유지한다.

새 DB/API/RPC/schema/migration/write/analytics/AI/publication/deploy는 추가하지 않는다. 이 결정은 local
route-safety와 Premium subscription-value surface를 증명하지만, production reviewed/current 공급,
authenticated Plus/RLS, completion write, translation publication과 live deploy를 증명하지 않는다.

**되돌리는 방법:** Global Daily base의 content-depth 필드와 `isIndexableMeme` 후보 게이트, server select 확장,
Review Shelf fragment CTA와 관련 회귀 테스트를 제거한다. 기존 reviewed/current translation gate, completion
API/streak, Market Passport, standalone `/daily`는 유지한다.

### D-088 — UI 언어와 검수 콘텐츠 언어를 Premium 세션에서 분리한다 (루프 142)

UI는 19개 로케일을 지원하지만 Global Daily와 localized Scout의 실제 검수 콘텐츠는 5개 콘텐츠 로케일에
한정된다. UI-only 로케일을 그대로 콘텐츠 locale로 사용하면 영어 fallback 콘텐츠가 `th`·`vi` 등의 상세
경로로 연결되거나, 완료 POST·분석·`lang`이 실제 콘텐츠와 어긋날 수 있다. 반대로 Global Daily 후보를 행별로
영어 fallback하면 기존 5-locale reviewed/current 계약과 “불완전한 번역으로 대신하지 않는다”는 신뢰 경계가
약해진다.

**결정:** 기존 `resolvePlusContentLocale()`와 Global Daily `isGlobalDailyLocale()` 정규화를 유지하고,
Premium·Global Daily·Global Scout·standalone `/daily`에 optional `displayLocale`을 전달한다. 실제
`contentLocale`은 검수 콘텐츠의 copy·`lang`·localized detail/Use Kit link·Global Daily completion
body의 `locale`·primary analytics `locale`의 source of truth로 삼는다. `displayLocale`은 날짜 표시와
`display_locale` provenance에만 사용하며, 두 값이 다를 때 콘텐츠 언어를 화면에 고지한다. UI-only `/daily`는
영어 content locale로 정규화하고 raw UI locale을 display locale로 보존한다.

Global Daily의 5개 locale 완전 reviewed/current/source-depth 후보 게이트, Scout의 requested-locale error와
기존 empty-only 영어 fallback, completion API/RLS/write 경계는 변경하지 않는다. 새 DB/API/RPC/schema/
migration/write/번역 발행/결제/외부 게시/production deploy는 추가하지 않는다.

**되돌리는 방법:** `displayLocale` props와 UI-only `/daily` 정규화·언어 고지·관련 회귀 테스트를 제거하면
기존 단일 locale 표시 동작으로 돌아간다. Global Daily/Scout loader, 5-locale translation gate, completion
API/streak, detail route와 저장 데이터는 변경하지 않는다.

### D-089 — Seven-Day Winning Replay는 자기 평가와 오늘의 completion 경계를 먼저 검증한다 (루프 143)

Outcome History·Replay가 이미 있어도 사용자가 최근 좋았다고 평가한 활용을 다시 찾으려면 History까지
스크롤해야 했다. 반대로 `hit`을 실제 외부 성과로 표현하거나 오늘 이미 완료한 항목을 다시 promotion하면
구독 가치와 데이터 신뢰를 동시에 해친다.

**결정:** 기존 7일 Summary의 날짜 창과 owner-scoped 30일 History의 교집합에서 `performanceRating=hit`,
현재 localized/current/safe replay path를 가진 최신 1건만 `PlusOutcomeSnapshot` promotion으로 만든다.
문구는 “내 평가”를 근거로 표시하고 verified public performance라고 주장하지 않는다. completion status가
unavailable이거나 오늘 completion ID/count가 하나라도 있으면 promotion을 fail-closed한다. 새 DTO에는
제목·사용일·채널·receipt 콘텐츠 언어·산출물·기존 replay path만 전달하며 receipt ID·private note·성과 메모·
result URL은 넣지 않는다.

Replay query가 실제 `loadPlusOutcomeReplayItem()`으로 활성화되면 Snapshot promotion을 숨기고, History는
`shortId + locale`가 모두 일치할 때만 `현재 실행 중`으로 표시한다. 기존 `replay`, `replay_locale`,
`from=outcome_history` allowlist·One-Cut·Creator Pack·receipt 흐름을 그대로 재사용한다.

새 DB/API/RPC/schema/migration/write/analytics/AI/translation publication/결제/외부 게시/production deploy는
추가하지 않는다. local Premium surface와 회귀 테스트는 검증하지만 authenticated Plus/RLS·실제 receipt/
completion write·외부 플랫폼 성공·production 공급은 별도 human gate다.

**되돌리는 방법:** `buildPlusOutcomeWinningReplay()`와 Snapshot promotion props/copy, active History marker 및
관련 회귀 테스트만 제거하면 기존 Snapshot·History Replay UI로 돌아간다. receipt/RLS·Replay loader/routing·
Creator Pack/One-Cut·공개 번역 데이터는 변경하지 않는다.

### D-090 — Market Passport 변형은 서버 확정 route만 노출한다 (루프 144)

Market Passport의 `reviewed` 변형 관계는 계보 연결의 검수 상태일 뿐, 대상 문서가 현재 locale에서 공개
가능하다는 뜻은 아니다. canonical target이 thin이면 공개 route 품질 계약을 우회하고, 번역 target이 stale·
incomplete·missing이면 localized 404를 조합할 수 있다. read failure를 empty로 표시하면 운영자와 사용자 모두
글로벌 공급 상태를 잘못 이해한다.

**결정:** `getMemeMarketPassport(memeId, contentLocale)`는 한국어 target에 기존 `isIndexableMeme()`를
적용하고 canonical href를 서버에서 확정한다. `en`·`ja`·`zh`·`zh-tw` target은 기존
`getLocalizedSearchMemesResult()`가 반환한 exact reviewed/current·required-field·public/source-depth
대상만 localized slug/title/href로 투영한다. 순수 Passport DTO는 서버가 주입한 `targetHref`가 없는 변형을
버리고, UI는 href를 재조합하지 않는다.

번역 target read의 `unavailable`은 명시적 unavailable 상태로 렌더하고, 성공적인 coverage-empty만 검수된
변형 없음으로 표시한다. Premium Global Daily는 UI display locale이 아니라 실제 content locale을 loader에
전달한다. 새 DB/API/RPC/schema/migration/write/결제/외부 게시/AI/번역 publication/deploy는 추가하지 않는다.

**되돌리는 방법:** Market Passport target의 `targetHref`·depth gate·localized bulk read와 unavailable copy,
호출부 locale 인자 및 관련 regression test를 제거하면 기존 reviewed 관계 기반 링크 조합으로 돌아간다.
Global Daily completion/streak, Premium Action/Outcome, 공개 번역 데이터와 저장 데이터는 변경하지 않는다.

### D-091 — Plus receipt는 의미가 다른 동일일 retry를 성공으로 처리하지 않는다 (루프 145)

기존 `record_plus_meme_use_receipt`는 동일 owner·meme·KST completion date의 receipt를 찾으면 입력
필드의 의미를 확인하기 전에 `already_recorded=true`를 반환했다. 이 경계는 사용자가 다른 channel·locale·
artifact kind·result URL·performance/private note를 제출해도 원래 receipt를 새 요청의 성공처럼 보이게 만든다.

**결정:** receipt를 만들기 전 입력의 허용 값과 canonical trim 값을 확정한다. 기존 receipt가 있으면
`channel`, `locale`, `artifact_kind`, `result_url`, `performance_note`, `private_note` 여섯 값을 모두
`IS DISTINCT FROM`으로 비교한다. 모두 같을 때만 기존 ID와 `already_recorded=true`를 반환하고, 하나라도
다르면 `receipt_conflict`를 반환해 API가 HTTP 409로 닫는다. 동시 insert의 `ON CONFLICT DO NOTHING` 이후
재조회 branch에도 같은 비교를 적용한다. receipt UPDATE나 table direct write 권한은 추가하지 않는다.

Receipt Form은 409를 일반 성공/재시도로 오인하지 않도록 5개 콘텐츠 언어의 conflict copy를 표시한다.
local ACT-001 runner는 `creator_pack` artifact와 실제 `p_channel` 변경 retry, owner read-back 및 cleanup
검사를 사용한다. 결제·webhook·production activation·번역 publication은 이 결정의 증거가 아니다.

**되돌리는 방법:** `20260810100000_plus_meme_use_receipt_integrity.sql`의 function replacement,
`receipt_conflict` API mapping/UI copy, runner conflict assertion과 contract tests를 제거하면 기존
동일일 receipt fast-path로 돌아간다. 기존 receipt 테이블·completion summary·Outcome History의 owner
scope는 유지한다.

### D-092 — Plus 채널 선택은 검수된 초안 구조와 기존 export 규격을 함께 결정한다 (루프 146)

기존 Creator Pack의 channel selector는 이미지 export를 `story` 또는 `card`로 고르는 데만 사용됐다. 같은
검수 문안이 모든 목적지에 같은 순서로 제공되면 사용자가 채널별로 다시 편집해야 하고, 채널 선택이 실제
구독 가치로 이어졌는지 확인하기 어렵다.

**결정:** 선택 채널을 `buildPlusCreatorPack()`에서 `buildPlusDailySharePack()`까지 전달하고, 시각형 짧은
영상·짧은 소셜·대화·장문·일반의 고정 family별 순서를 사용한다. 문안의 원천은 기존 reviewed/current facts와
사용자가 고른 reviewed usage example뿐이며 예문이 없으면 새 문장을 만들지 않는다. 기존 `story`/`card`
export, detail path, one-cut preview, clipboard/share/download, receipt/analytics 경계는 유지한다.

새 DB/API/RPC/schema/migration/write/payment/webhook/AI 생성/번역 publication/외부 게시 자동화는 추가하지
않는다. 채널별 초안은 “게시 성공”이나 “외부 성과”의 증거가 아니며, 실제 authenticated Plus/RLS와 production
공급·게시 검증은 별도 human gate다.

**되돌리는 방법:** `channel` 전달과 `creatorDraftFamilyForChannel()`/channel-specific share ordering,
관련 copy와 회귀 테스트를 제거하면 기존 generic share text와 channel-based image export만 남긴다.

### D-093 — Global Daily 완료는 실제 당일 검수 문항만 One-Cut으로 승격한다 (루프 147)

Global Daily 완료 선반이 기존 Use Kit에서 멈추면 Plus 사용자가 학습한 글로벌 밈을 바로 준비·공유하는
행동 루프가 끊긴다. 반대로 query의 `focus`만 믿어 임의 밈을 Action Inbox에 넣거나 UI 언어를 content
locale로 쓰면 검수·권리·URL 신뢰 경계가 약해진다.

**결정:** server loader가 이미 산출한 `GlobalDailyCandidate[]`를 DTO에 보존하고, Premium page가 현재
challenge의 실제 3개 `QuizQuestion` ID와 candidate의 content locale slug/title/safety를 다시 대조한다.
`green`/`yellow`와 `rising`/`active`만 `GlobalDailyOneCutCandidate`로 투영하며, `from=global_daily`의
지원 locale이 loader locale과 같을 때만 focus를 preferred Action으로 승격한다. `from` 배열·임의 focus·
지원하지 않는 locale·현재 3문항 밖 ID·다른 날짜·red/gray/cooling/archived·completion unavailable은
promotion과 analytics source를 닫는다.

review shelf CTA는 서버가 만든 same-origin Premium path만 받고, Action Inbox는 기존 translation/signal/
scout와 meme ID로 dedupe한 뒤 기존 channel-aware Creator Pack·explicit receipt를 재사용한다. Global Daily
handoff는 translation review DTO에 없는 `usage_examples`를 새로 만들거나 전달하지 않는다. UI-only locale은
`displayLocale`에만 남고 URL·action/receipt content locale이 되지 않는다.

새 DB/API/RPC/schema/migration/write/payment/webhook/AI 생성/번역 publication/외부 게시 자동화는 추가하지
않는다. 이 결정은 local Premium route와 reviewed-content contract를 증명하지만 authenticated Plus/RLS·
실제 completion/receipt write·결제 activation·번역 공급/publication·production deploy는 별도 human gate다.

**되돌리는 방법:** `LoadedGlobalDailyChallenge.candidates`, One-Cut candidate projection, global_daily routing,
review shelf handoff prop, Action Inbox candidate injection과 관련 회귀 테스트를 제거하면 기존 Global Daily
Use Kit-only 완료 화면과 Daily Signal/Scout Action Inbox가 남는다. Global Daily completion/streak, existing
Creator Pack/receipt, public data와 saved records는 변경하지 않는다.
