import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { metadata } from "@/app/(default)/products/mine/page";

describe("creator product dashboard metadata", () => {
  it("keeps the login-only dashboard out of search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
