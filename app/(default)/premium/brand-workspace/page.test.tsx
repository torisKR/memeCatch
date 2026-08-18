import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  entitlement: vi.fn(),
  loadBrandWorkspace: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/billing/repository.server", () => ({ getPremiumEntitlement: mocks.entitlement }));
vi.mock("@/lib/actions/brand-workspace", () => ({ loadBrandWorkspace: mocks.loadBrandWorkspace }));
vi.mock("./workspace-forms", () => ({ BrandWorkspaceForms: () => null }));

import BrandWorkspacePage from "./page";

describe("BrandWorkspacePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [{ signedIn: false, isPremium: false }, "/login?next=/premium/brand-workspace"],
    [{ signedIn: true, isPremium: false }, "/pricing?from=brand-workspace"],
  ])("redirects without loading private brand context", async (entitlement, destination) => {
    mocks.entitlement.mockResolvedValue(entitlement);

    await expect(BrandWorkspacePage()).rejects.toThrow(`redirect:${destination}`);
    expect(mocks.loadBrandWorkspace).not.toHaveBeenCalled();
  });
});
