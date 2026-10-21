import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/community-post-form", () => ({ CommunityPostForm: () => null }));

import { metadata } from "@/app/(default)/community/new/page";

describe("community authoring metadata", () => {
  it("keeps the login-only editor out of search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
