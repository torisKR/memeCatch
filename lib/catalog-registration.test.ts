import { describe, expect, it } from "vitest";
import {
  catalogRegistrationSchema,
  normalizeCatalogRegistration,
  normalizeCatalogSourceUrl,
} from "./catalog-registration";

const input = {
  registrationKey: "10000000-0000-4000-8000-000000000001",
  title: "Distracted Boyfriend",
  aliases: ["Disloyal Man"],
  summary: "다른 대상을 보고 한눈파는 상황을 표현하는 이미지 밈이에요.",
  description: "세 사람이 등장하는 스톡 사진을 맥락에 맞게 라벨링해 사용해요.",
  origin: "스톡 사진이 온라인 커뮤니티에서 템플릿으로 확산됐어요.",
  sourceWorkYear: 2015,
  memeFirstSeenYear: 2017,
  koreaViralYear: 2017,
  yearPrecision: "year" as const,
  tags: ["Reaction", "reaction"],
  safetyLevel: "yellow" as const,
  category: "image" as const,
  difficulty: "beginner" as const,
  sentiment: "funny" as const,
  usageContext: { work: "yellow", friends: "green", family: "green", sns: "green" } as const,
  sources: [
    {
      url: "https://archive.org/details/original#photo",
      platform: "web" as const,
      sourceRole: "original" as const,
      rightsBasis: "link_only" as const,
      reviewNote: "원작 페이지 확인",
    },
    {
      url: "https://knowyourmeme.com/memes/distracted-boyfriend",
      platform: "web" as const,
      sourceRole: "secondary_reference" as const,
      rightsBasis: "link_only" as const,
      reviewNote: "확산 시기 교차 확인",
    },
  ],
};

describe("catalog registration contract", () => {
  it("normalizes safe HTTPS URLs and deduplicates tags", () => {
    const parsed = normalizeCatalogRegistration(input);
    expect(parsed.sources[0].url).toBe("https://archive.org/details/original");
    expect(parsed.tags).toEqual(["reaction"]);
  });

  it("rejects script URLs, credential-bearing URLs, and duplicate sources", () => {
    expect(normalizeCatalogSourceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeCatalogSourceUrl("https://user:pass@archive.org/a")).toBeNull();
    expect(normalizeCatalogSourceUrl("https://127.0.0.1/source")).toBeNull();
    expect(normalizeCatalogSourceUrl("https://internal/source")).toBeNull();
    const result = catalogRegistrationSchema.safeParse({
      ...input,
      sources: [input.sources[0], { ...input.sources[1], url: input.sources[0].url }],
    });
    expect(result.success).toBe(false);
  });

  it("requires distinct provenance and verification roles", () => {
    const result = catalogRegistrationSchema.safeParse({
      ...input,
      sources: input.sources.map((source, index) => ({
        ...source,
        url: `https://archive.org/details/${index}`,
        sourceRole: "usage_example" as const,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a social platform that does not match the source URL", () => {
    const result = catalogRegistrationSchema.safeParse({
      ...input,
      sources: [{ ...input.sources[0], platform: "youtube" as const }, input.sources[1]],
    });
    expect(result.success).toBe(false);
  });
});
