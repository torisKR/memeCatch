# T6 notes — house original (GateGuard blocked docs/)

Canonical docs targets were `docs/architecture.md` (one sentence: house originals skip oEmbed ranking) and `docs/renewal/DECISIONS.md` D-094. GateGuard blocked those writes in this session. Paste when docs are unlocked:

## architecture.md (source pipeline section)

CatchMeme house originals (`origin_kind=house_original`) do not enter through oEmbed ranking; the operator creates a pending dictionary row and publishes only after in-transaction rights evidence.

## DECISIONS.md D-094

Dictionary house originals only; manual publish; same contentDepth/isIndexableMeme; v1 evidence is meme_sources + CatchMeme canonical URL + creator_permission / house_rights_attested_at; INSERT / origin_kind-flip / rights-revoke guards; publish_house_original RPC checks evidence in-transaction; logAudit stays a separate service-role insert after status update; origin/copy/media edits revert published house originals to rights_checking; public label v1 is TrustNote + detail origin line 「밈캐치 자체 제작」.

Production schema (`origin_kind` · guards · RPC) IS applied. No public `house_original` rows.

Canonical target `docs/renewal/DECISIONS.md` remained GateGuard-blocked after one fact-forced retry. Paste after D-093 when unlocked:

```
### D-094 — 자체 제작(house original)은 사전 행만, 권리 증거 확인 후에만 게시한다 (루프 148)

카탈로그 문서는 인터넷 밈을 기록하고, 자체 제작은 밈캐치가 만든 사전 행이다. oEmbed 랭킹·Studio PNG·
Creator Pack·제출 승인 3단 워크를 그대로 쓰면 권리 게이트가 빠지거나 인터넷 원본을 자체 제작처럼 보이게
된다.

**결정:** 사전 행만 `origin_kind=house_original`이다. 운영자가 pending 행을 만들고 사실·권리 확인을 사람
단계로 거친 뒤 수동 게시한다. `contentDepth`/`isIndexableMeme`는 카탈로그와 같다. v1 증거는
`meme_sources`(CatchMeme canonical URL, `source_role=original`, `rights_basis=creator_permission`)와
`house_rights_attested_at`이다. INSERT·`origin_kind` 변경·권리 회수 가드와 `publish_house_original` RPC가
트랜잭션 안에서 증거를 검사한다. `logAudit`는 status 갱신 후 별도 service-role insert다. 게시된 자체 제작의
출처/카피/미디어 수정은 `rights_checking`으로 되돌린다. 공개 라벨 v1은 TrustNote와 상세 출처 줄
「밈캐치 자체 제작」이다.

프로덕션 스키마(`origin_kind`·가드·RPC)는 적용됐다. 공개 `house_original` 행은 아직 없다.

**되돌리는 방법:** `20260830120000_house_original_provenance.sql`의 컬럼·트리거·RPC와 admin create/publish
경로, TrustNote 자체 제작 카피를 제거하면 기존 카탈로그-only 사전과 oEmbed 랭킹 입구가 남는다. 기존 공개
카탈로그 행과 검수 상태 기계는 유지한다.
```
