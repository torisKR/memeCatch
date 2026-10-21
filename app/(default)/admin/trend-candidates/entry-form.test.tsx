import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/trend-candidate-entry", () => ({
  submitTrendCandidateEvidence: vi.fn(),
  configureTrendDiscoverySeed: vi.fn(),
}));

import { TrendCandidateEntryPanel } from "./entry-form";

describe("TrendCandidateEntryPanel", () => {
  it("labels manual observations as unverified and exposes source identity fields", () => {
    const html = renderToStaticMarkup(<TrendCandidateEntryPanel />);

    expect(html).toContain("원문 URL로 후보 등록");
    expect(html).toContain("확산·유래·독립 사용례를 확정하지 않습니다");
    expect(html).toContain('name="sourceUrl"');
    expect(html).toContain('name="platformContentId"');
    expect(html).toContain('name="creatorKey"');
    expect(html).toContain('name="publishedAt"');
    expect(html).toContain("미검수 후보로 저장");
  });

  it("separates new discovery from candidate tracking and bounds call budget", () => {
    const html = renderToStaticMarkup(<TrendCandidateEntryPanel />);

    expect(html).toContain('value="new_discovery"');
    expect(html).toContain('value="candidate_tracking"');
    expect(html).toContain('name="callBudget"');
    expect(html).toContain('max="1000"');
    expect(html).toContain("탐색 설정 저장");
  });
});
