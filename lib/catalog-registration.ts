import { z } from "zod";
import {
  RIGHTS_BASIS,
  SOURCE_ROLES,
} from "@/lib/sources/review";
import { normalizeSourceUrl } from "@/lib/sources/url";
import { publicSourceUrl } from "@/lib/source-links";
import { memeTitleKey } from "../scripts/meme-title-key.mjs";

export const CATALOG_SOURCE_PLATFORMS = [
  "youtube",
  "youtube_shorts",
  "tiktok",
  "instagram",
  "broadcast_archive",
  "public_archive",
  "web",
] as const;

const year = z.number().int().min(1980).max(2100).nullable();
const compactText = (max: number) => z.string().trim().min(1).max(max);

export function normalizeCatalogSourceUrl(raw: string): string | null {
  const social = normalizeSourceUrl(raw);
  if (social) return social.canonicalUrl;

  try {
    const publicUrl = publicSourceUrl(raw);
    if (!publicUrl) return null;
    const url = new URL(publicUrl);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export const catalogSourceSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .max(2_048)
    .refine((value) => normalizeCatalogSourceUrl(value) !== null, {
      message: "최종 HTTPS 공개 URL을 입력해 주세요.",
    }),
  platform: z.enum(CATALOG_SOURCE_PLATFORMS),
  sourceRole: z.enum(SOURCE_ROLES),
  rightsBasis: z.enum(RIGHTS_BASIS),
  externalId: z.string().trim().max(240).optional().default(""),
  title: z.string().trim().max(300).optional().default(""),
  creatorName: z.string().trim().max(200).optional().default(""),
  reviewNote: z.string().trim().max(500).optional().default(""),
});

export const catalogRegistrationSchema = z
  .object({
    registrationKey: z.uuid(),
    title: compactText(160),
    aliases: z.array(compactText(120)).max(20).default([]),
    summary: compactText(300),
    description: compactText(5_000),
    origin: compactText(5_000),
    sourceWorkYear: year,
    memeFirstSeenYear: year,
    koreaViralYear: year,
    yearPrecision: z.enum(["exact", "year", "approximate", "decade", "unknown"]),
    tags: z.array(compactText(60)).min(1).max(15),
    safetyLevel: z.enum(["green", "yellow", "gray", "red"]),
    category: z.enum(["phrase", "dance", "song", "image", "comment", "challenge"]),
    difficulty: z.enum(["beginner", "normal", "deep"]),
    sentiment: z.enum(["funny", "ironic", "controversial", "negative", "wholesome"]),
    usageContext: z.object({
      work: z.enum(["green", "yellow", "gray", "red"]),
      friends: z.enum(["green", "yellow", "gray", "red"]),
      family: z.enum(["green", "yellow", "gray", "red"]),
      sns: z.enum(["green", "yellow", "gray", "red"]),
    }),
    sources: z.array(catalogSourceSchema).min(2).max(8),
  })
  .superRefine((value, ctx) => {
    const titleKey = memeTitleKey(value.title);
    if (titleKey && memeTitleKey(value.summary) === titleKey) {
      ctx.addIssue({
        code: "custom",
        path: ["summary"],
        message: "밈의 뜻이나 사용 상황을 덧붙인 요약을 입력해 주세요.",
      });
    }
    const urls = value.sources.map((source) => normalizeCatalogSourceUrl(source.url));
    if (new Set(urls).size !== urls.length) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "같은 출처 URL을 두 번 등록할 수 없어요.",
      });
    }
    if (!value.sources.some((source) => ["original", "earliest_known"].includes(source.sourceRole))) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "원문 또는 최초 확인 출처가 필요해요.",
      });
    }
    if (!value.sources.some((source) => ["secondary_reference", "official_reupload"].includes(source.sourceRole))) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "독립적인 검증 출처가 필요해요.",
      });
    }
    value.sources.forEach((source, index) => {
      const social = normalizeSourceUrl(source.url);
      const socialPlatform = ["youtube", "youtube_shorts", "tiktok", "instagram"].includes(source.platform);
      if ((social && social.platform !== source.platform) || (!social && socialPlatform)) {
        ctx.addIssue({
          code: "custom",
          path: ["sources", index, "platform"],
          message: "URL과 플랫폼이 일치하지 않아요.",
        });
      }
    });
  });

export const catalogDuplicateCheckSchema = z.object({
  title: compactText(160),
  sourceUrls: z
    .array(
      z.string().trim().max(2_048).refine((value) => normalizeCatalogSourceUrl(value) !== null),
    )
    .min(1)
    .max(8),
});

export type CatalogRegistrationInput = z.input<typeof catalogRegistrationSchema>;
export type ParsedCatalogRegistration = z.output<typeof catalogRegistrationSchema>;

export function normalizeCatalogRegistration(
  input: CatalogRegistrationInput,
): ParsedCatalogRegistration {
  const parsed = catalogRegistrationSchema.parse(input);
  return {
    ...parsed,
    aliases: [...new Set(parsed.aliases.map((alias) => alias.trim()))],
    tags: [...new Set(parsed.tags.map((tag) => tag.trim().toLowerCase()))],
    sources: parsed.sources.map((source) => ({
      ...source,
      url: normalizeCatalogSourceUrl(source.url)!,
      externalId: normalizeSourceUrl(source.url)?.externalId ?? "",
    })),
  };
}
