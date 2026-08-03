# DQ-C2 — 대표 콘텐츠 dead/region_blocked 공개 문서 14건 인벤토리

수집일: 2026-08-04 / 프로덕션 읽기 전용(PostgREST GET)
프로젝트: `https://onjipuldngbdptldkpoe.supabase.co`

## 수집 쿼리

```
GET /rest/v1/meme_contents?is_representative=eq.true&availability=in.(dead,region_blocked)
    &select=meme_id,platform,availability,url,type,moderation_status,
            memes!inner(short_id,slug,title,moderation_status,published_at)
GET /rest/v1/meme_sources?meme_id=in.(...14...)&select=meme_id,platform,source_url,title,copyright_status
GET /rest/v1/meme_contents?meme_id=in.(...14...)&select=...   → 총 14행
```

정확히 14건. 전부 `platform=YouTube`, `type=embed`,
`meme_contents.moderation_status=approved`, `memes.moderation_status=approved`
(= 공개 중). 14개 밈의 `meme_contents` 총합도 **14행** — 즉 **어떤 문서에도
대체 재생 콘텐츠(다른 meme_contents 행)가 없다.** 대체 후보는 오로지
`meme_sources`(총 20행)뿐이다.

## 판정 기준

- **대체 콘텐츠 지정 가능** = 죽은 대표 URL과 **다른** `meme_sources.source_url`이
  존재하고, 그 URL이 HTTP 200으로 살아 있음.
- **원본 유실** = `meme_sources`가 죽은 대표 URL과 **동일한 1행뿐**이라 지정할 대체가 없음.

외부 확인:
- namu.wiki 6건 전부 `curl -sL -o /dev/null -w %{http_code}` → **200**.
- YouTube는 oEmbed 응답코드로 교차확인(`/oembed?url=...`): 401/403 = 삭제·비공개,
  200 = 영상 자체는 존재(임베드 가능·지역 허용 여부는 별개).

## 분류 A — 대체 콘텐츠 지정 가능 (6건)

| short_id | 제목 | 대표 상태 | 죽은 대표 URL (oEmbed) | 대체 가능 출처 (HTTP) |
| --- | --- | --- | --- | --- |
| `f384zwnp` | 나빌레라 | region_blocked | `youtube.com/watch?v=YtK3Vtw4rno` (200) | 네이버 웹툰 — `namu.wiki/w/나빌레라(웹툰)` (200) |
| `8usbz526` | 단언컨대 메탈은 가장 완벽한 물질입니다 | dead | `…v=spdGZyCvMOc` (403) | TV — `namu.wiki/w/단언컨대` (200) |
| `6x5vm3my` | 띠용 띠용 김띠용사건 | dead | `…v=qNr0rdozOtg` (200) | 트위치/치지직 — `namu.wiki/w/징버거` (200) |
| `repzdxn4` | 애정남 | dead | `…v=1CETrdBbxMw` (401) | 방송 — `namu.wiki/w/애정남` (200) |
| `329w7u7p` | 재채기가 나온다 아 안 나온다 | dead | `…v=KCUB6dnVlTE` (401) | Twitch — `namu.wiki/w/트위치/대한민국/밈` (200) |
| `wgc93agj` | 탁걸리 | dead | `…v=ezbSM65ebjE` (401) | 방송(TV조선) — `namu.wiki/w/막걸리 한잔` (200) |

주의: 6건의 대체 출처는 전부 **namu.wiki 문서 링크(embed 불가, 참고 링크)** 다.
`meme_contents`에 바로 꽂을 재생 가능한 임베드가 아니라, "출처에서 원본 보기"
폴백 링크로만 유효하다. 임베드 복구가 목표라면 새 영상 URL 큐레이션이 별도로 필요하다.

## 분류 B — 원본 유실 (8건)

`meme_sources`가 죽은 대표 URL과 동일한 YouTube 1행뿐. 지정할 대체가 DB에 없다.

| short_id | 제목 | 대표 상태 | URL (oEmbed) | 비고 |
| --- | --- | --- | --- | --- |
| `xt52qg4j` | Young한데 완전 MZ인데요 | dead | `…v=YNOBV_uVzeY` (200) | `rr8j2m8h`와 **동일 URL 중복 문서** |
| `rr8j2m8h` | Young한데? 완전 MZ인데요? | dead | `…v=YNOBV_uVzeY` (200) | `xt52qg4j`와 중복 |
| `sdvd764t` | 그룹 싸쓰 | dead | `…v=bDPR_BpKdVk` (401) | 영상 삭제·비공개 확정 |
| `2j5tfqq7` | 김생민의 영수증 | dead | `…v=Pw4P5pQNdBY` (200) | oEmbed 생존 — 오탐 재검증 대상 |
| `7yaqepcn` | 번복진트 쇼미더산 | region_blocked | `…v=xOqbLdhvxlE` (200) | 지역 차단 |
| `yp9aj4pw` | 신화 - Wild Eyes 의자 퍼포먼스 | region_blocked | `…v=gFT1mEtk3VA` (200) | 지역 차단 |
| `39fyk7an` | 애정남(애매한 것을 정해주는 남자) | dead | `…v=LW70Q-PDu_0` (401) | `repzdxn4`(애정남)와 **주제 중복** — A분류 문서의 namu 출처 재사용 가능 |
| `7rnbewq7` | 홍박사님을 아세요? | dead | `…v=KVqxodtBhyE` (200) | oEmbed 생존 — 오탐 재검증 대상 |

## 해소 계획 시사점

1. **A 6건**: `meme_sources`의 namu.wiki 링크로 폴백 히어로("출처에서 원본 보기")가
   이미 성립. loop-022에서 확인된 폴백 렌더가 그대로 동작하므로 데이터 변경 없이
   UX는 방어됨. 임베드 복구는 별건.
2. **B 중 오탐 후보 3건** (`2j5tfqq7`, `7rnbewq7`, `6x5vm3my`): `availability=dead`인데
   oEmbed 200. 판정 로직/스캔 시점 문제일 수 있어 재검증이 먼저다. 무턱대고
   비공개 전환하면 정상 문서를 죽인다.
3. **중복 2쌍** (`xt52qg4j`/`rr8j2m8h`, `repzdxn4`/`39fyk7an`): 병합하면 14건이
   실질 12건으로 줄고, `39fyk7an`은 병합만으로 A분류 출처를 승계한다.
4. **잔여 확정 유실**: `sdvd764t`(401) 1건만이 대체 없는 순수 유실.
   `7yaqepcn`·`yp9aj4pw`는 region_blocked라 원본은 살아 있음 — 삭제 대상 아님.

## 원자료

- 죽은 대표 콘텐츠 14행 + 소속 밈: 위 쿼리 1
- `meme_sources` 20행: 밈당 1~2행, `copyright_status`는 20행 전부 `embeddable`
- 쓰기 작업 없음(GET만 수행)
