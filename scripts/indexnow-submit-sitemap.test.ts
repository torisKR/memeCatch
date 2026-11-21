import { describe, expect, it, vi } from "vitest";
import { parseArgs, run } from "./indexnow-submit-sitemap.mjs";
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from "@/lib/indexnow";

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://catchmeme.com</loc></url>
<url><loc>https://catchmeme.com/memes/a-b</loc></url>
<url><loc>https://www.catchmeme.com/memes/c</loc></url>
</urlset>`;

function fakeFetch(keyBody = INDEXNOW_KEY) {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/sitemap.xml")) return new Response(SITEMAP, { status: 200 });
    if (url === INDEXNOW_KEY_LOCATION) return new Response(keyBody, { status: 200 });
    if (url === INDEXNOW_ENDPOINT) return new Response(null, { status: 200 });
    return new Response(null, { status: 404 });
  });
}

describe("indexnow-submit-sitemap", () => {
  it("defaults to a dry run against the live sitemap", () => {
    expect(parseArgs([])).toMatchObject({ apply: false, sitemap: "https://catchmeme.com/sitemap.xml" });
    expect(parseArgs(["--apply"]).apply).toBe(true);
    expect(() => parseArgs(["--bogus"])).toThrow(/Unknown option/);
  });

  it("does not POST without --apply", async () => {
    const fetchImpl = fakeFetch();
    const log = vi.fn();
    const result = await run([], { fetchImpl: fetchImpl as unknown as typeof fetch, log });
    expect(result).toMatchObject({ mode: "dry-run", sitemap_urls: 3, accepted_urls: 2, dropped_urls: 1, requests: 1 });
    expect(fetchImpl.mock.calls.map(([url]) => url)).not.toContain(INDEXNOW_ENDPOINT);
    expect(JSON.stringify(log.mock.calls)).not.toContain(INDEXNOW_KEY);
  });

  it("checks the key file, then submits only apex URLs with --apply", async () => {
    const fetchImpl = fakeFetch();
    const log = vi.fn();
    await run(["--apply"], { fetchImpl: fetchImpl as unknown as typeof fetch, log });
    const post = fetchImpl.mock.calls.find(([url]) => url === INDEXNOW_ENDPOINT) as unknown as [string, RequestInit];
    expect(JSON.parse(String(post[1].body)).urlList).toEqual([
      "https://catchmeme.com/",
      "https://catchmeme.com/memes/a-b",
    ]);
    expect(JSON.stringify(log.mock.calls)).not.toContain(INDEXNOW_KEY);
  });

  it("refuses to submit before the key file is live", async () => {
    const fetchImpl = fakeFetch("wrong");
    await expect(run(["--apply"], { fetchImpl: fetchImpl as unknown as typeof fetch, log: vi.fn() })).rejects.toThrow(/key file/);
    expect(fetchImpl.mock.calls.map(([url]) => url)).not.toContain(INDEXNOW_ENDPOINT);
  });
});
