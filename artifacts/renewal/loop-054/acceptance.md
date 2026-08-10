# SUB-002 acceptance criteria — Plus Meme Vault

1. An active Plus account can search its complete saved library by saved meme title or summary and combine that search with a safety/use-signal filter.
2. Search input is normalized before the raw PostgREST `or()` predicate is constructed; filter grammar cannot be supplied through the URL.
3. All filtered result counts and page links stay account-scoped by existing `saved_memes` RLS. A free account's crafted `saved_q` or `saved_safety` parameters do not enable server-side filters.
4. Filtered pagination preserves the query and safety state, while clearing returns to the ordinary saved library.
5. Vault search/filter UI, zero-result state, upgrade prompt, and existing Plus folder/note editor are localized through `MY_COPY`; foreign users retain the localized pricing route.
6. No saved row, profile row, billing record, migration, production deployment, push, or merge is performed by this loop.
