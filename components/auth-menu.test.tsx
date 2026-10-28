// @vitest-environment jsdom

import type { ComponentPropsWithoutRef } from "react";
import { act, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}));
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

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps the unauthenticated login label on one line without shrinking", () => {
    const html = renderToStaticMarkup(<AuthMenu />);
    const loginLink = html.match(/<a[^>]*href="\/login\?next=%2Fproducts"[^>]*>/)?.[0];

    expect(loginLink).toContain("whitespace-nowrap");
    expect(loginLink).toContain("shrink-0");
    expect(html).toContain(">Log in</a>");
  });

  it("hydrates a rewritten meme URL without changing the first client href, then restores the browser pathname", async () => {
    navigation.pathname = "/memes/tsmfb662-encoded-slug";
    const host = document.createElement("div");
    host.innerHTML = renderToString(<AuthMenu />);
    expect(within(host).getByRole("link", { name: "Log in" }).getAttribute("href"))
      .toBe("/login?next=%2Fmemes%2Ftsmfb662");
    document.body.append(host);

    navigation.pathname = "/memes/tsmfb662-2%25-title";
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, <AuthMenu />, { onRecoverableError });
      });

      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(within(host).getByRole("link", { name: "Log in" }).getAttribute("href"))
        .toBe("/login?next=%2Fmemes%2Ftsmfb662-2%2525-title");
    } finally {
      await act(async () => root?.unmount());
      consoleError.mockRestore();
      host.remove();
    }
  });

  it("uses the same short-id hydration path for localized meme details", () => {
    navigation.pathname = "/zh-tw/memes/tsmfb662-encoded-slug";

    expect(renderToStaticMarkup(<AuthMenu />)).toContain(
      'href="/login?next=%2Fzh-tw%2Fmemes%2Ftsmfb662"',
    );
  });

  it("restores an ordinary browser pathname after the stable hydration fallback", async () => {
    navigation.pathname = "/products";
    const host = document.createElement("div");
    host.innerHTML = renderToString(<AuthMenu />);
    document.body.append(host);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, <AuthMenu />);
      });
      expect(within(host).getByRole("link", { name: "Log in" }).getAttribute("href"))
        .toBe("/login?next=%2Fproducts");
    } finally {
      await act(async () => root?.unmount());
      host.remove();
    }
  });

  it("uses the canonical home path for the Vercel /index alias after mount", async () => {
    navigation.pathname = "/index";
    const host = document.createElement("div");
    host.innerHTML = renderToString(<AuthMenu />);
    document.body.append(host);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, <AuthMenu />);
      });
      expect(within(host).getByRole("link", { name: "Log in" }).getAttribute("href"))
        .toBe("/login?next=%2F");
    } finally {
      await act(async () => root?.unmount());
      host.remove();
    }
  });
});
