import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, eq, redirect, update } = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  redirect: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));

import { completeOnboarding } from "./auth";

describe("completeOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eq.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn().mockReturnValue({ update }),
    });
  });

  it("updates only validated onboarding values", async () => {
    const form = new FormData();
    form.set("nickname", "Meme Maker");
    form.set("use_purpose", "invalid");
    form.set("age_group", "20s");
    form.append("interests", "dance");
    form.append("interests", "invalid");
    form.append("preferred_platforms", "instagram");
    form.append("preferred_platforms", "invalid");

    await completeOnboarding(form);

    expect(update).toHaveBeenCalledWith({
      nickname: "Meme Maker",
      use_purpose: "creator",
      age_group: "20s",
      interests: ["dance"],
      preferred_platforms: ["instagram"],
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });
});
