import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  isOperator: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    rpc: vi.fn((name: string, args?: unknown) => name === "is_operator"
      ? mocks.isOperator()
      : mocks.rpc(name, args)),
  })),
}));
import { applyRadarSafetyReview } from "./radar-safety";

const reviewId = "11111111-1111-4111-8111-111111111111";

describe("applyRadarSafetyReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "operator-1" } } });
    mocks.isOperator.mockResolvedValue({ data: true, error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("validates input before accessing Supabase", async () => {
    const result = await applyRadarSafetyReview({
      reviewId: "not-a-uuid",
      decision: "approved",
      reviewNote: "확인",
    });

    expect(result).toEqual({ ok: false, error: "올바른 검수 ID가 아니에요." });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("rejects decisions outside the RPC contract", async () => {
    const result = await applyRadarSafetyReview({
      reviewId,
      decision: "approve",
      reviewNote: "확인",
    });

    expect(result).toEqual({ ok: false, error: "승인 또는 반려를 선택해 주세요." });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("requires an operator for every invocation", async () => {
    mocks.isOperator.mockResolvedValue({ data: false, error: null });

    const result = await applyRadarSafetyReview({
      reviewId,
      decision: "rejected",
      reviewNote: "근거 부족",
    });

    expect(result).toEqual({ ok: false, error: "운영자 권한이 없어요." });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("applies through the audited review RPC and revalidates", async () => {
    const result = await applyRadarSafetyReview({
      reviewId,
      decision: "approved",
      reviewNote: "  증거 원문 확인 완료  ",
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_safety_review", {
      p_review_id: reviewId,
      p_decision: "approved",
      p_review_note: "증거 원문 확인 완료",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/radar-safety");
  });

  it("does not audit or revalidate an already handled review", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    const result = await applyRadarSafetyReview({
      reviewId,
      decision: "rejected",
      reviewNote: "이미 처리 여부 확인",
    });

    expect(result).toEqual({ ok: false, error: "이미 처리된 검수 요청이에요." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
