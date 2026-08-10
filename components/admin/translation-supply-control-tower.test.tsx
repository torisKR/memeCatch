// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TranslationSupplyControlTower } from "./translation-supply-control-tower";
import type {
  TranslationSupplyCoverageInput,
  TranslationSupplyPriorityInput,
} from "@/lib/translation-supply-control-tower";

const coverageRows: TranslationSupplyCoverageInput[] = [
  {
    locale: "en",
    totalPublic: 10,
    reviewedCurrent: 4,
    reviewNeeded: 2,
    stale: 1,
    missing: 3,
    completionPercentage: 40,
  },
  {
    locale: "ja",
    totalPublic: 10,
    reviewedCurrent: 10,
    reviewNeeded: 0,
    stale: 0,
    missing: 0,
    completionPercentage: 100,
  },
  {
    locale: "zh",
    totalPublic: 10,
    reviewedCurrent: 8,
    reviewNeeded: 0,
    stale: 2,
    missing: 0,
    completionPercentage: 80,
  },
  {
    locale: "zh-tw",
    totalPublic: 10,
    reviewedCurrent: 10,
    reviewNeeded: 0,
    stale: 0,
    missing: 0,
    completionPercentage: 100,
  },
];

const priorityRows: TranslationSupplyPriorityInput[] = [
  {
    memeId: "meme-route",
    locale: "en",
    requestCount: 4,
    latestRequestedAt: "2026-08-10T01:00:00.000Z",
    status: "requested",
    memeTitle: "Route-ready meme",
    memeShortId: "MC-0001",
    memeSlug: "route-ready",
    translationStatus: null,
    translationUpdatedAt: null,
    sourceUpdatedAt: null,
    routeUnlockCandidate: true,
  },
];

afterEach(cleanup);

describe("TranslationSupplyControlTower", () => {
  it("shows locale next actions and route-unlock candidate links", () => {
    render(<TranslationSupplyControlTower coverageRows={coverageRows} priorityRows={priorityRows} />);

    expect(screen.getByRole("heading", { name: "글로벌 번역 공급 다음 행동" })).toBeTruthy();
    expect(screen.getByText("Plus 요청 누락부터")).toBeTruthy();
    expect(screen.getByText(/원문이 현재 색인 가능 기준을 충족하므로/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "누락 검수 열기" }).getAttribute("href")).toBe(
      "/admin/translations?locale=en&focus=meme-route",
    );
    expect(
      screen
        .getAllByRole("link", { name: "이 로케일 작업 열기" })
        .map((link) => link.getAttribute("href")),
    ).toContain("/admin/translations?locale=en&focus=meme-route");
    expect(
      screen
        .getAllByRole("link", { name: "이 로케일 작업 열기" })
        .map((link) => link.getAttribute("href")),
    ).toContain("/admin/translations?locale=zh&status=stale");
  });

  it("keeps coverage and demand failures visible instead of fabricating zeroes", () => {
    render(
      <TranslationSupplyControlTower
        coverageRows={[]}
        priorityRows={[]}
        coverageError="coverage unavailable"
        priorityError="queue unavailable"
      />,
    );

    expect(screen.getAllByRole("alert").map((alert) => alert.textContent).join(" ")).toContain(
      "0건으로 간주하지 않았습니다",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByText("표시할 글로벌 공급 현황이 아직 없어요.")).toBeNull();
  });

  it("does not render a Plus zero when the global demand read failed", () => {
    render(
      <TranslationSupplyControlTower
        coverageRows={coverageRows}
        priorityRows={[]}
        priorityError="queue unavailable"
      />,
    );

    expect(screen.getAllByText("Plus 확인 불가")).toHaveLength(4);
    expect(screen.queryByText("Plus 0")).toBeNull();
  });
});
