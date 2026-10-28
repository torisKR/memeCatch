import { describe, expect, it } from "vitest";
import {
  CONTENT_PIPELINE_IMPORT_MAX_BYTES,
  ContentPipelineImportError,
  parseContentPipelineImport,
} from "./content-pipeline-import";

function artifact(overrides: Record<string, unknown> = {}) {
  const draft = {
    title: "퇴근 버튼",
    summary: "오늘 할 일을 모두 마친 순간에 쓰는 자체 제작 공감 문구",
    description:
      "하루 동안 해야 할 일을 모두 마친 직장인이 노트북을 닫는 순간을 담는다. 화면 속 완료 표시가 커다란 버튼처럼 보이고, 손가락이 그 버튼을 누르자 주변의 업무 알림이 조용히 사라지는 장면이다. 핵심 문구는 ‘오늘 할 일 완료, 이제 퇴근 버튼만 누르면 됨’이다. 실제 시스템 기능이 아니라 하루의 작은 성취를 게임의 마지막 단계처럼 표현하는 말장난이다. 바쁜 날의 끝에서 동료나 친구와 가볍게 성취감을 나누는 상황을 위해 기획했다. 버튼이 활성화되기 전에는 작은 체크 표시들이 차례로 켜지고, 마지막 체크가 끝나면 화면 전체의 색이 차분한 회색에서 밝은 초록색으로 바뀐다. 남은 일을 재촉하기보다 오늘 끝낸 일에 잠시 만족하는 태도를 가볍게 보여 준다.",
    origin: "밈캐치가 하루 업무 완료의 성취감을 게임의 마지막 버튼에 비유해 자체 기획한 문구입니다.",
    usageNote: "업무를 마친 직후 동료나 친구에게 가볍게 성취감을 알리는 메신저와 게시물에 사용합니다.",
    caution: "실제 퇴근 승인이나 업무 완료를 확인하는 기능으로 오해하지 않도록 사용합니다.",
    examples: [
      { context: "work", text: "오늘 할 일 완료. 이제 퇴근 버튼만 누르면 됨." },
      { context: "friends", text: "나 오늘 퇴근 버튼 정시에 누른다." },
    ],
    card: {
      caption: "오늘 할 일 완료\n퇴근 버튼 활성화",
      visualBrief:
        "짙은 화면 위에 밈캐치 자체 도형으로 만든 체크 표시와 커다란 둥근 퇴근 버튼을 배치한다. 버튼을 누르는 손과 사라지는 알림 조각을 함께 그린다.",
      motif: "office",
      symbols: ["screen", "briefcase", "spark"],
      composition: "frame",
    },
  };
  const description = `${draft.description}\n\n활용: ${draft.usageNote}\n\n자체 작성 예문:\n${draft.examples
    .map((example) => `${example.context}: ${example.text}`)
    .join("\n")}\n\n주의: ${draft.caution}\n\n카드 문구: ${draft.card.caption}\n\n비주얼: ${draft.card.visualBrief}\n\n카드 제작 설정: ${JSON.stringify({ motif: draft.card.motif, symbols: draft.card.symbols, composition: draft.card.composition })}`;
  return {
    schemaVersion: 1,
    kind: "house_original",
    status: "draft",
    generatedAt: "2025-12-31T23:30:00.000Z",
    provider: "opencodex",
    topic: "하루 업무를 모두 마친 순간",
    review: { decision: "pass", issues: [] },
    draft,
    adminDraft: {
      title: draft.title,
      summary: draft.summary,
      description,
      origin: draft.origin,
      safetyLevel: "yellow",
      category: "image",
      difficulty: "normal",
      originYear: 2025,
      country: "KR",
      usageContext: {
        work: "yellow",
        friends: "green",
        family: "yellow",
        sns: "yellow",
      },
    },
    ...overrides,
  };
}

describe("parseContentPipelineImport", () => {
  it("accepts the same dance-follow and repeat recipe that the local generator can produce", () => {
    const input = artifact();
    const oldRecipe = JSON.stringify({ motif: input.draft.card.motif, symbols: input.draft.card.symbols, composition: input.draft.card.composition });
    input.draft.card.symbols = ["dance-follow", "repeat", "hands"];
    input.draft.card.motif = "dance";
    input.draft.card.composition = "exchange";
    const newRecipe = JSON.stringify({ motif: input.draft.card.motif, symbols: input.draft.card.symbols, composition: input.draft.card.composition });
    input.adminDraft.description = input.adminDraft.description.replace(oldRecipe, newRecipe);
    expect(parseContentPipelineImport(JSON.stringify(input)).card).toEqual(input.draft.card);
  });
  it("returns only the validated admin draft and ignores top-level runtime overrides", () => {
    const input = artifact({
      moderationStatus: "approved",
      rightsChecked: true,
      runtimeOverrides: {
        country: "US",
        safetyLevel: "green",
        publishImmediately: true,
      },
    });

    expect(parseContentPipelineImport(JSON.stringify(input))).toEqual({
      ...input.adminDraft,
      card: input.draft.card,
    });
    expect(parseContentPipelineImport(JSON.stringify(input))).not.toHaveProperty("moderationStatus");
  });

  it.each([
    ["publication status", { moderationStatus: "approved" }],
    ["publication flag", { publishImmediately: true }],
    ["rights attestation", { rightsAttested: true }],
    ["rights sources", { sources: [{ url: "https://example.com" }] }],
  ])("rejects protected %s fields inside adminDraft", (_label, protectedField) => {
    const input = artifact();
    input.adminDraft = { ...input.adminDraft, ...protectedField };

    expect(() => parseContentPipelineImport(JSON.stringify(input))).toThrowError(
      new ContentPipelineImportError(
        "관리자 초안에 허용되지 않은 게시·권리 설정이 포함되어 있습니다.",
      ),
    );
  });

  it("requires a passing review before import", () => {
    expect(() =>
      parseContentPipelineImport(
        JSON.stringify(artifact({ review: { decision: "revise", issues: ["문구 보강"] } })),
      ),
    ).toThrow("검토 결과가 통과(pass)인 초안만 가져올 수 있습니다.");

    expect(() =>
      parseContentPipelineImport(
        JSON.stringify(artifact({ review: { decision: "pass", issues: ["문구 보강"] } })),
      ),
    ).toThrow("검토를 통과한 초안에는 미해결 이슈가 없어야 합니다.");
  });

  it("requires a canonical generated draft and exact derived admin copy", () => {
    const missingDraft = artifact();
    delete (missingDraft as { draft?: unknown }).draft;
    expect(() => parseContentPipelineImport(JSON.stringify(missingDraft))).toThrow(
      "초안 파일 형식이 올바르지 않습니다.",
    );

    for (const mismatch of [
      { title: "바뀐 제목" },
      { summary: "원본과 다른 관리자 요약입니다." },
      { origin: "밈캐치가 만들었다고만 적은 다른 제작 경위입니다." },
      { description: "원본에서 파생되지 않은 관리자 설명입니다." },
    ]) {
      const input = artifact();
      input.adminDraft = { ...input.adminDraft, ...mismatch };
      expect(() => parseContentPipelineImport(JSON.stringify(input))).toThrow(
        "생성 원본과 관리자 초안 내용이 일치하지 않습니다.",
      );
    }
  });

  it.each(["generatedAt", "provider", "topic"])("requires canonical %s metadata", (field) => {
    const input = artifact();
    delete (input as Record<string, unknown>)[field];
    expect(() => parseContentPipelineImport(JSON.stringify(input))).toThrow(
      ContentPipelineImportError,
    );
  });

  it("rejects category and origin year drift from the generated artifact", () => {
    for (const drift of [{ category: "phrase" }, { originYear: 2024 }]) {
      const input = artifact();
      input.adminDraft = { ...input.adminDraft, ...drift };
      expect(() => parseContentPipelineImport(JSON.stringify(input))).toThrow(
        ContentPipelineImportError,
      );
    }
  });

  it("rejects invalid fixed defaults, text bounds, and future years", () => {
    const invalidDrafts = [
      { safetyLevel: "green" },
      { country: "US" },
      { title: "" },
      { summary: "가".repeat(201) },
      { description: "가".repeat(6001) },
      { origin: "가".repeat(1501) },
      { originYear: new Date().getFullYear() + 1 },
      { originYear: 2026.5 },
      { usageContext: { work: "green", friends: "green", family: "yellow", sns: "yellow" } },
    ];

    for (const invalidDraft of invalidDrafts) {
      const input = artifact();
      input.adminDraft = { ...input.adminDraft, ...invalidDraft };
      expect(() => parseContentPipelineImport(JSON.stringify(input))).toThrow(
        ContentPipelineImportError,
      );
    }
  });

  it("rejects malformed JSON and files larger than 100KB", () => {
    expect(() => parseContentPipelineImport("{")).toThrow("올바른 JSON 파일이 아닙니다.");
    expect(() => parseContentPipelineImport(" ".repeat(CONTENT_PIPELINE_IMPORT_MAX_BYTES + 1)))
      .toThrow("JSON 파일은 100KB 이하여야 합니다.");
  });
});
