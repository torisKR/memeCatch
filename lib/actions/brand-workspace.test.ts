import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  entitlement: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/billing/repository.server", () => ({ getPremiumEntitlement: mocks.entitlement }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import {
  recordBrandApproval,
  saveBrandFitEvaluation,
  saveBrandWorkspace,
  loadBrandWorkspace,
} from "./brand-workspace";

const previous = { ok: false, message: "" };

describe("brand workspace actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.entitlement.mockResolvedValue({ signedIn: true, isPremium: true });
    mocks.rpc.mockResolvedValue({ data: "11111111-1111-4111-8111-111111111111", error: null });
  });

  it("normalizes forbidden expressions before saving the workspace", async () => {
    const form = new FormData();
    form.set("brandName", " MemeCatch ");
    form.set("brandContext", " 20대 크리에이터를 위한 서비스 ");
    form.set("brandTone", " 친근하고 정확하게 ");
    form.set("forbiddenExpressions", "무조건, 대박\n무조건");

    await expect(saveBrandWorkspace(previous, form)).resolves.toEqual({
      ok: true,
      message: "브랜드 문맥을 저장했어요.",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("save_brand_workspace", {
      p_brand_name: "MemeCatch",
      p_brand_context: "20대 크리에이터를 위한 서비스",
      p_brand_tone: "친근하고 정확하게",
      p_forbidden_expressions: ["무조건", "대박"],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/premium/brand-workspace");
  });

  it("rejects invalid fit scores before authorization", async () => {
    const form = new FormData();
    form.set("memeName", "테스트 밈");
    form.set("memePath", "/memes/abcd1234-test");
    form.set("proposedCopy", "문구");
    form.set("fitScore", "101");
    form.set("riskLevel", "low");
    form.set("rationale", "근거");

    const result = await saveBrandFitEvaluation(previous, form);
    expect(result.ok).toBe(false);
    expect(mocks.entitlement).not.toHaveBeenCalled();
  });

  it("requires an active Plus membership for mutations", async () => {
    mocks.entitlement.mockResolvedValue({ signedIn: true, isPremium: false });
    const form = new FormData();
    form.set("memeName", "테스트 밈");
    form.set("memePath", "/memes/abcd1234-test");
    form.set("proposedCopy", "문구");
    form.set("fitScore", "80");
    form.set("riskLevel", "low");
    form.set("rationale", "근거");

    await expect(saveBrandFitEvaluation(previous, form)).resolves.toEqual({
      ok: false,
      message: "Plus 멤버십이 필요해요.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("saves only an internal meme detail path for the share loop", async () => {
    const form = new FormData();
    form.set("memeName", "테스트 밈");
    form.set("memePath", "/memes/abcd1234-test");
    form.set("proposedCopy", "문구");
    form.set("fitScore", "80");
    form.set("riskLevel", "low");
    form.set("rationale", "근거");

    await expect(saveBrandFitEvaluation(previous, form)).resolves.toMatchObject({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("save_brand_fit_evaluation", expect.objectContaining({
      p_meme_path: "/memes/abcd1234-test",
    }));

    form.set("memePath", "https://evil.example/memes/abcd1234-test");
    await expect(saveBrandFitEvaluation(previous, form)).resolves.toMatchObject({ ok: false });
  });

  it("requires an active Plus membership before loading brand context", async () => {
    mocks.entitlement.mockResolvedValue({ signedIn: true, isPremium: false });

    await expect(loadBrandWorkspace()).rejects.toThrow("Plus 멤버십이 필요해요.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps duplicate immutable decisions to a clear result", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "decision_already_recorded" } });
    const form = new FormData();
    form.set("evaluationId", "11111111-1111-4111-8111-111111111111");
    form.set("decision", "approved");
    form.set("note", "캠페인 사용 승인");

    await expect(recordBrandApproval(previous, form)).resolves.toEqual({
      ok: false,
      message: "이미 승인 또는 반려된 평가예요.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
