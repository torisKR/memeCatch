import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, eq, redirect, signOut, signUp, update } = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  redirect: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));

import { completeOnboarding, signUp as submitSignUp } from "./auth";

describe("completeOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eq.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
        signUp,
      },
      from: vi.fn().mockReturnValue({ update }),
    });
    signUp.mockResolvedValue({ data: { session: null }, error: null });
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

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { signOut, signUp } });
    signOut.mockResolvedValue({ error: null });
    signUp.mockResolvedValue({ data: { session: null }, error: null });
  });

  function signupForm(email: string) {
    const form = new FormData();
    form.set("nickname", "Meme Maker");
    form.set("email", email);
    form.set("password", "password");
    return form;
  }

  it("blocks the internal OAuth email domain before calling Supabase", async () => {
    const result = await submitSignUp(
      null,
      signupForm("claimed@auth.memecatch.internal"),
    );

    expect(result?.fieldErrors?.email).toBe("가입할 수 없는 이메일 도메인이에요");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("returns the same generic response for accepted and rejected signups", async () => {
    const telemetry = vi.spyOn(console, "error").mockImplementation(() => undefined);
    signUp.mockResolvedValueOnce({
      data: { session: { access_token: "new-session" } },
      error: null,
    });
    const accepted = await submitSignUp(null, signupForm("new@example.com"));
    signUp.mockResolvedValueOnce({
      data: { session: null },
      error: new Error("User already registered"),
    });
    const rejected = await submitSignUp(null, signupForm("known@example.com"));

    expect(accepted?.notice).toBe(rejected?.notice);
    expect(accepted?.formError).toBeUndefined();
    expect(rejected?.formError).toBeUndefined();
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(telemetry).toHaveBeenCalledWith({ event: "auth_signup_provider_failed" });
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain("known@example.com");
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain("password");
    telemetry.mockRestore();
  });

  it("also clears cookies and returns the generic state when signup throws", async () => {
    const telemetry = vi.spyOn(console, "error").mockImplementation(() => undefined);
    signUp.mockRejectedValueOnce(new Error("network unavailable"));

    const result = await submitSignUp(null, signupForm("unknown@example.com"));

    expect(result?.notice).toBeTruthy();
    expect(signOut).toHaveBeenCalledOnce();
    expect(telemetry).toHaveBeenCalledWith({ event: "auth_signup_provider_failed" });
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain("network unavailable");
    telemetry.mockRestore();
  });
});
