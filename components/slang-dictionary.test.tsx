// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SlangDictionary,
  SlangDictionaryFromQuery,
  type SlangEra,
} from "@/components/slang-dictionary";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

function makeEras(): SlangEra[] {
  return [
    {
      key: "now",
      label: "요즘",
      range: "2020~",
      exploreHref: "/explore?category=phrase&year=2020s",
      terms: [
        {
          href: "/memes/aaa-럭키비키",
          title: "럭키비키",
          summary: "초긍정 사고방식 유행어",
          safety: "green",
          year: 2024,
        },
      ],
    },
    {
      key: "1990s",
      label: "1990년대",
      range: "1990~99",
      exploreHref: "/explore?category=phrase",
      terms: [
        {
          href: "/memes/bbb-하이루",
          title: "하이루",
          summary: "PC통신 인사말",
          safety: "gray",
          year: 1997,
        },
      ],
    },
  ];
}

function section(key: string) {
  return document.getElementById(`slang-era-${key}`)?.closest("section");
}

afterEach(() => {
  cleanup();
  searchParams.delete("era");
});

describe("SlangDictionary", () => {
  it("기본(정적 셸)에서는 요즘 탭이 활성이고 나머지 패널은 hidden", () => {
    render(<SlangDictionary eras={makeEras()} />);
    expect(
      screen.getByRole("link", { name: /요즘/ }).getAttribute("aria-current")
    ).toBe("page");
    expect(section("now")?.hasAttribute("hidden")).toBe(false);
    expect(section("1990s")?.hasAttribute("hidden")).toBe(true);
    // 비활성 패널의 표제어도 DOM(정적 HTML)에는 존재해야 한다 — SEO 요구
    expect(screen.getByText("하이루")).toBeTruthy();
  });

  it("?era=1990s면 1990년대 패널이 보이고 탭에 aria-current가 붙는다", () => {
    searchParams.set("era", "1990s");
    render(<SlangDictionaryFromQuery eras={makeEras()} />);
    expect(
      screen
        .getByRole("link", { name: /1990년대/ })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(section("1990s")?.hasAttribute("hidden")).toBe(false);
    expect(section("now")?.hasAttribute("hidden")).toBe(true);
  });

  it("잘못된 era 값은 기본 탭(요즘)으로 폴백한다", () => {
    searchParams.set("era", "3000s");
    render(<SlangDictionaryFromQuery eras={makeEras()} />);
    expect(
      screen.getByRole("link", { name: /요즘/ }).getAttribute("aria-current")
    ).toBe("page");
  });
});
