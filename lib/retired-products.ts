import { NextResponse } from "next/server";

const LOCALE_PREFIX = /^\/(en|ja|zh-tw|zh)(?=\/|$)/;

export type RetiredProductLocale = "ko" | "en";

/** Locales that have a public meme path. Korean stays unprefixed. */
export type RetiredRouteLocale = "ko" | "en" | "ja" | "zh" | "zh-tw";

export type RetiredProductDecision =
  | { type: "gone"; locale: RetiredProductLocale; routeLocale: RetiredRouteLocale }
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

function routeLocaleOf(prefix: string | undefined): RetiredRouteLocale {
  switch (prefix) {
    case "en":
    case "ja":
    case "zh":
    case "zh-tw":
      return prefix;
    default:
      return "ko";
  }
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
  const prefix = localeMatch?.[1];
  const routeLocale = routeLocaleOf(prefix);
  const rest = localeMatch ? path.slice(localeMatch[0].length) || "/" : path;
  if (rest === RETIRED_PRODUCTS_PATH) {
    if (routeLocale === "en") return { type: "gone", locale: "en", routeLocale: "en" };
    if (!localeMatch) return { type: "gone", locale: "ko", routeLocale: "ko" };
    return { type: "missing" };
  }
  const product = isProductPath(rest);
  const go = isGoProductPath(rest);
  if (!product && !go) return null;
  if (routeLocale === "en" && product) return { type: "redirect", location: "/en" };
  if (routeLocale === "en") return { type: "gone", locale: "en", routeLocale: "en" };
  return { type: "gone", locale: "ko", routeLocale };
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

