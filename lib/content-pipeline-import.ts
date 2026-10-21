import { z } from "zod";

export const CONTENT_PIPELINE_IMPORT_MAX_BYTES = 100 * 1024;

const boundedText = (label: string, max: number) =>
  z
    .string({ error: `${label} 형식이 올바르지 않습니다.` })
    .trim()
    .min(1, `${label}을(를) 입력해 주세요.`)
    .max(max, `${label}은(는) ${max}자 이하여야 합니다.`);

const canonicalText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !/<[^>]*>|https?:\/\//i.test(value));

const cardSchema = z
  .object({
    caption: canonicalText(8, 180),
    visualBrief: canonicalText(20, 600),
    motif: z.enum([
      "pen-pineapple",
      "dance",
      "gaming",
      "reaction",
      "office",
      "food",
      "animal",
      "sport",
      "music",
      "chat",
      "choice",
      "technology",
      "celebration",
      "fashion",
      "travel",
      "study",
    ]),
    symbols: z
      .array(
        z.enum([
          "pen",
          "apple",
          "pineapple",
          "music-note",
          "footsteps",
          "dance-follow",
          "repeat",
          "wave",
          "hands",
          "confetti",
          "spark",
          "heart",
          "path",
          "flag",
          "cup",
          "speech",
          "smile",
          "question",
          "quote",
          "chip",
          "screen",
          "controller",
          "clock",
          "briefcase",
          "desk",
          "book",
          "microphone",
          "ball",
        ]),
      )
      .min(2)
      .max(4),
    composition: z.enum(["orbit", "rise", "split", "burst", "rhythm", "stack", "frame", "exchange"]),
  })
  .strict();

const canonicalDraftSchema = z
  .object({
    title: canonicalText(1, 120),
    summary: canonicalText(20, 200),
    description: canonicalText(250, 2500),
    origin: canonicalText(20, 1000),
    usageNote: canonicalText(40, 700),
    caution: canonicalText(20, 500),
    examples: z
      .array(
        z
          .object({
            context: z.enum(["work", "friends", "family", "sns"]),
            text: canonicalText(8, 250),
          })
          .strict(),
      )
      .min(2)
      .max(4),
    card: cardSchema,
  })
  .strict();

const usageContextSchema = z
  .object({
    work: z.literal("yellow"),
    friends: z.literal("green"),
    family: z.literal("yellow"),
    sns: z.literal("yellow"),
  })
  .strict();

const adminDraftSchema = z
  .object({
    title: boundedText("제목", 120),
    summary: boundedText("한 줄 요약", 200),
    description: boundedText("설명", 6000),
    origin: boundedText("제작 설명", 1500),
    safetyLevel: z.literal("yellow"),
    category: z.literal("image"),
    difficulty: z.literal("normal"),
    originYear: z.number().int(),
    country: z.literal("KR"),
    usageContext: usageContextSchema,
  })
  .strict();

const contentPipelineArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal("house_original"),
    status: z.literal("draft"),
    generatedAt: z.iso.datetime({ offset: true }),
    provider: z.literal("opencodex"),
    topic: canonicalText(2, 120),
    review: z.object({
      decision: z.enum(["pass", "revise"]),
      issues: z.array(canonicalText(1, 500)).max(12),
    }).strict(),
    draft: canonicalDraftSchema,
    adminDraft: adminDraftSchema,
  })
  .passthrough();

export type ContentPipelineAdminDraft = z.infer<typeof adminDraftSchema>;
export type ContentPipelineCard = z.infer<typeof cardSchema>;
export type ContentPipelineImport = ContentPipelineAdminDraft & { card: ContentPipelineCard };

export class ContentPipelineImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentPipelineImportError";
  }
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function canonicalAdminDescription(draft: z.infer<typeof canonicalDraftSchema>): string {
  const cardRecipe = JSON.stringify({
    motif: draft.card.motif,
    symbols: draft.card.symbols,
    composition: draft.card.composition,
  });
  return `${draft.description}\n\n활용: ${draft.usageNote}\n\n자체 작성 예문:\n${draft.examples
    .map((example) => `${example.context}: ${example.text}`)
    .join("\n")}\n\n주의: ${draft.caution}\n\n카드 문구: ${draft.card.caption}\n\n비주얼: ${draft.card.visualBrief}\n\n카드 제작 설정: ${cardRecipe}`;
}

export function parseContentPipelineImport(text: string): ContentPipelineImport {
  if (byteLength(text) > CONTENT_PIPELINE_IMPORT_MAX_BYTES) {
    throw new ContentPipelineImportError("JSON 파일은 100KB 이하여야 합니다.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ContentPipelineImportError("올바른 JSON 파일이 아닙니다.");
  }

  const parsed = contentPipelineArtifactSchema.safeParse(raw);
  if (!parsed.success) {
    const unsafeDraftFields = parsed.error.issues.some(
      (issue) =>
        issue.code === "unrecognized_keys" &&
        issue.path.length === 1 &&
        issue.path[0] === "adminDraft",
    );
    const firstMessage = parsed.error.issues[0]?.message;
    throw new ContentPipelineImportError(
      unsafeDraftFields
        ? "관리자 초안에 허용되지 않은 게시·권리 설정이 포함되어 있습니다."
        : firstMessage && /[가-힣]/.test(firstMessage)
          ? firstMessage
          : "초안 파일 형식이 올바르지 않습니다.",
    );
  }

  if (parsed.data.review.decision !== "pass") {
    throw new ContentPipelineImportError("검토 결과가 통과(pass)인 초안만 가져올 수 있습니다.");
  }

  if (parsed.data.review.issues.length !== 0) {
    throw new ContentPipelineImportError("검토를 통과한 초안에는 미해결 이슈가 없어야 합니다.");
  }

  const { adminDraft, draft } = parsed.data;
  const generatedYear = new Date(parsed.data.generatedAt).getUTCFullYear();
  if (
    adminDraft.title !== draft.title ||
    adminDraft.summary !== draft.summary ||
    adminDraft.origin !== draft.origin ||
    adminDraft.description !== canonicalAdminDescription(draft) ||
    adminDraft.originYear !== generatedYear
  ) {
    throw new ContentPipelineImportError("생성 원본과 관리자 초안 내용이 일치하지 않습니다.");
  }

  return { ...adminDraft, card: draft.card };
}
