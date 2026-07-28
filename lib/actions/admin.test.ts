import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "lib/actions/admin.ts"),
  "utf-8",
);

function section(start: string, end: string) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("canonical meme cache revalidation", () => {
  it("invalidates every public locale index and machine-readable artifact", () => {
    const helper = section(
      "function revalidateCanonicalMemePaths",
      "/* ── 제보 큐",
    );

    expect(helper).toContain('"/sitemap.xml"');
    expect(helper).toContain('"/llms.txt"');
    expect(helper).toContain('"/llms-full.txt"');
    expect(helper).toContain("SEO_CONTENT_LOCALES");
    expect(helper).toContain("paths.add(`/${locale}`)");
    expect(helper).toContain("paths.add(`/${locale}/llms.txt`)");
    expect(helper).toContain("paths.add(`/${locale}/llms-full.txt`)");
  });

  it("invalidates the Korean detail and each determinable localized detail", () => {
    const identityLoader = section(
      "async function loadMemeRevalidationIdentity",
      "/** 한국어 원문/공개 상태",
    );
    const helper = section(
      "function revalidateCanonicalMemePaths",
      "/* ── 제보 큐",
    );

    expect(identityLoader).toContain(
      'meme_translations(locale, localized_slug)',
    );
    expect(helper).toContain("memePathFrom(meme.short_id, meme.slug)");
    expect(helper).toContain("localizedMemePath(");
    expect(helper).toContain("translation.localized_slug");
  });

  it.each([
    ["approveSubmission", "updateMeme"],
    ["updateMeme", "export type KoreanReviewDraft"],
    ["transitionMemeStatus", "/* ── 신고 처리"],
  ])("wires %s into the shared invalidation contract", (action, next) => {
    expect(section(`export async function ${action}`, next)).toContain(
      "revalidateCanonicalMemePaths(",
    );
  });
});
