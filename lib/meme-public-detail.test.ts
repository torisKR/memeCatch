import { describe, expect, it } from "vitest";
import { isAdsenseContentEligible } from "./adsense-policy";
import { contentDepth, isIndexableMeme } from "./content-depth";
import {
  publicAnswerCardMeme,
  publicMemeEmbedContent,
  publicEditorialEligibilityInput,
  publicReaderDescription,
} from "./meme-public-detail";

const prose = {
  title: "새삥 챌린지",
  summary: "새로운 것을 자신 있게 보여 줄 때 쓰는 챌린지 밈",
  description: "특정 표현의 뜻과 실제 사용 맥락을 독자가 구분할 수 있도록 설명한 문장입니다. ".repeat(8),
  origin: "공개된 원자료에서 확인되는 초기 사용과 이후 변형 사례를 구분해 정리한 유래 설명입니다.",
  usage_note: "상대가 새로 시작한 일이나 물건을 자신 있게 소개하는 맥락에서 가볍게 사용할 수 있습니다.",
  caution: "원본 영상과 음원은 별도 권리 대상이므로 링크 확인과 표현 사용을 재업로드 허가로 오해하면 안 됩니다.",
  usage_examples: [{ situation: "새 프로젝트 공개", text: "이게 바로 우리 팀 새삥 결과물이에요." }],
  published_at: "2026-01-01T00:00:00.000Z",
  moderation_status: "approved" as const,
  meme_tags_map: [{ tag_id: "challenge" }, { tag_id: "music" }, { tag_id: "reaction" }],
};

describe("public meme detail DTOs", () => {
  it("removes only the two exact trailing editorial illustration notes from reader copy", () => {
    expect(publicReaderDescription(
      "발레리나와 카푸치노를 합친 캐릭터 밈이다. 특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.",
    )).toBe("발레리나와 카푸치노를 합친 캐릭터 밈이다.");
    expect(publicReaderDescription(
      "상어 캐릭터와 반복 음성으로 확산된 밈이다. 이 항목의 대표 이미지는 특정 원본을 복제하지 않은 편집 일러스트로 운영한다.",
    )).toBe("상어 캐릭터와 반복 음성으로 확산된 밈이다.");
  });

  it("keeps genuine AI explanations and editorial-note text that is quoted before later prose", () => {
    const aiExplanation = "AI가 만든 브레인롯 캐릭터가 짧은 영상과 리믹스로 확산된 밈이다.";
    const quotedMiddle = "설명에는 '특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.'라는 문구가 인용되지만 실제 뜻은 뒤에서 이어진다.";

    expect(publicReaderDescription(aiExplanation)).toBe(aiExplanation);
    expect(publicReaderDescription(quotedMiddle)).toBe(quotedMiddle);
  });

  it("keeps null and empty descriptions stable", () => {
    expect(publicReaderDescription(null)).toBeNull();
    expect(publicReaderDescription("")).toBe("");
    expect(publicReaderDescription("  \n\t ")).toBe("");
  });

  it("requires a sentence boundary before a trailing editorial note", () => {
    const note = "특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.";

    expect(publicReaderDescription(note)).toBe("");
    expect(publicReaderDescription(`독자 설명.${note}`)).toBe("독자 설명.");
    expect(publicReaderDescription(`합성어${note}`)).toBe(`합성어${note}`);
  });

  it("uses the same cleaned description in the public depth projection", () => {
    const dto = publicEditorialEligibilityInput({
      meme: {
        ...prose,
        description: `${prose.description} 특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.`,
      },
      originalSources: [],
      renderableContents: [],
    });

    expect(dto.description).toBe(prose.description.trimEnd());
  });

  it("projects only the six playback fields, retaining null fallback without row metadata", () => {
    const playback = {
      platform: "YouTube", content_id: "abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      thumbnail_url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
      availability: "live", caption: "확인된 사용례",
    };
    expect(publicMemeEmbedContent(null)).toBeNull();
    const dto = publicMemeEmbedContent({
      ...playback, id: "internal-row", meme_id: "internal-meme",
      created_at: "internal-created", moderation_status: "approved",
      submitted_by: "private-submitter", is_representative: true,
    } as never);
    expect(dto).toEqual(playback);
    expect(Object.keys(dto!)).toEqual(Object.keys(playback));
    expect(JSON.stringify(dto)).not.toMatch(/internal-|private-|moderation_status|submitted_by|is_representative/);
  });
  it("projects the exact AnswerCard keys without serializing private or nested rows", () => {
    const dto = publicAnswerCardMeme({
      title: "새삥 챌린지",
      summary: "한 줄 뜻",
      lifecycle_status: "rising",
      safety_level: "green",
      doc_class: "meme",
      usage_note: "사용 맥락",
      private_note: "must stay server-side",
      submitter_email: "private@example.test",
      meme_sources: [{ source_url: "https://private.example.test" }],
      meme_contents: [{ url: "https://private.example.test/video" }],
    } as never);

    expect(Object.keys(dto)).toEqual([
      "title",
      "summary",
      "lifecycle_status",
      "safety_level",
      "doc_class",
      "usage_note",
    ]);
    expect(JSON.stringify(dto)).not.toMatch(/private_note|submitter_email|meme_sources|meme_contents|private\.example/);
  });

  it("uses only filtered delivery while preserving citation validity fields", () => {
    const dto = publicEditorialEligibilityInput({
      meme: {
        ...prose,
        raw_internal_state: "must not cross",
        meme_sources: [{ source_url: "https://private.example.test/raw" }],
        meme_contents: [{ url: "https://private.example.test/raw-video" }],
      } as never,
      originalSources: [{
        source_url: "https://www.lge.co.kr/story/newsroom/236165",
        platform: "web",
        title: "LG전자 뉴스룸 밈 소개",
        creator_name: "LG전자",
        captured_at: "2025-12-31T00:00:00.000Z",
        internal_review_note: "do not serialize",
      } as never],
      renderableContents: [{
        availability: "alive",
        moderation_status: "approved",
        url: "https://www.youtube.com/watch?v=private-id",
        content_id: "private-id",
      } as never],
    });

    expect(Object.keys(dto)).toEqual([
      "title",
      "summary",
      "description",
      "origin",
      "usage_note",
      "caution",
      "usage_examples",
      "published_at",
      "moderation_status",
      "meme_tags_map",
      "meme_sources",
      "meme_contents",
    ]);
    expect(dto.meme_sources[0]).toEqual({
      source_url: "https://www.lge.co.kr/story/newsroom/236165",
      platform: "web",
      title: "LG전자 뉴스룸 밈 소개",
      creator_name: "LG전자",
      captured_at: "2025-12-31T00:00:00.000Z",
    });
    expect(dto.meme_contents[0]).toEqual({
      availability: "alive",
      moderation_status: "approved",
    });
    expect(JSON.stringify(dto)).not.toMatch(/raw_internal_state|internal_review_note|private-id|private\.example/);
    expect(contentDepth(dto).signals.mediaCount).toBe(1);
    expect(isIndexableMeme(dto)).toBe(true);
    expect(isAdsenseContentEligible(dto)).toBe(true);
  });

  it("cannot recover raw media or sources when filtered delivery is empty", () => {
    const dto = publicEditorialEligibilityInput({
      meme: {
        ...prose,
        meme_sources: [{ source_url: "https://www.lge.co.kr/story/newsroom/236165" }],
        meme_contents: [{ availability: "alive", moderation_status: "approved" }],
      } as never,
      originalSources: [],
      renderableContents: [],
    });

    expect(dto.meme_sources).toEqual([]);
    expect(dto.meme_contents).toEqual([]);
    expect(contentDepth(dto).signals).toMatchObject({ sourceCount: 0, mediaCount: 0 });
    expect(isIndexableMeme(dto)).toBe(true);
    expect(isAdsenseContentEligible(dto)).toBe(false);
  });
});
