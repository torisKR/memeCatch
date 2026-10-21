import { afterEach, describe, expect, it, vi } from "vitest";

// Vitest emits development JSX while this test deliberately changes NODE_ENV.
vi.mock("react/jsx-dev-runtime", async () => {
  const { jsx, Fragment } = await import("react/jsx-runtime");
  return { jsxDEV: jsx, Fragment };
});

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function productionLoader() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-3004906966180197");
  vi.resetModules();
  return (await import("./adsense-script")).AdsenseScript;
}

describe("review-safe automatic advertising", () => {
  it.each(["false", "0", "TRUE", "1"])("does not render an ad loader for non-opt-in value %s", async (value) => {
    vi.stubEnv("ADSENSE_AUTO_ADS_ENABLED", value);
    const Loader = await productionLoader();
    expect(Loader()).toBeNull();
  });

  it("does not start a persistent Auto Ads runtime unless an operator explicitly opts in", async () => {
    vi.stubEnv("ADSENSE_AUTO_ADS_ENABLED", "");
    const Loader = await productionLoader();
    expect(Loader()).toBeNull();
  });
  it("retains the verified production loader behind an explicit opt-in", async () => {
    vi.stubEnv("ADSENSE_AUTO_ADS_ENABLED", "true");
    const Loader = await productionLoader();
    expect(Loader()).not.toBeNull();
  });
  it("never enables it on preview even with an opt-in", async () => {
    vi.stubEnv("ADSENSE_AUTO_ADS_ENABLED", "true");
    const Loader = await productionLoader();
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(Loader()).toBeNull();
  });
});
