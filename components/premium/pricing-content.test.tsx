import { readFileSync } from "node:fs";
import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/lib/i18n";
import { PREMIUM_COPY } from "@/lib/i18n-premium";

const localeState = vi.hoisted(() => ({ value: "en" as Locale }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    useLocale: () => ({ locale: localeState.value, messages: getMessages(localeState.value) }),
  };
});

import { PricingContent } from "@/components/premium/pricing-content";

function ruleBody(css: string, selector: string) {
  const match = css.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`));
  expect(match, selector).not.toBeNull();
  return match?.[1] ?? "";
}

describe("PricingContent", () => {
  beforeEach(() => {
    localeState.value = "en";
  });

  it("shows the separate Fairy donation option only with server-approved configuration", () => {
    expect(renderToStaticMarkup(<PricingContent />)).not.toContain("/api/billing/fairy/checkout");
    const html = renderToStaticMarkup(<PricingContent fairyMinimumAmount={15_000} />);
    expect(html).toContain("KRW 15,000");
    expect(html).toContain('action="/api/billing/fairy/checkout"');
    expect(html).toContain("smaller donations are support only");
    expect(html).toContain('href="/premium"');
  });
  it("renders a localized comparison and POST checkout action", () => {
    const html = renderToStaticMarkup(<PricingContent checkoutEnabled />);

    expect(html).toContain("Get three memes to post today, with platform-ready copy");
    expect(html).toContain("Saved-meme reuse radar");
    expect(html).toContain("Unlimited + radar");
    expect(html).toContain(">10<");
    expect(html).toContain("$10");
    expect(html).toContain('action="/api/billing/checkout"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="locale" value="en"');
    expect(html).toContain('href="/en"');
    expect(html).toContain('href="/en/explore"');
    // 자동 갱신이 없다는 사실이 결제 버튼 옆에 반드시 보여야 한다.
    expect(html).toContain("no auto-renewal");
    expect(html).toContain("Kaia USDT");
    expect(html).toContain("Pay with Kaia USDT");
    expect(html).toContain("Sign in to MemeCatch.");
    expect(html).toContain("Prepare USDT on Kaia in Unifi Wallet.");
    expect(html).toContain("Finish payment, then return to see your Plus status.");
    expect(html).toContain("Explore free memes");
    expect(html).toContain("remaining time preserved");
    expect(html).toContain("original payment wallet");
    expect(html).toContain("shrink-0 text-right");
    expect(html).toContain("whitespace-nowrap");
  });

  it("wraps ja/zh/zh-tw hero titles on phrase boundaries and keeps the English title plain", () => {
    const css = readFileSync(new URL("./pricing-content.module.css", import.meta.url), "utf8");
    expect(css).toMatch(/word-break: normal;\n\s*word-break: auto-phrase;/);
    expect(css).toContain(".keepPhrase {\n  white-space: nowrap;\n}");
    expect(ruleBody(css, ".root")).toMatch(/min-width:\s*0\s*;/);
    expect(ruleBody(css, ".hero")).toMatch(/min-width:\s*0\s*;/);
    expect(ruleBody(css, ".heroCopy,\\s*\\.intro")).toMatch(/min-width:\s*0\s*;/);
    expect(ruleBody(css, ".title")).toMatch(/min-width:\s*0\s*;/);
    expect(ruleBody(css, ".eyebrow")).toMatch(/overflow-wrap:\s*anywhere\s*;/);

    const phrases = {
      ja: ["今日", "投稿する", "ミーム", "3つと", "媒体別", "コピーを", "受け取る"],
      zh: ["获取", "今天", "可发布的", "3个", "迷因", "及", "各平台", "文案"],
      "zh-tw": ["今天", "就能", "使用的", "已審核", "迷因"],
    } as const;
    for (const locale of ["ja", "zh", "zh-tw"] as const) {
      expect(phrases[locale].join("")).toBe(PREMIUM_COPY[locale].pricing.title);
      localeState.value = locale;
      const html = renderToStaticMarkup(<PricingContent />);
      for (const phrase of phrases[locale]) {
        expect(html).toContain(`>${phrase}<`);
      }
      expect(html).not.toContain("minmax(20rem");
      if (locale === "ja") expect(html).toContain("審査済みミーム活用ツール");
    }

    localeState.value = "en";
    const english = renderToStaticMarkup(<PricingContent />);
    expect(english).toContain(">Get three memes to post today, with platform-ready copy<");
    expect(english).not.toContain(">投稿する<");
    expect(english).not.toContain(">获取<");
    expect(english).not.toContain(">已審核<");
  });

  it("does not render a checkout form while new purchases are disabled", () => {
    const html = renderToStaticMarkup(<PricingContent checkoutEnabled={false} />);

    expect(html).not.toContain('action="/api/billing/checkout"');
    expect(html).not.toContain('<form');
    expect(html).toContain("New purchases are temporarily unavailable.");
    expect(html).toContain("disabled");
  });
});
