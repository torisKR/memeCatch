import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RelatedMemes } from "@/components/related-memes";

describe("RelatedMemes", () => {
  it("does not insert launcher clearance in the middle of the detail column", () => {
    const html = renderToStaticMarkup(
      <RelatedMemes
        locale="ko"
        memes={["1", "2", "3"].map((id) => ({
          meme: {
            id,
            short_id: `abc1234${id}`,
            slug: `test-${id}`,
            title: `테스트 밈 ${id}`,
            summary: "한 줄 뜻",
            category: "phrase",
            safety_level: "green",
          },
        }))}
      />,
    );

    expect(html).toContain("비슷한 밈");
    expect(html).toContain("테스트 밈 1");
    expect(html).not.toContain("max-md:pb-");
    expect(html).not.toContain("4.5rem+4rem+1rem");
  });
});
