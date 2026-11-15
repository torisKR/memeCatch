import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { curatedShareVersion, shareCacheVersion } from "@/lib/share-version";

function versionUnder(tz: string): { locale: string; curated: string } {
  const source = `
    import { curatedShareVersion, shareCacheVersion } from "./lib/share-version.ts";
    const row = new Date("2026-11-14T02:45:04.100Z");
    const translation = new Date("2026-11-14T02:45:04.900Z");
    const locale = shareCacheVersion({ timestamps: [row, translation], imageUrl: "/ai-memes/a.png" });
    const curated = curatedShareVersion({
      title: "분좋카",
      summary: "뜻",
      origin_year: 2021,
      category: "phrase",
    });
    process.stdout.write(JSON.stringify({ locale, curated }));
  `;
  const stdout = execFileSync(process.execPath, [
    "--experimental-strip-types",
    "--no-warnings",
    "--input-type=module",
    "--eval",
    source,
  ], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: tz },
    encoding: "utf8",
  });
  return JSON.parse(stdout) as { locale: string; curated: string };
}

describe("share version timezone", () => {
  it("is the same decimal under UTC and Asia/Seoul", () => {
    const utc = versionUnder("UTC");
    const seoul = versionUnder("Asia/Seoul");
    expect(utc.locale).toMatch(/^\d+$/);
    expect(utc.curated).toMatch(/^\d+$/);
    expect(seoul).toEqual(utc);
    const early = new Date("2026-11-14T02:45:04.100Z");
    const later = new Date("2026-11-14T02:45:04.900Z");
    expect(shareCacheVersion({ timestamps: [early, early] })).toBe(String(early.getTime()));
    expect(shareCacheVersion({ timestamps: [early, later] })).toBe(String(later.getTime()));
    expect(curatedShareVersion({
      title: "분좋카",
      summary: "뜻",
      origin_year: 2021,
      category: "phrase",
    })).toBe(utc.curated);
  });
});
