import { describe, expect, it, vi } from "vitest";
import catalog from "@/data/meme-cards/catalog-1000.json";

vi.mock("server-only", () => ({}));

import { getAlignedMemeCardEditorialPresentation } from "./meme-collectible-catalog";

describe("collectible card editorial identity", () => {
  it("preserves the frozen card claim while grounding the correction in the official dance video", () => {
    const card = catalog.cards.find((item) => item.id === "mc-0012");
    expect(card).toMatchObject({
      id: "mc-0012",
      cardNo: 12,
      memeId: "dbe93730-0dbd-4ef0-a318-92c7e775caf3",
      edition: 1,
      artSeed: 1381021653,
      evidenceKind: "historical-media",
    });
    expect(card?.referenceUrls[0]).toBe("https://www.youtube.com/watch?v=JnQu_5O4lh4");
    expect(card?.referenceUrls).toContain("https://www.youtube.com/watch?v=WG2YQEzgH8c");
    expect(card?.art.subject).toContain("위댐보이즈 바타");
  });

  it("returns reviewed art and copy for the exact frozen meme identity", () => {
    expect(getAlignedMemeCardEditorialPresentation(
      "mc-0012",
      "dbe93730-0dbd-4ef0-a318-92c7e775caf3",
      "새삥 챌린지 (지코)",
    )).toEqual({
      art: { motif: "dance", symbols: ["dance-follow", "repeat", "hands"], composition: "exchange" },
      caption: "Mnet 스트릿 맨 파이터 리더 계급 미션곡 ‘새삥’ 안무를 따라 하는 댄스 챌린지",
    });
  });

  it("rejects stale presentation when either the linked meme or its reviewed title changes", () => {
    expect(getAlignedMemeCardEditorialPresentation(
      "mc-0012",
      "different-meme-id",
      "새삥 챌린지 (지코)",
    )).toBeNull();
    expect(getAlignedMemeCardEditorialPresentation(
      "mc-0012",
      "dbe93730-0dbd-4ef0-a318-92c7e775caf3",
      "새싹 챌린지 (지코)",
    )).toBeNull();
  });

  it("returns defensive art symbol copies", () => {
    const first = getAlignedMemeCardEditorialPresentation("mc-0012", "dbe93730-0dbd-4ef0-a318-92c7e775caf3", "새삥 챌린지 (지코)");
    expect(first).not.toBeNull();
    first?.art.symbols.push("question");
    expect(getAlignedMemeCardEditorialPresentation("mc-0012", "dbe93730-0dbd-4ef0-a318-92c7e775caf3", "새삥 챌린지 (지코)")?.art.symbols)
      .toEqual(["dance-follow", "repeat", "hands"]);
  });
});
