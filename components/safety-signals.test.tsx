// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { SafetyBadge } from "@/components/safety-badge";
import { SafetyIcon } from "@/components/safety-icon";
import { SafetySignalGuide } from "@/components/safety-legend";
import { SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";
import { getSafetySignalCopy } from "@/lib/safety-copy";

afterEach(cleanup);

const LEVELS = Object.keys(SAFETY_LEVELS) as SafetyLevel[];

describe("SafetyIcon", () => {
  it("renders four original, shape-distinct symbols instead of the text glyphs", () => {
    const icons = LEVELS.map((level) => renderToStaticMarkup(<SafetyIcon level={level} />));
    const pathSignatures = icons.map((html) =>
      [...html.matchAll(/<path[^>]*d="([^"]+)"/g)].map((match) => match[1]).join("|"),
    );

    expect(new Set(pathSignatures).size).toBe(4);
    LEVELS.forEach((level, index) => {
      expect(icons[index]).toContain(`data-safety-icon="${level}"`);
      expect(icons[index]).not.toContain(SAFETY_LEVELS[level].icon);
    });
  });

  it("is decorative by default and receives an accessible name when titled", () => {
    const decorative = renderToStaticMarkup(<SafetyIcon level="green" />);
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).toContain('focusable="false"');

    render(<SafetyIcon level="red" title="Risky to use" />);
    expect(screen.getByRole("img", { name: "Risky to use" })).toBeTruthy();
  });
});

describe("safety signal copy", () => {
  it.each([
    ["ko", ["써도 됨", "맥락 주의", "이미 늦음", "쓰면 위험"]],
    ["en", ["Safe to use", "Check the context", "Past its moment", "Risky to use"]],
    ["ja", ["使ってOK", "文脈に注意", "旬を過ぎた", "使用は危険"]],
    ["zh", ["可以使用", "注意语境", "已经过时", "使用有风险"]],
    ["zh-tw", ["可以使用", "留意語境", "已經過時", "使用有風險"]],
  ] as const)("provides the four intended labels for %s", (locale, expected) => {
    const copy = getSafetySignalCopy(locale);
    expect(LEVELS.map((level) => copy.levels[level].label)).toEqual(expected);
  });

  it("uses cautious editorial guidance instead of promising universal safety", () => {
    const copy = getSafetySignalCopy("en");
    expect(copy.disclaimer).toMatch(/editorial guidance/i);
    expect(copy.disclaimer).toMatch(/do not guarantee/i);
  });
});

describe("SafetySignalGuide", () => {
  it("uses labeled native explainers that work without color or tooltip access", async () => {
    const user = userEvent.setup();
    const { container } = render(<SafetySignalGuide locale="ko" />);
    const explainers = [...container.querySelectorAll("details")];
    const summaries = [...container.querySelectorAll("summary")];

    expect(explainers).toHaveLength(4);
    expect(summaries).toHaveLength(4);
    expect(container.querySelectorAll("[data-safety-icon]")).toHaveLength(4);
    for (const label of ["써도 됨", "맥락 주의", "이미 늦음", "쓰면 위험"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/모든 상황의 안전이나 허용을 보장하지 않아요/)).toBeTruthy();

    await user.tab();
    expect(document.activeElement).toBe(summaries[0]);
    await user.click(summaries[0]);
    expect(explainers[0].open).toBe(true);
    expect(summaries.every((summary) => summary.getAttribute("title") === null)).toBe(true);
  });

  it("renders the selected home locale", () => {
    render(<SafetySignalGuide locale="zh-tw" />);
    expect(screen.getByText("留意語境")).toBeTruthy();
    expect(screen.getByText("使用有風險")).toBeTruthy();
  });
});

describe("SafetyBadge", () => {
  it("keeps its existing default Korean semantics while rendering the new icon", () => {
    const { container } = render(<SafetyBadge level="yellow" />);
    expect(screen.getByText("맥락 주의")).toBeTruthy();
    expect(container.querySelector('[data-safety-icon="yellow"]')).toBeTruthy();
    expect(container.textContent).not.toContain(SAFETY_LEVELS.yellow.icon);
  });

  it("accepts an optional locale without changing the existing note API", () => {
    const { container } = render(
      <SafetyBadge level="red" size="lg" locale="ja" note="公開投稿では使わない" />,
    );
    expect(screen.getByText("使用は危険")).toBeTruthy();
    expect(screen.getByText("公開投稿では使わない")).toBeTruthy();
    expect(container.querySelector('[data-safety-icon="red"]')).toBeTruthy();
  });
});
