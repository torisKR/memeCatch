import { NextResponse } from "next/server";

const LOCALE_PREFIX = /^\/(en|ja|zh-tw|zh)(?=\/|$)/;

export type RetiredProductLocale = "ko" | "en";

export type RetiredProductDecision =
  | { type: "gone"; locale: RetiredProductLocale }
  | { type: "redirect"; location: "/en" | "/" }
  | { type: "missing" };

/** Robots metadata for the retired product document. Next emits this as a noindex meta tag. */
export const RETIRED_PRODUCTS_ROBOTS = { index: false, follow: true } as const;

export const RETIRED_PRODUCTS_PATH = "/retired-products";

function normalizePath(pathname: string): string {
  const path = pathname.split("?")[0] ?? pathname;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function isProductPath(path: string): boolean {
  return path === "/products" || path.startsWith("/products/");
}

function isGoProductPath(path: string): boolean {
  return path === "/go/products" || path.startsWith("/go/products/");
}

/**
 * Public product URLs are gone. English `/products` still 308s to `/en`.
 * Location values are relative paths and must not be built from `request.url`.
 */
export function retiredProductDecision(pathname: string): RetiredProductDecision | null {
  const path = normalizePath(pathname);
  if (path === "/admin/creator-products" || path.startsWith("/admin/creator-products/")) {
    return { type: "redirect", location: "/" };
  }
  const localeMatch = LOCALE_PREFIX.exec(path);
  const locale = localeMatch?.[1] ?? "ko";
  const rest = localeMatch ? path.slice(localeMatch[0].length) || "/" : path;
  if (rest === RETIRED_PRODUCTS_PATH) {
    if (locale === "en") return { type: "gone", locale: "en" };
    if (!localeMatch) return { type: "gone", locale: "ko" };
    return { type: "missing" };
  }
  const product = isProductPath(rest);
  const go = isGoProductPath(rest);
  if (!product && !go) return null;
  if (locale === "en" && product) return { type: "redirect", location: "/en" };
  if (locale === "en") return { type: "gone", locale: "en" };
  return { type: "gone", locale: "ko" };
}

/** 410 JSON for retired product APIs. */
export function retiredProductJson(): NextResponse {
  return NextResponse.json(
    { error: "gone" },
    {
      status: 410,
      headers: { "X-Robots-Tag": "noindex" },
    },
  );
}

