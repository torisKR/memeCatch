import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RelatedMemes } from "@/components/related-memes";

describe("RelatedMemes", () => {
  it("does not insert launcher clearance in the middle of the detail column", () => {
    const html = renderToStaticMarkup(
      <RelatedMemes
        locale="ko"
        memes={[{
          meme: {
            id: "1",
            short_id: "abc12345",
            slug: "test",
            title: "테스트 밈",
            summary: "한 줄 뜻",
            category: "phrase",
            safety_level: "green",
          },
        }]}
      />,
    );

    expect(html).toContain("비슷한 밈");
    expect(html).toContain("테스트 밈");
    expect(html).not.toContain("max-md:pb-");
    expect(html).not.toContain("4.5rem+4rem+1rem");
  });
});
