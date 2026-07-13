# Task 4 Report: MemeCatch editorial product shop

## Outcome

Implemented Task 4 on `codex/products-editorial-carousel`.

- Commit: `deb13c0` (`feat: redesign products as a meme editorial shop`).
- Scope: only the eleven Task 4 source/test files listed in the brief were committed.
- Preserved: untracked `pnpm-workspace.yaml` and `.superpowers/sdd/progress.md` were not edited, staged, or committed.
- Not performed: Task 5 browser QA, deployment, and unrelated repository work.

## Changes

- Rebuilt the live AdPick card with shadcn `Card`, `Badge`, and link-compatible `buttonVariants`, a 2px adaptive Ink-style border, one-degree image-corner sticker, fixed 4:3 frame, two-line source title, monospaced merchant/price data, AA-safe accent text, and a full-width Ink CTA with Flame hover/focus treatment.
- Added both localized live-ad and affiliate badges and product-specific CTA accessible names while retaining internal `/go/products/:id` exits.
- Added the tiny `AffiliateProductImage` client boundary. Direct remote images keep `width=640`, `height=480`, lazy loading, async decoding, and `no-referrer`; an image error replaces only the image with a decorative `MemeCatch pick` fallback while retaining the 4:3 wrapper.
- Extracted the route-local editor card into the server-compatible `EditorialProductCard`, preserving localized category/audience/title/description/disclosure, expiry, advertiser source link, sponsored relationship, and inactive-campaign behavior.
- Recomposed the server page as cream editorial hero -> affiliate `Alert` -> live-product grid/carousel -> editor picks, retaining one page `h1`, section `h2` elements, `TrackedBlock`, canonical metadata, data fetching, and JSON-LD construction.
- Counts only live storefront hotdeals plus active editorial campaigns in the disclosure. A one-argument wrapper is intentionally used around `isMemeProductActive`: passing that two-parameter helper directly to `Array.filter` would pass the item index as its optional date and incorrectly mark campaigns inactive.
- Updated the loading state to one hero block, one disclosure block, and one/two/three responsive carousel-card skeletons.
- Added shop-only sticker, focus-safe overflow, carousel edge-fade, and reduced-motion CSS.

## TDD Evidence

### RED: cards and route

Command required by the brief:

```bash
pnpm exec vitest run components/affiliate-product-card.test.tsx components/editorial-product-card.test.tsx app/products/page.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'
```

Observed before production changes:

- Exit code: `1`.
- Test files: `3 failed (3)`.
- Tests: `2 failed | 11 passed (13)`; the new editorial suite could not collect because its component did not exist yet.
- Expected failures: the live card lacked `liveBadge`, the route lacked `shopTitle`/new hierarchy, and the editorial component import was unresolved.

### RED: deterministic image failure

Command:

```bash
pnpm exec vitest run components/affiliate-product-image.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'
```

Observed before creating the client component:

- Exit code: `1`.
- Test files: `1 failed (1)` during collection.
- Expected failure: `@/components/affiliate-product-image` could not be resolved.

### GREEN: focused Task 4 verification

Command:

```bash
./node_modules/.bin/vitest run components/affiliate-product-card.test.tsx components/affiliate-product-image.test.tsx components/editorial-product-card.test.tsx app/products/page.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'
```

Fresh result at the completion gate:

- Exit code: `0`.
- Test files: `4 passed (4)`.
- Tests: `16 passed (16)`.
- Coverage includes truthful price/discount behavior, source-name preservation, direct image attributes, error fallback/frame retention, both live labels, localized accessible names, sponsored relations, expired CTA removal, page hierarchy/count, and stale/original-only JSON-LD offer omission.

## Carousel Regression Verification

Command:

```bash
./node_modules/.bin/vitest run components/affiliate-product-carousel.test.tsx components/ui/ui-primitives.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'
```

- Exit code: `0`.
- Test files: `2 passed (2)`.
- Tests: `19 passed (19)`.
- The reviewed autoplay, pointer release, pause/resume, reduced-motion, controls, carousel, and shadcn primitive behavior remains green.

## Static Verification

Commands:

```bash
./node_modules/.bin/eslint components/affiliate-product-card.tsx components/affiliate-product-card.test.tsx components/affiliate-product-image.tsx components/affiliate-product-image.test.tsx components/editorial-product-card.tsx components/editorial-product-card.test.tsx components/affiliate-product-grid.tsx app/products/page.tsx app/products/page.test.tsx app/products/loading.tsx
./node_modules/.bin/tsc --noEmit
git diff --check
```

- All commands exited `0` with no findings.

## Self-review

- Verified `app/products/page.tsx` remains a Server Component and still performs both server data reads. The only new `"use client"` file is the image error handler; the existing reviewed carousel remains the other client boundary.
- Verified the JSON-LD mapping and stale/current-price conditions are unchanged; stale data and original-only prices still omit the entire Offer object.
- Verified live remote images remain direct `img` requests with all required privacy/performance attributes, and no Next image allowlist or proxy behavior was introduced.
- Verified every live CTA still exits through internal `/go/products/:id`; editorial destinations and advertiser-source links retain their original AdPick URLs and relation attributes.
- Verified expired editorial campaigns render status text rather than a destination CTA.
- Verified source product names are not translated, price/discount rules are unchanged, and no urgency, popularity, sales, inventory, or outcome claims were invented.
- Verified the page contains one `h1`; live and editor sections use `h2`; cards use `h3`.
- Verified editor-card text regions use `min-w-0` and defensive wrapping, CTAs can wrap, mobile cards do not require a fixed minimum width, and the loading placeholders expose one/two/three responsive cards.
- Verified small Flame text uses `text-accent-text`, primary CTA text is white on Ink and switches to darker Flame 700 on hover, and borders/text adapt through `foreground` in dark mode.
- Verified reduced motion removes sticker hover changes and carousel-decoration transitions.
- Verified the Button primitive's exported `buttonVariants` styles are applied to semantic links because the reviewed Button implementation does not expose `asChild`; no invalid nested interactive control was introduced.
- Verified `pnpm-workspace.yaml` and the ignored progress ledger remain untouched.

## Concerns

None. The one-argument active-product filter wrapper is an intentional correctness safeguard for the existing helper signature, not an unresolved issue.

## Review Fix

### RED

Command:

```bash
./node_modules/.bin/vitest run components/affiliate-product-card.test.tsx components/affiliate-product-image.test.tsx app/products/page.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**' --reporter=verbose
```

- Exit code: `1`.
- Test files: `2 failed | 1 passed (3)`.
- Tests: `4 failed | 13 passed (17)`.
- Expected failures: the live CTA lacked `focus-visible:ring-inset`; the carousel wrapper still exposed the singular `shop-carousel-edge` class and had no focus-within mask override; an already-complete broken image remained rendered because no ref inspected its DOM state; and the permanent failure boolean kept a later URL B hidden after URL A failed.
- The strengthened page-count test passed while proving its controlled fixture contains `2` campaigns but only `1` active campaign, so replacing the active count with `MEME_PRODUCTS.length` would fail the assertion.

### GREEN

Focused Task 4 command:

```bash
./node_modules/.bin/vitest run components/affiliate-product-card.test.tsx components/affiliate-product-image.test.tsx components/editorial-product-card.test.tsx app/products/page.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**' --reporter=dot
```

- Exit code: `0`.
- Test files: `4 passed (4)`.
- Tests: `19 passed (19)`.

Carousel regression command:

```bash
./node_modules/.bin/vitest run components/affiliate-product-carousel.test.tsx components/ui/ui-primitives.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**' --reporter=dot
```

- Exit code: `0`.
- Test files: `2 passed (2)`.
- Tests: `19 passed (19)`.

Static verification:

```bash
./node_modules/.bin/eslint components/affiliate-product-card.tsx components/affiliate-product-card.test.tsx components/affiliate-product-image.tsx components/affiliate-product-image.test.tsx components/affiliate-product-grid.tsx app/products/page.test.tsx
./node_modules/.bin/tsc --noEmit
git diff --check
```

- All commands exited `0` with no findings after replacing the test-only ES2018 `s` regex flag with a target-compatible `[\s\S]` expression.

### Self-review

- The Embla viewport remains `overflow-hidden`; the live CTA now uses an inset, zero-offset focus ring, so the fix does not create horizontal page overflow.
- `.shop-carousel-edges:focus-within` removes both prefixed and unprefixed masks while focus is inside, and the component/CSS regression locks that class contract.
- Image failures are keyed to the failing URL. The callback ref catches `complete && naturalWidth === 0` after hydration, while a later different URL renders normally.
- Direct `<img>` loading/privacy attributes and the `aspect-[4/3]` wrapper remain unchanged.
- The disclosure-count fixture mixes one active and one expired campaign without changing production campaign data.
- `pnpm-workspace.yaml` and `.superpowers/sdd/progress.md` remain untouched.
