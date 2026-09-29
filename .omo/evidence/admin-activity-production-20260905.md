# Admin activity production release — 2026-09-05

## Release plan and scope

- Completed: verify origin/main and actual production both at `5f34b8c0c0178a0ebdd52d073db0353b5a5b2735`.
- Completed: isolate dashboard from integrated `7a54da6e03732bfc2bd2e004205075128782cdd0`, preserving the preceding 26 unrelated commits and dirty original checkout.
- Completed: 270 Vitest files / 1,821 tests; focused dashboard/proxy 63; TypeScript; production build; lint 0 errors / 7 pre-existing warnings; local SQL 57/57.
- Completed: browser login using a disposable localhost operator, 57 synthetic views, 28 unique current subscriptions, KST 00:00 bucket 55 views, subscriber filtering, user selection, 50+5 view paging and refresh. No production test accounts or payments created.
- Completed: admin document external scripts 0, iframes 0, no-referrer, browser console errors 0.
- Completed: apply and normalize only dashboard migration in production; verify privileges and valid index.
- Completed: commit isolated release, push remote main, verify matching Vercel production deployment and live routes.

## DB application

- Production: `onjipuldngbdptldkpoe`; Preview stays `hsuqapozawtxhycvcgjm`.
- Existing public data prerequisites present; private schema absent before this migration.
- Migration SHA-256: `4cff8c7d90fa0a72259b25446a709ca662437d51148c65260d28209bd34bab17`, identical to Preview-tested SQL.
- Production apply returned success; temporary ledger version `20260905042132`.
- Public RPC SECURITY INVOKER; private implementation SECURITY DEFINER; both search_path=pg_catalog; anon EXECUTE false; authenticated EXECUTE true with internal operator check. Partial index valid.
- Existing billing subscription row count remains 1. No billing, refund, entitlement, content generation, or provider settings changed.
- Canonical production ledger confirmed: `20260905034152 / admin_activity_dashboard`. Only the tool-generated temporary ledger entry was reverted; DB objects remain applied.

## Final release and live proof

- Exact release SHA: `f4e926ead7f659f094d7fd0f6fb2019055ce8957`.
- Remote `main` was fast-forwarded from `5f34b8c0c0178a0ebdd52d073db0353b5a5b2735` to the release SHA; `git ls-remote` confirmed it.
- Release worktree: `/tmp/memecatch-admin-production-20260905`, branch `codex/admin-activity-production`; clean after commit. No dependencies, provider settings, billing logic, or unrelated migrations changed.
- Vercel deployment: `dpl_FGxwE9QSGgwbziaS3er71iB2NLFk`, target `production`, state `READY`.
- Deployment URL: https://memecatch-m3xtle2wf-ironjustlikethatgmailcoms-projects.vercel.app
- Production aliases include `catchmeme.com`, `www.catchmeme.com`, `memecatch.vercel.app`.
- GitHub commit status: Vercel `success` for the exact release SHA.
- Live HTTPS: `/` 200 with Korean Accept-Language; `/admin/activity` 307 to `/login?next=%2Fadmin%2Factivity`; login 200. All three responses carry `X-MemeCatch-Release-Sha: f4e926ead7f659f094d7fd0f6fb2019055ce8957`.
- Actual production browser navigation to `/admin/activity` displayed the expected login form with the preserved admin return path. No production account credentials were entered.
- Final standalone TypeScript check passed at the exact release SHA. Source diff unchanged from the successful full test/build run; only verification documentation was finalized before commit.
- Local disposable users/events/subscriptions all confirmed 0 after cleanup, and the QA development server was stopped.
- Original dirty files preserved. Local `main` remains `e3084972dcc6b1101aca6012377137a7c655abf4`; the integrated branch remains `7a54da6e03732bfc2bd2e004205075128782cdd0`. Those preceding 26 unverified changes were not silently released or discarded.

## Validation limits

- Browser functional evidence uses local synthetic data, not authenticated production operator data.
- Prior integrated branch results are not claimed as current release coverage.
- pnpm 11 offline install linked the lockfile dependencies but rejected unapproved package build scripts; no scripts were approved. Tests, lint, TypeScript and build ran via installed Node entrypoints successfully. Its temporary workspace suggestion file was removed.
- Automatic LSP hook cannot target files outside the original request directory; standalone TypeScript and eslint checks passed for the release worktree.
