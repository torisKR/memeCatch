import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <TArgs extends readonly object[], TResult>(fn: (...args: TArgs) => TResult) => {
    const roots = new WeakMap<object, unknown>();
    return (...args: TArgs): TResult => {
      let node = roots;
      for (let index = 0; index < args.length - 1; index += 1) {
        const argument = args[index];
        let child = node.get(argument) as WeakMap<object, unknown> | undefined;
        if (!child) {
          child = new WeakMap<object, unknown>();
          node.set(argument, child);
        }
        node = child;
      }
      const last = args.at(-1)!;
      if (node.has(last)) return node.get(last) as TResult;
      const result = fn(...args);
      node.set(last, result);
      return result;
    };
  },
}));
import {
  filterPublicMemeMedia,
  filterPublicSourceLinks,
  getPublicMemeMedia,
} from "./public-links.server";
import { resolveMemeDelivery } from "@/lib/meme-delivery";

function adminWith(rows: Array<Record<string, unknown>>, error: { message?: string } | null = null) {
  const query = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    or: vi.fn(),
    limit: vi.fn(),
  };
  const from = vi.fn(() => {
    const state = {
      equals: new Map<string, unknown>(),
      in: new Map<string, readonly string[]>(),
      nulls: new Set<string>(),
      tiktokIds: null as Set<string> | null,
      limit: null as number | null,
    };
    const execute = () => {
      let data = rows.filter((row) => {
        for (const [column, value] of state.equals) if (row[column] !== value) return false;
        for (const [column, values] of state.in) if (!values.includes(String(row[column]))) return false;
        for (const column of state.nulls) if (row[column] !== null) return false;
        if (state.tiktokIds) {
          const match = typeof row.canonical_url === "string"
            ? row.canonical_url.match(/^https:\/\/www\.tiktok\.com\/@[^/]+\/video\/(\d{10,25})(?:[/?].*)?$/)
            : null;
          if (!match || !state.tiktokIds.has(match[1])) return false;
        }
        return true;
      });
      if (state.limit !== null) data = data.slice(0, state.limit);
      return { data, error };
    };
    const builder = {
      select: (columns: string) => {
        query.select(columns);
        return builder;
      },
      in: (column: string, values: readonly string[]) => {
        query.in(column, values);
        state.in.set(column, values);
        return builder;
      },
      eq: (column: string, value: string) => {
        query.eq(column, value);
        state.equals.set(column, value);
        return builder;
      },
      is: (column: string, value: null) => {
        query.is(column, value);
        state.nulls.add(column);
        return builder;
      },
      or: (filters: string) => {
        query.or(filters);
        state.tiktokIds = new Set([...filters.matchAll(/\/video\/(\d{10,25})%/g)].map((match) => match[1]));
        return builder;
      },
      limit: (count: number) => {
        query.limit(count);
        state.limit = count;
        return builder;
      },
      then: <TResult1 = { data: Array<Record<string, unknown>>; error: { message?: string } | null }, TResult2 = never>(
        onfulfilled?: ((value: { data: Array<Record<string, unknown>>; error: { message?: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) => Promise.resolve(execute()).then(onfulfilled, onrejected),
    };
    return builder;
  });
  return { from, query };
}

describe("filterPublicSourceLinks", () => {
  it("starts independent external-id and nullable-canonical ledger reads together", async () => {
    type Result = { data: Array<Record<string, unknown>>; error: null };
    const pending: Array<{ kind: string; resolve: (result: Result) => void }> = [];
    const started: string[] = [];
    const admin = {
      from: vi.fn(() => {
        let kind = "unknown";
        const builder = {
          select: () => builder,
          in: (column: string) => {
            kind = column;
            return builder;
          },
          eq: () => builder,
          is: () => builder,
          or: () => builder,
          limit: () => builder,
          then: <TResult1 = Result, TResult2 = never>(
            onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ) => {
            started.push(kind);
            return new Promise<Result>((resolve) => pending.push({ kind, resolve }))
              .then(onfulfilled, onrejected);
          },
        };
        return builder;
      }),
    };
    const content = {
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      platform: "youtube",
      content_id: "abcdefghijk",
    };

    const resultPromise = filterPublicMemeMedia({ sources: [], contents: [content] }, admin as never);
    await vi.waitFor(() => {
      expect(started).toEqual(expect.arrayContaining(["external_id", "canonical_url"]));
    });
    expect(pending).toHaveLength(2);
    for (const query of pending) query.resolve({ data: [], error: null });

    await expect(resultPromise).resolves.toEqual({ sources: [], contents: [content] });
  });

  it("deduplicates the same source and content arrays within one render cache", async () => {
    const adminFactory = adminWith([]);
    const sources = [{ source_url: "https://www.youtube.com/watch?v=abcdefghijk" }];
    const contents = [{
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      platform: "youtube",
      content_id: "abcdefghijk",
    }];
    const originalFrom = adminFactory.from;

    const first = getPublicMemeMedia(sources, contents, adminFactory as never);
    const second = getPublicMemeMedia(sources, contents, adminFactory as never);

    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ sources, contents });
    expect(originalFrom).toHaveBeenCalledTimes(2);
  });

  it("hides explicit private, unlisted, and removed sources while preserving unknown states", async () => {
    const admin = adminWith([
      { platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", public_status: "private", removed_at: null },
      { platform: "youtube", external_id: "12345678901", canonical_url: "https://www.youtube.com/watch?v=12345678901", public_status: "private", removed_at: null },
      { platform: "youtube_shorts", external_id: "lmnopqrstuv", canonical_url: "https://www.youtube.com/shorts/lmnopqrstuv", public_status: "public", removed_at: "2026-10-14T00:00:00Z" },
      { platform: "instagram", external_id: "AbCdEfGhI", canonical_url: "https://www.instagram.com/reel/AbCdEfGhI/", public_status: "unlisted", removed_at: null },
      { platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@x/video/1234567890", public_status: "unknown", removed_at: null },
    ]);
    const sources = [
      { source_url: "https://youtu.be/abcdefghijk?si=tracking" },
      { source_url: "https://www.youtube.com/shorts/lmnopqrstuv?utm_source=x" },
      { source_url: "https://www.instagram.com/reel/AbCdEfGhI/?utm_source=x" },
      { source_url: "https://www.tiktok.com/@x/video/1234567890?lang=ko" },
      { source_url: "https://example.com/reference" },
    ];
    await expect(filterPublicSourceLinks(sources, admin as never)).resolves.toEqual([sources[3], sources[4]]);
    expect(admin.query.select).toHaveBeenCalledWith("platform,external_id,canonical_url,public_status,embeddable,removed_at");
  });

  it("keeps link-only citations and never hides on ledger errors", async () => {
    const source = { source_url: "https://www.youtube.com/watch?v=abcdefghijk" };
    const admin = adminWith([], { message: "temporary database failure" });
    await expect(filterPublicSourceLinks([source], admin as never)).resolves.toEqual([source]);
  });

  it("matches YouTube watch/shorts and Instagram p/reel identities, but not another platform", async () => {
    const admin = adminWith([
      { platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", public_status: "private", removed_at: null },
      { platform: "instagram", external_id: "AbCdEfGhI", canonical_url: "https://www.instagram.com/p/AbCdEfGhI/", public_status: "public", removed_at: "2026-10-14T00:00:00Z" },
    ]);
    const watch = { source_url: "https://www.youtube.com/shorts/abcdefghijk" };
    const reel = { source_url: "https://www.instagram.com/reel/AbCdEfGhI/" };
    const wrongPlatform = { source_url: "https://www.tiktok.com/@x/video/12345678901" };
    await expect(filterPublicSourceLinks([watch, reel, wrongPlatform], admin as never)).resolves.toEqual([wrongPlatform]);
  });

  it("filters private ledger media and its link-only citation together", async () => {
    const admin = adminWith([
      { platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", public_status: "private", removed_at: null },
    ]);
    const source = { source_url: "https://www.youtube.com/watch?v=abcdefghijk" };
    const content = { url: "https://www.youtube.com/shorts/abcdefghijk", platform: "YouTube Shorts", content_id: "abcdefghijk" };
    await expect(filterPublicMemeMedia({ sources: [source], contents: [content] }, admin as never)).resolves.toEqual({ sources: [], contents: [] });
  });

  it("removes only the non-embeddable content while retaining a legitimate link citation", async () => {
    const admin = adminWith([
      { platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", public_status: "public", embeddable: false, removed_at: null },
    ]);
    const source = { source_url: "https://www.youtube.com/watch?v=abcdefghijk" };
    const content = { id: "embed", url: source.source_url, platform: "YouTube", content_id: "abcdefghijk", availability: "live", moderation_status: "approved", is_representative: true };
    const filtered = await filterPublicMemeMedia({ sources: [source], contents: [content] }, admin as never);
    expect(filtered.sources).toEqual([source]);
    expect(filtered.contents).toEqual([]);
    expect(resolveMemeDelivery({ sources: filtered.sources, contents: filtered.contents }).representative).toBeNull();
  });

  it("rejects a legacy content row when playback content_id conflicts with its URL", async () => {
    const admin = adminWith([
      { platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", public_status: "public", embeddable: true, removed_at: null },
      { platform: "youtube", external_id: "lmnopqrstuv", canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv", public_status: "private", embeddable: false, removed_at: null },
    ]);
    const content = { url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "YouTube", content_id: "lmnopqrstuv", availability: "live", moderation_status: "approved", is_representative: true };
    await expect(filterPublicMemeMedia({ sources: [], contents: [content] }, admin as never)).resolves.toEqual({ sources: [], contents: [] });
  });

  it("uses lowercase URL-less YouTube platform for playback identity", async () => {
    const admin = adminWith([
      { platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", public_status: "private", embeddable: false, removed_at: null },
    ]);
    const content = { url: null, platform: "youtube", content_id: "abcdefghijk", availability: "live", moderation_status: "approved", is_representative: true };
    await expect(filterPublicMemeMedia({ sources: [], contents: [content] }, admin as never)).resolves.toEqual({ sources: [], contents: [] });
  });

  it("checks URL-less Instagram and TikTok content IDs without fabricating public citations", async () => {
    const admin = adminWith([
      { platform: "instagram", external_id: "AbCdEfGhI", canonical_url: "https://www.instagram.com/reel/AbCdEfGhI/", public_status: "private", embeddable: false, removed_at: null },
      { platform: "tiktok", external_id: "1234567890", canonical_url: "https://www.tiktok.com/@creator/video/1234567890", public_status: "public", embeddable: false, removed_at: null },
    ]);
    const contents = [
      { url: null, platform: "instagram", content_id: "AbCdEfGhI", availability: "live", moderation_status: "approved", is_representative: true },
      { url: null, platform: "tiktok", content_id: "1234567890", availability: "live", moderation_status: "approved", is_representative: false },
    ];
    await expect(filterPublicMemeMedia({ sources: [], contents }, admin as never)).resolves.toEqual({ sources: [], contents: [] });
  });

  it("matches nullable legacy rows across canonical YouTube and Instagram URL variants", async () => {
    const admin = adminWith([
      { platform: "youtube_shorts", external_id: null, canonical_url: "https://www.youtube.com/shorts/abcdefghijk", public_status: "private", embeddable: false, removed_at: null },
      { platform: "instagram", external_id: null, canonical_url: "https://www.instagram.com/p/AbCdEfGhI/", public_status: "public", embeddable: true, removed_at: "2026-10-14T00:00:00Z" },
      { platform: "youtube", external_id: null, canonical_url: "https://www.youtube.com/watch?v=zzzzzzzzzzz", public_status: "private", embeddable: false, removed_at: null },
    ]);
    const contents = [
      { url: null, platform: "youtube", content_id: "abcdefghijk", availability: "live", moderation_status: "approved", is_representative: true },
      { url: null, platform: "instagram", content_id: "AbCdEfGhI", availability: "live", moderation_status: "approved", is_representative: false },
    ];
    await expect(filterPublicMemeMedia({ sources: [], contents }, admin as never)).resolves.toEqual({ sources: [], contents: [] });
    expect(admin.query.is).toHaveBeenCalledWith("external_id", null);
    expect(admin.query.in).toHaveBeenCalledWith("canonical_url", expect.arrayContaining([
      "https://www.youtube.com/shorts/abcdefghijk",
      "https://www.instagram.com/p/AbCdEfGhI/",
    ]));
  });

  it("matches a URL-less TikTok ID to a nullable legacy row across creator handles", async () => {
    const admin = adminWith([
      { platform: "tiktok", external_id: null, canonical_url: "https://www.tiktok.com/@actual.creator/video/1234567890", public_status: "public", embeddable: false, removed_at: null },
      { platform: "tiktok", external_id: null, canonical_url: "https://example.com/@actual.creator/video/1234567890", public_status: "private", embeddable: false, removed_at: null },
      { platform: "tiktok", external_id: null, canonical_url: "https://www.tiktok.com/@actual.creator/video/9999999999", public_status: "private", embeddable: false, removed_at: null },
    ]);
    const content = { url: null, platform: "tiktok", content_id: "1234567890", availability: "live", moderation_status: "approved", is_representative: true };
    await expect(filterPublicMemeMedia({ sources: [], contents: [content] }, admin as never)).resolves.toEqual({ sources: [], contents: [] });
    expect(admin.query.eq).toHaveBeenCalledWith("platform", "tiktok");
    expect(admin.query.or).toHaveBeenCalledWith("canonical_url.like.https://www.tiktok.com/@%/video/1234567890%");
    expect(admin.query.limit).toHaveBeenCalledWith(100);
  });

  it("does not trust a nullable row whose declared platform conflicts with its canonical URL", async () => {
    const admin = adminWith([
      { platform: "instagram", external_id: null, canonical_url: "https://www.youtube.com/shorts/abcdefghijk", public_status: "private", embeddable: false, removed_at: null },
    ]);
    const content = { url: null, platform: "youtube", content_id: "abcdefghijk", availability: "live", moderation_status: "approved", is_representative: true };
    await expect(filterPublicMemeMedia({ sources: [], contents: [content] }, admin as never)).resolves.toEqual({ sources: [], contents: [content] });
  });

  it("defers all playback but preserves citations when the source ledger read fails", async () => {
    const admin = adminWith([], { message: "temporary failure" });
    const content = { url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "youtube", content_id: "abcdefghijk", availability: "live", moderation_status: "approved" };
    const citation = { source_url: content.url, title: "Stored citation" };
    const pageDto = { meme: { safety_level: "caution", lifecycle_status: "rising", canonical: "https://catchmeme.com/memes/example" }, sources: [citation], contents: [content] };
    const before = structuredClone(pageDto);
    await expect(filterPublicMemeMedia({ sources: [citation], contents: [content] }, admin as never))
      .resolves.toEqual({ sources: [citation], contents: [] });
    expect(pageDto).toEqual(before);
  });

  it("defers playback when the source ledger transport throws without mutating data", async () => {
    const content = { url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "youtube", content_id: "abcdefghijk", availability: "live", moderation_status: "approved" };
    const source = { source_url: content.url };
    const pageDto = { meme: { safety_level: "safe", lifecycle_status: "evergreen", canonical: "https://catchmeme.com/memes/example" }, sources: [source], contents: [content] };
    const before = structuredClone(pageDto);
    const client = { from() { throw new Error("transport unavailable"); } };
    await expect(filterPublicMemeMedia({ sources: [source], contents: [content] }, client as never))
      .resolves.toEqual({ sources: [source], contents: [] });
    expect(pageDto).toEqual(before);
  });

  it("drops URL/content_id conflicts even when the ledger read fails", async () => {
    const admin = adminWith([], { message: "temporary failure" });
    const content = { url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "youtube", content_id: "lmnopqrstuv", availability: "live", moderation_status: "approved", is_representative: true };
    await expect(filterPublicMemeMedia({ sources: [], contents: [content] }, admin as never)).resolves.toEqual({ sources: [], contents: [] });
  });

  it("treats an explicit YouTube platform/content_id as playback truth when a stale URL points elsewhere", async () => {
    const admin = adminWith([], { message: "temporary failure" });
    const content = { url: "https://www.instagram.com/reel/AbCdEfGhI/", platform: "youtube", content_id: "lmnopqrstuv", availability: "live", moderation_status: "approved", is_representative: true };
    await expect(filterPublicMemeMedia({ sources: [], contents: [content] }, admin as never)).resolves.toEqual({ sources: [], contents: [] });
  });

  it("returns a fresh array and preserves exact DTO fields", async () => {
    const source = { source_url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Citation", note: 7 };
    const admin = adminWith([]);
    const result = await filterPublicSourceLinks([source], admin as never);
    expect(result).toEqual([source]);
    expect(result).not.toBe([source]);
  });
});
