# Memecatch catalog registration and WebMCP production deployment

Date: 2026-10-02 (Asia/Seoul)

## Result

- Production: https://catchmeme.com
- Admin entry: https://catchmeme.com/admin/memes/catalog/new
- Deployment: https://memecatch-rnhxqm1et-ironjustlikethatgmailcoms-projects.vercel.app
- Inspector: https://vercel.com/ironjustlikethatgmailcoms-projects/memecatch/5BxDNWQhYcHhhV9KfpqgfpKidHAz
- Deployment ID: `dpl_5BxDNWQhYcHhhV9KfpqgfpKidHAz`
- Target/status: production / READY
- Framework: Next.js 16.3.4; remote build approximately 3 minutes.
- Source: local changes on base commit `1a637c7`; deployed from an isolated source snapshot. No source commit was created for this deployment.
- Snapshot/evidence directory: `/tmp/memecatch-deploy.R5G4hl`
- Upload manifest: `/tmp/memecatch-deploy.R5G4hl/upload-manifest.json` (1,971 files; 40,267,195 bytes). No `.env`, `.aws`, nested worktrees, or Supabase temporary files were uploaded.
- Previous deployment: `dpl_EZMSAWc2uLNMjs5t8arChig4pgoT`.

## DB deployment

Supabase project: `onjipuldngbdptldkpoe` / memeCatch.

Applied only `20261001010000_catalog_meme_registration.sql` through `supabase db push` after fetching remote migration history into a separate temporary directory. The six existing remote-only migrations were not replayed, reverted, or repaired.

Migration SHA-256: `ef2653594c3dbef1e5ae3088639c9663e9695e0f8fb4e9479749ea8b5ef582d4`.

Remote verification confirmed:

- Migration history contains version `20261001010000` / `catalog_meme_registration`.
- `catalog_registration_key` column and unique index exist.
- Both new RPCs deny EXECUTE to anon and allow authenticated execution, with internal `auth.uid()` and `is_operator()` guards.
- Both RPCs rejected a nonexistent/non-operator JWT subject with `operator_required` before any write.
- Fixed `search_path=public, pg_temp` exists on both functions.
- Meme count remained 5,018 before and after application; catalog registration count was 0.

The CLI reported a pg-delta catalog cache warning concerning a certificate path. The migration command exited successfully, and the remote history, schema, permissions, and guards were independently verified. This was a cache warning, not an application failure.

## Validation

- Fresh targeted tests: 9 files / 34 tests passed (registration validation/actions/form, WebMCP/public/admin lifecycle, moderation controls, migration contract, config).
- Fresh `tsc --noEmit`: passed.
- Fresh ESLint for changed files: passed.
- Fresh `git diff --check`: passed.
- Vercel production build: compiled, typechecked, generated 105 static pages, and completed successfully.
- Before promotion: home and search returned HTTP 200; unauthenticated admin registration returned HTTP 307 to `/login?next=%2Fadmin%2Fmemes%2Fcatalog%2Fnew`.
- After promotion: `vercel inspect https://catchmeme.com` resolved the new deployment ID; public home returned HTTP 200 and admin registration retained the same login redirect.
- Production headers: `Permissions-Policy: camera=(), microphone=(), geolocation=(), tools=(self)` and `Origin-Agent-Cluster: ?1`.
- Actual production in-app browser: four public WebMCP tools registered. Invoking `memecatch.search` with `AI 슬롭` navigated to the search page and rendered three results.
- Actual production browser admin entry: login page appeared with the correct admin return path. Only public WebMCP tools were registered there.
- Live authenticated admin registration/save was not exercised: the QA browser had no valid operator session. Full registration/write flow had passed earlier isolated local DB and UI checks.
- Earlier full local suite: 366 files / 2,612 tests passed, as recorded in the preceding task. That entire suite was not repeated during this deployment.

## Post-deployment observations

The first 15-minute error scan returned two request logs at 05:41:49 KST with `refresh_token_not_found`:

- `GET /submit`: redirect response, HTTP 307.
- `POST /api/analytics/events`: HTTP 503 (`auth_unavailable` path).

Both were Supabase refresh-session errors during browser verification. Their proxy/auth/analytics source files were unchanged by this feature. The prior deployment had no logs in the comparison hour, so this report does not assert that the same errors were previously observed. Public search continued to work and the admin page correctly required login. No unrelated session-handling patch was deployed.

Supabase security advisors before/after were identical except for two generic authenticated SECURITY DEFINER notices for the newly introduced RPCs. Their operator guards and anon denial were verified. Existing advisor findings remain; see [security-definer notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [mutable search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), and [extension in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). Log drains were not inspected.

## Preservation and follow-up

- Existing source changes remain in the original workspace; deployment used a separate snapshot.
- Local migration history still lacks six remote-only migrations. A future root-workspace `db push` needs those histories reconciled first; this deployment used the fetched temporary history.
- Persist the feature in the normal Git release workflow before a later Git-based deployment, since this release was deployed directly from uncommitted source.
- Toris Studio services, source, QA clone, and temporary files were left unchanged in this deployment task.
- For an application rollback, the previous Vercel deployment is recorded above. The DB change is additive and backward-compatible with the prior application; rollback does not require dropping the new DB objects.
