# Loop 122 acceptance

## Selected vertical

`ACT-001-LITE` — local activation evidence for the existing global Plus result flow.

## Acceptance criteria

1. The runner refuses non-local Supabase URLs and requires explicitly named local anon/service-role
   credentials without reading production configuration.
2. The local-only flow uses a public seed meme and a temporary reviewed/current English translation
   fixture, then removes the fixture and temporary Auth users in cleanup.
3. An active Plus user can create one reviewed/current English receipt, retry it idempotently, and
   read the resulting owner-scoped outcome summary.
4. Free and canceled Plus users are rejected with `plus_required`.
5. A second active Plus user cannot read the first user's receipt through the authenticated REST path.
6. No production Supabase, payment provider, webhook, translation publication, or deploy is touched.
