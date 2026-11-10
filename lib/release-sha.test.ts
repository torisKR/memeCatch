import { describe, expect, it } from "vitest";
import { releaseShaFromEnv } from "@/lib/release-sha";

describe("releaseShaFromEnv", () => {
  it("lets the Vercel platform SHA win over a stale project RELEASE_SHA", () => {
    expect(releaseShaFromEnv({
      VERCEL: "1",
      RELEASE_SHA: "de2a2e63",
      VERCEL_GIT_COMMIT_SHA: "47a38535",
    })).toBe("47a38535");
  });

  it("does not publish a project RELEASE_SHA when Vercel has no platform SHA", () => {
    expect(releaseShaFromEnv({
      VERCEL: "1",
      RELEASE_SHA: "de2a2e63",
    })).toBeUndefined();
  });

  it("uses RELEASE_SHA off Vercel", () => {
    expect(releaseShaFromEnv({
      RELEASE_SHA: "worker-sha",
      VERCEL_GIT_COMMIT_SHA: "platform-sha",
    })).toBe("worker-sha");
  });

  it("falls back to a git SHA off Vercel when RELEASE_SHA is unset", () => {
    expect(releaseShaFromEnv({ VERCEL_GIT_COMMIT_SHA: "platform-sha" })).toBe("platform-sha");
    expect(releaseShaFromEnv({})).toBeUndefined();
  });
});
