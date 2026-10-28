import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../public/paddle-review/", import.meta.url);
const pages = ["index.html", "product.html", "pricing.html", "terms.html", "privacy.html", "refund.html"];

async function page(name) {
  return readFile(new URL(name, root), "utf8");
}

test("every Paddle review page exposes product, pricing, and required policy navigation", async () => {
  for (const name of pages) {
    const html = await page(name);
    assert.match(html, /href="\/product"/);
    assert.match(html, /href="\/pricing"/);
    assert.match(html, /href="\/terms"/);
    assert.match(html, /href="\/privacy"/);
    assert.match(html, /href="\/refund"/);
    assert.match(html, /toris@toris\.kr/);
    assert.match(html, /<link rel="canonical" href="https:\/\/plus\.catchmeme\.com\//);
  }
});

test("pricing describes a specific hosted software license and does not imply auto-renewal", async () => {
  const html = await page("pricing.html");
  assert.match(html, /\$10/);
  assert.match(html, /30 days/);
  assert.match(html, /one-time 30-day access license/);
  assert.match(html, /does not renew automatically/);
  assert.match(html, /hosted application/i);
});

test("supplier, refund, privacy, and delivery disclosures are present", async () => {
  const [terms, privacy, refund, pricing] = await Promise.all([
    page("terms.html"),
    page("privacy.html"),
    page("refund.html"),
    page("pricing.html"),
  ]);
  assert.match(terms, /Supplier: Toris/);
  assert.match(terms, /Paddle will act as Merchant of Record/);
  assert.match(privacy, /Information we process/);
  assert.match(privacy, /Complete payment card details are not stored/);
  assert.match(refund, /paddle\.net/);
  assert.match(refund, /14-day statutory withdrawal right/);
  assert.match(pricing, /After a completed purchase/);
});

test("Vercel isolates the review host from the main MemeCatch application", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const hostRules = config.rewrites.filter((rule) =>
    rule.has?.some((condition) => condition.type === "host" && condition.value === "plus.catchmeme.com"),
  );
  assert.equal(hostRules[0].source, "/");
  assert.equal(hostRules[0].destination, "/paddle-review/index.html");
  assert.deepEqual(
    new Set(hostRules.map((rule) => rule.source)),
    new Set(["/", "/product", "/pricing", "/terms", "/privacy", "/refund", "/robots.txt", "/sitemap.xml", "/review.css", "/:path*"]),
  );
  assert.equal(hostRules.at(-1).destination, "/paddle-review/404.html");
});
