import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadCreatorProductImage } from "./upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("creator product upload client errors", () => {
  it.each([
    ["storage_quota_exceeded", "상품 이미지는 계정당 최대 20개까지 보관할 수 있어요."],
    ["storage_quota_unavailable", "이미지 저장 공간을 확인하지 못했어요. 잠시 후 다시 시도해 주세요."],
  ])("shows a user-readable %s message", async (error, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: false, error }, { status: 429 })));

    await expect(uploadCreatorProductImage(
      new File(["image"], "product.png", { type: "image/png" }),
    )).resolves.toEqual({ ok: false, error: message });
  });
});
