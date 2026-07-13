# Products Editorial Shop & Auto Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/products` as a responsive four-locale MemeCatch editorial shop with transparent affiliate labels, shadcn/ui primitives, and an accessible carousel that automatically moves to the right.

**Architecture:** Keep `app/products/page.tsx` as an async Server Component that fetches and serializes storefront data. Add a narrow Client Component around Embla and its auto-scroll plugin; all product copy, cards, JSON-LD, and affiliate links remain server-renderable. Build only the shadcn-compatible primitives this page needs and retain the existing direct remote `<img>` policy for unbounded AdPick image hosts.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4, shadcn/ui-compatible local components, Embla Carousel, `embla-carousel-auto-scroll`, Motion reduced-motion hook, Vitest 4.1.10, Testing Library, jsdom.

## Global Constraints

- Visual direction is **밈 스티커 편집숍** using Flame `#FF5C38`, Ink `#16161A`, Cream `#FAF6F0`, Surface `#FFFFFF`, and Trust Yellow `#FDF3D8`.
- Automatic products must be labeled as real-time advertising products; manually authored products must be labeled as MemeCatch editor picks; every affiliate card still carries an explicit advertising/affiliate label.
- The product track moves toward the right, loops seamlessly, pauses on hover/focus/hidden tabs, provides previous/next/play-pause controls, and does not autoplay under `prefers-reduced-motion: reduce`.
- Mobile shows one card plus a peek, tablet about two cards, and desktop three cards; the page itself must never gain horizontal overflow at 320, 375, 768, or 1280px.
- Supported UI locales are `ko`, `en`, `ja`, and `zh`, with document languages `ko`, `en`, `ja`, and `zh-Hans`; external product and merchant names remain unchanged.
- Do not add fake scarcity, countdowns, sales claims, bestseller claims, reviews, or stock claims.
- Preserve the existing AdPick API, Supabase schema, redirect security, JSON-LD price-staleness behavior, `.gitignore` modification, and untracked `.pnpm-store/` directory.
- Read and follow `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `11-css.md`, `12-images.md`, `01-app/02-guides/testing/vitest.md`, and `03-architecture/accessibility.md` during implementation.

---

## File Map

- `components.json` — shadcn/ui project metadata for Tailwind CSS 4 and `@/` aliases.
- `lib/utils.ts` — shared `cn(...inputs)` class merger required by shadcn primitives.
- `components/ui/{alert,badge,button,card,carousel,skeleton}.tsx` — minimal local shadcn-compatible primitives.
- `components/affiliate-product-carousel.tsx` — the only new interactive product boundary; owns rightward auto-scroll and accessible controls.
- `components/affiliate-product-image.tsx` — tiny client boundary that swaps a failed remote image for the reserved-ratio brand placeholder.
- `components/affiliate-product-card.tsx` — live AdPick card using shared primitives and product-specific CTA names.
- `components/editorial-product-card.tsx` — manually authored MemeCatch editor-pick card, extracted from the route.
- `components/affiliate-product-grid.tsx` — storefront section composition and live carousel handoff.
- `components/language-selector.tsx` — unclipped compact locale control.
- `lib/i18n.ts` — short locale labels for the header.
- `lib/i18n-pages.ts` — all new shop, badge, carousel, state, and accessible strings in four locales.
- `app/products/page.tsx` — editorial hero, disclosure count, section hierarchy, JSON-LD.
- `app/products/loading.tsx` — loading skeleton matching the new card geometry.
- `app/globals.css` — locale-aware line breaking, shop tokens, and reduced-motion styles.
- `components/*.test.tsx`, `app/products/page.test.tsx`, `lib/i18n-pages.test.ts` — static, interaction, localization, and regression coverage.
- `package.json`, `pnpm-lock.yaml`, `vitest.config.mts` — exact UI/testing dependencies and jsdom test support.

---

### Task 1: Add the minimal shadcn/ui foundation

**Files:**
- Create: `components.json`
- Create: `lib/utils.ts`
- Create: `components/ui/alert.tsx`
- Create: `components/ui/badge.tsx`
- Create: `components/ui/button.tsx`
- Create: `components/ui/card.tsx`
- Create: `components/ui/carousel.tsx`
- Create: `components/ui/skeleton.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `components/ui/ui-primitives.test.tsx`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`.
- Produces: `Button`, `buttonVariants`, `Badge`, `Card`, `CardHeader`, `CardContent`, `CardFooter`, `Alert`, `AlertTitle`, `AlertDescription`, and `Skeleton`.
- Produces: shadcn carousel API `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`, `useCarousel`, and exported `CarouselApi`/`CarouselOptions`/`CarouselPlugin` types.

- [ ] **Step 1: Write the failing primitive test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

describe("shadcn product primitives", () => {
  it("merges conflicting Tailwind classes", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toContain("px-4");
    expect(cn("px-2", "px-4")).not.toContain("px-2");
  });

  it("renders semantic, composable shop primitives", () => {
    const html = renderToStaticMarkup(
      <Card><CardContent><Badge>Ad</Badge><Alert><AlertTitle>Notice</AlertTitle><AlertDescription>Terms</AlertDescription></Alert><Button>Open</Button></CardContent></Card>,
    );
    expect(html).toContain("Notice");
    expect(html).toContain("Terms");
    expect(html).toContain("type=\"button\"");
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `pnpm exec vitest run components/ui/ui-primitives.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: FAIL because `@/components/ui/alert` and `@/lib/utils` do not exist.

- [ ] **Step 3: Install the exact runtime and test dependencies**

Run:

```bash
pnpm add class-variance-authority clsx embla-carousel-auto-scroll embla-carousel-react lucide-react tailwind-merge
pnpm add -D @testing-library/dom @testing-library/react @testing-library/user-event jsdom
```

Expected: `package.json` and `pnpm-lock.yaml` contain the six runtime packages and three Testing Library/jsdom packages without changing Next.js, React, or Tailwind versions.

- [ ] **Step 4: Add shadcn metadata and the class utility**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Add the six shadcn-compatible primitives**

Use the installed shadcn New York component contracts, keep `Button` defaulting to `type="button"`, map variants to existing tokens (`bg-foreground text-background`, `bg-accent-soft text-accent-text`, `border-border bg-surface`), and implement the carousel with `useEmblaCarousel`, a context containing `{ carouselRef, api, scrollPrev, scrollNext, canScrollPrev, canScrollNext }`, keyboard ArrowLeft/ArrowRight handling, and an accessible `role="region" aria-roledescription="carousel"` root. Do not add Radix dependencies because these six primitives require none.

- [ ] **Step 6: Run the primitive test and project type check**

Run: `pnpm exec vitest run components/ui/ui-primitives.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: PASS.

Run: `pnpm exec tsc --noEmit`

Expected: exit 0.

- [ ] **Step 7: Commit the foundation**

```bash
git add components.json package.json pnpm-lock.yaml lib/utils.ts components/ui components/ui/ui-primitives.test.tsx
git commit -m "feat: add shadcn product primitives"
```

---

### Task 2: Complete four-locale copy and fix the responsive language control

**Files:**
- Modify: `lib/i18n.ts`
- Modify: `lib/i18n-pages.ts`
- Create: `lib/i18n-pages.test.ts`
- Modify: `components/language-selector.tsx`
- Modify: `components/global-header.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `LANGUAGE_SHORT_NAMES: Record<Locale, "KO" | "EN" | "JA" | "ZH">`.
- Extends every `PAGE_COPY[locale]` with `shopTitle`, `shopIntro`, `liveAdTitle`, `liveAdDescription`, `editorPickTitle`, `editorPickDescription`, `liveBadge`, `editorBadge`, `carouselLabel`, `previousProduct`, `nextProduct`, `pauseCarousel`, `playCarousel`, `viewProductLabel(productName: string)`, and `checkProductLabel(productName: string)`.
- Keeps: `Locale` values `ko | en | ja | zh` and `getDocumentLanguage("zh") === "zh-Hans"`.

- [ ] **Step 1: Write failing locale completeness and header tests**

```ts
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";

describe("product shop copy", () => {
  it.each(SUPPORTED_LOCALES)("has complete carousel copy for %s", (locale) => {
    const copy = PAGE_COPY[locale];
    for (const value of [copy.shopTitle, copy.liveAdTitle, copy.editorPickTitle, copy.carouselLabel, copy.previousProduct, copy.nextProduct, copy.pauseCarousel, copy.playCarousel]) {
      expect(value.trim()).not.toBe("");
    }
    expect(copy.viewProductLabel("Source name")).toContain("Source name");
  });
});
```

Replace the current class-fragment assertion in `global-header.test.tsx` with assertions that the selector contains a fully visible `KO` label, `min-w-[4.75rem]`, an absolute transparent native select covering the complete 44px control, and no `w-11`/`md:w-11` clipping classes.

- [ ] **Step 2: Run the locale/header tests and verify failures**

Run: `pnpm exec vitest run lib/i18n-pages.test.ts components/global-header.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: FAIL because the new copy and compact label do not exist.

- [ ] **Step 3: Add all four translations and the short locale map**

Use these exact section titles:

| Key | Korean | English | Japanese | Simplified Chinese |
|---|---|---|---|---|
| `shopTitle` | 밈캐치 편집숍 | MemeCatch Edit Shop | MemeCatch セレクトショップ | MemeCatch 迷因选物店 |
| `liveAdTitle` | 실시간 광고 상품 | Live sponsored products | リアルタイム広告商品 | 实时广告商品 |
| `editorPickTitle` | 밈캐치 에디터 픽 | MemeCatch editor picks | MemeCatch 編集部ピック | MemeCatch 编辑精选 |
| `liveBadge` | 실시간 광고 | Live ad | リアルタイム広告 | 实时广告 |
| `editorBadge` | 에디터 픽 | Editor pick | 編集部ピック | 编辑精选 |

Translate the remaining descriptions and controls naturally, and implement `viewProductLabel` so the external source product name is appended unchanged in all four locales.

- [ ] **Step 4: Replace the clipped select presentation**

```tsx
<label className="relative grid h-11 min-w-[4.75rem] shrink-0 cursor-pointer grid-cols-[1rem_1fr_auto] items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-bold text-foreground transition-colors hover:border-accent focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/20">
  <span className="sr-only">{messages.language}</span>
  <GlobeIcon className="h-4 w-4 text-muted" />
  <span aria-hidden>{LANGUAGE_SHORT_NAMES[locale]}</span>
  <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
  <select value={locale} onChange={...} aria-label={messages.languageMenu} className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0">
    ...
  </select>
</label>
```

- [ ] **Step 5: Make line breaking locale-aware**

Replace the global body `word-break: keep-all` with:

```css
body { overflow-wrap: anywhere; word-break: normal; }
html:lang(ko) body { word-break: keep-all; }
html:lang(ja) body,
html:lang(zh-Hans) body { line-break: strict; overflow-wrap: anywhere; word-break: normal; }
```

Do not apply `overflow-x: hidden`; the browser QA must expose real layout errors.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm exec vitest run lib/i18n-pages.test.ts components/global-header.test.tsx app/layout.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: PASS for all four locales and document language checks.

```bash
git add lib/i18n.ts lib/i18n-pages.ts lib/i18n-pages.test.ts components/language-selector.tsx components/global-header.test.tsx app/globals.css
git commit -m "fix: complete product locales and responsive language picker"
```

---

### Task 3: Build and test the right-moving product carousel

**Files:**
- Create: `components/affiliate-product-carousel.tsx`
- Create: `components/affiliate-product-carousel.test.tsx`
- Modify: `components/affiliate-product-grid.tsx`

**Interfaces:**
- Consumes: `AffiliateStorefrontProduct[]`, `Locale`, `PAGE_COPY`, shadcn carousel primitives, and `AffiliateProductCard`.
- Produces: `AffiliateProductCarousel({ products, locale, sectionId }: { products: AffiliateStorefrontProduct[]; locale: Locale; sectionId: string }): ReactElement`.
- Invariant: auto-scroll is created only when `products.length >= 4` and reduced motion is false.

- [ ] **Step 1: Write failing structure and interaction tests**

Use `// @vitest-environment jsdom`, mock `motion/react` `useReducedMotion`, mock `embla-carousel-auto-scroll` with spies for `play`, `stop`, `isPlaying`, and render four products. Assert:

```tsx
expect(screen.getByRole("region", { name: PAGE_COPY.ko.carouselLabel })).toBeTruthy();
expect(screen.getByRole("button", { name: PAGE_COPY.ko.pauseCarousel })).toBeTruthy();
await user.click(screen.getByRole("button", { name: PAGE_COPY.ko.pauseCarousel }));
expect(autoScrollStop).toHaveBeenCalled();
expect(screen.getByRole("button", { name: PAGE_COPY.ko.playCarousel })).toBeTruthy();
fireEvent.focusIn(screen.getByRole("region", { name: PAGE_COPY.ko.carouselLabel }));
expect(autoScrollStop).toHaveBeenCalled();
```

Add a reduced-motion case expecting no auto-scroll `play()` call and a two-product case expecting no play/pause control.

- [ ] **Step 2: Run the carousel test and verify failure**

Run: `pnpm exec vitest run components/affiliate-product-carousel.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: FAIL because `AffiliateProductCarousel` does not exist.

- [ ] **Step 3: Implement the client boundary**

Create the plugin with these exact semantics:

```tsx
"use client";

const canAutoScroll = products.length >= 4 && !reduceMotion;
const autoScroll = useMemo(() => AutoScroll({
  direction: "backward",
  playOnInit: canAutoScroll,
  speed: 0.75,
  stopOnInteraction: false,
  stopOnMouseEnter: true,
}), [canAutoScroll]);
```

Render `Carousel` with `opts={{ align: "start", loop: canAutoScroll, dragFree: true }}`, `plugins={canAutoScroll ? [autoScroll] : []}`, and items with responsive bases `basis-[88%] min-[480px]:basis-[72%] sm:basis-1/2 lg:basis-1/3`. On `focusCapture` call `stop()`, on `blurCapture` resume only when focus leaves the region and the user has not manually paused, and on `visibilitychange` stop hidden tabs/resume visible tabs under the same conditions. Previous/next controls call Embla and then restart after a 2500ms grace timer. The play/pause control reflects plugin state and has a translated accessible name.

- [ ] **Step 4: Use the carousel only for live AdPick products**

In `AffiliateProductGrid`, render popular products as a small static grid only when non-empty and render `data.hotdeals` through `AffiliateProductCarousel`. Keep the empty state server-rendered and do not render carousel controls when there are no products.

- [ ] **Step 5: Run carousel and storefront tests**

Run: `pnpm exec vitest run components/affiliate-product-carousel.test.tsx components/affiliate-product-card.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: PASS, including reduced motion, control labels, empty guidance, and popular-before-live ordering.

- [ ] **Step 6: Commit the carousel**

```bash
git add components/affiliate-product-carousel.tsx components/affiliate-product-carousel.test.tsx components/affiliate-product-grid.tsx
git commit -m "feat: add accessible right-moving product carousel"
```

---

### Task 4: Recompose cards and the route as the MemeCatch editorial shop

**Files:**
- Modify: `components/affiliate-product-card.tsx`
- Modify: `components/affiliate-product-card.test.tsx`
- Create: `components/affiliate-product-image.tsx`
- Create: `components/affiliate-product-image.test.tsx`
- Create: `components/editorial-product-card.tsx`
- Create: `components/editorial-product-card.test.tsx`
- Modify: `components/affiliate-product-grid.tsx`
- Modify: `app/products/page.tsx`
- Modify: `app/products/page.test.tsx`
- Modify: `app/products/loading.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `EditorialProductCard({ product, locale }: { product: MemeProduct; locale: Locale })`.
- Extends: `AffiliateProductCard` with explicit `liveBadge`, `affiliateBadge`, and `aria-label={copy.viewProductLabel(product.productName)}`.
- Keeps: sale-price truthfulness, stale JSON-LD offer omission, direct remote image loading, and internal `/go/products/:id` exits.

- [ ] **Step 1: Write failing card and route tests**

Add assertions that the live card contains both `affiliateBadge` and `liveBadge`, that its CTA has the product-specific `aria-label`, and that the editorial card contains `editorBadge`, localized title/disclosure, `rel="sponsored noopener noreferrer"`, and no active CTA when expired.

Extend `app/products/page.test.tsx`:

```ts
expect(html).toContain(PAGE_COPY.ko.shopTitle);
expect(html.indexOf(PAGE_COPY.ko.liveAdTitle)).toBeLessThan(html.indexOf(PAGE_COPY.ko.editorPickTitle));
expect(html).toContain(PAGE_COPY.ko.affiliateBody(1 + activeMemeProductCount));
expect(html).toContain("bg-cream");
```

- [ ] **Step 2: Run card/page tests and verify failures**

Run: `pnpm exec vitest run components/affiliate-product-card.test.tsx components/editorial-product-card.test.tsx app/products/page.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: FAIL for missing editorial component and new shop copy/labels.

- [ ] **Step 3: Redesign the live product card with shadcn primitives**

Use `Card` with a 2px Ink-compatible border, a 1deg sticker badge limited to the image corner, an image aspect ratio of 4:3, a two-line source product name, monospace merchant/price metadata, AA-safe `text-accent-text`, and a full-width Ink CTA with Flame hover/focus treatment. Preserve `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`, width 640, height 480, and the current price/discount rules.

- [ ] **Step 4: Add deterministic remote-image failure handling**

Create a client `AffiliateProductImage` that starts with the supplied URL, sets `failed=true` on `onError`, and always retains the parent `aspect-[4/3]`. Its fallback is decorative text `MemeCatch pick` with `aria-hidden="true"`. In the jsdom test, fire `error` on the image and assert the image is removed while the fallback appears without removing the aspect-ratio wrapper.

- [ ] **Step 5: Extract and redesign the editor-pick card**

Move the route-local `ProductCard` to `components/editorial-product-card.tsx`. Use `Card`, `Badge`, and `Button` primitives, preserve localized categories/audiences/disclosure/expiry/source link, add the `editorBadge`, and give the CTA `aria-label={copy.checkProductLabel(localized.title)}`. Keep every text container `min-w-0` and `break-words`.

- [ ] **Step 6: Recompose the server page**

Keep data fetching and JSON-LD unchanged, but calculate disclosure count as:

```ts
const activeEditorialCount = MEME_PRODUCTS.filter(isMemeProductActive).length;
const availableLinkCount = storefront.hotdeals.length + activeEditorialCount;
```

Use this hierarchy: Cream editorial hero with sticker eyebrow and `shopTitle`; shadcn `Alert` for affiliate disclosure; `AffiliateProductGrid` for live products; editor-pick section with `EditorialProductCard`. Keep one page `<h1>`, section `<h2>` elements, `TrackedBlock`, and canonical metadata.

- [ ] **Step 7: Match the loading state and add shop-only CSS**

Update `loading.tsx` to one hero block, one disclosure block, and 1/2/3 responsive carousel card skeletons. Add only product-specific utilities/classes needed for the sticker border, focus-safe overflow, and carousel edge fade. Under reduced motion, disable sticker hover transforms and carousel decoration transitions.

- [ ] **Step 8: Run focused tests and commit**

Run: `pnpm exec vitest run components/affiliate-product-card.test.tsx components/affiliate-product-image.test.tsx components/editorial-product-card.test.tsx app/products/page.test.tsx --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: PASS with current pricing, JSON-LD, labels, and editorial ordering intact.

```bash
git add components/affiliate-product-card.tsx components/affiliate-product-card.test.tsx components/affiliate-product-image.tsx components/affiliate-product-image.test.tsx components/editorial-product-card.tsx components/editorial-product-card.test.tsx components/affiliate-product-grid.tsx app/products/page.tsx app/products/page.test.tsx app/products/loading.tsx app/globals.css
git commit -m "feat: redesign products as a meme editorial shop"
```

---

### Task 5: Verify the complete product experience and repair only observed regressions

**Files:**
- Modify if required by observed failures: files from Tasks 1–4 only
- Update: `docs/superpowers/plans/2026-07-13-products-editorial-carousel.md` checkboxes

**Interfaces:**
- Consumes the complete route.
- Produces no new public API; this task is the release gate.

- [ ] **Step 1: Run the source test suite**

Run: `pnpm exec vitest run --exclude '.worktrees/**' --exclude '.pnpm-store/**'`

Expected: all source tests pass; `.pnpm-store` duplicates are not collected.

- [ ] **Step 2: Run static verification**

Run: `pnpm exec eslint app components lib --max-warnings=0`

Expected: exit 0.

Run: `pnpm exec tsc --noEmit`

Expected: exit 0.

Run: `pnpm build`

Expected: production build exits 0 and `/products` compiles without client/server boundary errors.

- [ ] **Step 3: Start the local production build and inspect it with the in-app browser**

Run: `./node_modules/.bin/next start -p 3100`

Use the already-bound in-app browser runtime and inspect `http://localhost:3100/products`. For each locale `ko`, `en`, `ja`, `zh`, test widths 320, 375, 768, and 1280. Record `document.documentElement.scrollWidth === document.documentElement.clientWidth`, the complete language label, section order, button names, and card widths.

- [ ] **Step 4: Verify carousel behavior and accessibility**

At 1280px, sample the first card transform/position twice to confirm rightward movement. Verify pause on pointer hover, focus, explicit pause, and hidden tab; verify previous/next; emulate reduced motion and confirm no automatic movement. Tab through controls and CTAs, ensuring visible focus and product-specific accessible names. Confirm 1+peek, 2, and 3 card layouts at mobile, tablet, and desktop.

- [ ] **Step 5: Verify content truthfulness and degraded states**

Confirm live and editor badges remain distinct, every card shows affiliate disclosure, popular copy says it is based on MemeCatch clicks, stale pricing warning remains visible, no price offer appears in stale JSON-LD, and no fake urgency/sales language appears. Temporarily block one image request in browser inspection and confirm the reserved aspect ratio prevents layout shift.

- [ ] **Step 6: Perform two-stage review and address findings**

Dispatch a specification-compliance reviewer, fix any spec gap, then dispatch a code-quality reviewer. Re-run the focused command for every changed file followed by the complete tests, lint, type check, and build commands above.

- [ ] **Step 7: Commit verified repairs, if any**

```bash
git add app/products/page.tsx app/products/page.test.tsx app/products/loading.tsx app/globals.css components/affiliate-product-carousel.tsx components/affiliate-product-carousel.test.tsx components/affiliate-product-card.tsx components/affiliate-product-card.test.tsx components/affiliate-product-image.tsx components/affiliate-product-image.test.tsx components/editorial-product-card.tsx components/editorial-product-card.test.tsx components/affiliate-product-grid.tsx components/language-selector.tsx components/global-header.test.tsx components/ui lib/i18n.ts lib/i18n-pages.ts lib/i18n-pages.test.ts lib/utils.ts package.json pnpm-lock.yaml components.json
git commit -m "fix: polish responsive product storefront"
```

If no repairs were needed, do not create an empty commit. Leave the user's existing `.gitignore` modification and `.pnpm-store/` directory untracked/uncommitted.
