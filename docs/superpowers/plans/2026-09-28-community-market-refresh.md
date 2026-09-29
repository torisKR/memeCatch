# MemeCatch discovery and creator market implementation plan

> Implementation baseline: 3d10dc0095001fc5595fe8b563ef2f78b0462de2, isolated DevSpace worktree. Do not touch or deploy the dirty source checkout.

**Goal:** Make recent memes, community participation, and creator-owned meme products immediately discoverable; publish a small, source-verified contemporary content batch.

**Architecture:** Reuse the existing Next.js App Router, Supabase authentication/RLS, community and affiliate storefront. Keep creator submissions separate from automated affiliate products. New creator listings start pending review; only approved listings appear publicly. Treat external destinations as promotional links, not an on-platform checkout.

**Tech stack:** Existing Next.js 16.3.4, React 19, TypeScript, Tailwind tokens, Supabase, Vitest/Testing Library. No new runtime dependencies.

**Spec:** User request dated 2026-09-28; PRODUCT.md and DESIGN.md.

## Constraints

- Preserve original ~/projects/memecatch uncommitted work; changes stay in this isolated worktree until reviewed.
- Read installed Next.js docs before implementation. Preserve multilingual routes and return-to login navigation.
- Reuse orange brand, Pretendard, existing mascot/assets and CSS tokens. Maintain visible focus, 44px targets, reduced-motion support, mobile safe area, loading/empty/error states.
- Do not invent member counts, reactions, prices, endorsements, stock status, or trend scores.
- Never expose service-role keys. Authenticate and authorize every mutation; enforce owner/admin access and review states in SQL as well as application code.
- Public collection is original concise editorial text with verified URL/date provenance; do not rehost third-party media without rights.
- Production content and deployment require explicit target/schema verification, idempotency and post-write read-back. No destructive changes or unreviewed bulk publish.

## Task 1 — Navigation and participation

Files: components/global-header.tsx, components/bottom-nav.tsx, app/(default)/page.tsx, components/home-sections.tsx; add focused components/tests where needed.

- [ ] Inspect existing navigation, locale helpers, home data queries and assets before deciding exact edits.
- [ ] Write regression tests for latest-meme, community and products destinations and active state.
- [ ] Provide one-tap entry points to latest memes, community and products on mobile and desktop, without removing access to submit/search/MY.
- [ ] Improve above-the-fold hierarchy, readable cards and useful contribution CTAs; retain working features and real data.
- [ ] Verify keyboard navigation, 375px and desktop layout, reduced motion and image dimensions.

## Task 2 — Creator product listings

Files: new lib/creator-products/*, components/creator-products/*, app/(default)/products/new/*, app/(default)/products/mine/*, product moderation route/page and additive Supabase migration/tests. Integrate with app/(default)/products/page.tsx and components/products-page-content.tsx. Keep existing affiliate repository intact.

- [ ] Inspect existing auth, uploads, validation, admin role checks and rate-limit patterns.
- [ ] Test anonymous rejection, ownership, malformed/unsafe URLs, missing rights consent, validation bounds, pending visibility and admin-only approval.
- [ ] Implement authenticated registration with title, description, product image, external destination, optional price/category, relationship/rights attestation and a clear pending-review result.
- [ ] Provide owner status/list management and admin approve/reject flow. Editing approved content returns it to pending; owners cannot self-approve.
- [ ] Separate creator promotions from affiliate products visually and in data; approved-only public cards and clear outbound-link disclosure.
- [ ] Add RLS/grants and constraints. No production migration until parent review.

## Task 3 — Verified recent content

Files: dated editorial batch under data/, idempotent validation/import script under scripts/, documentation of real source URLs and checked dates.

- [ ] Inspect existing content pipeline, public eligibility rules, schema constraints, deduplication and cache invalidation.
- [ ] Collect recent non-political meme references using live sources. Distinguish origin date, recent spread date and our publication date.
- [ ] Write original Korean summaries/usage notes and record uncertainty. Link/embed sources rather than copying assets.
- [ ] Validate duplicates, required fields, future dates, public eligibility and rollback identifiers before any production insert.
- [ ] Publish only validated records to the verified MemeCatch project; read back and check public routes.

## Task 4 — Release verification

- [ ] Targeted regression tests, TypeScript, lint, build; distinguish baseline failures from new failures.
- [ ] Independent security review of creator listings and content import.
- [ ] Browser checks: home/latest/community/products/new; anonymous/login-return, form errors, pending state and mobile overflow.
- [ ] Review diff and current production revision before deployment. Do not deploy unrelated dirty source changes.
- [ ] Report exact implementation paths, tests, production batch IDs/counts, verified URLs and remaining gaps.
