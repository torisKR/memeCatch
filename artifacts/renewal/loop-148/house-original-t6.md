# T6 notes — house original (GateGuard blocked docs/)

Canonical docs targets were `docs/architecture.md` (one sentence: house originals skip oEmbed ranking) and `docs/renewal/DECISIONS.md` D-094. GateGuard blocked those writes in this session. Paste when docs are unlocked:

## architecture.md (source pipeline section)

CatchMeme house originals (`origin_kind=house_original`) do not enter through oEmbed ranking; the operator creates a pending dictionary row and publishes only after in-transaction rights evidence.

## DECISIONS.md D-094

Dictionary house originals only; manual publish; same contentDepth/isIndexableMeme; v1 evidence is meme_sources + CatchMeme canonical URL + creator_permission / house_rights_attested_at; INSERT / origin_kind-flip / rights-revoke guards; publish_house_original RPC checks evidence in-transaction; logAudit stays a separate service-role insert after status update; origin/copy/media edits revert published house originals to rights_checking; public label v1 is TrustNote + detail origin line 「밈캐치 자체 제작」.

Production SQL was not applied.
