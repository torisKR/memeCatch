# Loop 121 acceptance

## Selected vertical

`LOC-022` — route-ready translation worklist

The global bottleneck is not another Plus panel. Operators need to know which missing translation
will actually unlock a public locale route and Plus supply after human review. The existing list only
used source recency, and the Plus demand RPC error path could look like an empty queue.

## Acceptance criteria

1. Public `approved`/`limited` missing-source rows use the existing `isIndexableMeme()` contract to
   compute `routeUnlockCandidate` without creating or changing translation data.
2. The worklist scans all public source pages before applying `routeUnlockCandidate` first,
   `updatedAt` descending, and `memeId` ascending ordering, then applies the requested limit.
   When `focusMemeId` is present, that missing source is reserved as the first row within the
   limit so a claimed Plus request cannot disappear behind higher-ranked candidates.
3. The operator UI distinguishes `번역 후 글로벌 공개 후보` from `원문 보강 필요` and does not
   describe either state as reviewed, published, live, or route-200 proven.
4. A Plus translation-priority RPC failure renders an explicit unavailable alert; it never renders
   the empty-queue message or a zero count.
5. Existing operator authorization, locale/focus links, GPT-5.6-sol high preview, explicit machine
   draft save, human review/publication, and no-new-write boundaries remain unchanged.
6. The implementation adds no DB/API/RPC/schema/migration/write/automatic translation/publication or
   analytics surface, and keeps private operator/request metadata out of the missing-source card.
