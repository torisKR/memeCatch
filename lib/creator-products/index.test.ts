import { describe, expect, it } from "vitest";
import {
  CREATOR_PRODUCT_CATEGORIES,
  validateCreatorProductInput,
  validatePublicProductUrl,
} from "./index";

const valid = {
  title: "고양이 밈 티셔츠",
  description: "직접 디자인한 티셔츠입니다.",
  externalUrl: "https://shop.example.com/products/cat-shirt",
  imagePath: "creator-products/owner-1/abc123.png",
  price: "19000",
  category: "apparel",
  relationshipDisclosure: "creator",
  rightsAccepted: true,
};

describe("creator product validation", () => {
  it("accepts a bounded listing with a public HTTPS destination", () => {
    expect(validateCreatorProductInput(valid)).toMatchObject({ ok: true });
    expect(validatePublicProductUrl("https://8.8.8.8/product")).toBe(true);
  });

  it.each([
    "http://shop.example/item",
    "javascript:alert(1)",
    "https://user:pass@shop.example/item",
    "https://localhost/item",
    "https://shop.example/item",
    "https://intranet/item",
    "https://127.0.0.1/item",
    "https://10.2.3.4/item",
    "https://[::1]/item",
    "https://shop.example/item\n.evil.test",
  ])("rejects unsafe destination %s", (url) => {
    expect(validatePublicProductUrl(url)).toBe(false);
  });

  it("requires rights attestation and bounds all listing fields", () => {
    expect(validateCreatorProductInput({ ...valid, rightsAccepted: false })).toMatchObject({ ok: false });
    expect(validateCreatorProductInput({ ...valid, title: "x".repeat(201) })).toMatchObject({ ok: false });
    expect(validateCreatorProductInput({ ...valid, description: "x".repeat(5001) })).toMatchObject({ ok: false });
    expect(validateCreatorProductInput({ ...valid, price: "-1" })).toMatchObject({ ok: false });
    expect(validateCreatorProductInput({ ...valid, category: "not-a-category" })).toMatchObject({ ok: false });
    expect(CREATOR_PRODUCT_CATEGORIES).toContain("apparel");
    expect(validateCreatorProductInput(null as unknown as typeof valid)).toMatchObject({ ok: false });
    expect(validateCreatorProductInput({ ...valid, title: null as unknown as string })).toMatchObject({ ok: false });
  });

  it("only accepts a creator-products image path scoped to the submitter", () => {
    expect(validateCreatorProductInput({ ...valid, imagePath: "creator-products/owner-2/image.png" }, "owner-1"))
      .toMatchObject({ ok: false });
    expect(validateCreatorProductInput({ ...valid, imagePath: "meme-uploads/owner-1/image.png" }, "owner-1"))
      .toMatchObject({ ok: false });
  });
});
