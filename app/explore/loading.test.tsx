import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ExploreLoading from "./loading";

describe("ExploreLoading", () => {
  it("uses the same two-column/four-column rhythm as the loaded grid", () => {
    const html = renderToStaticMarkup(<ExploreLoading />);

    expect(html).toContain("grid-cols-2");
    expect(html).toContain("lg:grid-cols-4");
    expect(html).not.toContain("sm:grid-cols-3");
  });
});
