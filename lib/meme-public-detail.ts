import type { ContentDepthInput, DepthContentRef, DepthTagRef } from "./content-depth";
import type { MemeContentRow, MemeRow } from "./queries";
import type { CitableSourceInput } from "./source-links";

const PUBLIC_READER_EDITORIAL_SUFFIXES = [
  "특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.",
  "이 항목의 대표 이미지는 특정 원본을 복제하지 않은 편집 일러스트로 운영한다.",
] as const;

/**
 * Remove known internal illustration-operation notes from public prose.
 *
 * This is deliberately an exact trailing-sentence projection rather than a
 * broad AI/editorial filter: genuine meme explanations, rights context and
 * the same words when quoted inside a description remain untouched. Stored
 * editorial data is not mutated.
 */
export function publicReaderDescription(description: string): string;
export function publicReaderDescription(description: null): null;
export function publicReaderDescription(description: string | null): string | null;
export function publicReaderDescription(description: string | null): string | null {
  if (!description) return description;
  const trimmed = description.trimEnd();
  if (!trimmed) return "";
  const suffix = PUBLIC_READER_EDITORIAL_SUFFIXES.find((note) => {
    if (!trimmed.endsWith(note)) return false;
    const noteStart = trimmed.length - note.length;
    return noteStart === 0 || /[\s.!?。！？]/u.test(trimmed[noteStart - 1]);
  });
  return suffix ? trimmed.slice(0, -suffix.length).trimEnd() : description;
}

export type PublicAnswerCardMeme = Pick<
  MemeRow,
  | "title"
  | "summary"
  | "lifecycle_status"
  | "safety_level"
  | "doc_class"
  | "usage_note"
>;

/**
 * Client component boundary for the detail answer card.
 *
 * Keep this as an explicit projection: a full MemeRow can contain editorial,
 * moderation and submitter fields that must not be serialized into the RSC
 * payload merely because the card needs six public labels.
 */
export function publicAnswerCardMeme(meme: PublicAnswerCardMeme): PublicAnswerCardMeme {
  return {
    title: meme.title,
    summary: meme.summary,
    lifecycle_status: meme.lifecycle_status,
    safety_level: meme.safety_level,
    doc_class: meme.doc_class,
    usage_note: meme.usage_note,
  };
}

export type PublicMemeEmbedContent = Pick<
  MemeContentRow,
  "platform" | "content_id" | "url" | "thumbnail_url" | "availability" | "caption"
>;

/** Keep row identity and moderation metadata on the server, not in Flight props. */
export function publicMemeEmbedContent(
  content: PublicMemeEmbedContent | null,
): PublicMemeEmbedContent | null {
  if (!content) return null;
  return {
    platform: content.platform,
    content_id: content.content_id,
    url: content.url,
    thumbnail_url: content.thumbnail_url,
    availability: content.availability,
    caption: content.caption,
  };
}

type PublicDepthMeme = Pick<
  MemeRow,
  | "title"
  | "summary"
  | "description"
  | "origin"
  | "usage_note"
  | "caution"
  | "usage_examples"
  | "published_at"
  | "moderation_status"
> & {
  meme_tags_map?: readonly DepthTagRef[] | null;
};

type PublicDeliverySource = Pick<
  CitableSourceInput,
  "source_url" | "platform" | "title" | "creator_name" | "captured_at"
>;

type PublicDeliveryContent = DepthContentRef;

export type PublicEditorialEligibilityInput = ContentDepthInput & {
  title: MemeRow["title"];
  summary: MemeRow["summary"];
  published_at: MemeRow["published_at"];
  moderation_status: MemeRow["moderation_status"];
  meme_sources: PublicDeliverySource[];
  meme_contents: PublicDeliveryContent[];
};

/**
 * Build the shared index/depth/AdSense input from already-filtered delivery.
 * Raw content URLs, platform IDs and internal moderation metadata never cross
 * this boundary. Citation fields remain because AdSense eligibility validates
 * attributable evidence rather than treating a bare URL as a citation.
 */
export function publicEditorialEligibilityInput({
  meme,
  originalSources,
  renderableContents,
}: {
  meme: PublicDepthMeme;
  originalSources: readonly PublicDeliverySource[];
  renderableContents: readonly PublicDeliveryContent[];
}): PublicEditorialEligibilityInput {
  return {
    title: meme.title,
    summary: meme.summary,
    description: publicReaderDescription(meme.description),
    origin: meme.origin,
    usage_note: meme.usage_note,
    caution: meme.caution,
    usage_examples: meme.usage_examples,
    published_at: meme.published_at,
    moderation_status: meme.moderation_status,
    meme_tags_map: meme.meme_tags_map
      ? meme.meme_tags_map.map((tag) => ({ tag_id: tag.tag_id }))
      : [],
    meme_sources: originalSources.map((source) => ({
      source_url: source.source_url,
      platform: source.platform,
      title: source.title,
      creator_name: source.creator_name,
      captured_at: source.captured_at,
    })),
    meme_contents: renderableContents.map((content) => ({
      availability: content.availability,
      moderation_status: content.moderation_status,
    })),
  };
}
