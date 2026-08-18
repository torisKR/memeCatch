import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/(default)/privacy/page";
import TermsPage from "@/app/(default)/terms/page";

describe("billing legal copy", () => {
  it("names the current provider and limits Latpeed to legacy records", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).toContain("Unifi Pay");
    expect(html).toContain("신규 Plus 결제에는 사용하지 않습니다");
    expect(html).toContain("지갑 비밀키");
    expect(html).toContain("가명 요청 식별자");
  });

  it("states the fixed-term product and verified settlement boundary", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("10 USDT 상당의 30일 이용권");
    expect(html).toContain("자동 갱신되지 않습니다");
    expect(html).toContain("Kaia 네트워크의 USDT");
    expect(html).toContain("결제창 복귀만으로 권한이 생기지 않습니다");
  });
});
