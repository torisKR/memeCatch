import { describe, expect, it } from "vitest";
import { RETIRED_PRODUCT_REDIRECTS } from "@/lib/retired-product-paths";
import { redirectRetiredProduct } from "@/lib/retired-product-redirects";

describe("retired product redirects", () => {
  it("sends every removed product URL home with a permanent redirect", () => {
    const sources = RETIRED_PRODUCT_REDIRECTS.map((entry) => entry.source);
    expect(sources).toEqual([
      "/products",
      "/products/:path*",
      "/:locale(en|ja|zh|zh-tw)/products",
      "/:locale(en|ja|zh|zh-tw)/products/:path*",
      "/go/products",
      "/go/products/:path*",
      "/:locale(en|ja|zh|zh-tw)/go/products",
      "/:locale(en|ja|zh|zh-tw)/go/products/:path*",
      "/api/cron/adpick-hotdeals",
      "/api/creator-products",
      "/api/creator-products/:path*",
      "/admin/creator-products",
      "/admin/creator-products/:path*",
    ]);
    for (const entry of RETIRED_PRODUCT_REDIRECTS) {
      expect(entry.destination).toBe("/");
      expect(entry.permanent).toBe(true);
    }
  });

  it("answers with a relative 308 so the bind host cannot leak", () => {
    const response = redirectRetiredProduct();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("location")).not.toContain("0.0.0.0");
  });
});
