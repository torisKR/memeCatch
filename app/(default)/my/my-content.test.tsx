import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ value: "en" }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("motion/react", () => ({
  motion: { div: "div", section: "section", li: "li", ul: "ul" },
  useReducedMotion: () => true,
}));
vi.mock("@/lib/actions/auth", () => ({
  signOut: vi.fn(),
  updateNickname: vi.fn(),
}));
vi.mock("@/components/my-recent", () => ({ MyRecent: () => null }));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    useLocale: () => ({
      locale: locale.value as "en" | "ja",
      messages: getMessages(locale.value as "en" | "ja"),
    }),
  };
});

import { MyContent } from "@/app/(default)/my/my-content";

function renderMyContent(
  overrides: Partial<React.ComponentProps<typeof MyContent>> = {},
) {
  return renderToStaticMarkup(
    <MyContent
      nickname="Meme finder"
      ageGroup={null}
      interests={[]}
      saved={[
        {
          id: "meme-1",
          shortId: "abc123",
          slug: "test-meme",
          title: "BTS reaction",
          summary: "A saved meaning",
          safetyLevel: "yellow",
        },
      ]}
      submissions={[]}
      loadError={false}
      nicknameSaved={false}
      savedTotal={3}
      savedResultTotal={1}
      savedQuery="BTS"
      savedSafety="yellow"
      savedPage={1}
      savedPageCount={2}
      {...overrides}
    />,
  );
}

describe("MY saved library", () => {
  it("renders a localized server-filtered search, safety filter, count, and preserved page link", () => {
    locale.value = "en";
    const html = renderMyContent();

    expect(html).toContain('name="saved_q"');
    expect(html).toContain('value="BTS"');
    expect(html).toContain('name="saved_safety"');
    expect(html).toContain("1 results · 3 saved in total");
    expect(html).toContain(
      'href="/my?saved_q=BTS&amp;saved_safety=yellow&amp;saved_page=2#saved"',
    );
    expect(html).toContain('aria-label="Saved memes pages"');
    expect(html).toContain("Page 1 of 2");
    expect(html).not.toContain("/api/plus/");
    expect(html).not.toContain("PLUS");
  });

  it("offers saved-library search to every account without a pricing upsell", () => {
    locale.value = "ja";
    const html = renderMyContent({
      savedQuery: "",
      savedSafety: null,
      savedPageCount: 1,
    });

    expect(html).toContain('name="saved_q"');
    expect(html).not.toContain("pricing");
    expect(html).not.toContain("Plus");
  });

  it("hides saved-library search when nothing is saved yet", () => {
    locale.value = "en";
    const html = renderMyContent({ saved: [], savedTotal: 0, savedResultTotal: 0, savedQuery: "", savedSafety: null, savedPageCount: 1 });

    expect(html).not.toContain('name="saved_q"');
  });

  it("exposes a withdrawal request path on My", () => {
    locale.value = "en";
    const html = renderMyContent();

    expect(html).toContain("Delete account");
    expect(html).toContain("Request account deletion");
    expect(html).toContain('href="/support"');
    expect(html).toContain("Email a request");
    expect(html).toContain("mailto:toris@toris.kr");
  });

  it("keeps the meme card slot beside the saved library", () => {
    locale.value = "en";
    const html = renderMyContent({ memeCards: <section id="meme-cards">28 free cards</section> });
    expect(html).toContain("28 free cards");
    expect(html).toContain('href="#meme-cards"');
    expect(html).toContain('id="saved"');
    expect(html).toContain("Request account deletion");
  });
});
