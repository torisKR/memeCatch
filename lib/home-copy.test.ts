import { describe, expect, it } from "vitest";
import { HOME_COPY, HOME_LOCALES } from "@/lib/home-copy";

describe("HOME_COPY", () => {
  it("provides complete consumer home copy for every public home locale", () => {
    expect(HOME_LOCALES).toEqual(["ko", "en", "ja", "zh", "zh-tw"]);

    for (const locale of HOME_LOCALES) {
      const copy = HOME_COPY[locale];

      expect(copy.hero.title).toBeTruthy();
      expect(copy.hero.searchLabel).toBeTruthy();
      expect(copy.recent.title).toBeTruthy();
      expect(copy.recent.empty).toBeTruthy();
      expect(copy.pathways.community.title).toBeTruthy();
      expect(copy.pathways.products.title).toBeTruthy();
      expect(copy.pathways.community.createAction).toBeTruthy();
      expect(copy.pathways.products.createAction).toBeTruthy();
      expect(copy.pathways.submitAction).toBeTruthy();
      expect(copy.trust.links).toHaveLength(3);
    }
  });

  it("describes the studio emblem instead of the retired toy mascot", () => {
    const labels = HOME_LOCALES.map((locale) => HOME_COPY[locale].hero.sceneLabel);
    expect(labels.every((label) => label.length > 20)).toBe(true);
    expect(labels.join(" ")).not.toMatch(/캐릭터|mascot|キャラクター|角色/);
    expect(HOME_COPY.ko.hero.sceneLabel).toContain("심벌");
    expect(HOME_COPY.en.hero.sceneLabel).toContain("emblem");
  });

  it("does not make blanket human-review or approval claims", () => {
    const publishedCopy = JSON.stringify(HOME_COPY);

    expect(publishedCopy).not.toMatch(/human[- ]reviewed/i);
    expect(publishedCopy).not.toMatch(/人工(审核|審核)/);
    expect(publishedCopy).not.toContain("人が確認した");
    expect(publishedCopy).not.toMatch(/모든.{0,12}(검수|승인)/);
  });
});
