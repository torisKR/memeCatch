import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createStaticClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient, createStaticClient: mocks.createStaticClient }));

import { getCreatorProductReviewQueue, getMyCreatorProducts, getPublicCreatorProducts, moderateCreatorProduct, submitCreatorProduct } from "./server";

const input = {
  title: "고양이 밈 티셔츠", description: "직접 디자인한 티셔츠입니다.",
  externalUrl: "https://shop.example.com/item", imagePath: "creator-products/user-1/image.png",
  price: "19000", category: "apparel", relationshipDisclosure: "creator", rightsAccepted: true,
};
const productId = "20000000-0000-4000-8000-000000000002";
function client(user: { id: string } | null, isOperator = false) {
  const rpc = vi.fn(async (name: string): Promise<{ data: unknown; error: { message: string } | null }> => name === "is_operator"
    ? { data: isOperator, error: null }
    : { data: productId, error: null });
  const order = vi.fn().mockResolvedValue({ data: [], error: null });
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  return {
    client: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, rpc, from: vi.fn(() => ({ select })) },
    rpc, eq,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("creator product authorization", () => {
  it("rejects anonymous submission before calling the database", async () => {
    const fixture = client(null);
    mocks.createClient.mockResolvedValue(fixture.client);
    await expect(submitCreatorProduct(input)).resolves.toMatchObject({ ok: false, error: "로그인이 필요해요." });
    expect(fixture.rpc).not.toHaveBeenCalled();
  });

  it("binds submission to the authenticated owner and rejects a mismatched upload path", async () => {
    const fixture = client({ id: "user-1" });
    mocks.createClient.mockResolvedValue(fixture.client);
    await expect(submitCreatorProduct({ ...input, imagePath: "creator-products/user-2/foreign.png" }))
      .resolves.toMatchObject({ ok: false });
    expect(fixture.rpc).not.toHaveBeenCalled();
    await expect(submitCreatorProduct(input)).resolves.toMatchObject({ ok: true, data: { id: productId } });
    expect(fixture.rpc).toHaveBeenCalledWith("creator_product_submit", expect.objectContaining({ p_rights_accepted: true }));
    expect(fixture.rpc).toHaveBeenLastCalledWith("creator_product_submit", expect.not.objectContaining({ p_owner_id: expect.anything() }));
  });

  it("returns a clear daily quota error when direct submission calls exceed the limit", async () => {
    const fixture = client({ id: "user-1" });
    fixture.rpc.mockResolvedValueOnce({ data: null, error: { message: "api_rate_limited" } });
    mocks.createClient.mockResolvedValue(fixture.client);
    await expect(submitCreatorProduct(input)).resolves.toEqual({
      ok: false,
      error: "오늘 등록 가능한 상품 수를 초과했어요. 내일 다시 시도해 주세요.",
    });
    expect(fixture.rpc).toHaveBeenCalledWith("creator_product_submit", expect.any(Object));
  });

  it("restricts moderation to operators and requires rejection reasons", async () => {
    const member = client({ id: "user-1" });
    mocks.createClient.mockResolvedValue(member.client);
    await expect(moderateCreatorProduct(productId, "approved", ""))
      .resolves.toMatchObject({ ok: false, error: "운영자 권한이 없어요." });
    expect(member.rpc).toHaveBeenCalledTimes(1);

    const operator = client({ id: "admin-1" }, true);
    mocks.createClient.mockResolvedValue(operator.client);
    await expect(moderateCreatorProduct(productId, "rejected", "  "))
      .resolves.toMatchObject({ ok: false });
    expect(operator.rpc).toHaveBeenCalledTimes(1);
    await expect(moderateCreatorProduct(productId, "approved", ""))
      .resolves.toMatchObject({ ok: true });
    expect(operator.rpc).toHaveBeenLastCalledWith("creator_product_moderate", {
      p_id: productId, p_decision: "approved", p_rejection_reason: null,
    });
  });

  it("scopes owner listing queries to the authenticated owner and gives admins only the pending queue", async () => {
    const owner = client({ id: "user-1" });
    mocks.createClient.mockResolvedValueOnce(owner.client);
    await getMyCreatorProducts();
    expect(owner.eq).toHaveBeenCalledWith("owner_id", "user-1");

    const admin = client({ id: "admin-1" }, true);
    mocks.createClient.mockResolvedValueOnce(admin.client);
    await expect(getCreatorProductReviewQueue()).resolves.toMatchObject({ ok: true });
    expect(admin.eq).toHaveBeenCalledWith("moderation_status", "pending");
  });

  it("returns a safe error state when listing retrieval fails", async () => {
    const failed = client({ id: "user-1" });
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    failed.client.from = vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order })) })) }));
    mocks.createClient.mockResolvedValue(failed.client);
    await expect(getMyCreatorProducts()).resolves.toEqual({ ok: false, error: "등록한 상품을 불러오지 못했어요." });
  });

  it("queries only approved rows for public visibility and handles query failure", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    mocks.createStaticClient.mockReturnValue({ from: vi.fn(() => ({ select })) });
    await expect(getPublicCreatorProducts()).resolves.toMatchObject({ products: [], error: false });
    expect(eq).toHaveBeenCalledWith("moderation_status", "approved");

    order.mockResolvedValueOnce({ data: null, error: { message: "database unavailable" } });
    await expect(getPublicCreatorProducts()).resolves.toEqual({ products: [], error: true });
  });
});
