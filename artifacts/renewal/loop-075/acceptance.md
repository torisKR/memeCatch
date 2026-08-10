# Loop 075 acceptance — Global Translation Desk

Date: 2026-08-09 (Asia/Seoul)

## Product contract

- `/admin/translations` keeps its operator-only boundary and adds a live public-catalog coverage panel for `en`, `ja`, `zh`, and `zh-tw`.
- The denominator is the current `approved`/`limited` meme catalog from the database. It is explicitly separate from the offline LOC-007 artifact gate of 448/1,520 rows.
- Each public meme and locale is classified into exactly one of `reviewed/current`, `machine/current`, `stale`, or `missing`. A source revision instant mismatch takes precedence over the stored status and becomes `stale`.
- Public meme and translation reads paginate at 1,000 rows. The translation query uses an inner public-meme relation filter, so operator visibility of private rows cannot inflate public coverage.
- The panel links machine and stale counts to the existing review queue, while missing counts explain that offline draft generation and human review are required.
- Coverage failures render an unavailable/error state rather than a false zero. Coverage performs no write, GPT call, claim RPC, revalidation, or publication.

## Stop boundary

This loop proves the local operator/public-only read contract, deterministic classification, error-safe presentation, and signed-out HTTP protection. It does not apply migrations, modify production data, generate translations, approve drafts, or prove an authenticated operator 200 against the production Supabase instance.
