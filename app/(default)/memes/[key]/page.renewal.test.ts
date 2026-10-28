import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/(default)/memes/[key]/page.tsx"),
  "utf-8",
);

describe("meme detail renewal", () => {
  it("keeps usage before media and the optional explanation without an auth promotion", () => {
    const about = source.indexOf('id="meme-story"');
    const usageExamples = source.indexOf("<UsageExamples");

    expect(about).toBeGreaterThan(-1);
    expect(usageExamples).toBeGreaterThan(-1);
    expect(usageExamples).toBeLessThan(about);
    expect(usageExamples).toBeLessThan(source.indexOf("<MemeEmbed"));
    expect(source).not.toContain("<AuthInvite");
  });

  it("keeps the answer visible and secondary prose and sources in native disclosures", () => {
    expect(source).toContain("<MemeDetailNavigation");
    expect(source).toContain('label="밈 내용 바로가기"');
    expect(source).toContain('id="meme-media"');
    expect(source).toContain('id="meme-examples"');
    expect(source).toMatch(/<details\s+id="meme-story"/);
    expect(source).not.toMatch(/<details\s+open\s+id="meme-story"/);
    expect(source).toContain('id="meme-sources"');
    expect(source).toContain("const hasUsageExamples = parseUsageExamples(usageExamples).length > 0;");
    expect(source).toContain("const hasCitableSources = citableSources(originalSources).length > 0;");
    expect(source).not.toContain("defaultOpen");
    expect(source).toContain('id="meme-story" tabIndex={-1}');
    expect(source.indexOf('{ id: "meme-examples", label:')).toBeLessThan(source.indexOf('{ id: "meme-media", label:'));
    expect(source).toContain("<AnswerCard meme={answerCardMeme}");
    expect(source).toContain("{readerDescription}</p>");
  });

  it("uses the public origin heading instead of the private editor label", () => {
    expect(source).toContain("{publicOriginSectionHeading(meme.origin_kind)}");
    expect(source).not.toMatch(/<h3[^>]*>\s*어디서 시작됐어요\?/);
  });

  it("uses aboutSectionHeading for sr-only about h2 and page metadata, not hardcoded folk 유래", () => {
    expect(source).toContain("{aboutSectionHeading(meme.origin_kind)}");
    expect(source).toContain("memeDetailMetadataDescription(");
    expect(source).not.toMatch(/<h2[^>]*>\s*뜻과 유래/);
    expect(source).not.toContain("뜻과 유래 ·");
  });

  it("keeps social examples separate from reviewed secondary-reference performances", () => {
    expect(source).toContain("const relatedSocialContents = liveContents");
    expect(source).toContain('["tiktok", "instagram"]');
    expect(source).toContain("const secondaryReferenceContents = selectSecondaryReferenceContents({");
    expect(source).toContain("검수된 참고 영상");
    expect(source).toContain("이해를 돕는 보조 자료이며, 챌린지 원본이나 독립 확산 근거가 아닙니다.");
    expect(source.indexOf("다른 사용 영상")).toBeLessThan(source.indexOf("검수된 참고 영상"));
  });
});
