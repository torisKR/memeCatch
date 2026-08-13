import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260813120000_ai_meme_topic_seed.sql"),
  "utf8",
);

const slugs = [
  "italian-brainrot",
  "tralalero-tralala",
  "ballerina-cappuccina",
  "ai-slop",
  "shrimp-jesus",
] as const;

describe("AI meme topic seed migration contract", () => {
  it("is transactional and replay-safe across every seeded relation", () => {
    expect(sql.trimStart().startsWith("begin;")).toBe(true);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).toContain("on conflict (slug) do update");
    expect(sql).toContain("on conflict (name) do nothing");
    expect(sql).toContain("on conflict (meme_id, tag_id) do nothing");
    expect(sql).toContain("AI meme seed cannot republish a rejected record");
    expect(sql).toMatch(/moderation_status = 'fact_checking'[\s\S]*moderation_status = 'rights_checking'/i);
    expect(sql).toMatch(/meme_contents existing[\s\S]*existing\.thumbnail_url = seed\.image_path/i);
    expect(sql).toMatch(/meme_sources existing[\s\S]*existing\.source_url = source\.source_url/i);
  });

  it("seeds exactly the five approved or limited phrase/image entries", () => {
    for (const slug of slugs) {
      expect(sql).toContain(`'${slug}'`);
      expect(sql).toContain(`/ai-memes/${slug}.jpg`);
    }
    expect(sql).toContain("'image', 'yellow', 'limited'");
    expect(sql).toContain("'phrase', 'yellow', 'approved'");
    expect(sql).toContain("'image', 'gray', 'limited'");
    expect(sql).not.toMatch(/alter type\s+public\.meme_category/i);
  });

  it("gives every entry the AI topic tag and at least three curated tags", () => {
    const aiTopicOccurrences = sql.match(/array\['AI 밈'/g) ?? [];
    expect(aiTopicOccurrences).toHaveLength(5);
    expect(sql).toContain("cross join lateral unnest(seed.tags) tag_name");
    expect(sql).toContain("insert into public.meme_tags_map");
  });

  it("filters AI search inside SQL instead of joining relations onto an RPC result", () => {
    expect(sql).toContain("function public.search_ai_memes");
    expect(sql).toContain("tag.name = 'AI 밈'");
    expect(sql).toContain(
      "grant execute on function public.search_ai_memes(text, int) to anon, authenticated",
    );
  });

  it("publishes one live approved project-local representative per entry", () => {
    expect(sql).toContain("'^/ai-memes/[a-z0-9-]+\\.jpg$'");
    expect(sql).toMatch(/'image', 'MemeCatch'[\s\S]*true, 'live', 'approved'/i);
    expect(sql).toMatch(/set is_representative = false[\s\S]*thumbnail_url is distinct from seed\.image_path/i);
    expect(sql).not.toMatch(/https?:\/\/[^']+\.(?:png|jpe?g|webp)/i);
  });

  it("uses stable context citations with an explicit non-unknown rights state", () => {
    for (const url of [
      "https://apnews.com/article/7600d1faea12be53609f3c2092e02eb7",
      "https://www.nytimes.com/2025/04/30/style/italian-brain-rot-ballerina-cappuccina.html",
      "https://www.merriam-webster.com/dictionary/slop",
      "https://fsi.stanford.edu/news/ai-spam-accounts-build-followers",
    ]) {
      expect(sql).toContain(url);
    }
    expect(sql).toContain("source.creator_name, 'permission_needed'");
    expect(sql).not.toMatch(/source\.creator_name,\s*'unknown'/i);
  });

  it("keeps uncertain origins cautious and records safety, IP, and religious context", () => {
    for (const phrase of [
      "확정하기는 어렵다",
      "확정적 원작자로 표기하지 않고",
      "저작권 문제",
      "종교적 맥락",
      "스팸·스캠",
    ]) {
      expect(sql).toContain(phrase);
    }
  });
});
