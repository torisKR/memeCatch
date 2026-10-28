import { describe, expect, it, vi } from "vitest";
import {
  EVIDENCE_DRAFT_INSTRUCTIONS,
  generateEvidenceDraft,
  type EvidenceDraft,
  type EvidenceDraftInput,
} from "./evidence-draft";

const input: EvidenceDraftInput = {
  candidateName: "출근 완료 밈",
  suppliedAliases: ["출근 완료"],
  evidence: [
    {
      id: "meaning-1",
      kind: "meaning",
      text: "제목과 설명에서 출근 직후 이미 하루를 다 쓴 듯한 과장 표현으로 소개한다.",
      observedScope: "title_description",
      provenanceStatus: "unverified",
    },
    {
      id: "origin-1",
      kind: "origin",
      text: "2026-10-01 게시물을 확인 가능한 이른 사례로 기록했다.",
      observedScope: "full_transcript",
      sourceUrl: "https://example.com/posts/early",
      publishedAt: "2026-10-01T00:00:00Z",
      provenanceStatus: "earliest_confirmed_case",
    },
    {
      id: "use-1",
      kind: "independent_use",
      text: "독립 작성자가 업무 시작 전 피로를 표현하는 변형을 게시했다.",
      observedScope: "title_description",
      provenanceStatus: "unverified",
    },
    {
      id: "spread-1",
      kind: "spread",
      text: "서로 다른 표현으로 바꾼 사용례가 관찰 범위에서 늘었다.",
      observedScope: "title_description",
      provenanceStatus: "unverified",
    },
  ],
};

function validDraft(overrides: Partial<EvidenceDraft> = {}): EvidenceDraft {
  return {
    name: "출근 완료 밈",
    aliases: ["출근 완료"],
    oneLineMeaning: "출근하자마자 기운을 다 쓴 느낌을 과장해 표현한다.",
    origin: {
      status: "earliest_confirmed_case",
      claim: "2026-10-01 게시물은 확인 가능한 이른 사례다.",
      evidenceIds: ["origin-1"],
    },
    independentUses: ["use-1"],
    spreadObservations: [{
      claim: "관찰 범위에서 서로 다른 표현으로 바꾼 사용례가 늘었다.",
      evidenceIds: ["use-1", "spread-1"],
    }],
    interpretation: "업무 시작과 동시에 지친다는 공감이 짧은 문장으로 전달되기 때문일 수 있다.",
    usageExamples: ["자체 작성 예시: 노트북 켰는데 오늘 업무 완료한 기분."],
    caution: "직장이나 개인을 실제로 비난하는 표현으로 오해되지 않게 맥락을 확인한다.",
    reviewNeeds: ["기원과 사용 안전성을 운영자가 다시 확인해야 한다."],
    analyzedScope: input.evidence.map((item) => ({
      evidenceId: item.id,
      scope: item.observedScope,
    })),
    reviewStatus: "pending_human_review",
    ...overrides,
  };
}

describe("generateEvidenceDraft", () => {
  it("passes bounded untrusted evidence to an injected completion and keeps the result pending review", async () => {
    const complete = vi.fn(async () => validDraft());

    await expect(generateEvidenceDraft(input, complete)).resolves.toEqual(validDraft());
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      name: "memecatch_evidence_draft",
      instructions: expect.stringContaining("비신뢰 데이터"),
      jsonSchema: expect.any(Object),
      input: expect.objectContaining({
        untrustedSourceData: true,
        constraints: {
          operatorReviewRequired: true,
          rankingMathAllowed: false,
          unsupportedFactsAllowed: false,
        },
      }),
    }));
    expect(EVIDENCE_DRAFT_INSTRUCTIONS).toContain("title_description");
  });

  it("rejects evidence IDs that were not supplied", async () => {
    const draft = validDraft({ independentUses: ["invented-evidence"] });
    await expect(generateEvidenceDraft(input, async () => draft))
      .rejects.toThrow("unknown_evidence_id");
  });

  it.each([
    ["URL", { interpretation: "자세한 내용은 https://invented.example/meme 에 있다." }, "invented_url"],
    ["date", { interpretation: "2026년 12월 31일에 유행했다고 해석한다." }, "invented_date"],
    ["number", { interpretation: "조회수가 999999회 늘었다." }, "invented_number"],
  ])("rejects an invented %s", async (_label, overrides, error) => {
    await expect(generateEvidenceDraft(input, async () => validDraft(overrides)))
      .rejects.toThrow(error);
  });

  it("does not upgrade title and description evidence to a full transcript observation", async () => {
    const draft = validDraft({
      analyzedScope: validDraft().analyzedScope.map((scope) =>
        scope.evidenceId === "meaning-1" ? { ...scope, scope: "full_transcript" } : scope,
      ),
    });
    await expect(generateEvidenceDraft(input, async () => draft))
      .rejects.toThrow("analyzed_scope_mismatch");
  });

  it("keeps origin unverified unless referenced evidence supports the claimed provenance status", async () => {
    const draft = validDraft({
      origin: {
        status: "confirmed",
        claim: "원본이 확인됐다.",
        evidenceIds: ["meaning-1"],
      },
    });
    await expect(generateEvidenceDraft(input, async () => draft))
      .rejects.toThrow("unverified_origin_claim");
  });

  it("rejects aliases absent from supplied aliases and evidence text", async () => {
    await expect(generateEvidenceDraft(input, async () => validDraft({ aliases: ["새로 만든 별칭"] })))
      .rejects.toThrow("unsupported_alias");
  });

  it("rejects ranking fields and publication approval outside the draft schema", async () => {
    const ranked = { ...validDraft(), score: 98 };
    await expect(generateEvidenceDraft(input, async () => ranked)).rejects.toThrow();

    const published = { ...validDraft(), reviewStatus: "approved" };
    await expect(generateEvidenceDraft(input, async () => published)).rejects.toThrow();
  });
});
