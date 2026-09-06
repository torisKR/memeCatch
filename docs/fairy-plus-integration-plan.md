# MemeCatch conversion and Fairy integration

## Work

- Completed: verify Explee campaign state and Fairy project/webhook contract.
- Completed: save crypto-aware Explee Pricing, Outreach and payment guidance, First email and Follow-up instructions; UTM source is `outreach` and the strict link block was removed after the provider rejected it.
- Blocked: direct-click traffic through Explee first emails/follow-ups; the product prohibits links in those messages. No outreach has been sent.
- Completed: verify application/database behavior and browser/API flows.
- Completed: clarify crypto checkout and implement authenticated, idempotent Fairy donation handling using the documented contract.
- Completed: per the owner's instruction, repurpose the unused LoveTrip project as `밈캐치 (MemeCatch)` / `@memecatch`; saved title, description and slug verified after reload. Existing donations were zero and no webhook was configured. Its inactive state was preserved.
- Completed: apply the Fairy migration to the production database (provider migration version 20260906054257); confirmed zero payment records and service-role-only grant permissions.
- In progress: configure the signing secret, deploy and activate Fairy with the approved KRW 15,000 threshold.

## Constraints

- Preserve pre-existing security and billing work in this shared checkout.
- Current Plus offer: USD 10, paid in Kaia USDT through Unifi Wallet, 30 days, no automatic renewal.
- Fairy's authenticated webhook documentation explicitly supports membership grants. Present Plus as a qualifying donation benefit; the standard crypto purchase remains a separate path.
- Owner approved a single donation of KRW 15,000 or more granting Plus for 30 days.
- No campaign budget changes, card registration, real payment, or wallet signature as part of verification.
- Public provider facts and a successful checkout redirect do not prove settlement or entitlement activation.

## Contract and activation

1. Use the renamed project at `https://fairy.hada.io/dashboard/projects/@memecatch/basic`. The owner's choice of LoveTrip resolved the ten-project creation limit without deletion. Activate this project when the benefit and webhook are ready. Its old `@lovetrip` public URL no longer applies.
2. Apply `supabase/migrations/20260906120000_fairy_plus.sql` after reviewing the existing billing migrations. It adds private intent/payment tables and service-role RPCs; ordinary clients cannot grant Plus.
3. Set `FAIRY_PROJECT_SLUG` to the actual public slug without `@`, `FAIRY_WEBHOOK_SECRET` to that project's secret, and `FAIRY_PLUS_MIN_AMOUNT_KRW` to the agreed integer threshold. Leave `FAIRY_PLUS_ENABLED=false` until ready. The approved threshold is 15000.
4. Configure the project's webhook URL as `https://catchmeme.com/api/billing/fairy/webhook`. Set `FAIRY_PLUS_ENABLED=true` and rebuild/redeploy with all four variables. Pricing pages only display the option when the full configuration is valid. The server uses the same threshold when creating intents.
5. Send Fairy's test webhook; a valid signed `source=test` event must return 200 with `ignored=test_event` and grant nothing. Then verify an owner-authorized real qualifying donation, receipt, account entitlement, duplicate delivery and refund reconciliation before claiming live settlement works.

The footer, meme donation card and About donation link lead to the pricing page's account-link section. The native form posts to `/api/billing/fairy/checkout`. The server checks the authenticated account, creates a random intent and redirects to Fairy with `payload={"memecatchIntent":"<uuid>"}`. User IDs and donor email addresses are never used as client-provided account proof. The CSP allows the official Fairy host for form redirects.

Fairy sends `payment.completed` with HMAC-SHA256 hex in `X-Fairy-Signature`, calculated over the exact JSON request body. Verified project, source, amount, timestamp and intent go to the database; donor names, emails and messages are discarded. `paymentId` deduplicates delivery. A qualifying single donation adds 30 days; smaller donations and ordinary links grant nothing. No automatic renewal or aggregation of small donations is promised. An intent accepts one donation; every new donation must start at MemeCatch's button.

Fairy expects a 2xx response within five seconds and retries failures. Old signed deliveries are allowed for manual replay; the unique payment ledger prevents double grants. Events dated before their intent or more than five minutes into the future are rejected.

## Refund operations

Only `payment.completed` is documented; no automatic refund event or public payment-status API was verified. Check refunds in the Fairy dashboard. For a verified refund, use the private `revoke_fairy_payment(p_payment_id, p_reason)` RPC from an authorized server/operator session. This revokes that benefit and recomputes remaining rights. It does not issue money refunds. Partial-refund benefit decisions require an operator; do not invent a proportional refund policy. Repeat the same payment/reason safely. Never expose this RPC through a public browser endpoint.

## Promotion

The project guidance contains `https://catchmeme.com/?utm_source=outreach&utm_medium=email&utm_campaign=free_dictionary` and `https://catchmeme.com/pricing?utm_source=outreach&utm_medium=email&utm_campaign=plus_kaia_usdt`, reusing existing attribution tracking. The source value was changed from `explee` after the generator's own-platform-name guard rejected it. Disclose USD 10 / 30 days, USDT on Kaia through Unifi Wallet, and no automatic renewal whenever payment is discussed. Do not market crypto as an investment or promise bespoke consulting, customer results, unsupported integrations or unlaunched Fairy availability.

Explee then explicitly rejected a generated direct URL with: "Links are not allowed here". First emails and follow-ups therefore cannot be treated as a verified direct-click acquisition channel. The saved knowledge and payment instructions are useful, but link-based traffic through those templates is blocked by the product's policy. A reply-first workflow or a separate approved channel is needed; no campaign was launched.

At inspection, Explee showed zero sends/replies/interested leads/spend, no payment card on file, and six review-stage campaigns. Saved copy does not establish traffic or conversion results. Auto-replies were paused pending a booking link; do not supply a placeholder link.

## Local verification

- 96 focused application tests passed, including existing billing handlers, Fairy signature/auth/config gates, pricing and CSP checks. Scoped ESLint and TypeScript passed.
- The new migration was applied to a temporary schema-only copy of local Supabase, then Fairy (32), growth billing (15), and Latpeed billing (85) pgTAP assertions all passed: 132 total. The temporary database was dropped; the shared and production databases were not changed.
- The isolated dump used `pg_dump --schema-only --no-owner --exclude-extension=pg_cron --exclude-schema=cron`; the local-only `SET log_min_messages TO` function setting was removed for restoration. Tests execute real SQL and roll back fixtures.
- Production build passed with local Supabase variables. An initial build without these required variables failed at the existing `/feed.xml` route. Existing `metadataBase` warnings remain.
- Real HTTP checks on the local server: signed Fairy test callback returns 200/ignored; invalid signature returns 401; cross-origin checkout returns 403; anonymous checkout returns 303 to login with the localized return path. No real donation was sent.
- Aside verified Korean/English pricing, free Explore navigation and anonymous Fairy checkout navigation. Desktop and 390px iframe layout had no horizontal overflow; no relevant console/CSP error was observed. The KRW 15,000 used in local QA was subsequently approved by the owner.
- A later shared build was missing its middleware manifest at runtime. An isolated source snapshot rebuilt successfully, served complete pricing/About HTML, and passed the final browser click: footer Support us opened `/en/pricing#fairy-support-title` with the Fairy account-link section visible.

## Provider sources

- https://fairy.hada.io/terms
- https://fairy.hada.io/dashboard/projects/@toris-dev/donations
- https://fairy.hada.io/dashboard/projects/@toris-dev/webhook
- https://fairy.hada.io/dashboard/projects/new
- https://explee.com/app-auto-gtm/p/33603

Vercel marketplace discovery returned Stripe for payments; the user explicitly selected Fairy, so the existing Fairy account and its native webhook are the integration source.
