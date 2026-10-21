import { describe, expect, it } from "vitest";

import type { RadarConnectorRegistry } from "./radar-connectors.server";
import { filterPolicyApprovedLegacyRadarConnectors } from "./legacy-policy-gate";

const NOW = new Date("2026-10-13T00:00:00.000Z");
const connectors = {
  instagram: { platform: "instagram", collect: async () => ({ signals: [] }) },
  threads: { platform: "threads", collect: async () => ({ signals: [] }) },
} as unknown as RadarConnectorRegistry;

function policy(platform: string, overrides: Record<string, unknown> = {}) {
  return {
    platform,
    enabled: true,
    verified_at: "2026-10-01T00:00:00.000Z",
    approval_basis: "approved API terms reviewed 2026-10-01",
    derived_analysis_allowed: true,
    cross_platform_combination_allowed: false,
    ...overrides,
  };
}

describe("filterPolicyApprovedLegacyRadarConnectors", () => {
  it("does not treat configured credentials as policy approval", () => {
    expect(filterPolicyApprovedLegacyRadarConnectors(connectors, [], NOW)).toEqual({});
  });

  it.each([
    ["disabled", { enabled: false }],
    ["derived analysis denied", { derived_analysis_allowed: false }],
    ["blank approval basis", { approval_basis: "  " }],
    ["future verification", { verified_at: "2026-10-14T00:00:00.000Z" }],
    ["invalid verification", { verified_at: "not-a-date" }],
  ])("rejects a source whose policy is %s", (_name, overrides) => {
    expect(filterPolicyApprovedLegacyRadarConnectors(connectors, [policy("instagram", overrides)], NOW)).toEqual({});
  });

  it("allows one approved source without pretending it is cross-platform analysis", () => {
    const result = filterPolicyApprovedLegacyRadarConnectors(connectors, [policy("instagram")], NOW);
    expect(Object.keys(result)).toEqual(["instagram"]);
  });

  it("rejects all multi-source analysis when any eligible source lacks cross-platform approval", () => {
    const result = filterPolicyApprovedLegacyRadarConnectors(connectors, [
      policy("instagram", { cross_platform_combination_allowed: true }),
      policy("threads", { cross_platform_combination_allowed: false }),
    ], NOW);
    expect(result).toEqual({});
  });

  it("allows multiple sources only when every eligible policy explicitly approves combination", () => {
    const result = filterPolicyApprovedLegacyRadarConnectors(connectors, [
      policy("instagram", { cross_platform_combination_allowed: true }),
      policy("threads", { cross_platform_combination_allowed: true }),
    ], NOW);
    expect(Object.keys(result).sort()).toEqual(["instagram", "threads"]);
  });
});
