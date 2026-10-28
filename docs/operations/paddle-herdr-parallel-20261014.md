# Paddle migration: isolated Herdr audit lanes

## Scope

The latest user request was to split the Paddle sandbox-to-live migration work into parallel branches with `$herdr`. The existing dirty `main` checkout and existing media-recovery workspaces were preserved. No merge, commit, push, deployment, catalog mutation, credential rotation, notification change, verification submission, or payment is part of this audit.

The three new worktrees start at `26ff7783cb6e051418ef6246e9bfb484fef15d62`. They inspect the **current dirty root checkout read-only**, rather than mistaking the clean branch baseline for the current integration. Only lane-specific audit reports are added to the new branches. Native specialist agents do the parallel audits; the Herdr panes show their reports and independent non-mutating checks. Shell panes are not presented as interactive coding agents.

## Branch / pane mapping

| Lane | Branch | Herdr workspace / pane | Worktree |
| --- | --- | --- | --- |
| Existing code and sandbox-test proof | `codex/paddle-code-audit-20261014` | `wA` / `wA:p1` | `.worktrees/paddle-code-audit-20261014` |
| Account capabilities and webhook security | `codex/paddle-webhook-audit-20261014` | `wB` / `wB:p1` | `.worktrees/paddle-webhook-audit-20261014` |
| Public product / policy readiness | `codex/paddle-readiness-audit-20261014` | `wC` / `wC:p1` | `.worktrees/paddle-readiness-audit-20261014` |

The discovered running Herdr session is `default` (client/server 0.9.4, protocol 22). All new workspaces were created with `--no-focus`; the existing memecatch workspace `w4` remained focused. No existing pane or security prompt was changed or closed.

## Freshly verified prerequisites

- Code audit: the existing checkout invokes Unifi Pay, not Paddle (`app/api/billing/checkout/route.ts`). No Paddle implementation or sandbox integration test-pass evidence was found in this checkout. Existing `public/paddle-review/` files are review pages, not a tested checkout.
- This session exposes no tools or resources for `paddle-sandbox` or `paddle-live`. Therefore live and sandbox catalogs, notification destinations, credential validity, and account approval state are **unknown**, not empty or complete.
- Herdr pane `wC:p1` ran `node /Users/toris/projects/memecatch/scripts/paddle-review-site.test.mjs`: **4 passed, 0 failed**. These are local page-contract tests, not Paddle checkout or account-verification tests.
- Herdr pane `wB:p1` performed a read-only GET of `https://api.paddle.com/ips`: the response contained six IPv4 `/32` CIDRs in `data.ipv4_cidrs`. No IP allowlist was installed. The endpoint remains the source of truth; values are not embedded in app configuration.
- The code-audit lane's report was created successfully and its worktree diff check passed.
- All three parallel audit reports are now complete; each lane changed only its own new Markdown report and passed its diff check.
- Public-readiness observation: root `/terms`, `/privacy`, and `/pricing` returned 200, while root `/refund` returned 404. The proposed `plus.catchmeme.com` host failed the audit's HTTPS/TLS checks despite resolving in DNS. This is a current access failure, not evidence of an approved live domain or a tested checkout.

## Completed lane reports

- `.worktrees/paddle-code-audit-20261014/docs/operations/paddle-code-audit-20261014.md`
- `.worktrees/paddle-webhook-audit-20261014/docs/operations/paddle-webhook-audit-20261014.md`
- `.worktrees/paddle-readiness-audit-20261014/docs/operations/paddle-readiness-audit-20261014.md`

The webhook report also records a current-documentation correction: Paddle's notification-setting GET reference includes `endpoint_secret_key`. This does not authorize reading/logging secrets or recreating a live destination, and the user's reuse/no-rotation guardrail remains unchanged.

## Stop conditions for live migration

Do not point code at live until the actual tested Paddle sandbox integration and its test results are identified. Ask for the correct repository or an explicit decision to implement a new sandbox integration rather than silently replacing Unifi. Obtain the named MCP connections before declaring any catalog mapping or live account state verified.

Existing live notification destinations and secrets must be reused; no destination deletion, recreation, or secret rotation is permitted. Existing live products/prices/discounts/customer/subscription/transaction entities and mirrored rows remain untouched. The sandbox remains read-only.

The webhook and public-readiness lanes provide their separate reports under their own `docs/operations/` directories. This document records coordination and fresh local evidence; it does not represent migration completion, domain approval, verification submission, or live payment readiness.

## Herdr parallel-agent continuation (2026-10-14)

On the renewed `$herdr` request, the existing three branches/workspaces were reused rather than duplicated. Fresh process inspection confirmed each target pane was an available foreground `zsh` before starting an interactive Codex agent. These panes now host actual agents, unlike the earlier shell-only report display described above.

| Agent | Existing pane | Responsibility |
| --- | --- | --- |
| `mc-paddle-code` | `wA:p1` | Current dirty-root integration, catalog IDs, environment names/presence and sandbox-test prerequisite |
| `mc-paddle-webhook` | `wB:p1` | MCP availability, existing webhook security, idempotency and dynamic IP allowlist gaps |
| `mc-paddle-readiness` | `wC:p1` | Local policy/pricing/contact evidence and the existing review-site contract test |

All three agents were started with `--sandbox read-only --ask-for-approval never --no-alt-screen`. Their separate prompts were submitted through `herdr --session default agent prompt`; fresh `agent get` responses observed all three **working**, confirming accepted work rather than only queued text. A short CLI wait timing out does not cancel their work and is not a reason to submit the same prompt again.

Their scope excludes file edits, installs, deployments, domain submissions, account verification, payments, credential output or rotation, and sandbox/live entity mutations. No merge, commit or push was performed. Existing media-recovery workspaces and the focused root workspace were left untouched. The leader currently has no exposed `paddle-sandbox` or `paddle-live` MCP tools; account state remains unverified. This continuation establishes parallel execution, not migration completion.

## Renewed branch/pane request: completed audits inspected

On the next explicit `$herdr` request, live session discovery confirmed the same
`default` server, three worktrees, and three named Codex agents. All three agents
reported `done`; their terminal output contained completed audit results. The
existing branches were reused, not recreated, and no duplicate prompts were sent.

- `mc-paddle-code`: current checkout still implements Unifi Pay. The billing SQL
  restricts the order provider to Unifi, so replacing IDs or environment variables
  cannot perform a Paddle migration. Local environment checks reported names and
  presence only; there was no Paddle sandbox checkout/webhook/entitlement test proof.
- `mc-paddle-webhook`: existing webhook implementations are not Paddle-compatible;
  there is no dynamic Paddle IP allowlist in the inspected application code. Its
  renewed live IP fetch was unsuccessful, so the earlier six-CIDR result remains
  historical rather than freshly verified. No IP list was installed.
- `mc-paddle-readiness`: the static review-site contract test passed 4/4. Public
  host routing, HTTP status for unknown paths, and real entitlement behavior remain
  unverified. Earlier public TLS/refund observations were not refreshed by this
  follow-up and must not be described as current checks.

Fresh leader tool discovery still exposes neither `paddle-sandbox` nor
`paddle-live`. All three agent terminals show an Advanced Account Security setup
notice. No security dialog was answered or dismissed, and no further input was
sent to those panes. The focused root workspace was left unchanged.

This is a verified parallel audit arrangement, not a completed live migration.
The next migration step requires identification of the actual tested Paddle
sandbox implementation and callable account connections. Live entities, existing
notification destinations/signing secrets, sandbox data, deployments, and payments
remain untouched.

## Latest requested parallel refresh: isolated branches retained

Fresh Herdr discovery confirmed the running `default` server (0.9.4, protocol
22) and the existing three Paddle worktrees. The original dirty `main` checkout
and the focused `w4` workspace remain unchanged by this coordination action.

Three additional no-focus panes were created in the existing workspaces:

| Branch | Added pane | New interactive agent |
| --- | --- | --- |
| `codex/paddle-code-audit-20261014` | `wA:p2` | `mc-paddle-code-refresh` |
| `codex/paddle-webhook-audit-20261014` | `wB:p2` | `mc-paddle-webhook-refresh` |
| `codex/paddle-readiness-audit-20261014` | `wC:p2` | `mc-paddle-ready-refresh` |

Each new pane was verified to have an idle foreground `zsh` before starting a
read-only Codex agent. **All three agents then displayed an Advanced Account
Security setup dialog. No audit prompt or dialog input was submitted to them.**
Herdr's `idle`/`done` detection does not override the visible dialog. These
interactive agents are started, not evidence of executing or completed audits.

To finish the safe branch without answering account-security UI, three native
subagents were assigned independently to the existing code, webhook, and
readiness branches. Their only write ownership is each branch's audit report;
they inspect the current dirty root read-only. This fallback is native parallel
execution, **not Herdr-pane execution**. No branch merge, commit, push, package
install, deployment, secret rotation, Paddle entity mutation, verification
submission, or payment is authorized by this refresh.

The three native branch reports now contain fresh local evidence. Code and
webhook inspection found no migratable Paddle runtime or callable Paddle account
tools. The readiness lane and leader each ran
`node /Users/toris/projects/memecatch/scripts/paddle-review-site.test.mjs`:
4 passed, 0 failed. This is a static review-page contract, not a sandbox checkout,
webhook, entitlement, public-host, or live-account validation. The code lane's
worktree Vitest attempt was blocked by missing dependencies/package override
mismatch; no install or lockfile change was performed. Live migration remains
blocked until the tested Paddle integration is identified and both named account
connections are callable. Herdr interactive prompts remain unsubmitted.

## 2026-10-18: requested parallel branch refresh

Reused the three existing `codex/paddle-*-audit-20261014` branches and worktrees;
no duplicate branch, worktree, or pane was created. Fresh `herdr status` and
`session list --json` confirmed the running `default` server, version 0.9.4.
The focused workspace was `w1` and remained focused. Each target below had an
idle foreground `zsh` before commands were submitted.

| Branch responsibility | Reused pane | Fresh report |
| --- | --- | --- |
| Runtime/provider and sandbox-test prerequisite | `wA:p2` | `paddle-code-audit-20261018.md` in the code worktree |
| Webhook security and current official guidance | `wB:p2` | `paddle-webhook-audit-20261018.md` in the webhook worktree |
| Product, policy, pricing and public-host readiness | `wC:p2` | `paddle-readiness-audit-20261018.md` in the readiness worktree |

The panes execute ordinary read-only checks and the existing static review-site
test. Three native Codex specialists perform the independent audits in parallel;
they are not represented as interactive agents inside Herdr. Each specialist
owns only its new report in its respective worktree and reads the dirty root
without changing it. An initial webhook grep used a nonexistent `app/api/webhooks`
directory; it was corrected to the actual `app/api/billing` and `lib/billing`
directories. This command error is not a webhook-test failure or proof of absence.

Fresh code inspection still finds Unifi Pay rather than a tested Paddle runtime.
The existing Unifi regression suite passes 72 tests in four files. The Herdr
readiness pane's static review-page test passes 4/4, with no skipped tests. Neither
result proves a Paddle sandbox checkout, webhook delivery, or entitlement flow.
Tool/resource discovery exposes no callable `paddle-sandbox` or `paddle-live`
connection in this session; their account catalogs and notification settings
remain unknown, not empty.

No sandbox/live entity, existing notification destination, signing secret,
credential, mirrored billing row, deployment, DNS setting, verification submission,
or payment was changed. No integration code was replaced, and no commit, merge,
or push was performed. Live migration remains gated on the actual tested sandbox
implementation and callable account connections.

All three 2026-10-18 branch reports are now complete. Public readiness checks
observed real `200` responses for root Terms, Privacy and Pricing, an actual `404`
for `/refund`, and a TLS-handshake failure for `plus.catchmeme.com` from the audit
network path (not proof of a global outage). Proposed review-host feature copy
also differs from the current production offer. Live catalog parity cannot be
checked without the account connection. The public `/ips` endpoint was read once;
no IP allowlist or webhook setting was changed. Local environment checks inspected
names/presence only and found no Paddle-named variables in the visible root env
files or current process; credentials elsewhere remain unknown.
