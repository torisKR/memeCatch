import { describe, expect, it } from "vitest";

import { HOME_SCENE_COPY } from "@/lib/home-scene-copy";
import { SEO_ROUTE_LOCALES } from "@/lib/i18n-routing";
import { SAFETY_SIGNAL_LEVELS, getSafetySignalCopy } from "@/lib/safety-copy";

describe("HOME_SCENE_COPY", () => {
  it("provides complete UI guidance for every SEO locale", () => {
    expect(Object.keys(HOME_SCENE_COPY)).toEqual([...SEO_ROUTE_LOCALES]);

    for (const locale of SEO_ROUTE_LOCALES) {
      const copy = HOME_SCENE_COPY[locale];
      const safetyCopy = getSafetySignalCopy(locale);

      expect(copy.brandLabel.length).toBeGreaterThan(0);
      expect(copy.signalGroupLabel.length).toBeGreaterThan(0);
      expect(copy.interactionHint.length).toBeGreaterThan(0);
      expect(copy.resetView.length).toBeGreaterThan(0);
      expect(copy.disclosureLabel.length).toBeGreaterThan(0);
      expect(copy.educationNotice.length).toBeGreaterThan(0);
      expect(copy.demoDisclaimer.length).toBeGreaterThan(0);
      expect(SAFETY_SIGNAL_LEVELS.map((level) => safetyCopy.levels[level].label)).toHaveLength(4);
    }
  });

  it("describes an educational demo instead of issuing a verdict or guarantee", () => {
    expect(HOME_SCENE_COPY.en.demoDisclaimer).toContain("educational demo");
    expect(HOME_SCENE_COPY.en.educationNotice).toBe("Education only. Not a verdict on any meme.");

    const allCopy = JSON.stringify(HOME_SCENE_COPY).toLowerCase();
    expect(allCopy).not.toMatch(/[—–]/);
    expect(allCopy).not.toContain("adsense");
    expect(allCopy).not.toContain("legally permitted");
    expect(allCopy).not.toContain("automatically verified");
  });
});
