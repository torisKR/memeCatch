# LOC-007 acceptance criteria — offline machine-draft generation boundary

1. A local MLX translation request can be explicitly directed to a new local SQL artifact without invoking a linked Supabase write.
2. Artifact mode uses a production sitemap and linked Supabase only for reads, records a source-snapshot-locked machine draft, and creates its SQL file exclusively so a reviewable slice is never overwritten.
3. Existing rows in the offline artifact directory are excluded before candidate selection, so a later slice does not duplicate an already drafted `(meme_id, locale)` pair.
4. Normal dry-run remains model-call-free and database-write-free; `--apply` and `--emit-artifact` cannot be combined.
5. The existing translation checker still accepts every historical artifact and reports the current partial-batch counts.
6. No production translation, migration, deployment, push, merge, or checkout is executed by this loop.
