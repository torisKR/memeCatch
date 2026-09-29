// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreatorProduct } from "@/lib/creator-products";

const mocks = vi.hoisted(() => ({
  moderateCreatorProduct: vi.fn(),
}));

vi.mock("@/lib/creator-products/actions", () => ({
  moderateCreatorProduct: mocks.moderateCreatorProduct,
}));

import { CreatorProductModerationQueue } from "./moderation-queue";

const product: CreatorProduct = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "owner-1",
  title: "검토 상품",
  description: "운영자가 확인할 상품 설명입니다.",
  external_url: "https://shop.example.com/item",
  image_path: "creator-products/owner-1/image.png",
  price: 19_000,
  category: "prints",
  relationship_disclosure: "affiliate",
  moderation_status: "pending",
  rejection_reason: null,
  created_at: "2026-09-20T00:00:00.000Z",
  updated_at: "2026-09-20T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function neverSettles() {
  return new Promise<never>(() => {});
}

describe("CreatorProductModerationQueue", () => {
  it("submits an approval and disables moderation controls while pending", async () => {
    mocks.moderateCreatorProduct.mockReturnValue(neverSettles());
    const user = userEvent.setup();
    render(<CreatorProductModerationQueue products={[product]} />);

    await user.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() => {
      expect(mocks.moderateCreatorProduct).toHaveBeenCalledWith(product.id, "approved", "");
    });
    expect((screen.getByRole("button", { name: "승인" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "반려" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits a rejection with the operator reason", async () => {
    mocks.moderateCreatorProduct.mockReturnValue(neverSettles());
    const user = userEvent.setup();
    render(<CreatorProductModerationQueue products={[product]} />);

    await user.type(screen.getByLabelText(/반려 사유/), "외부 주소를 다시 확인해 주세요.");
    await user.click(screen.getByRole("button", { name: "반려" }));

    await waitFor(() => {
      expect(mocks.moderateCreatorProduct).toHaveBeenCalledWith(
        product.id,
        "rejected",
        "외부 주소를 다시 확인해 주세요.",
      );
    });
  });

  it("shows an action error for the reviewed product and re-enables controls", async () => {
    mocks.moderateCreatorProduct.mockResolvedValue({ ok: false, error: "검토 상태를 저장하지 못했어요." });
    const user = userEvent.setup();
    render(<CreatorProductModerationQueue products={[product]} />);

    await user.click(screen.getByRole("button", { name: "승인" }));

    expect((await screen.findByRole("alert")).textContent).toContain("검토 상태를 저장하지 못했어요.");
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "승인" }) as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByRole("button", { name: "반려" }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("recovers when the moderation transport throws", async () => {
    mocks.moderateCreatorProduct.mockRejectedValue(new Error("action transport unavailable"));
    const user = userEvent.setup();
    render(<CreatorProductModerationQueue products={[product]} />);

    await user.click(screen.getByRole("button", { name: "승인" }));

    expect((await screen.findByRole("alert")).textContent).toContain("검토 상태를 저장하지 못했어요");
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "승인" }) as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByRole("button", { name: "반려" }) as HTMLButtonElement).disabled).toBe(false);
    });

    mocks.moderateCreatorProduct.mockResolvedValueOnce({ ok: false, error: "재시도 결과" });
    await user.click(screen.getByRole("button", { name: "승인" }));
    await waitFor(() => expect(mocks.moderateCreatorProduct).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole("alert")).textContent).toContain("재시도 결과");
  });
});
