import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { MY_COPY } from "@/lib/i18n-my";

const CATEGORY_KEYS = [
  "phrase",
  "dance",
  "song",
  "image",
  "comment",
  "challenge",
] as const;
const SAFETY_KEYS = ["green", "yellow", "gray", "red"] as const;
const SUBMISSION_KEYS = [
  "pending",
  "reviewing",
  "approved",
  "rejected",
] as const;
const AGE_KEYS = ["10s", "20s", "30s", "40s", "50s+"] as const;

describe("MY_COPY", () => {
  it.each(SUPPORTED_LOCALES)("provides complete MY copy for %s", (locale) => {
    const copy = MY_COPY[locale];

    expect(copy.defaultNickname).toBeTruthy();
    expect(copy.onboarding.title).toBeTruthy();
    expect(copy.onboarding.nicknamePlaceholder).toBeTruthy();
    expect(copy.onboarding.submitting).toBeTruthy();
    expect(copy.greeting(copy.ageGroups["20s"])).toBeTruthy();
    expect(copy.greeting(undefined)).toBeTruthy();
    expect(copy.nickname.saved).toBeTruthy();
    expect(copy.interests.empty).toBeTruthy();
    expect(copy.saved.emptyBody).toBeTruthy();
    expect(copy.saved.library.title).toBeTruthy();
    expect(copy.saved.library.results(1, 2)).toBeTruthy();
    expect(copy.saved.library.upgradeAction).toBeTruthy();
    expect(copy.recent.title).toBeTruthy();
    expect(copy.recent.clearAll).toBeTruthy();
    expect(copy.submissions.submittedAt("2026-07-18")).toContain("2026-07-18");

    for (const key of CATEGORY_KEYS) expect(copy.categories[key]).toBeTruthy();
    for (const key of SAFETY_KEYS) expect(copy.safety[key]).toBeTruthy();
    for (const key of AGE_KEYS) expect(copy.ageGroups[key]).toBeTruthy();
    for (const key of SUBMISSION_KEYS) {
      expect(copy.submissions.status[key].badge).toBeTruthy();
    }
  });

  it.each(["en", "ja", "zh"] as const)(
    "does not leak fixed Korean UI copy into %s",
    (locale) => {
      const copy = MY_COPY[locale];
      const fixedCopy = JSON.stringify(copy, (_key, value) =>
        typeof value === "function" ? undefined : value,
      );

      expect(fixedCopy).not.toMatch(/[\uac00-\ud7a3]/);
      expect(copy.greeting(copy.ageGroups["20s"])).not.toMatch(
        /[\uac00-\ud7a3]/,
      );
      expect(copy.greeting(undefined)).not.toMatch(/[\uac00-\ud7a3]/);
      expect(copy.submissions.submittedAt("2026-07-18")).not.toMatch(
        /[\uac00-\ud7a3]/,
      );
    },
  );

  it.each(SUPPORTED_LOCALES)(
    "localizes every nickname action error for %s",
    (locale) => {
      const errors = MY_COPY[locale].nickname.errors;

      expect(errors.invalidLength).toBeTruthy();
      expect(errors.taken).toBeTruthy();
      expect(errors.saveFailed).toBeTruthy();
    },
  );
});
