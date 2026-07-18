// @vitest-environment jsdom

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

vi.mock("@/components/reveal", () => ({
  Reveal: ({
    as: Tag = "div",
    children,
    ...props
  }: {
    as?: ElementType;
    children: ReactNode;
  } & ComponentPropsWithoutRef<"div">) => <Tag {...props}>{children}</Tag>,
}));

vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme }: { meme: { title: string } }) => <article>{meme.title}</article>,
}));

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import { TimelineView, type TimelineDecade } from "@/components/timeline-view";

function makeMeme(id: string, year: number): MemeListItem {
  return {
    id,
    short_id: id,
    slug: `meme-${id}`,
    title: `밈 ${id}`,
    summary: "테스트 요약",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    media_type: "image",
    origin_year: year,
    trend_score: 1,
    meme_contents: [],
  } as unknown as MemeListItem;
}

/** 연도 6개(1991~1996) — 초기 4행 + 추가 배치 검증용 */
function makeDecades(): TimelineDecade[] {
  const years = [1991, 1992, 1993, 1994, 1995, 1996];
  return [
    {
      key: "1990s",
      label: "1990년대",
      years: years.map((year) => ({
        year,
        memes: [makeMeme(`m${year}`, year)],
      })),
    },
  ];
}

/**
 * IntersectionObserver 목 — 생성 인스턴스를 기록하고 수동으로 교차를 발화한다.
 * "배치마다 옵저버 재생성" 회귀(1회 생성 후 영구 정지)를 직접 검증하는 데 쓴다.
 */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }
  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

describe("TimelineView — 레이아웃", () => {
  it("keeps four-digit years on one line and cards inside a responsive grid", () => {
    const html = renderToStaticMarkup(
      <TimelineView
        decades={[
          {
            key: "1990s",
            label: "1990년대",
            years: [{ year: 1991, memes: [makeMeme("m1", 1991)] }],
          },
        ]}
      />
    );

    expect(html).toContain("sm:w-20");
    expect(html).toContain("lg:w-24");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("lg:grid-cols-4");
    expect(html).not.toContain("sm:overflow-x-auto");
  });
});

describe("TimelineView — 무한스크롤", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("초기에는 앞 4개 연도 행만 마운트한다", () => {
    render(<TimelineView decades={makeDecades()} />);
    expect(screen.getByText("밈 m1994")).toBeDefined();
    expect(screen.queryByText("밈 m1995")).toBeNull();
    expect(screen.queryByText("밈 m1996")).toBeNull();
  });

  it("센티널 교차 시 다음 배치가 마운트되고, 배치마다 옵저버가 재생성된다", () => {
    render(<TimelineView decades={makeDecades()} />);
    const first = MockIntersectionObserver.instances.at(-1)!;
    expect(first.observe).toHaveBeenCalled();

    act(() => first.trigger(true));

    // 다음 배치(1995~1996) 마운트 — 전체 6행이 다 보이면 센티널·옵저버는 사라진다
    expect(screen.getByText("밈 m1995")).toBeDefined();
    expect(screen.getByText("밈 m1996")).toBeDefined();
    // 회귀 가드: 교차 후에도 이전 옵저버 하나로 버티면(재생성 없음) 센티널이
    // 마진 안에 머무는 경우 영구 정지한다 — 배치 후 정리(disconnect)됐는지 확인
    expect(first.disconnect).toHaveBeenCalled();
  });

  it("연도가 4행을 넘게 남아 있으면 교차마다 4행씩 이어 마운트한다", () => {
    const years = Array.from({ length: 12 }, (_, i) => 1991 + i);
    const decades: TimelineDecade[] = [
      {
        key: "1990s",
        label: "1990년대",
        years: years.map((year) => ({ year, memes: [makeMeme(`m${year}`, year)] })),
      },
    ];
    render(<TimelineView decades={decades} />);

    act(() => MockIntersectionObserver.instances.at(-1)!.trigger(true));
    expect(screen.getByText("밈 m1998")).toBeDefined();
    expect(screen.queryByText("밈 m1999")).toBeNull();

    // 새 옵저버가 생성돼 있어야 다음 배치가 가능하다(재생성 회귀 가드)
    const second = MockIntersectionObserver.instances.at(-1)!;
    act(() => second.trigger(true));
    expect(screen.getByText("밈 m2002")).toBeDefined();
  });

  it("IntersectionObserver 미지원 환경에서는 전체를 마운트한다", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<TimelineView decades={makeDecades()} />);
    expect(screen.getByText("밈 m1996")).toBeDefined();
  });
});
