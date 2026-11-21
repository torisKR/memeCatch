import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemeNeighbourLinks } from "@/components/meme-neighbour-links";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const item = (id: string, year = 2020) => ({
  id, short_id: id, slug: `s-${id}`, title: `밈 ${id}`, summary: "", category: "phrase", origin_year: year,
});

describe("MemeNeighbourLinks", () => {
  it("links same-category and same-year memes plus the directory", () => {
    const html = renderToStaticMarkup(
      <MemeNeighbourLinks category="phrase" originYear={2020} sameCategory={[item("a")]} sameYear={[item("b")]} />,
    );
    expect(html).toContain('href="/memes/a-s-a"');
    expect(html).toContain('href="/memes/b-s-b"');
    expect(html).toContain("같은 분류: 밈 용어(유행어)");
    expect(html).toContain("같은 해(2020년)로 정리된 밈");
    expect(html).toContain('href="/memes"');
  });

  it("renders nothing without neighbours", () => {
    expect(renderToStaticMarkup(
      <MemeNeighbourLinks category="phrase" originYear={null} sameCategory={[]} sameYear={[]} />,
    )).toBe("");
  });
});
