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
    // 편집 원칙(E-E-A-T 신뢰 문서)은 전 페이지 푸터에서 도달 가능해야 한다.
    expect(html).toContain(`>${messages.editorial}</a>`);
  });

  // 예전 푸터는 모바일용 <details>와 데스크톱용 <div>에 같은 고지 문단을
  // 각각 렌더하고 CSS로 한쪽만 보여줬다. 화면에는 하나만 보여도 HTML에는
  // 두 벌이 담겨, 크롤러·심사 도구에는 같은 문단이 연속 2회 반복되는
  // 중복 텍스트로 읽혔다. 고지는 문서에 정확히 한 번만 나와야 한다.
  it("운영·저작권 고지를 문서에 한 번만 출력한다", () => {
    const messages = getMessages("ko");

    const html = renderToStaticMarkup(
      RootLayout({ children: <main>content</main> }),
    );

    expect(html.split(messages.legal1).length - 1).toBe(1);
    expect(html.split(messages.legal2).length - 1).toBe(1);
  });
});
