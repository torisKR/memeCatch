// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signInWithWeb3: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const dappPortal = vi.hoisted(() => ({ init: vi.fn() }));
const serverActions = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@linenext/dapp-portal-sdk", () => ({
  default: { init: dappPortal.init },
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: "div", span: "span" },
  useReducedMotion: () => true,
}));
vi.mock("@/components/brand-mark", () => ({ BrandTile: () => <span /> }));
vi.mock("@/lib/actions/auth", () => serverActions);
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

import { LoginForm } from "./login-form";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n-client";

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

function renderLogin(locale: Locale = "ko", next = "/saved") {
  window.history.replaceState({}, "", "/login");
  document.cookie = `${LOCALE_COOKIE}=; Max-Age=0; path=/`;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/`;
  return render(
    <LocaleProvider initialLocale={locale}>
      <LoginForm next={next} />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_UNIFI_CLIENT_ID", "");
  auth.signInWithWeb3.mockReset();
  dappPortal.init.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  serverActions.signIn.mockReset();
  serverActions.signUp.mockReset();
  setWallet(undefined);
});

describe("LoginForm signup notice", () => {
  it("announces the generic signup result accessibly", async () => {
    const notice = "가입 요청을 접수했어요. 가입 가능한 이메일이면 안내 메일을 확인하거나 로그인해 주세요.";
    serverActions.signUp.mockResolvedValue({ notice });
    render(
      <LocaleProvider initialLocale="ko">
        <LoginForm next="/saved" initialMode="signup" />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "밈메이커" },
    });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "가입하고 시작하기" }));

    const message = await screen.findByText(notice);
    expect(message.getAttribute("role")).toBe("status");
    expect(message.getAttribute("aria-live")).toBe("polite");
  });

  it("keeps email signup disabled until terms and privacy are accepted", () => {
    render(
      <LocaleProvider initialLocale="ko">
        <LoginForm next="/saved" initialMode="signup" />
      </LocaleProvider>,
    );

    expect(screen.getAllByRole("link", { name: "이용약관" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "개인정보처리방침" }).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/소셜 로그인을 시작하면 이용약관과 개인정보처리방침에 동의/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "가입하고 시작하기" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "가입하고 시작하기" }));
    expect(serverActions.signUp).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.cookie = `${LOCALE_COOKIE}=; Max-Age=0; path=/`;
  window.history.replaceState({}, "", "/");
  delete (window as Window & { klaytn?: TestWallet }).klaytn;
});

describe("LoginForm Kaia Wallet", () => {
  it("initializes Unifi Wallet, validates its account, and signs in with its provider", async () => {
    vi.stubEnv("NEXT_PUBLIC_UNIFI_CLIENT_ID", "public-client-id");
    const provider = wallet();
    provider.request.mockResolvedValue([
      "0x0000000000000000000000000000000000000001",
    ]);
    const getWalletProvider = vi.fn(() => provider);
    dappPortal.init.mockResolvedValue({ getWalletProvider });
    auth.signInWithWeb3.mockResolvedValue({
      data: { session: { access_token: "test" } },
      error: null,
    });
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Unifi Wallet로 로그인" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/saved"));
    expect(dappPortal.init).toHaveBeenCalledWith({
      clientId: "public-client-id",
      chainId: "8217",
    });
    expect(getWalletProvider).toHaveBeenCalledOnce();
    expect(provider.request).toHaveBeenCalledWith({
      method: "kaia_requestAccounts",
    });
    expect(auth.signInWithWeb3).toHaveBeenCalledWith(expect.objectContaining({
      chain: "ethereum",
      statement: "Sign in to MemeCatch with Kaia Wallet.",
    }));
    const loginWallet = auth.signInWithWeb3.mock.calls[0][0].wallet;
    await expect(loginWallet.request({ method: "eth_requestAccounts" })).resolves.toEqual([
      "0x0000000000000000000000000000000000000001",
    ]);
    await expect(loginWallet.request({ method: "eth_chainId" })).resolves.toBe("0x2019");
    await loginWallet.request({ method: "personal_sign", params: ["message", "address"] });
    expect(provider.request).toHaveBeenLastCalledWith({
      method: "personal_sign",
      params: ["message", "address"],
    });
  });

  it("rejects an invalid Unifi Wallet account before authentication", async () => {
    vi.stubEnv("NEXT_PUBLIC_UNIFI_CLIENT_ID", "public-client-id");
    const provider = wallet();
    provider.request.mockResolvedValue(["not-an-address"]);
    dappPortal.init.mockResolvedValue({
      getWalletProvider: () => provider,
    });
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Unifi Wallet로 로그인" }));

    expect(await screen.findByText(/Kaia Wallet 로그인에 실패했어요/)).toBeTruthy();
    expect(auth.signInWithWeb3).not.toHaveBeenCalled();
  });

  it("explains when the Kaia provider is unavailable", async () => {
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Unifi Wallet로 로그인" }));

    expect(await screen.findByText(/Kaia Wallet을 찾지 못했어요/)).toBeTruthy();
    expect(auth.signInWithWeb3).not.toHaveBeenCalled();
  });

  it("blocks authentication outside Kaia Mainnet", async () => {
    const provider = wallet("0x1");
    setWallet(provider);
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Unifi Wallet로 로그인" }));

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
    renderLogin("ko", "//evil.example");

    fireEvent.click(screen.getByRole("button", { name: "Unifi Wallet로 로그인" }));

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
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Unifi Wallet로 로그인" }));

    expect(await screen.findByText(/Kaia Wallet 서명이 취소됐어요/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders the English login UI and unavailable-wallet error", async () => {
    renderLogin("en");

    fireEvent.click(screen.getByRole("button", { name: "Continue with Unifi Wallet" }));

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(await screen.findByText(/Kaia Wallet was not found/)).toBeTruthy();
  });

  it("renders the Japanese Kaia button and wrong-chain error", async () => {
    setWallet(wallet("0x1"));
    renderLogin("ja");

    fireEvent.click(screen.getByRole("button", { name: "Unifi Walletでログイン" }));

    expect(await screen.findByText(/Kaia Mainnetに切り替えて/)).toBeTruthy();
    expect(auth.signInWithWeb3).not.toHaveBeenCalled();
  });

  it("uses the Chinese fallback for zh-tw Kaia rejection copy", async () => {
    setWallet(wallet());
    auth.signInWithWeb3.mockRejectedValue(
      Object.assign(new Error("User rejected the request"), { code: 4001 }),
    );
    renderLogin("zh-tw");

    fireEvent.click(screen.getByRole("button", { name: "使用 Unifi Wallet 登录" }));

    expect(await screen.findByText(/Kaia Wallet 签名已取消/)).toBeTruthy();
  });
});
