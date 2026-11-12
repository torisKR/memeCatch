import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { NextResponse } from "next/server";
import { BrandTile } from "@/components/brand-mark";
import { RetiredProductsPage } from "@/components/retired-products-page";
import type { MemeListItem } from "@/lib/queries";
import type { RetiredProductLocale } from "@/lib/retired-products";

const COPY = {
  ko: {
    lang: "ko",
    title: "밈상품 페이지는 더 이상 운영하지 않아요",
    message: "밈상품 페이지는 더 이상 운영하지 않아요.",
    explore: "밈 탐색",
    exploreHref: "/explore",
  },
  en: {
    lang: "en",
    title: "Meme product pages are no longer available",
    message: "Meme product pages are no longer available.",
    explore: "Explore memes",
    exploreHref: "/en/explore",
  },
} as const satisfies Record<
  RetiredProductLocale,
  {
    lang: string;
    title: string;
    message: string;
    explore: string;
    exploreHref: string;
  }
>;

const BRAND = {
  ko: { name: "밈캐치", home: "밈캐치 홈", homeHref: "/" },
  en: { name: "MemeCatch", home: "MemeCatch home", homeHref: "/en" },
} as const;

const NAV = {
  ko: [
    ["/", "홈"],
    ["/explore?sort=recent", "최신"],
    ["/community", "커뮤니티"],
    ["/submit", "제보"],
    ["/pricing", "Plus"],
    ["/my", "내 정보"],
  ],
  en: [
    ["/en", "Home"],
    ["/en/explore?sort=recent", "Latest"],
    ["/community", "Community"],
    ["/submit", "Submit"],
    ["/pricing", "Plus"],
    ["/my", "My"],
  ],
} as const satisfies Record<RetiredProductLocale, readonly (readonly [string, string])[]>;

function TombstoneDocument({
  locale,
  memes,
}: {
  locale: RetiredProductLocale;
  memes: MemeListItem[];
}) {
  const brand = BRAND[locale];
  const nav = NAV[locale];
  return createElement(
    "html",
    { lang: COPY[locale].lang },
    createElement(
      "body",
      { className: "flex min-h-dvh flex-col pb-16 md:pb-0" },
      createElement(
        "header",
        {
          className:
            "sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur",
        },
        createElement(
          "div",
          { className: "mx-auto flex min-h-16 max-w-6xl items-center px-4 sm:px-6" },
          createElement(
            "a",
            {
              href: brand.homeHref,
              "aria-label": brand.home,
              className: "flex items-center gap-2",
            },
            createElement(BrandTile, { className: "size-8" }),
            createElement(
              "span",
              { className: "text-lg font-extrabold tracking-[-0.045em]" },
              brand.name,
            ),
          ),
        ),
      ),
      createElement(
        "div",
        { className: "flex-1" },
        createElement(RetiredProductsPage, { locale, memes }),
      ),
      createElement(
        "nav",
        {
          "aria-label": locale === "en" ? "Main navigation" : "주 내비게이션",
          className:
            "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden",
        },
        createElement(
          "ul",
          { className: "mx-auto flex max-w-2xl items-stretch justify-around" },
          nav.map(([href, label]) =>
            createElement(
              "li",
              { key: href, className: "flex min-w-11 flex-1" },
              createElement(
                "a",
                {
                  href,
                  className:
                    "flex min-h-14 w-full flex-col items-center justify-center whitespace-nowrap text-[11px] leading-none text-muted",
                },
                label,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function stylesheetLinks(): string {
  const directories = [
    join(process.cwd(), ".next/static/css"),
    join(process.cwd(), ".next/standalone/.next/static/css"),
  ];
  const links: string[] = [];
  for (const directory of directories) {
    try {
      for (const name of readdirSync(directory)) {
        if (!name.endsWith(".css")) continue;
        links.push(`<link rel="stylesheet" href="/_next/static/css/${name}" />`);
      }
    } catch {
      // Unit tests run before the production CSS build exists.
    }
  }
  return links.join("");
}

function fallbackDocument(locale: RetiredProductLocale): string {
  const copy = COPY[locale];
  return `<!DOCTYPE html>
<html lang="${copy.lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, follow"/>
<title>${copy.title}</title>
</head>
<body>
<main>
<h1>${copy.message}</h1>
<a href="${copy.exploreHref}">${copy.explore}</a>
</main>
</body>
</html>`;
}

/**
 * 410 document rendered in this process.
 * The public request is not fetched again: a forwarded https origin would
 * point at the bind address and the TLS handshake would fail.
 */
export async function retiredProductDocument(
  locale: RetiredProductLocale,
  load?: () => Promise<MemeListItem[]>,
): Promise<NextResponse> {
  let html = fallbackDocument(locale);
  try {
    // Dynamic so the App Router compiler does not treat this module as a
    // component that imports the server renderer.
    const { renderToStaticMarkup } = await import("react-dom/server");
    const memes = load
      ? await load()
      : await (await import("@/lib/retired-product-memes")).loadRetiredProductMemes();
    const markup = renderToStaticMarkup(
      createElement(TombstoneDocument, { locale, memes }) as ReactNode,
    );
    const copy = COPY[locale];
    const head = `<head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex, follow"/><title>${copy.title}</title>${stylesheetLinks()}</head>`;
    html = `<!DOCTYPE html>${markup.replace(/<html([^>]*)>/, `<html$1>${head}`)}`;
  } catch (error) {
    console.error("retired product document failed", error);
  }
  return new NextResponse(html, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "x-robots-tag": "noindex",
    },
  });
}
