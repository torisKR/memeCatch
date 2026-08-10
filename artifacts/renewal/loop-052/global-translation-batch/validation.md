# Global translation draft validation — Loop 052

- **Scope:** 2 Korean source documents × 4 locales = 8 machine drafts.
- **Source retrieval:** linked Supabase CLI, read-only, on 2026-08-08. All eight locale/document combinations still lacked a translation at retrieval time.
- **No production writes:** these are offline SQL artifacts only; no SQL was executed and no deployment was performed.
- **Local MLX:** `http://127.0.0.1:8080` was unavailable, so no MLX model request was sent. The AI-authored drafts are explicitly recorded as `provider=openai`, `model=gpt-5.6-luna`, `status=machine` and require human review before reviewed-only public publication.

## Safety contract

Each generated SQL statement:

1. locks and rechecks the source `updated_at` plus every Korean source field;
2. inserts only if that source snapshot is still current and approved/limited;
3. is idempotent on `(meme_id, locale)`; and
4. leaves the translation at `machine` status.

## Checks run

```sh
node scripts/translation-batch-check.test.mjs
node scripts/translate-memes-mlx-linked.test.mjs
pnpm translation:check
```

For the selected 2-document subset, the checker was run against a temporary directory containing only `*-slice19.sql`, with `--require-complete`. Its result is `selected-batch-validation.json`: **8/8 rows, no errors**. The full resumable worklist result is `aggregate-validation.json`: **448/1,520 rows, 1,072 remaining**.

`complete-gate.json` records the expected nonzero full-worklist gate: en 258, ja 238, zh 290, and zh-tw 286 rows remain. It is intentionally not a release-ready translation batch.
