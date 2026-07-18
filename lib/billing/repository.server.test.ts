import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  getCurrentBillingUser,
  getPremiumEntitlement,
} from "@/lib/billing/repository.server";

describe("billing repository authentication", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it("treats a missing Supabase session as a signed-out checkout visitor", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getCurrentBillingUser()).resolves.toBeNull();
  });

  it("returns a signed-out entitlement when the session cookie is missing", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getPremiumEntitlement()).resolves.toEqual({
      signedIn: false,
      isPremium: false,
      status: null,
      currentPeriodEnd: null,
    });
  });

  it("still surfaces unexpected authentication failures", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("auth service unavailable"),
    });

    await expect(getCurrentBillingUser()).rejects.toThrow("auth service unavailable");
  });
});
