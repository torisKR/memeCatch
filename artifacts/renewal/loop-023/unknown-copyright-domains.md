# copyright_status='unknown' 도메인 분포 (HG-004 · DQ-007 자료)

조회: 프로덕션 PostgREST GET, `meme_sources?copyright_status=eq.unknown` (읽기 전용)
조회 시각 기준 총계: **293건** (지시서의 292건과 1건 차이 — 현재 값은 293)
전체 `meme_sources` 4,608건 중 6.4%.

## 0. 먼저 확인된 사실 — `link_only`라는 값은 존재하지 않는다

- 스키마: `supabase/migrations/20260708004500_schema_v2.sql:15`
  `create type copyright_status as enum ('unknown','embeddable','permission_needed','internal_only');`
- PostgREST 검증: `copyright_status=eq.link_only` → `22P02 invalid input value for enum copyright_status: "link_only"`
- 현재 값 분포: `embeddable` 4,315 / `unknown` 293 / `permission_needed` 0 / `internal_only` 0
- 코드상 의미: `lib/actions/admin-sources.ts:184`
  `copyright_status: linkOnly ? "unknown" : "embeddable"`
  → **관리자 플로우는 이미 `unknown`을 "링크만 허용"의 뜻으로 쓰고 있다.**

따라서 "link_only로 일괄 분류"는 두 가지 중 하나를 뜻한다.
(a) enum에 `link_only` 값을 추가하는 마이그레이션 + 데이터 이관, 또는
(b) 값은 그대로 두고 `unknown`의 의미를 문서·UI에서 "링크만"으로 명시.
(b)는 쓰기 0건이라 HUMAN_GATE 없이 가능하나, `unknown`이 "미확인"과 "링크만"
두 뜻으로 섞여 있다는 문제(아래 3번)는 (b)로 해결되지 않는다.

## 1. 도메인 분포

| 도메인 | 건수 | 비중 | platform 값 | 1차 판정 |
|---|---:|---:|---|---|
| `namu.wiki` | 253 | 86.3% | Community 253 | **일괄 가능** (링크 전용) |
| `www.instagram.com` | 5 | 1.7% | Instagram 5 | **일괄 가능** (링크 전용) |
| 국내 언론사 26개 도메인 (아래) | 35 | 11.9% | TV 20 · Community 8 · News 7 | **개별 확인** |

### 상위 3위 밖 26개 도메인 (합 35건)

| 도메인 | 건수 |
|---|---:|
| `news.mt.co.kr` | 2 |
| `news.sbs.co.kr` | 2 |
| `sports.khan.co.kr` | 2 |
| `wordrow.kr` | 2 |
| `www.asiae.co.kr` | 2 |
| `www.busan.com` | 2 |
| `www.hankookilbo.com` | 2 |
| `www.khan.co.kr` | 2 |
| `www.news1.kr` | 2 |
| `blog.youtube` | 1 |
| `digitalchosun.dizzo.com` | 1 |
| `en.wikipedia.org` | 1 |
| `librewiki.net` | 1 |
| `ohfun.net` | 1 |
| `www.allurekorea.com` | 1 |
| `www.etnews.com` | 1 |
| `www.etoday.co.kr` | 1 |
| `www.fifa.com` | 1 |
| `www.hankyung.com` | 1 |
| `www.insight.co.kr` | 1 |
| `www.munhwa.com` | 1 |
| `www.newsis.com` | 1 |
| `www.segye.com` | 1 |
| `www.seoul.co.kr` | 1 |
| `www.sportsworldi.com` | 1 |
| `www.starnewskorea.com` | 1 |

유튜브(`www.youtube.com`) unknown은 **0건**이다. 지시서의 "유튜브" 가설은
데이터로 반증된다 — 유튜브 출처 2,715건은 전부 `embeddable`.
(`blog.youtube` 1건은 영상이 아니라 구글 공식 블로그 글이다.)

## 2. 도메인별 1차 판정

| 도메인군 | 건수 | 판정 | 근거 |
|---|---:|---|---|
| `namu.wiki` | 253 | **일괄 "링크만"** | URL 253건 전부 `/w/` 문서 경로. `title`은 `나무위키` 209건 + `null` 44건, `creator_name` 전건 `null` — 개별 확인해도 얻을 정보가 없다. 나무위키는 CC BY-NC-SA 2.0 KR이라 상업 사이트에서 본문·이미지 재사용 불가, 링크는 가능. 도메인 단위로 결론이 동일하다. |
| `www.instagram.com` | 5 | **일괄 "링크만"** | 전부 `/reel/` URL, `title`·`creator_name` 모두 `null`. 인스타그램 임베드는 oEmbed 토큰 없이는 안정적으로 못 붙인다. 5건은 어차피 링크 표기 외 선택지가 없다. |
| 국내 언론사 26개 도메인 | 35 | **개별 확인** | 언론사 기사는 (i) 기사 링크만인지 (ii) 기사 안 사진·영상을 쓰려던 것인지에 따라 처리가 갈린다. `platform` 값이 `TV`(20) / `Community`(8) / `News`(7)로 섞여 있어 등록 의도가 도메인 단위로 일관되지 않는다. 예: `www.khan.co.kr`은 unknown 2건 + embeddable 5건으로 같은 도메인이 두 상태에 걸쳐 있다. 35건은 사람이 한 번에 훑을 수 있는 양이다. |

## 3. HG-004 · DQ-007에 넘길 쟁점

1. **`unknown`은 지금 두 뜻으로 쓰인다.** 관리자 플로우가 넣은 "링크만"(의도된 값)과
   초기 시드가 남긴 "미확인"(판정 안 한 값)이 구분되지 않는다. `namu.wiki`는
   `unknown` 253건 / `embeddable` 899건으로 **같은 도메인이 두 상태에 나뉘어 있다** —
   이건 도메인 정책 차이가 아니라 등록 경로 차이로 보인다. 어느 쪽이 맞는지
   정하지 않으면 unknown 253건만 고쳐도 embeddable 899건이 반대 방향으로 틀린 채 남는다.
   → 실제 문제는 "unknown 293건 분류"보다 **"나무위키 1,152건의 상태 일관성"**이다.
2. **일괄 처리 대상은 258건(88.0%)**, 개별 확인은 35건(12.0%).
3. enum에 값을 추가할지(마이그레이션) 의미만 문서화할지는 코드 변경 범위가 다르다.
   후자는 `lib/actions/admin-sources.ts`와 표시 계층 문구만 손대면 된다.

## 4. 확인하지 않은 것

- 나무위키 unknown 253건과 embeddable 899건의 등록 시점·경로 차이(등록 소스 컬럼 없음).
- 각 언론사의 실제 이용약관. 도메인만으로 판정하지 않았다.
- 프로덕션 쓰기는 일절 하지 않았다. GET만 수행.
