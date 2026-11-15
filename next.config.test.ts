import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

type RewriteRule = {
  source: string;
  destination: string;
  has?: unknown;
  missing?: unknown;
};

function rewriteRules(value: unknown): RewriteRule[] {
  if (Array.isArray(value)) return value as RewriteRule[];
  if (value && typeof value === "object") {
    const grouped = value as {
      beforeFiles?: RewriteRule[];
      afterFiles?: RewriteRule[];
      fallback?: RewriteRule[];
    };
    return [
      ...(grouped.beforeFiles ?? []),
      ...(grouped.afterFiles ?? []),
      ...(grouped.fallback ?? []),
    ];
  }
  return [];
}

describe("script-src eval policy", () => {
  it("allows eval only in development", () => {
    // 개발 React는 eval()이 필요하지만, 프로덕션에 'unsafe-eval'이 새어 나가면
    // XSS 방어가 통째로 약해진다. 허용은 IS_DEV 분기 안에서만 일어나야 한다.
    const scriptDirective = source.slice(
      source.indexOf("`script-src"),
      source.indexOf('"style-src'),
    );
    expect(scriptDirective).toContain("unsafe-eval");
    expect(scriptDirective).toContain("IS_DEV ?");

    // 주석에도 'unsafe-eval'이 등장하므로 코드만 남기고 센다.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code.split("'unsafe-eval'").length - 1).toBe(1);
    expect(source).toContain(
      'const IS_DEV = process.env.NODE_ENV === "development"',
    );
  });
});

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

describe("release SHA response header", () => {
  it("reads the release identifier from the image build arg only", () => {
    expect(source).toContain("process.env.RELEASE_SHA?.trim()");
    expect(source).not.toContain("VERCEL");
  });
});

describe("arabic opengraph rewrite", () => {
  it("sends every /ar/opengraph-image request to /ar with no conditions", async () => {
    if (typeof nextConfig.rewrites !== "function") {
      throw new Error("next config has no rewrites()");
    }
    const result = await nextConfig.rewrites();
    const match = rewriteRules(result).filter(
      (rule) => rule.source === "/ar/opengraph-image/:path*",
    );

    expect(match).toEqual([
      { source: "/ar/opengraph-image/:path*", destination: "/ar" },
    ]);
  });
});

describe("retired membership redirects", () => {
  it("permanently sends old Plus pricing, premium, and daily URLs home before the trailing-slash rule", async () => {
    if (typeof nextConfig.redirects !== "function") {
      throw new Error("next config has no redirects()");
    }
    const redirects = await nextConfig.redirects();
    const find = (source: string) => redirects.find((rule) => rule.source === source);

    expect(find("/pricing")).toMatchObject({ destination: "/", permanent: true });
    expect(find("/premium/:path+")).toMatchObject({ destination: "/", permanent: true });
    expect(find("/daily")).toMatchObject({ destination: "/", permanent: true });
    expect(find("/:locale(en|ja|zh|zh-tw)/pricing")).toMatchObject({ destination: "/:locale" });
    expect(redirects.at(-1)?.source).toBe("/:path+/");
  });
});
