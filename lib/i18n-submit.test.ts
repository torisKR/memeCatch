import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { SUBMIT_COPY } from "@/lib/i18n-submit";

describe("SUBMIT_COPY", () => {
  it.each(SUPPORTED_LOCALES)("provides submit flow copy for %s", (locale) => {
    const copy = SUBMIT_COPY[locale];
    expect(copy.metadata.title).toBeTruthy();
    expect(copy.page.reviewSteps).toHaveLength(4);
    expect(copy.page.tiktokDone(2)).toContain("2");
    expect(copy.form.submit).toBeTruthy();
    expect(copy.form.successBody).toBeTruthy();
    expect(copy.preview.frameTitle("TikTok")).toContain("TikTok");
    expect(copy.errors.sourceUrlInvalid).toBeTruthy();
  });

  it.each(["en", "ja", "zh", "zh-tw"] as const)(
    "does not leak Korean into %s",
    (locale) => {
      const copy = SUBMIT_COPY[locale];
      const serialized = JSON.stringify(copy, (_key, value) =>
        typeof value === "function" ? undefined : value,
      );
      expect(serialized).not.toMatch(/[\uac00-\ud7a3]/);
      expect(copy.page.tiktokDone(2)).not.toMatch(/[\uac00-\ud7a3]/);
      expect(copy.preview.frameTitle("TikTok")).not.toMatch(/[\uac00-\ud7a3]/);
    },
  );
});
