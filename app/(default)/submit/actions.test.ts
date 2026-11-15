import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags", () => ({ flags: { submissionsOpen: true } }));
vi.mock("@/lib/i18n-server", () => ({
  getRequestLocale: vi.fn().mockResolvedValue("en"),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { submitMemeWithAttachment, type SubmitState } from "./actions";

const idleState: SubmitState = { status: "idle" };

describe("submitMemeWithAttachment locale validation", () => {
  it("uses the trusted request locale for a required-name error", async () => {
    const result = await submitMemeWithAttachment(idleState, new FormData());

    expect(result).toEqual({
      status: "error",
      fieldErrors: { name: "Enter a meme name." },
    });
  });

  it("keeps the existing HTTPS URL rule while localizing its error", async () => {
    const formData = new FormData();
    formData.set("name", "Example meme");
    formData.set("sourceUrl", "http://example.com/source");

    const result = await submitMemeWithAttachment(idleState, formData);

    expect(result).toEqual({
      status: "error",
      fieldErrors: { sourceUrl: "Use a link that starts with https://." },
    });
  });
});
