// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverActions = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: "div", span: "span" },
  useReducedMotion: () => true,
}));
vi.mock("@/components/brand-mark", () => ({ BrandTile: () => <span /> }));
vi.mock("@/lib/actions/auth", () => serverActions);
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }),
}));

import { LoginForm } from "./login-form";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n-client";
import { LOGIN_COPY } from "@/lib/i18n-login";

function renderLogin(locale: Locale = "ko", next = "/saved", pathname = "/login") {
  window.history.replaceState({}, "", pathname);
  document.cookie = `${LOCALE_COOKIE}=; Max-Age=0; path=/`;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/`;
  return render(
    <LocaleProvider initialLocale={locale}>
      <LoginForm next={next} />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  serverActions.signIn.mockReset();
  serverActions.signUp.mockReset();
});

describe("LoginForm signup notice", () => {
  it("announces the generic signup result accessibly", async () => {
    const notice = "가입 요청을 접수했어요. 가입 가능한 이메일이면 확인 메일을 보내요. 메일의 링크를 열기 전에는 로그인되지 않아요.";
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
  document.cookie = `${LOCALE_COOKIE}=; Max-Age=0; path=/`;
  window.history.replaceState({}, "", "/");
});

describe("LoginForm providers and locale chrome", () => {
  it("offers Kakao and Google but no wallet login", () => {
    renderLogin("ko");

    expect(screen.getByRole("button", { name: LOGIN_COPY.ko.kakaoButton })).toBeTruthy();
    expect(screen.getByRole("button", { name: LOGIN_COPY.ko.googleButton })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Wallet/i })).toBeNull();
  });

  it.each(["en", "ja", "zh-tw"] as const)(
    "keeps Korean login chrome on unprefixed /login when the cookie is %s",
    (cookieLocale) => {
      renderLogin(cookieLocale, "/saved", "/login");

      expect(screen.getByRole("heading", { name: LOGIN_COPY.ko.loginTitle })).toBeTruthy();
      expect(screen.getByLabelText(LOGIN_COPY.ko.email)).toBeTruthy();
      expect(screen.queryByRole("heading", { name: LOGIN_COPY.en.loginTitle })).toBeNull();
    },
  );

  // There is no app/[locale]/login route. The form still follows a prefixed
  // pathname, which is what /en|ja|zh-tw/login would render if that route existed.
  it.each([
    ["/en/login", "en"],
    ["/ja/login", "ja"],
    ["/zh-tw/login", "zh-tw"],
  ] as const)("uses localized chrome when the login pathname is %s", (pathname, locale) => {
    renderLogin("ko", "/saved", pathname);

    expect(screen.getByRole("heading", { name: LOGIN_COPY[locale].loginTitle })).toBeTruthy();
    expect(screen.getByRole("button", { name: LOGIN_COPY[locale].kakaoButton })).toBeTruthy();
  });
});
