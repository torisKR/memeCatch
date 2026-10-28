import type { RadarConnectorRegistry } from "./radar-connectors.server";

/** Legacy Radar performs derived analysis, so credentials alone never authorize it. */
export function filterPolicyApprovedLegacyRadarConnectors(
  connectors: RadarConnectorRegistry,
  policies: readonly { platform: string; enabled: boolean; verified_at: string; approval_basis: string; derived_analysis_allowed: boolean; cross_platform_combination_allowed: boolean }[],
  now = new Date(),
): RadarConnectorRegistry {
  const eligible = Object.entries(connectors).filter(([platform]) => policies.some((policy) =>
    policy.platform === platform && policy.enabled && policy.derived_analysis_allowed &&
    Boolean(policy.approval_basis.trim()) && Date.parse(policy.verified_at) <= now.getTime(),
  ));
  if (eligible.length > 1 && eligible.some(([platform]) => !policies.some((policy) =>
    policy.platform === platform && policy.enabled && policy.derived_analysis_allowed &&
    policy.cross_platform_combination_allowed && Boolean(policy.approval_basis.trim()) &&
    Date.parse(policy.verified_at) <= now.getTime(),
  ))) return {};
  return Object.fromEntries(eligible) as RadarConnectorRegistry;
}
