import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

describe("service-worker image CSP", () => {
  it("shares the remote thumbnail allowlist between img-src and connect-src", () => {
    const allowlist = source.slice(
      source.indexOf("const REMOTE_MEME_THUMBNAIL_SOURCES"),
      source.indexOf("] as const", source.indexOf("const REMOTE_MEME_THUMBNAIL_SOURCES")),
    );
    expect(allowlist).toContain("https://i.ytimg.com");
    expect(allowlist).toContain("https://*.tiktokcdn.com");

    const imageDirective = source.slice(
      source.indexOf('"img-src'),
      source.indexOf('"font-src'),
    );
    const connectDirective = source.slice(
      source.indexOf('"connect-src'),
      source.indexOf('"media-src'),
    );
    expect(imageDirective).toContain("...REMOTE_MEME_THUMBNAIL_SOURCES");
    expect(connectDirective).toContain("...REMOTE_MEME_THUMBNAIL_SOURCES");
  });
});
