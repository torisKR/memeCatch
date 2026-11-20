import { describe, expect, it } from "vitest";
import { buildEnrichmentSql, proseChars, validateEnrichmentBatch } from "./enrich-public-memes.mjs";

const text = (n: number, ch = "가") => ch.repeat(n);

function meme(over: Record<string, unknown> = {}) {
  return {
    short_id: "abcd1234",
    slug: "샘플-밈",
    title: "샘플 밈",
    description: text(220),
    origin: text(90, "나"),
    usage_note: text(60, "다"),
    caution: text(50, "라"),
    usage_examples: [
      { situation: "단톡방", text: "샘플 밈이네" },
      { situation: "SNS 캡션", text: "오늘도 샘플 밈" },
    ],
    sources: [
      { url: "https://www.yna.co.kr/view/AKR001", title: "기사 A", publisher: "예시일보" },
      { url: "https://www.hani.co.kr/arti/1001", title: "기사 B", publisher: "예시신문" },
    ],
    ...over,
  };
}

function batch(memes = [meme()]) {
  return { batch_id: "enrich-test", checked_at: "2026-11-20", memes, dropped: [] };
}

describe("proseChars", () => {
  it("counts prose the way lib/content-depth.ts does", () => {
    // usage_note and caution under 40 characters do not count.
    expect(proseChars(meme({ usage_note: text(39), caution: text(10) }))).toBe(220 + 90 + 3 + 6 + 6 + 8);
    expect(proseChars(meme())).toBe(220 + 90 + 60 + 50 + 3 + 6 + 6 + 8);
  });

  it("does not count the shared Wikimedia boilerplate origin", () => {
    expect(proseChars(meme({ origin: "공개 Wikimedia 기록을 바탕으로 정리했다" }))).toBe(220 + 60 + 50 + 3 + 6 + 6 + 8);
  });
});

describe("validateEnrichmentBatch", () => {
  it("accepts a complete record", () => {
    expect(validateEnrichmentBatch(batch())).toEqual([]);
  });

  it("rejects prose under the 250-character listing floor", () => {
    const errors = validateEnrichmentBatch(batch([meme({ description: text(30), origin: text(30), usage_note: "", caution: "" })]));
    expect(errors.join("\n")).toMatch(/250/);
  });

  it("requires two usage examples and two distinct https sources", () => {
    const errors = validateEnrichmentBatch(batch([meme({
      usage_examples: [{ situation: "단톡방", text: "하나뿐" }],
      sources: [
        { url: "https://www.yna.co.kr/view/AKR001", title: "A", publisher: "P" },
        { url: "https://www.yna.co.kr/view/AKR001/", title: "A again", publisher: "P" },
      ],
    })]));
    expect(errors.join("\n")).toMatch(/usage_examples/);
    expect(errors.join("\n")).toMatch(/sources/);
  });

  it("rejects self links, blocked hosts, and non-https sources", () => {
    for (const url of ["https://catchmeme.com/memes/x", "https://namu.wiki/w/x", "http://news.example.com/a", "javascript:alert(1)"]) {
      const errors = validateEnrichmentBatch(batch([meme({
        sources: [{ url, title: "t", publisher: "p" }, { url: "https://www.hani.co.kr/arti/1001", title: "B", publisher: "P" }],
      })]));
      expect(errors.length, url).toBeGreaterThan(0);
    }
  });

  it("rejects duplicate short ids and malformed ids", () => {
    expect(validateEnrichmentBatch(batch([meme(), meme()])).join("\n")).toMatch(/duplicate/);
    expect(validateEnrichmentBatch(batch([meme({ short_id: "BAD" })])).join("\n")).toMatch(/short_id/);
  });
});

describe("buildEnrichmentSql", () => {
  const options = { reviewedAt: "2026-11-20T18:00:00+09:00" };

  it("updates only the public row by short id and slug, and never touches status or publish date", () => {
    const sql = buildEnrichmentSql(batch(), options);
    expect(sql).toContain("where short_id = 'abcd1234'");
    expect(sql).toContain("and slug = '샘플-밈'");
    expect(sql).toContain("moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status)");
    expect(sql).not.toMatch(/moderation_status\s*=/i);
    expect(sql).not.toMatch(/published_at\s*=/i);
    expect(sql).not.toMatch(/\bdelete\b|\bbegin;|\bcommit;/i);
  });

  it("adds a source only when that url is not already on the meme", () => {
    const sql = buildEnrichmentSql(batch(), options);
    expect(sql.match(/insert into public\.meme_sources/g)).toHaveLength(2);
    expect(sql).toContain("existing.source_url = 'https://www.yna.co.kr/view/AKR001'");
  });

  it("keeps safety_reviewed_at and records the review date", () => {
    const sql = buildEnrichmentSql(batch(), options);
    expect(sql.indexOf("create temporary table")).toBeLessThan(sql.indexOf("update public.memes set"));
    expect(sql).toContain("set safety_reviewed_at = backup.safety_reviewed_at");
    expect(sql).toContain("content_reviewed_at = '2026-11-20T18:00:00+09:00'::timestamptz");
  });

  it("escapes quotes in text and json", () => {
    const sql = buildEnrichmentSql(batch([meme({
      description: `${text(220)} 'quoted'`,
      usage_examples: [
        { situation: "it's", text: "say \"hi\"" },
        { situation: "둘", text: "둘째" },
      ],
    })]), options);
    expect(sql).toContain("''quoted''");
    expect(sql).toContain(`"situation":"it''s"`);
  });

  it("refuses to build SQL for an invalid batch", () => {
    expect(() => buildEnrichmentSql(batch([meme({ description: "" })]), options)).toThrow();
  });
});
