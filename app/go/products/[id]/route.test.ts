import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createProductRedirectHandler } from "@/lib/affiliate/product-redirect";

const productId = "550e8400-e29b-41d4-a716-446655440000";
const affiliateUrl =
  "https://adpick.co.kr/apis/goshopping.php?affid=member123&offer=abc12&url=https%3A%2F%2Fshop.example.com%2Fp%2F1";

function request(id = productId) {
  return new Request(`https://catchmeme.com/go/products/${id}`);
}

function context(id = productId) {
  return { params: Promise.resolve({ id }) };
}

describe("product redirect handler", () => {
  beforeEach(() => {
    process.env.ADPICK_AFFILIATE_ID = "member123";
  });

  afterEach(() => {
    delete process.env.ADPICK_AFFILIATE_ID;
  });

  it("records a click and redirects an active product", async () => {
    const repository = {
      getActiveRedirect: vi.fn().mockResolvedValue(affiliateUrl),
      recordClick: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createProductRedirectHandler(
      repository,
      () => new Date("2026-07-13T00:00:00Z"),
    );

    const response = await handler(request(), context());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(
      "https://adpick.co.kr/apis/goshopping.php",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(repository.recordClick).toHaveBeenCalledOnce();
    expect(repository.recordClick).toHaveBeenCalledWith(
      productId,
      "2026-07-13",
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it("redirects an invalid UUID to the products page without querying", async () => {
    const repository = {
      getActiveRedirect: vi.fn(),
      recordClick: vi.fn(),
    };
    const handler = createProductRedirectHandler(repository, () => new Date());

    const response = await handler(request("not-a-uuid"), context("not-a-uuid"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://catchmeme.com/products");
    expect(repository.getActiveRedirect).not.toHaveBeenCalled();
  });

  it("redirects a missing or inactive product to the products page", async () => {
    const repository = {
      getActiveRedirect: vi.fn().mockResolvedValue(null),
      recordClick: vi.fn(),
    };
    const handler = createProductRedirectHandler(repository, () => new Date());

    const response = await handler(request(), context());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://catchmeme.com/products");
    expect(repository.recordClick).not.toHaveBeenCalled();
  });

  it("rejects an unsafe stored URL", async () => {
    const repository = {
      getActiveRedirect: vi.fn().mockResolvedValue("https://evil.example/buy"),
      recordClick: vi.fn(),
    };
    const handler = createProductRedirectHandler(repository, () => new Date());

    const response = await handler(request(), context());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://catchmeme.com/products");
    expect(repository.recordClick).not.toHaveBeenCalled();
  });

  it.each([undefined, ""])(
    "fails closed when the affiliate ID is %s",
    async (affiliateId) => {
      if (affiliateId === undefined) {
        delete process.env.ADPICK_AFFILIATE_ID;
      } else {
        process.env.ADPICK_AFFILIATE_ID = affiliateId;
      }
      const repository = {
        getActiveRedirect: vi.fn().mockResolvedValue(affiliateUrl),
        recordClick: vi.fn(),
      };
      const handler = createProductRedirectHandler(repository, () => new Date());

      const response = await handler(request(), context());

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://catchmeme.com/products",
      );
      expect(repository.recordClick).not.toHaveBeenCalled();
    },
  );

  it("rejects a stored URL for a different affiliate ID", async () => {
    process.env.ADPICK_AFFILIATE_ID = "different-member";
    const repository = {
      getActiveRedirect: vi.fn().mockResolvedValue(affiliateUrl),
      recordClick: vi.fn(),
    };
    const handler = createProductRedirectHandler(repository, () => new Date());

    const response = await handler(request(), context());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://catchmeme.com/products");
    expect(repository.recordClick).not.toHaveBeenCalled();
  });

  it("still redirects when click recording fails", async () => {
    const repository = {
      getActiveRedirect: vi.fn().mockResolvedValue(affiliateUrl),
      recordClick: vi.fn().mockRejectedValue(new Error("database unavailable")),
    };
    const handler = createProductRedirectHandler(
      repository,
      () => new Date("2026-07-13T00:00:00Z"),
    );

    const response = await handler(request(), context());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(affiliateUrl);
  });
});
