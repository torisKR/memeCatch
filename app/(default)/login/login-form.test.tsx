// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signInWithWeb3: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: "div", span: "span" },
  useReducedMotion: () => true,
}));
vi.mock("@/components/brand-mark", () => ({ BrandTile: () => <span /> }));
vi.mock("@/lib/actions/auth", () => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

import { LoginForm } from "./login-form";

type TestWallet = {
  address: `0x${string}`;
  request: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
};

function setWallet(wallet?: TestWallet) {
  Object.defineProperty(window, "klaytn", {
    configurable: true,
    value: wallet,
  });
}

function wallet(chainId = "0x2019"): TestWallet {
  return {
    address: "0x0000000000000000000000000000000000000001",
    request: vi.fn().mockResolvedValue(chainId),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

beforeEach(() => {
  auth.signInWithWeb3.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  setWallet(undefined);
});

afterEach(() => {
  cleanup();
  delete (window as Window & { klaytn?: TestWallet }).klaytn;
});

describe("LoginForm Kaia Wallet", () => {
  it("explains when the Kaia provider is unavailable", async () => {
    render(<LoginForm next="/saved" />);

    fireEvent.click(screen.getByRole("button", { name: "Kaia Wallet로 로그인" }));

    expect(await screen.findByText(/Kaia Wallet을 찾지 못했어요/)).toBeTruthy();
    expect(auth.signInWithWeb3).not.toHaveBeenCalled();
  });

  it("blocks authentication outside Kaia Mainnet", async () => {
    const provider = wallet("0x1");
    setWallet(provider);
    render(<LoginForm next="/saved" />);

    fireEvent.click(screen.getByRole("button", { name: "Kaia Wallet로 로그인" }));

    expect(await screen.findByText(/Kaia Mainnet으로 네트워크를 변경/)).toBeTruthy();
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_chainId" });
    expect(auth.signInWithWeb3).not.toHaveBeenCalled();
  });

  it("signs in with the Kaia provider and preserves a safe next route", async () => {
    const provider = wallet();
    setWallet(provider);
    auth.signInWithWeb3.mockResolvedValue({
      data: { session: { access_token: "test" } },
      error: null,
    });
    render(<LoginForm next="//evil.example" />);

    fireEvent.click(screen.getByRole("button", { name: "Kaia Wallet로 로그인" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(auth.signInWithWeb3).toHaveBeenCalledWith({
      chain: "ethereum",
      wallet: provider,
      statement: "Sign in to MemeCatch with Kaia Wallet.",
    });
    expect(provider.request.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signInWithWeb3.mock.invocationCallOrder[0],
    );
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("distinguishes a rejected wallet signature", async () => {
    setWallet(wallet());
    auth.signInWithWeb3.mockRejectedValue(
      Object.assign(new Error("User rejected the request"), { code: 4001 }),
    );
    render(<LoginForm next="/saved" />);

    fireEvent.click(screen.getByRole("button", { name: "Kaia Wallet로 로그인" }));

    expect(await screen.findByText(/Kaia Wallet 서명이 취소됐어요/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
