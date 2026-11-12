import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as creatorGet, POST as creatorPost } from "@/app/api/creator-products/[[...slug]]/route";
import { GET as cronGet } from "@/app/api/cron/adpick-hotdeals/route";
import { proxy } from "@/proxy";

const GONE_PAGES = [
  "/products",
  "/products/",
  "/products/hotdeal",
  "/products/some-id",
  "/go/products",
  "/go/products/550e8400-e29b-41d4-a716-446655440000",
  "/ja/products",
  "/ja/products/hotdeal",
  "/zh/products",
  "/zh-tw/products/item",
  "/ja/go/products/item",
  "/zh/go/products",
] as const;

function request(pathname: string, origin = "https://catchmeme.test"): NextRequest {
  return new NextRequest(`${origin}${pathname}`);
}

/** Location after Next relativizes a same-origin middleware redirect. */
function locationOnTheWire(header: string, origin: string): string {
  const base = new URL(origin);
  const target = new URL(header, base);
  if (target.origin !== base.origin) return target.toString();
  return `${target.pathname}${target.search}${target.hash}`;
}

describe("retired product responses", () => {
  it.each(GONE_PAGES)("returns 410 for %s", async (pathname) => {
    const response = await proxy(request(pathname));
    expect(response.status).toBe(410);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("밈 탐색");
    expect(html).toContain('href="/explore"');
    expect(html).toContain("noindex");
  });

  it.each(["/en/go/products", "/en/go/products/hotdeal"])(
    "returns the English 410 page for %s",
    async (pathname) => {
      const response = await proxy(request(pathname));
      expect(response.status).toBe(410);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      const html = await response.text();
      expect(html).toContain("Explore memes");
      expect(html).toContain('href="/en/explore"');
      expect(html).toContain("noindex");
    },
  );

  it.each(["/en/products", "/en/products/", "/en/products/hotdeal", "/en/products/a/b"])(
    "308s %s to a relative /en",
    async (pathname) => {
      const origin = "http://0.0.0.0:3000";
      const response = await proxy(request(pathname, origin));
      expect(response.status).toBe(308);
      const header = response.headers.get("location");
      expect(header).toBeTruthy();
      expect(locationOnTheWire(header!, origin)).toBe("/en");
      expect(locationOnTheWire(header!, origin)).not.toContain("0.0.0.0");
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );

  it("308s retired creator-product admin URLs home without leaking the bind host", async () => {
    const origin = "http://0.0.0.0:3000";
    const response = await proxy(request("/admin/creator-products/review", origin));
    expect(response.status).toBe(308);
    const header = response.headers.get("location");
    expect(header).toBeTruthy();
    expect(locationOnTheWire(header!, origin)).toBe("/");
    expect(locationOnTheWire(header!, origin)).not.toContain("0.0.0.0");
  });

  it("does not retire unrelated paths", async () => {
    const response = await proxy(request("/explore"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("keeps product redirects out of next.config", () => {
    const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(source).not.toContain("RETIRED_PRODUCT_REDIRECTS");
    expect(source).not.toContain('"/products"');
  });
});

describe("retired product APIs", () => {
  it.each([
    ["creator-products GET", creatorGet],
    ["creator-products POST", creatorPost],
    ["adpick-hotdeals GET", cronGet],
  ])("%s returns 410 JSON", async (_name, handler) => {
    const response = handler();
    expect(response.status).toBe(410);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual({ error: "gone" });
  });
});
