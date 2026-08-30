// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentPropsWithoutRef<"a">) => (
    <a href={typeof href === "string" ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/memes/demo1234",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession },
  }),
}));

import { AuthInvite } from "@/components/auth-invite";

afterEach(() => {
  cleanup();
  getSession.mockReset();
});

describe("AuthInvite", () => {
  it("reserves the guest card height before the session is known", () => {
    getSession.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AuthInvite />);

    expect(container.querySelector('[data-auth-invite="pending"]')).not.toBeNull();
    expect(screen.getByText("로그인하면 밈캐치를 200% 즐길 수 있어요")).toBeTruthy();
    expect(container.querySelector("aside")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows the invite after a guest session resolves without dropping the copy", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthInvite />);

    await waitFor(() => {
      expect(screen.getByRole("complementary", { name: "로그인 안내" })).toBeTruthy();
    });
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe(
      "/login?next=%2Fmemes%2Fdemo1234",
    );
  });

  it("removes the invite for signed-in members", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    const { container } = render(<AuthInvite />);

    await waitFor(() => {
      expect(container.querySelector('[data-auth-invite="pending"]')).toBeNull();
    });
    expect(screen.queryByText("로그인하면 밈캐치를 200% 즐길 수 있어요")).toBeNull();
  });
});
