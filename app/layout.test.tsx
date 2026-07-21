import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/components/auth-menu", () => ({
  AuthMenu: () => null,
  HideOnAdmin: ({ children }: { children: React.ReactNode }) => children,
}));

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  // 루트 레이아웃은 로케일을 정적 기본값(ko)으로 SSR/ISR 렌더한다.
  // 요청 헤더를 읽으면 전 페이지가 요청-동적으로 강등돼 상세(ISR)가
  // DYNAMIC_SERVER_USAGE로 깨지므로 금지. 실제 사용자 로케일은 클라이언트
  // LocaleProvider가 쿠키로 복원한다(useSyncExternalStore).
  it("정적 기본 로케일(ko) 문서를 서버 렌더한다 — ISR 유지", () => {
    const messages = getMessages("ko");

    const html = renderToStaticMarkup(
      RootLayout({ children: <main>content</main> }),
    );

    expect(html).toMatch(/^<html lang="ko">/);
    expect(html).toContain(`aria-label="${messages.home}"`);
    // 언어 선택기는 전 라우트 상시 노출 — 첫 방문은 LocaleAutoDetect가
    // 브라우저 언어로 자동 설정하고, 수동 변경은 쿠키로 유지된다.
    expect(html).toContain(`aria-label="${messages.languageMenu}"`);
    expect(html).toContain(`aria-label="${messages.footerNav}"`);
    expect(html).toContain(`aria-label="${messages.mainNav}"`);
    expect(html).toContain(`>${messages.about}</a>`);
  });
});
