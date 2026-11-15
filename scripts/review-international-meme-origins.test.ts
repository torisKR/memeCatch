import { describe, expect, it, vi } from "vitest";
import {
  ORIGIN_REVIEW_PACK,
  reviewInternationalMemeOrigins,
} from "./review-international-meme-origins.mjs";

type Identity = { userId: string | null; role: string };

/** Minimal plan-client fake: memes lookup by slug and the origin RPC. */
function fakeDb(identity: Identity, writes: Array<{ identity: Identity; args: Record<string, string> }>) {
  return {
    from: () => {
      let slug = "";
      const query = {
        select: () => query,
        eq: (_column: string, value: string) => { slug = value; return query; },
        limit: async () => {
          const candidate = ORIGIN_REVIEW_PACK.find((item) => item.slug === slug);
          return {
            data: candidate ? [{
              id: `meme-${candidate.slug}`,
              slug: candidate.slug,
              title: candidate.localTitle,
              meme_sources: [{ id: `source-${candidate.slug}`, source_url: candidate.evidenceUrl }],
            }] : [],
            error: null,
          };
        },
      };
      return query;
    },
    rpc: async (_name: string, args: Record<string, string>) => {
      writes.push({ identity, args });
      return { data: true, error: null };
    },
  };
}

describe("international origin review pack", () => {
  it("validates 10-20 evidence-backed overseas memes without writing in dry-run mode", async () => {
    expect(ORIGIN_REVIEW_PACK.length).toBeGreaterThanOrEqual(10);
    expect(ORIGIN_REVIEW_PACK.length).toBeLessThanOrEqual(20);
    expect(new Set(ORIGIN_REVIEW_PACK.map((item) => item.country)).size).toBeGreaterThanOrEqual(5);

    const writes: Array<{ identity: Identity; args: Record<string, string> }> = [];
    const dbFor = vi.fn(async (identity: Identity) => fakeDb(identity, writes));
    await expect(reviewInternationalMemeOrigins({
      env: { NODE_ENV: "test", DATABASE_URL: "postgres://127.0.0.1:5432/memecatch" } as NodeJS.ProcessEnv,
      argv: ["--json"],
      dbFor: dbFor as never,
    })).resolves.toEqual({
      mode: "dry-run",
      remote: false,
      reviewed: ORIGIN_REVIEW_PACK.length,
      countries: { BR: 1, JP: 6, US: 4, CN: 1, TW: 1 },
    });
    expect(dbFor).toHaveBeenCalledTimes(1);
    expect(dbFor).toHaveBeenCalledWith({ userId: null, role: "anon", anonymous: false });
    expect(writes).toHaveLength(0);
  });

  it("requires explicit remote confirmation and an operator id before writing", async () => {
    const env = { NODE_ENV: "test", DATABASE_URL: "postgres://db.internal:5432/memecatch" } as NodeJS.ProcessEnv;
    await expect(reviewInternationalMemeOrigins({ env, argv: ["--apply"], dbFor: vi.fn() }))
      .rejects.toThrow("remote apply requires --confirm-remote");
    await expect(reviewInternationalMemeOrigins({ env, argv: ["--apply", "--confirm-remote"], dbFor: vi.fn() }))
      .rejects.toThrow("MEMECATCH_OPERATOR_USER_ID is required");
  });

  it("writes the matched evidence source id as the operator identity", async () => {
    const writes: Array<{ identity: Identity; args: Record<string, string> }> = [];
    await reviewInternationalMemeOrigins({
      env: {
        NODE_ENV: "test",
        DATABASE_URL: "postgres://localhost:5432/memecatch",
        MEMECATCH_OPERATOR_USER_ID: "operator-1",
      } as NodeJS.ProcessEnv,
      argv: ["--apply"],
      dbFor: (async (identity: Identity) => fakeDb(identity, writes)) as never,
    });

    expect(writes).toHaveLength(ORIGIN_REVIEW_PACK.length);
    expect(writes[0].identity).toMatchObject({ userId: "operator-1", role: "authenticated" });
    expect(writes[0].args).toMatchObject({
      p_meme_id: `meme-${ORIGIN_REVIEW_PACK[0].slug}`,
      p_market_code: ORIGIN_REVIEW_PACK[0].country,
      p_evidence_source_id: `source-${ORIGIN_REVIEW_PACK[0].slug}`,
    });
  });
});
