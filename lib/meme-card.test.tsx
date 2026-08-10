import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  renderMemeCard,
  type MemeCardData,
  type MemeCardLocale,
} from "@/lib/meme-card";
import type { LifecycleStatus, SafetyLevel } from "@/lib/labels";

const BASE_DATA: MemeCardData = {
  title: "Test meme",
  summary: "Test summary",
  safetyLevel: "green",
  lifecycleStatus: "rising",
};

const OPTIONS = {
  template: "classic",
  format: "card",
  watermark: false,
  hasFont: false,
} as const;

const COPY: Record<
  MemeCardLocale,
  {
    tagline: string;
    safety: Record<SafetyLevel, string>;
    lifecycle: Record<LifecycleStatus, string>;
  }
> = {
  ko: {
    tagline: "그 밈, 3초 안에 알려드려요",
    safety: { green: "써도 됨", yellow: "맥락 주의", gray: "이미 늦음", red: "쓰면 위험" },
    lifecycle: { rising: "급상승", active: "유행 중", cooling: "식는 중", archived: "추억 밈" },
  },
  en: {
    tagline: "Korean Memes Explained",
    safety: { green: "Safe to use", yellow: "Context needed", gray: "Past its prime", red: "Risky to use" },
    lifecycle: { rising: "Rising", active: "Active", cooling: "Cooling", archived: "Archived" },
  },
  ja: {
    tagline: "韓国ミームをわかりやすく解説",
    safety: { green: "使ってOK", yellow: "文脈に注意", gray: "旬を過ぎた", red: "使用注意" },
    lifecycle: { rising: "急上昇", active: "流行中", cooling: "落ち着き中", archived: "懐かしミーム" },
  },
  zh: {
    tagline: "看懂韩国网络迷因",
    safety: { green: "可以使用", yellow: "注意语境", gray: "已经过时", red: "谨慎使用" },
    lifecycle: { rising: "上升中", active: "流行中", cooling: "降温中", archived: "怀旧迷因" },
  },
  "zh-tw": {
    tagline: "看懂韓國網路迷因",
    safety: { green: "可以使用", yellow: "注意語境", gray: "已經過時", red: "謹慎使用" },
    lifecycle: { rising: "上升中", active: "流行中", cooling: "降溫中", archived: "懷舊迷因" },
  },
};

function render(data: MemeCardData, locale?: MemeCardLocale) {
  return renderToStaticMarkup(renderMemeCard(data, { ...OPTIONS, locale }));
}

describe("renderMemeCard localized server copy", () => {
  it.each(Object.entries(COPY) as [MemeCardLocale, (typeof COPY)[MemeCardLocale]][])(
    "renders every %s tagline, safety label, and lifecycle label",
    (locale, copy) => {
      expect(render(BASE_DATA, locale)).toContain(copy.tagline);

      for (const [safetyLevel, label] of Object.entries(copy.safety) as [SafetyLevel, string][]) {
        expect(render({ ...BASE_DATA, safetyLevel }, locale)).toContain(label);
      }

      for (const [lifecycleStatus, label] of Object.entries(copy.lifecycle) as [LifecycleStatus, string][]) {
        expect(render({ ...BASE_DATA, lifecycleStatus }, locale)).toContain(label);
      }
    },
  );

  it("keeps Korean as the default for existing callers", () => {
    const html = render({ ...BASE_DATA, safetyLevel: "yellow", lifecycleStatus: "active" });

    expect(html).toContain(COPY.ko.tagline);
    expect(html).toContain(COPY.ko.safety.yellow);
    expect(html).toContain(COPY.ko.lifecycle.active);
  });
});
