import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags", () => ({ flags: { submissionsOpen: true } }));
vi.mock("@/lib/i18n-server", () => ({ getRequestLocale: vi.fn().mockResolvedValue("ko") }));

const rpc = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/db/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));

import { submitMemeContribution } from "./actions";

const MEME_ID = "10000000-0000-4000-8000-000000000001";

describe("submitMemeContribution", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: "c1", error: null });
  });

  it("https가 아닌 링크는 RPC 전에 막는다", async () => {
    const res = await submitMemeContribution({ memeId: MEME_ID, kind: "source", sourceUrl: "http://a.com/x" });
    expect(res).toMatchObject({ ok: false, error: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("예문은 상황과 문장이 모두 있어야 한다", async () => {
    const res = await submitMemeContribution({ memeId: MEME_ID, kind: "example", situation: "단톡방", text: " " });
    expect(res).toMatchObject({ ok: false, error: "invalid", message: "실제로 쓴 문장을 적어 주세요." });
  });

  it("로그인하지 않았으면 login_required", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await submitMemeContribution({ memeId: MEME_ID, kind: "source", sourceUrl: "https://a.com/x" });
    expect(res).toMatchObject({ ok: false, error: "login_required" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("출처 제보는 이 밈에 묶어 RPC로 보낸다", async () => {
    const res = await submitMemeContribution({
      memeId: MEME_ID,
      kind: "source",
      sourceUrl: " https://www.youtube.com/watch?v=abc ",
      note: "원본 영상",
      creditPublic: false,
    });
    expect(res).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_meme_contribution", {
      p_meme_id: MEME_ID,
      p_kind: "source",
      p_source_url: "https://www.youtube.com/watch?v=abc",
      p_note: "원본 영상",
      p_situation: null,
      p_text: null,
      p_credit_public: false,
    });
  });

  it("예문 제보는 링크 없이 상황·문장만 보낸다", async () => {
    await submitMemeContribution({ memeId: MEME_ID, kind: "example", situation: "시험 끝나고", text: "럭키비키잖아" });
    expect(rpc).toHaveBeenCalledWith("submit_meme_contribution", {
      p_meme_id: MEME_ID,
      p_kind: "example",
      p_source_url: null,
      p_note: null,
      p_situation: "시험 끝나고",
      p_text: "럭키비키잖아",
      p_credit_public: true,
    });
  });

  it.each([
    [{ code: "P0429", message: "rate_limited" }, "rate_limited"],
    [{ code: "23505", message: "already_linked" }, "duplicate"],
    [{ code: "23505", message: "already_pending" }, "duplicate"],
    [{ code: "XX000", message: "boom" }, "failed"],
  ])("RPC 오류 %o 를 %s 로 안내한다", async (error, expected) => {
    rpc.mockResolvedValue({ data: null, error });
    const res = await submitMemeContribution({ memeId: MEME_ID, kind: "source", sourceUrl: "https://a.com/x" });
    expect(res).toMatchObject({ ok: false, error: expected });
  });
});
