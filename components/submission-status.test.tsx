import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubmissionStatusBadge } from "@/components/submission-status";

describe("SubmissionStatusBadge", () => {
  it("uses a caller-provided localized label without changing its status styling", () => {
    const html = renderToStaticMarkup(
      <SubmissionStatusBadge status="pending" label="Received" />,
    );

    expect(html).toContain("Received");
    expect(html).not.toContain("접수됨");
    expect(html).toContain("bg-safety-gray-bg");
  });
});
