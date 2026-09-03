import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/[locale]/memes/[key]/page.tsx"),
  "utf-8",
);

describe("localized meme detail metadata", () => {
  it("uses the reviewed English page as x-default when available", () => {
    expect(source).toContain("const englishVersion = indexableVersions.find");
    expect(source).toContain('["x-default", xDefault]');
    expect(source).toContain("localizedMemePath(\"en\", englishVersion.short_id, englishVersion.slug)");
  });

  it("turns a missing localized meme into a not-found result", () => {
    expect(source).toContain("if (!meme) notFound();");
  });

  it("keeps the Plus export action on the active localized detail page", () => {
    expect(source).toContain('import { ExportButton } from "@/components/export-button";');
    expect(source).toContain("<ExportButton shortId={meme.short_id} />");
  });

  it("keeps the Plus trend anchor available for localized weekly brief links", () => {
    expect(source).toContain('import { MemeTrendPanel } from "@/components/premium/meme-trend-panel";');
    expect(source).toContain("<MemeTrendPanel memeId={meme.id} />");
  });

  it("connects the localized detail action row to the existing Plus Use Kit", () => {
    expect(source).toContain('import { MemeUseKit, MemeUseKitEntry } from "@/components/premium/meme-use-kit";');
    expect(source).toContain("<MemeUseKitEntry locale={locale} />");
    expect(source).toContain("<MemeUseKit");
  });

  it("offers the localized canonical share action only after editorial review", () => {
    expect(source).toContain('import { ShareButton } from "@/components/share-button";');
    expect(source).toContain("{!needsReview && (\n        <div className=\"mt-3 flex justify-end\">");
    expect(source).toContain("path={canonical}");
    expect(source).toContain("label={copy.share}");
    expect(source).toContain("copiedLabel={copy.shareCopied}");
    expect(source).toContain("copiedStatus={copy.shareCopiedStatus}");
    expect(source).toContain("siteName={seo.siteName}");
  });
});
