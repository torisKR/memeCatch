import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/creator-products/creator-product-form", () => ({
  CreatorProductForm: () => null,
}));

import { metadata } from "@/app/(default)/products/new/page";

describe("creator product editor metadata", () => {
  it("keeps the login-only editor out of search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
