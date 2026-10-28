import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafetyBadge } from "./safety-badge";

describe("static readable safety signals", () => {
  it.each(["green", "yellow", "gray", "red"] as const)("keeps icon and text for %s without decorative animation", (level) => {
    for (const size of ["sm", "lg"] as const) {
      const html = renderToStaticMarkup(<SafetyBadge level={level} size={size} />);
      expect(html).toContain(`data-safety-icon="${level}"`);
      expect(html).not.toMatch(/safety-pulse|instrument-grid|shadow-\[/);
      expect(html.replace(/<[^>]*>/g, "").trim().length).toBeGreaterThan(0);
    }
  });
});
