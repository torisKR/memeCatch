import { describe, expect, it } from "vitest";

import {
  HOME_IMMERSIVE_COPY,
  HOME_IMMERSIVE_LOCALES,
} from "@/lib/home-immersive-copy";
import { SEO_ROUTE_LOCALES } from "@/lib/i18n-routing";

describe("HOME_IMMERSIVE_COPY", () => {
  it("covers every home locale with the same three-chapter data shape", () => {
    expect(HOME_IMMERSIVE_LOCALES).toEqual(SEO_ROUTE_LOCALES);

    for (const locale of HOME_IMMERSIVE_LOCALES) {
      const copy = HOME_IMMERSIVE_COPY[locale];

      expect(copy.navigationLabel.length).toBeGreaterThan(0);
      expect(copy.skipLabel.length).toBeGreaterThan(0);
      expect(copy.sceneLabel.length).toBeGreaterThan(0);
      expect(copy.pauseScene.length).toBeGreaterThan(0);
      expect(copy.playScene.length).toBeGreaterThan(0);
      expect(copy.chapters.map((chapter) => chapter.id)).toEqual([
        "discover",
        "context",
        "participate",
      ]);
      expect(copy.chapters.map((chapter) => chapter.href)).toEqual([
        "#home-story-discover",
        "#home-story-context",
        "#home-story-participate",
      ]);

      for (const chapter of copy.chapters) {
        expect(chapter.navigationLabel.length).toBeGreaterThan(0);
        expect(chapter.eyebrow.length).toBeGreaterThan(0);
        expect(chapter.title.length).toBeGreaterThan(0);
        expect(chapter.description.length).toBeGreaterThan(0);
      }

      expect(copy.search.label.length).toBeGreaterThan(0);
      expect(copy.search.placeholder.length).toBeGreaterThan(0);
      expect(copy.search.button.length).toBeGreaterThan(0);
      expect(copy.contextAction.length).toBeGreaterThan(0);
      expect(copy.communityAction.length).toBeGreaterThan(0);
    }
  });
});
