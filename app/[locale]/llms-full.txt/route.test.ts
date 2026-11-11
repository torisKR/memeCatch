import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/meme-translations", () => ({
  getLocalizedFeaturedMemes: vi.fn(async () => []),
}));

import { dynamic as routeDynamic } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("localized llms-full publication export", () => {
  it("renders on request so a database-less build cannot cache a failure", () => {
    expect(routeDynamic).toBe("force-dynamic");
  });
});
