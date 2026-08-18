import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { growthSessionIdFromRequest } from "@/lib/growth/events.server";

describe("growthSessionIdFromRequest", () => {
  it("uses only a valid server-observed cookie", () => {
    expect(growthSessionIdFromRequest(new Request("https://catchmeme.com", {
      headers: { cookie: "mc_growth_session=20000000-0000-4000-8000-000000000002" },
    }))).toBe("20000000-0000-4000-8000-000000000002");
    expect(growthSessionIdFromRequest(new Request("https://catchmeme.com", {
      headers: { cookie: "mc_growth_session=%E0%A4%A" },
    }))).toBeNull();
    expect(growthSessionIdFromRequest(new Request("https://catchmeme.com"))).toBeNull();
  });
});
