# loop-028 safety_reviewed_at restore proof

- Ran: 2026-11-11 23:30:49 KST (Asia/Seoul)
- Engine: scratch PostgreSQL 16 at `/workspace/memecatch/pg16` with a throwaway data directory under `/tmp`. Not production. The cluster was stopped and deleted after the run.
- Replay: `scripts/loop028-prove-safety-reviewed-at.sh`
- Trigger: a copy of `public.touch_meme_safety_reviewed_at` / `memes_touch_safety_reviewed_at`. The trigger definition was not changed.
- Method: capture `safety_reviewed_at` into a temporary table, `UPDATE` `usage_note`/`caution` (which fires the trigger), then restore the captured values in the same transaction. The same transaction is run a second time to check idempotency.
- Control: a sixth row was updated without a restore. The trigger set `safety_reviewed_at` to now(), which shows the trigger is active.
- Status: **PASS**

## Result

`cdkdz2tv`, `gf66ref6`, `ah2zk3m5` kept the existing instant `2026-10-26 23:25:00.606776+00` (the session displayed it as `2026-10-27 08:25:00.606776+09`, which is the same moment). `b9gzeysg` and `xazbup6j` stayed `NULL`. Run 1 and run 2 were identical for these five rows.

This is the same restore pattern used in `data/memes/sql/20261111-loop028-priority-enrichment.sql`.
