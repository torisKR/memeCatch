import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as creatorGet, POST as creatorPost } from "@/app/api/creator-products/[[...slug]]/route";
import { GET as cronGet } from "@/app/api/cron/adpick-hotdeals/route";
import { proxy } from "@/proxy";
import {
  retiredProductDocument,
  retiredProductLoopbackUrl,
} from "@/lib/retired-product-document";
import {
  DEFAULT_TRAILING_SLASH_REDIRECT,
  EN_PRODUCT_GONE_REDIRECTS,
} from "@/lib/retired-product-redirects";
import { RETIRED_PRODUCT_SHELL_HEADER } from "@/lib/retired-products";

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

function forwardedProducts(): NextRequest {
  return new NextRequest("http://0.0.0.0:3000/products", {
    headers: { "x-forwarded-proto": "https", host: "0.0.0.0:3000" },
  });
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
    expect(html).not.toContain("지금은 보여드릴 인기 밈이 없어요.");
    expect(html).not.toContain("0.0.0.0");
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
      expect(html).not.toContain("No popular memes to show right now.");
    },
  );

  it.each(["/retired-products", "/en/retired-products"])(
    "returns 410 for the direct tombstone %s",
    async (pathname) => {
      const response = await proxy(request(pathname));
      expect(response.status).toBe(410);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );

  it("renders the tombstone page for the loopback shell request", async () => {
    const response = await proxy(
      new NextRequest("http://127.0.0.1:3000/retired-products", {
        headers: { [RETIRED_PRODUCT_SHELL_HEADER]: "1" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("still returns 410 for a product URL that copies the shell header", async () => {
    const response = await proxy(
      new NextRequest("http://0.0.0.0:3000/products", {
        headers: {
          "x-forwarded-proto": "https",
          host: "0.0.0.0:3000",
          [RETIRED_PRODUCT_SHELL_HEADER]: "1",
        },
      }),
    );
    expect(response.status).toBe(410);
    const html = await response.text();
    expect(html).toContain("밈상품 페이지는 더 이상 운영하지 않아요.");
    expect(html).not.toContain("0.0.0.0");
  });

  it("returns 404 for a non-English tombstone URL", async () => {
    const response = await proxy(request("/ja/retired-products"));
    expect(response.status).toBe(404);
  });

  it("returns the full page for X-Forwarded-Proto https without calling the bind host", async () => {
    const fullPage = `<!DOCTYPE html><html><head><link rel="stylesheet" href="/_next/static/css/app.css" /></head><body><header>밈캐치</header><main><h1>밈상품 페이지는 더 이상 운영하지 않아요.</h1><a href="/explore">밈 탐색</a><ul><li>새우 예수</li><li>치맥</li><li>꼰대</li><li>갑툭튀</li></ul></main></body></html>`;
    const seen: string[] = [];
    const response = await retiredProductDocument(
      forwardedProducts(),
      "ko",
      async (url) => {
        seen.push(url.toString());
        return { status: 200, html: fullPage };
      },
    );
    const html = await response.text();

    expect(retiredProductLoopbackUrl(forwardedProducts(), "ko")).toBe(
      "http://127.0.0.1:3000/retired-products",
    );
    expect(seen).toEqual(["http://127.0.0.1:3000/retired-products"]);
    expect(response.status).toBe(410);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain("밈캐치");
    expect(html).toContain("새우 예수");
    expect(html).toContain("갑툭튀");
    expect(html).not.toContain("0.0.0.0");
    expect(html.length).toBeGreaterThan(200);
    const documentSource = readFileSync(
      join(process.cwd(), "lib/retired-product-document.ts"),
      "utf8",
    );
    expect(documentSource).not.toContain("node:https");
    expect(documentSource).not.toContain("nextUrl.origin");
  });

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
    expect(source).toContain("skipTrailingSlashRedirect: true");
    const redirects = source.slice(source.indexOf("async redirects"));
    expect(redirects.indexOf("EN_PRODUCT_GONE_REDIRECTS")).toBeLessThan(
      redirects.indexOf("DEFAULT_TRAILING_SLASH_REDIRECT"),
    );
  });

  it("sends /en/products/ to /en before the trailing-slash strip", () => {
    expect(EN_PRODUCT_GONE_REDIRECTS.map((rule) => rule.source)).toEqual([
      "/en/products",
      "/en/products/",
      "/en/products/:path+",
      "/en/products/:path+/",
    ]);
    expect(EN_PRODUCT_GONE_REDIRECTS.every((rule) => rule.destination === "/en")).toBe(true);
    expect(DEFAULT_TRAILING_SLASH_REDIRECT).toEqual({
      source: "/:path+/",
      destination: "/:path+",
      permanent: true,
    });
  });

  it("does not schedule the adpick hotdeal cron", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons.map((cron) => cron.path)).not.toContain("/api/cron/adpick-hotdeals");
    expect(config.crons).toContainEqual({
      path: "/api/cron/trend-pulse",
      schedule: "0 18 * * *",
    });
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
