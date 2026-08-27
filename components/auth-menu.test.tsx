import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/products" }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: "div" },
  useReducedMotion: () => false,
}));

vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/i18n-client", async (importOriginal) => {
  const { getMessages } = await import("@/lib/i18n");
  const original = await importOriginal<typeof import("@/lib/i18n-client")>();

  return {
    ...original,
    useLocale: () => ({ locale: "en", messages: getMessages("en") }),
  };
});

import { AuthMenu } from "@/components/auth-menu";

describe("AuthMenu", () => {
  beforeEach(() => {
    navigation.pathname = "/products";
  });

  it("keeps the unauthenticated login label on one line without shrinking", () => {
    const html = renderToStaticMarkup(<AuthMenu />);
    const loginLink = html.match(/<a[^>]*href="\/login\?next=%2Fproducts"[^>]*>/)?.[0];

    expect(loginLink).toContain("whitespace-nowrap");
    expect(loginLink).toContain("shrink-0");
    expect(html).toContain(">Log in</a>");
  });

  it("uses the canonical home path for the Vercel /index alias", () => {
    navigation.pathname = "/index";

    expect(renderToStaticMarkup(<AuthMenu />)).toContain(
      'href="/login?next=%2F"',
    );
  });
});
