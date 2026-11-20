import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ExploreLoading from "./loading";

describe("ExploreLoading", () => {
  it("uses the same two-column/three-column rhythm as the loaded grid", () => {
    const html = renderToStaticMarkup(<ExploreLoading />);

    expect(html).toContain("grid-cols-2");
    // Three across on desktop: the owner asked for larger cards (2026-11-20).
    expect(html).toContain("lg:grid-cols-3");
    expect(html).not.toContain("grid-cols-4");
    expect(html).not.toContain("sm:grid-cols-3");
  });
});
