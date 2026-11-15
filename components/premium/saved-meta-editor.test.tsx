import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ value: "en" }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    useLocale: () => ({
      locale: locale.value as "en" | "ja",
      messages: getMessages(locale.value as "en" | "ja"),
    }),
  };
});

import { SavedMetaEditor } from "@/components/premium/saved-meta-editor";

describe("SavedMetaEditor", () => {
  it("uses localized Plus vault copy for an English member", () => {
    locale.value = "en";
    const html = renderToStaticMarkup(
      <SavedMetaEditor
        memeId="meme-1"
        isPremium
        collection={null}
        note={null}
      />,
    );

    expect(html).toContain("Add folder &amp; note");
    expect(html).not.toMatch(/[\uac00-\ud7a3]/);
  });

  it("links a Japanese free user to localized pricing", () => {
    locale.value = "ja";
    const html = renderToStaticMarkup(
      <SavedMetaEditor
        memeId="meme-1"
        isPremium={false}
        collection={null}
        note={null}
      />,
    );

    expect(html).toContain('href="/ja/pricing"');
    expect(html).toContain(
      "保存したミームをフォルダに整理してメモを残せます。",
    );
  });
});
