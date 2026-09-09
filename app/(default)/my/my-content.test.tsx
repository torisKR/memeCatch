import type { ComponentPropsWithoutRef, ReactNode } from "react";
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
  updateProfileCustomization: vi.fn(),
}));
vi.mock("@/components/my-recent", () => ({ MyRecent: () => null }));
vi.mock("@/components/premium/saved-meta-editor", () => ({
  SavedMetaEditor: () => <div data-saved-editor />,
}));
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
          collection: null,
          note: null,
        },
      ]}
      collectionNames={["Launch ideas", "Archive"]}
      submissions={[]}
      loadError={false}
      nicknameSaved={false}
      flair={null}
      accentColor={null}
      customSaved={false}
      isPremium
      saveLimit={30}
      savedTotal={3}
      savedResultTotal={1}
      savedQuery="BTS"
      savedSafety="yellow"
      savedPage={1}
      savedPageCount={2}
      myFeed={(<div>personal feed</div>) as ReactNode}
      {...overrides}
    />,
  );
}

describe("Plus Meme Vault", () => {
  it("renders a localized server-filtered search, safety filter, count, and preserved page link", () => {
    locale.value = "en";
    const html = renderMyContent();

    expect(html).toContain("Your meme vault");
    expect(html).toContain('name="saved_q"');
    expect(html).toContain('value="BTS"');
    expect(html).toContain('name="saved_safety"');
    expect(html).toContain("1 results · 3 saved in total");
    expect(html).toContain(
      'href="/my?saved_q=BTS&amp;saved_safety=yellow&amp;saved_page=2#saved"',
    );
    expect(html).toContain("Build a collection brief");
    expect(html).toContain('action="/api/plus/collection-brief"');
    expect(html).toContain('name="collection"');
    expect(html).toContain("Download brief");
  });

  it("keeps the vault locked for free accounts and sends Japanese users to localized pricing", () => {
    locale.value = "ja";
    const html = renderMyContent({
      isPremium: false,
      collectionNames: [],
      savedQuery: "",
      savedSafety: null,
      savedPageCount: 1,
      myFeed: <div>upgrade gate</div>,
    });

    expect(html).toContain("Plusで自分のミーム保管庫を検索");
    expect(html).toContain('href="/ja/pricing"');
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
});
