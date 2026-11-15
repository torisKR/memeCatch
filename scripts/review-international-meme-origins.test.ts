import { describe, expect, it, vi } from "vitest";
import {
  ORIGIN_REVIEW_PACK,
  reviewInternationalMemeOrigins,
} from "./review-international-meme-origins.mjs";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("international origin review pack", () => {
  it("validates 10-20 evidence-backed overseas memes without writing in dry-run mode", async () => {
    expect(ORIGIN_REVIEW_PACK.length).toBeGreaterThanOrEqual(10);
    expect(ORIGIN_REVIEW_PACK.length).toBeLessThanOrEqual(20);
    expect(new Set(ORIGIN_REVIEW_PACK.map((item) => item.country)).size).toBeGreaterThanOrEqual(5);

    const fetchImpl = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      expect(init.method).toBeUndefined();
      const slugFilter = new URL(input instanceof Request ? input.url : input.toString())
        .searchParams.get("slug");
      const candidate = ORIGIN_REVIEW_PACK.find((item) => `eq.${item.slug}` === slugFilter);
      if (!candidate) return response([], 404);
      return response([{
        id: `meme-${candidate.slug}`,
        slug: candidate.slug,
        title: candidate.localTitle,
        meme_sources: [{ id: `source-${candidate.slug}`, source_url: candidate.evidenceUrl }],
      }]);
    });

    await expect(reviewInternationalMemeOrigins({
      env: {
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
      },
      argv: ["--json"],
      fetchImpl,
    })).resolves.toEqual({
      mode: "dry-run",
      remote: false,
      reviewed: ORIGIN_REVIEW_PACK.length,
      countries: { BR: 1, JP: 6, US: 4, CN: 1, TW: 1 },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(ORIGIN_REVIEW_PACK.length);
  });

  it("requires explicit remote confirmation and an operator JWT before writing", async () => {
    await expect(reviewInternationalMemeOrigins({
      env: {
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
      },
      argv: ["--apply"],
      fetchImpl: vi.fn(),
    })).rejects.toThrow("remote apply requires --confirm-remote");

    await expect(reviewInternationalMemeOrigins({
      env: {
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
      },
      argv: ["--apply", "--confirm-remote"],
      fetchImpl: vi.fn(),
    })).rejects.toThrow("MEMECATCH_OPERATOR_JWT is required");
  });

  it("writes the matched evidence source id through the operator-only resolver", async () => {
    const writes: Array<Record<string, string>> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith("/rpc/set_meme_origin_country_with_evidence")) {
        writes.push(JSON.parse(String(init.body)) as Record<string, string>);
        return response({ ok: true });
      }
      const slugFilter = url.searchParams.get("slug");
      const candidate = ORIGIN_REVIEW_PACK.find((item) => `eq.${item.slug}` === slugFilter);
      if (!candidate) return response([], 404);
      return response([{
        id: `meme-${candidate.slug}`,
        slug: candidate.slug,
        title: candidate.localTitle,
        meme_sources: [{ id: `source-${candidate.slug}`, source_url: candidate.evidenceUrl }],
      }]);
    });

    await reviewInternationalMemeOrigins({
      env: {
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
        MEMECATCH_OPERATOR_JWT: "operator-test",
      },
      argv: ["--apply"],
      fetchImpl,
    });

    expect(writes).toHaveLength(ORIGIN_REVIEW_PACK.length);
    expect(writes[0]).toMatchObject({
      p_meme_id: `meme-${ORIGIN_REVIEW_PACK[0].slug}`,
      p_market_code: ORIGIN_REVIEW_PACK[0].country,
      p_evidence_source_id: `source-${ORIGIN_REVIEW_PACK[0].slug}`,
    });
  });
});
