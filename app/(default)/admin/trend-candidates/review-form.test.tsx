import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/trend-candidates", () => ({ reviewTrendCandidate: vi.fn() }));

import { TrendCandidateReviewForm } from "./review-form";

describe("TrendCandidateReviewForm", () => {
  it("pre-fills only evidence URLs supplied by the authenticated parent page", () => {
    const html = renderToStaticMarkup(
      <TrendCandidateReviewForm
        candidateId="11111111-1111-4111-8111-111111111111"
        evidenceLinks={[
          { label: "YouTube 독립 사용례 1", url: "https://www.youtube.com/watch?v=one" },
          { label: "TikTok 독립 사용례 2", url: "https://www.tiktok.com/@creator/video/two" },
        ]}
      />,
    );

    expect(html).toContain("YouTube 독립 사용례 1 | https://www.youtube.com/watch?v=one");
    expect(html).toContain("TikTok 독립 사용례 2 | https://www.tiktok.com/@creator/video/two");
    expect(html).toContain("검수된 독립 사용례 URL만 미리 채웁니다");
  });

  it("renders explicit targets, relation decisions, and selectable split signals", () => {
    const signalId = "44444444-4444-4444-8444-444444444444";
    const html = renderToStaticMarkup(
      <TrendCandidateReviewForm
        candidateId="11111111-1111-4111-8111-111111111111"
        signals={[{ id: signalId, label: "youtube · https://example.com/source" }]}
      />,
    );

    expect(html).toContain('name="targetMemeId"');
    expect(html).toContain('name="targetCandidateId"');
    expect(html).toContain(`name="splitSignalIds" value="${signalId}"`);
    expect(html).toContain('value="link_existing"');
    expect(html).toContain('value="link_alias"');
    expect(html).toContain('value="merge"');
    expect(html).toContain('value="split"');
  });
});
