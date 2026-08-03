# 표본 50건 문서 검토 종합 (루프 023)

> 입력: 5개 층 표본 50건의 문서별 검토 결과 JSON.
> 검증: 프로덕션 PostgREST **읽기 전용** GET(anon 키)으로 표본 필드와 전수 분포를 대조했다.
> 쓰기 0건. `app/`·`lib/`·`components/` 미변경.

---

## 0. 한 문장 결론

**표본에서 나온 결함은 문서별 실수가 아니라 스키마 축 세 개(`usage_context.friends`,
`media_type`, `meme_sources.title/creator_name`)가 사실상 상수이거나 비어 있어서
생기는 구조적 결함이며, 그 위에서 「밈 아님」 문서가 approved 상태로 랭킹 상위에
올라 있다.** 전수 확인으로 셋 다 확정했다(§5).

| 표본 지표 | 값 |
| --- | ---: |
| critical + high | **26 / 50 (52.0%)** |
| 밈이 아니거나 경계 (`not_meme`+`borderline`) | **27 / 50 (54.0%)** |
| 주장을 뒷받침하는 근거 0건 | **25 / 50 (50.0%)** |
| `category` 오분류 | **22 / 50 (44.0%)** |
| 표본 50건의 `trend_score` 중 `not_meme` 문서 비중 | **16.3%** (1,160.5 / 7,132.3) |
| 표본 50건의 `trend_score` 중 `not_meme`+`borderline` 비중 | **46.8%** |

---

## 1. 층별 심각도 분포

| 층 | n | critical | high | medium | low | crit+high 비율 | 가중 평균¹ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `top_traffic` | 15 | 0 | 6 | 7 | 2 | 40.0% | 2.27 |
| `recent` | 10 | **1** | 6 | 3 | 0 | **70.0%** | **2.80** |
| `oldest` | 10 | 0 | 3 | 5 | 2 | 30.0% | 2.10 |
| `limited_or_thin` | 10 | **1** | 6 | 3 | 0 | **70.0%** | **2.80** |
| `high_risk` | 5 | **1** | 2 | 2 | 0 | 60.0% | **2.80** |
| **합계** | **50** | **3** | **23** | **20** | **4** | **52.0%** | 2.50 |

¹ critical=4 · high=3 · medium=2 · low=1의 층별 평균.

**층마다 실패 양식이 다르다.** 심각도 총량만 보면 `recent`·`limited_or_thin`·`high_risk`가
같은 2.80이지만, 원인이 서로 다르다.

| 판정 축 | `top_traffic` | `recent` | `oldest` | `limited_or_thin` | `high_risk` |
| --- | ---: | ---: | ---: | ---: | ---: |
| 근거 0건 (`no_sources`+`sources_irrelevant`) | 6/15 | **10/10** | 2/10 | 6/10 | 1/5 |
| `category` 오분류 | **8/15** | 6/10 | 2/10 | 3/10 | 3/5 |
| 안전 신호 결함 (`questionable`+`wrong`) | 1/15 | 2/10 | **5/10** | 3/10 | **3/5** |
| 검증 불가한 맨 링크 출처 | **8/15** | 0/10 | 3/10 | 2/10 | 1/5 |
| 밈 아님·경계 | 7/15 | **9/10** | 5/10 | 4/10 | 2/5 |

- **`recent` 10건은 예외 없이 근거 0건이다(10/10).** 그러면서 `not_meme` 5건으로 전
  층 중 최다다 — 최근 등록 파이프라인이 출처 요구 없이 「밈 아닌 항목」을 통과시키고 있다.
- **`oldest`는 출처는 상대적으로 나은데(8/10 `partially`) 안전 신호가 가장 나쁘다(5/10).**
  오래된 문서일수록 나무위키 맥락 출처가 붙어 있지만 안전 등급 재판정을 받은 적이 없다.
- **`top_traffic`은 출처가 「있긴 한데 확인이 안 되는」 유형이 최다다(8/15).** 노출이
  가장 큰 층에서 근거가 가장 검증 불가능하다.
- **`limited_or_thin`은 crit+high 70%로 `recent`와 동률**이라, 「얇은 문서는 노출이 적으니
  나중」이라는 우선순위 가정이 성립하지 않는다(단, 이 층은 노출 자체는 낮다).

### 판정 축별 전체 분포 (n=50)

| 축 | 분포 |
| --- | --- |
| `definition_quality` | clear 41 · vague 8 · wrong 1 |
| `origin_verifiable` | plausible_unsourced 37 · dubious 7 · **missing 4** · verified_by_source **2** |
| `sources_support_claims` | no_sources 22 · partially 22 · sources_irrelevant 3 · **yes 3** |
| `safety_signal_reasonable` | yes 36 · questionable 13 · wrong 1 |
| `category_correct` | true 28 · **false 22** |
| `is_actually_meme` | meme 23 · borderline 18 · **not_meme 9** |

**`origin_verifiable=verified_by_source`는 50건 중 2건(4%)**, `sources_support_claims=yes`는
3건(6%)뿐이다. 즉 **표본의 94~96%는 유래 주장을 문서 안의 근거로 확인할 수 없다.**

---

## 2. 가장 흔한 문제 유형 top5

`worst_problem` 서술과 구조화 필드를 함께 태깅해(한 문서가 복수 유형에 해당) 집계했다.

| 순위 | 문제 유형 | 건수 | 비율 | 최다 층 |
| ---: | --- | ---: | ---: | --- |
| 1 | **밈이 아니거나 경계 항목** — `not_meme` 9 + `borderline` 18 | **27** | 54% | `recent` 9/10 |
| 2 | **주장을 뒷받침하는 근거 0건** — `meme_sources=[]` 이거나 있는 출처가 주장과 무관 | **25** | 50% | `recent` 10/10 |
| 3 | **`category` 불일치** — 실제 유형과 어긋난 분류(특히 `comment`) | **22** | 44% | `top_traffic` 8/15 |
| 4= | **검증 불가한 맨 링크 출처** — `title`·`creator_name`이 `null`인 URL 1건이 유일 근거 | **14** | 28% | `top_traffic` 8/15 |
| 4= | **안전 신호 결함** — 자기모순(`red` + `friends=green`), `caution=null`, 과대·과소 판정 | **14** | 28% | `oldest` 5/10, `high_risk` 3/5 |
| 6 | (참고) **`media_type` ↔ 실제 콘텐츠 불일치** — `image` 선언인데 콘텐츠가 embed이거나 0건 | 13 | 26% | `limited_or_thin` 4/10 |

그 밖: 2차 위키(나무위키) 단독 의존 11건(22%) · 연도 모순 9건(18%) · 실존 인물 위험 7건(14%) ·
운영 문구 노출 2건(4%, `kecg9kfp` `origin`="검수 중이에요" / `ur6qq8ck` `usage_note`가 편집 지침) ·
표제어 오류 1건(`r8cyrjhy`).

### 유형 3의 정체 — `category='comment'`

`category` 오분류 22건 중 다수가 `comment`(댓글)로 찍혀 있는데 실제로는 영화 대사
(`s64tpdwu`), 오디션 우승 사건(`jxj74cyd`·`pgzgkx58`), 웹서비스 사회현상(`2jaw8rkp`),
방송 코너 영상(`2dz5ezu4`), 지자체 반응(`v6de3tbs`)이다.
프로덕션 전수로 **`category='comment'` approved 문서는 732건**이다 —
`comment`가 분류 실패의 기본값(catch-all)으로 쓰이고 있을 개연성이 크다.

---

## 3. 「밈 아님」 판정 목록 (9건 / 18.0%)

프로덕션 필드는 read-only GET으로 재확인했다. **9건 전부 `moderation_status='approved'`,
즉 공개 상태다.**

| # | short_id | 제목 | 층 | 실제 정체 | `category` | `media_type` | `trend_score` | `lifecycle` | 심각도 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| 1 | `jxj74cyd` | 악동뮤지션 K팝스타2 우승 | top_traffic | 2013년 오디션 우승 사건 | comment | video | **334.86** | rising | high |
| 2 | `kkz7run4` | 보아 - No.1 | top_traffic | 2002년 발매곡 | dance | video | **328.65** | archived | high |
| 3 | `pgzgkx58` | 슈퍼스타K3 울랄라세션 우승 | oldest | 2011년 오디션 우승 사건 | comment | image | **309.50** | archived | high |
| 4 | `2jaw8rkp` | 아이러브스쿨 신드롬 | limited_or_thin | 1999년 웹서비스·사회현상 | comment | image | 37.50 | archived | high |
| 5 | `56e4yxbk` | 검은 마법사(검마) | recent | 메이플스토리 보스/스토리 설정 | phrase | text | 31.89 | cooling | high |
| 6 | `e8ferq5u` | 리부트 서버 | recent | 메이플스토리 공식 서버 사양 | phrase | text | 30.27 | cooling | high |
| 7 | `dkaaam5p` | 핑크빈 | recent | 게임 내 보스 몬스터 | image | text | 30.27 | cooling | high |
| 8 | `nsf5c2gn` | 트럭 시위 | recent | 2021년 확률형 아이템 소비자 사건 | comment | text | 30.00 | cooling | **critical** |
| 9 | `vkb5ctmz` | 따효니 | recent | 실존 스트리머 개인 | phrase | text | 27.50 | cooling | high |

**세 갈래로 갈린다.**

1. **사건·인물 기록 4건** (`jxj74cyd`·`pgzgkx58`·`2jaw8rkp`·`nsf5c2gn`) — 전부
   `category='comment'`. 밈이 아니라 「무슨 일이 있었나」 항목이다.
2. **게임 고유명사 3건** (`56e4yxbk`·`e8ferq5u`·`dkaaam5p`) — 전부 `recent`,
   `media_type='text'`, `meme_sources=[]`. 한 게임(메이플스토리)에서 3건이 몰려 나온 것은
   **특정 소스에서 용어집을 통째로 흡입한 파이프라인 사고**를 시사한다.
3. **곡·인물 2건** (`kkz7run4` 곡 / `vkb5ctmz` 실존 스트리머).

**노출 관점이 핵심이다.** 상위 3건의 `trend_score`가 309~335로, 표본 50건 중 최상위권이다
(표본 최고값 `jxj74cyd` 334.86). **밈 아닌 문서가 랭킹 최상단을 차지한다.**
표본 `trend_score` 총합의 16.3%가 `not_meme` 문서 몫이다.

### 경계(`borderline`) 18건 — 별도 판단 필요

`f8vys3hv`(광고 CM송) · `sejp2dtf` · `ukjwwvde` · `mn3smqqr` · `a3m443m3`(장르 문서) ·
`v2cvf68s` · `fdcv9jnn`(언론이 만든 캐치프레이즈) · `mb5ne3kw`(선수 별명) · `bvasfbe3` ·
`km874pzj` · `g3ggtkn4` · `9e4wxp8e` · `dsecykzp`(실존 인물 외모 별명) · `a5z9ahnv` ·
`tjr9cw5e`(일반 신조어) · `4purnhbm` · `2frja29t` · `2dz5ezu4`.

`not_meme` 9 + `borderline` 18 = **27건(54%)** 이 「이 서비스가 다루는 대상인가」 자체를
다시 물어야 하는 문서다. 이 27건이 표본 `trend_score`의 **46.8%** 를 가져간다.

---

## 4. critical 문서 목록 (3건)

세 건 모두 프로덕션 필드값으로 직접 재확인했다.

### C-1. `2frja29t` 「지하철 개똥녀 사건」 — 안전 신호 자기모순 (`high_risk`)

```
safety_level  : "red"
caution       : "실존 개인을 공개 조리돌림한 사건이라 유머 소재로 가볍게 쓰면 안 됨"
usage_context : {"sns":"red","work":"red","family":"red","friends":"green"}
trend_score   : 37.5   moderation_status: approved
```

`caution`이 "가볍게 쓰면 안 됨"이라고 명시하는데 같은 화면의 상황별 신호는
**친구 사이에는 green(= 써도 됨)** 을 표시한다. `red` 문서에서 사용자가 실제 행동을
바꿀 수 있는 유일한 칸이 정반대를 가리킨다. §5에서 보듯 이건 개별 오류가 아니라
전수 패턴이다.

### C-2. `r8cyrjhy` 「롬곡옾눞」 — 표제어 자체가 틀림 (`limited_or_thin`)

```
title    : "롬곡옾눞"
slug     : "롬곡옾눞"
aliases  : ["롬곡옾높", "폭풍눈물 뒤집기"]
category : "image"   media_type: "image"
trend_score: 315.94   safety_level: green   moderation_status: approved
```

「폭풍눈물」을 180° 뒤집으면 「롬곡옾높」이고 그 표기가 **`aliases`에 이미 들어 있다.**
정답이 문서 안에 있는데 표제어와 `slug`가 오답이다. `trend_score` 315.94로 노출이 크고,
유일 출처(`youtube.com/watch?v=yzsWoeKTFTA`)는 `title`·`creator_name`이 `null`이라
2018년 확산 주장을 뒷받침하지 못한다. **`slug` 교체는 URL 변경이라 영구 리다이렉트가
필수다(LOOP.md 절대규칙 7) → 자동 수정 불가, 게이트 대상.**

### C-3. `nsf5c2gn` 「트럭 시위」 — 밈 아님 + 사실 주장 무근거 + 회색 사유 미설명 (`recent`)

```
category : "comment"   media_type: "text"
safety_level : "gray"  caution: null
usage_context: {"sns":"green","work":"gray","family":"yellow","friends":"green"}
origin_year  : 2021    year_precision: "unknown"
slug         : "트럭 시위"   (공백 포함)
trend_score  : 30      moderation_status: approved
```

2021년 확률형 아이템 논란이라는 **실제 소비자·사회 사건**이 밈 문서로 공개돼 있다.
연도·규제 영향 등 검증 가능한 사실 주장을 담았는데 `meme_sources`가 0건이라 보도 근거가
없다. `safety_level='gray'`이면서 `caution=null`이라 **왜 회색인지 화면에서 설명되지 않는다.**
부수 관찰: `slug`에 공백이 들어 있다.

---

## 5. 프로덕션 전수 확인 — 표본 결함은 구조적이다

표본에서 반복된 세 패턴을 approved 문서 **3,903건** 전수로 확인했다. 세 개 모두 확정됐다.

### 5-1. `usage_context.friends`는 상수다 — 99.0%가 `green`

| 조건 | 전체 | `friends='green'` | 비율 |
| --- | ---: | ---: | ---: |
| approved 전체 | 3,903 | **3,864** | **99.0%** |
| `safety_level='red'` | 103 | 84 | **81.6%** |
| `safety_level='gray'` | 168 | 155 | **92.3%** |
| `safety_level='yellow'` | 222 | 216 | **97.3%** |

**`red` 103건 중 84건이 「친구 사이엔 써도 됨」을 표시한다.** C-1은 특이 사례가 아니라
기본값이다. 표본 안에서도 비-green 12건 중 11건이 `friends='green'`이었다(예외는
`kecg9kfp` 하나로 4칸 모두 yellow).

이는 `DECISIONS.md` **HG-003**의 전제를 갱신해야 한다는 뜻이다. HG-003은 「4칸이 전부
같은 값인 문서가 84.8%」로 문제를 규정했는데, **상황별로 값을 나눈 나머지 문서에서도
`friends` 축만은 상수**여서 실제 정보량은 HG-003이 가정한 것보다 더 작다.
`friends`는 위험 등급과 **역상관조차 없는** 칸이다.

추가로 **`caution=null`인 비-green 문서가 179건**이다(`red` 20건, `gray` 118건).
경고 등급인데 이유를 말하지 않는다.

### 5-2. `media_type='image'`를 뒷받침할 이미지 자산이 DB에 0건이다

```
meme_contents 전체            : 3,324행
  type='embed'                : 3,324행 (100.0%)
  type≠'embed'                :     0행
  platform: YouTube 94.2% · YouTube Shorts 3.6% · Instagram 2.0% · TikTok 0.2% (1,000행 표본)

approved memes의 media_type   : video 1,652 · image 1,364 · text 887
```

**`meme_contents`에는 이미지 타입 행이 단 한 건도 없다.** 그런데 approved 문서 1,364건
(34.9%)이 `media_type='image'`를 선언한다. `trend_score` 상위 `media_type='image'` 문서 5건을
뽑아 보면 전부 콘텐츠가 YouTube embed 1건이다(`s64tpdwu`·`hy3gqdv6`·`uskrnffh`·`bkmd5qku`·`r8cyrjhy`).

표본의 「`media_type='image'`인데 이미지가 없다」 13건은 **문서 오류가 아니라
`media_type` 축이 어떤 저장된 자산과도 대응되지 않는다**는 사실의 반복 관측이다.
「짤(image)」을 표방하는 서비스에서 이미지 자산 보유량이 0이다.

### 5-3. 출처 행의 62.4%가 확인 불가능한 맨 링크다 — 그리고 화면은 이를 「확인」으로 센다

```
meme_sources 전체      : 4,608행
  title = null         : 2,876행 (62.4%)
  creator_name = null  : 3,088행 (67.0%)
  title·creator 둘 다 null : 2,876행   ← title이 없으면 creator도 없다
  copyright_status='unknown' : 293행 (6.4%)
  platform='YouTube'   : 2,445행 (53.1%)
  source_url ~ namu.wiki : 1,152행 (25.0%)
```

여기서 코드와 맞물리는 결함이 나온다. `lib/source-links.ts:86` `summarizeEvidence()`는
**URL만 보고 센다.**

```ts
const url = cleanText(source.source_url);
if (!url) continue;
...
if (isContextSourceUrl(url)) context += 1;
else primary += 1;
```

`title`·`creator_name`은 한 번도 참조되지 않는다. 그래서 `title=null`·`creator_name=null`인
맨 YouTube 링크 한 줄이 **`primary`(원본·보도)로 집계되고**, 상세 화면의 `TrustNote`는
루프 003이 도입한 최상위 문구인 **「● 근거 출처 1개 확인 (원본·보도 1개)」** 를 출력한다.
namu.wiki는 `context`로 내려가지만 YouTube 맨 링크는 `primary`로 올라간다 —
**2,445개 YouTube 출처 행 대부분이 이 경로를 탄다.**

루프 003은 「근거 0건 문서가 검수를 주장」하는 문제를 고쳤다. 이 관측은 그 다음 층이다:
**근거 1건 문서가 「원본 확인」을 주장하는데, 그 1건이 제목도 작성자도 없는 URL이다.**
표본에서 이 유형이 14건(28%)이고, 노출 최상위 층에서 8/15로 가장 잦다.

---

## 6. docs/renewal 관점 결론

### 6-1. 기존 게이트에 미치는 영향

| 게이트 | 이번 표본·전수 확인이 주는 변화 |
| --- | --- |
| **HG-001** (충실도 96.3% 미달 → 색인 임계값) | **추천안 C(색인 임계값 인하)를 지금 실행하면 안 된다.** 색인 대상을 넓히면 §3의 `not_meme` 9건 유형과 §5-3의 「확인 불가 근거 1건」 문서가 함께 색인된다. 표본 기준 `not_meme` 18% · 밈 아님/경계 54%다. **밈 여부 판정이 색인 확대의 선행 조건**이다. |
| **HG-003** (usage_context 84.8% 동일값) | **전제 갱신 필요.** 동일값 문제만이 아니라 `friends` 축이 전수 99.0% `green`이다(§5-1). 값을 나눈 문서에서도 `red` 81.6%가 `friends=green`이다. 추천안 C(「미확인」 상태 추가)는 여전히 유효하지만, **`friends` 칸은 「미확인」이 아니라 아예 제거하거나 재판정 전까지 렌더하지 않는 편이 정직하다.** 재판정 우선순위는 `caution=null`인 비-green 179건. |
| **HG-004** (중복·alias·태그) | `r8cyrjhy`(C-2)를 **alias 정리 작업에 편입**해야 한다. 정답 표기가 `aliases`에 있고 표제어가 틀린 유형은 alias 충돌 275건 안에 더 있을 개연성이 크다. `slug` 변경이므로 영구 리다이렉트 필수 — HG-004의 「수동 확정」 경로 그대로다. |
| **HG-006** (분석 이벤트) | 변화 없음. 다만 `meme_source_opened`가 없으면 **§5-3의 「맨 링크 근거」를 사용자가 실제로 열어 보는지** 알 수 없다. HG-006 추천안 B의 근거가 한 겹 더 두꺼워졌다. |

### 6-2. 신규 등록을 제안하는 항목

우선순위는 **노출 × 신뢰 훼손** 순이다.

| ID(제안) | 내용 | 근거 | 게이트 |
| --- | --- | --- | :---: |
| **HG-008**(신규) | **「밈 아님」 문서 처리 방침** — 비공개 전환 / 별도 카테고리 분리 / 유지 중 택1 | 표본 9/50(18%)이 `not_meme`, 전부 approved. 상위 3건 `trend_score` 309~335 | ✅ 필요 (문서 비공개·URL 소멸) |
| **DQ-012**(신규) | `usage_context.friends` 렌더 중단 또는 재판정 | `red` 103건 중 84건(81.6%)이 `friends=green` (§5-1) | HG-003 종속 |
| **DQ-013**(신규) | `TrustNote`의 「원본·보도」 판정에 `title`/`creator_name` 유무를 반영 | `meme_sources` 62.4%가 title·creator 둘 다 null (§5-3). **표시 계층만 바꾸는 변경이라 게이트 불필요** | ❌ 불필요 |
| **DQ-014**(신규) | `media_type` 축 재정의 또는 폐기 | `meme_contents` 100% `embed`, 이미지 자산 0건인데 `image` 선언 1,364건 (§5-2) | 조사 후 판단 |
| **DQ-015**(신규) | `category='comment'` 732건 재판정 | 표본 category 오류 22건의 다수가 `comment` catch-all (§2) | ❌ 불필요(데이터 편집) |
| **DQ-016**(신규) | `recent` 등록 파이프라인 점검 | `recent` 10/10이 근거 0건, 그중 메이플스토리 용어 3건 연속 (§3) | ❌ 불필요(조사) |

**게이트 없이 즉시 착수 가능한 것은 DQ-013 하나다.** `LOOP_STATE.md`가 「게이트 없이 진행
가능한 backlog 0건」이라고 적어 둔 상태를 이 한 건이 깬다. 표시 계층만 건드리고,
데이터를 바꾸지 않으며, 루프 003이 만든 컴포넌트의 판정 기준을 좁히는 방향이라
되돌리기도 쉽다.

### 6-3. 「검수됨」이라는 표시의 정확한 상태

루프 003 이후 상세 화면은 3단계(0건 / 맥락만 / 원본 있음)로 근거를 말한다. 이번 종합은
**세 번째 단계가 아직 과대 주장**임을 보여준다.

```
현재:  meme_sources 행 1개(URL만 있음)  →  "● 근거 출처 1개 확인 (원본·보도 1개)"
실제:  제목·작성자·수집 시각이 없어 그 URL이 무엇인지 문서 안에서 알 수 없음
표본:  14/50 (28%) · top_traffic 8/15 (53%)
전수:  meme_sources 4,608행 중 2,876행(62.4%)이 title·creator 모두 null
```

`origin_verifiable='verified_by_source'`가 50건 중 **2건**뿐이라는 표본 수치와 정확히
일치한다. 근거의 **개수**는 신뢰의 대리 지표로 부족하고, **확인 가능성**이 기준이어야 한다.

---

## 7. 이 종합의 한계

- **표본 50건은 층별 균등 배분이 아니다**(15/10/10/10/5). 층별 비율은 층 안에서만 읽어야
  하고, 「전체의 18%가 밈이 아니다」 같은 전수 추정으로 바로 옮기면 안 된다.
- **심각도는 검토자 판정이다.** 층별 가중 평균(2.10~2.80)의 차이는 작아서 순위 해석은
  신중해야 한다.
- **§5의 전수 수치는 프로덕션 read-only GET으로 직접 센 값**이므로 표본과 성격이 다르다.
  §5의 세 결론(친구 축 상수 · 이미지 자산 0 · 맨 링크 62.4%)은 표본 의존이 아니다.
- `meme_contents.type`·`platform` 분포는 **1,000행 표본**이다. 단 `type≠'embed'` 행이
  전수 0건인 것은 count 쿼리로 확정했다.
- 밈 여부(`is_actually_meme`) 판정 기준은 이 저장소에 문서화돼 있지 않다. HG-008을
  올릴 때 **판정 기준부터 `/editorial`에 명문화**해야 재현 가능한 작업이 된다.
