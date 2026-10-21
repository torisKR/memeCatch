import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import { HomeExperience, type HomeEntry } from "@/components/home/home-experience";
import { HOME_COPY, HOME_LOCALES } from "@/lib/home-copy";
import type { PublicMemeTrendSummary } from "@/lib/trend/public-evidence.server";

const entry: HomeEntry = {
  id: "published-entry",
  href: "/memes/ABC123/published-entry",
  title: "Published entry",
  summary: "A real published summary.",
  categoryLabel: "Phrase",
  originalTitle: "공개된 항목",
  safetyLevel: "green",
};

const trend: PublicMemeTrendSummary = {
  memeId: "trend-1",
  href: "/memes/TREND1/verified-trend",
  title: "Verified trend",
  summary: "Published summary",
  state: "rising",
  reason: "Independent uses increased in a comparable observation window.",
  evidenceScope: "Public YouTube results",
  independentUseCount: 4,
  score: null,
  confidence: 0.8,
  lastVerifiedAt: "2026-10-18T01:00:00.000Z",
  stale: false,
  evidenceLinks: [{ label: "Source", url: "https://www.youtube.com/watch?v=abc" }],
};

describe("HomeExperience", () => {
  it.each(HOME_LOCALES)("keeps a compact search and recent-content flow for %s", (locale) => {
    const html = renderToStaticMarkup(
      <HomeExperience locale={locale} entries={[entry]} />,
    );
    const sectionOrder = [...html.matchAll(/data-home-section="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(sectionOrder).toEqual(["hero-search", "recent-content"]);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain(`action="${locale === "ko" ? "/search" : `/${locale}/search`}"`);
    expect(html).toContain('method="get"');
    expect(html.match(/role="search"/g)).toHaveLength(1);
    expect(html).toContain(`href="${locale === "ko" ? "/explore?sort=recent" : `/${locale}/explore?sort=recent`}"`);
    expect(html).toContain(entry.title);
    expect(html).toContain('data-safety-icon="green"');
    expect(html).not.toContain("data-home-scroll-track");
    expect(html).not.toContain("data-home-artwork");
    expect(html).not.toContain('data-home-section="pathways"');
    expect(html).not.toContain('data-home-section="editorial-trust"');
  });

  it("separates verified external spread from the recently published list", () => {
    const html = renderToStaticMarkup(
      <HomeExperience locale="ko" entries={[entry]} externalTrends={[trend]} />,
    );
    const sectionOrder = [...html.matchAll(/data-home-section="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(sectionOrder).toEqual(["hero-search", "external-trends", "recent-content"]);
    expect(html).toContain("지금 확산 근거가 확인된 밈");
    expect(html).toContain("Verified trend");
    expect(html).toContain("독립 사용례 4건");
    expect(html).toContain("관찰 범위: Public YouTube results");
  });

  it("uses a short Korean first-screen promise", () => {
    const html = renderToStaticMarkup(<HomeExperience locale="ko" entries={[entry]} />);

    expect(html).toContain("지금 궁금한 밈, 한눈에.");
    expect(html).not.toContain("밈의 뜻을 찾고, 쓸 맥락까지 확인하세요.");
    expect(html).toContain("출처와 설명을 갖춘 밈을 살펴보세요.");
    expect(html).toContain("제목이 있는 공개 출처와 충분한 설명");
    expect(html).toContain("밈 이름이나 상황으로 검색");
    expect(html).toContain("검색어는 등록된 공개 밈 자료 안에서만 찾아요.");
    expect(html).not.toContain("AI 서비스");
    expect(html).not.toContain("Boundless");
  });

  it("does not offer Korean-only AI routing on translated home pages", () => {
    const html = renderToStaticMarkup(<HomeExperience locale="en" entries={[entry]} />);

    expect(html).not.toContain("AI 서비스");
    expect(html).not.toContain("개인정보는 입력하지 마세요");
  });

  it("renders honest empty and unavailable states without placeholder cards", () => {
    const empty = renderToStaticMarkup(<HomeExperience locale="en" entries={[]} />);
    const unavailable = renderToStaticMarkup(
      <HomeExperience locale="ko" entries={[]} entryState="unavailable" />,
    );

    expect(empty).toContain(HOME_COPY.en.recent.empty);
    expect(empty).toContain('data-home-recommendations="empty"');
    expect(empty).not.toContain("data-thumbnail-state");
    expect(unavailable).toContain('data-home-recommendations="unavailable"');
    expect(unavailable).not.toContain('data-home-recommendations="empty"');
  });
});
