import { describe, expect, it } from "vitest";
import { buildMemeUseKit, type MemeUseKitLabels } from "@/lib/meme-use-kit";

const labels: MemeUseKitLabels = {
  explainTitle: "Explain",
  captionTitle: "Caption",
  safetyTitle: "Safety check",
  safetyLabel: "Safety",
  usageLabel: "Usage",
  cautionLabel: "Caution",
  trendLabel: "Trend",
  noGuidance: "No extra guidance is recorded.",
  safety: { green: "Generally safe", yellow: "Context matters", gray: "Dated", red: "Risky" },
  lifecycle: { rising: "Rising", active: "Active", cooling: "Cooling", archived: "Archived" },
};

describe("buildMemeUseKit", () => {
  it("creates three copy-ready formats from editorial facts", () => {
    const kit = buildMemeUseKit(
      {
        title: "Signal meme",
        summary: "A short way to say the situation is unexpectedly intense.",
        usageNote: "Use it with close friends.",
        caution: "Avoid using it to target a real person.",
        safetyLevel: "yellow",
        lifecycleStatus: "rising",
      },
      labels,
    );

    expect(kit.map((item) => item.id)).toEqual(["explain", "caption", "safety"]);
    expect(kit[0].body).toContain("Signal meme");
    expect(kit[1].body).toContain("Trend: Rising");
    expect(kit[2].body).toContain("Caution: Avoid using it to target a real person.");
  });

  it("does not invent guidance when the source entry has none", () => {
    const kit = buildMemeUseKit(
      {
        title: "Sparse meme",
        summary: "A documented meaning.",
        usageNote: null,
        caution: null,
        safetyLevel: "green",
        lifecycleStatus: "active",
      },
      labels,
    );

    expect(kit[2].body).toContain(labels.noGuidance);
    expect(kit[2].body).not.toContain("safe for everyone");
  });
});
