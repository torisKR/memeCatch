import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnswerCard } from "@/components/answer-card";

vi.mock("@/components/save-button", () => ({
  SaveButton: () => <button type="button">Save</button>,
}));

describe("AnswerCard hydration visibility", () => {
  it("renders the answer heading and summary without hiding their section", () => {
    const html = renderToStaticMarkup(
      <AnswerCard
        meme={{
          title: "Sample meme",
          summary: "Immediate answer",
          lifecycle_status: "active",
          safety_level: "green",
        }}
      />,
    );
    const sectionTag = html.match(/^<section[^>]*>/)?.[0];

    expect(html).toContain("<h1");
    expect(html).toContain("Sample meme");
    expect(html).toContain('id="meme-summary"');
    expect(html).toContain("Immediate answer");
    expect(sectionTag).not.toMatch(/opacity:\s*0(?:;|\")/);
  });
});
