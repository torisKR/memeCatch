import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract for the www -> apex redirect in the Caddy configs. Caddy is not
 * available in CI, so this parses the named matcher and evaluates it with the
 * same semantics Caddy uses (all lines AND-ed, `not` negates, path globs).
 */
type WwwRule = { hosts: string[]; methods: string[]; notPaths: string[]; target: string; status: string };

function wwwRule(file: string): WwwRule {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  const matcher = text.match(/@www_to_apex\s*\{([^}]*)\}/);
  expect(matcher, `${file} has no @www_to_apex matcher`).not.toBeNull();
  const lines = matcher![1].split("\n").map((line) => line.trim()).filter(Boolean);
  const rule: WwwRule = { hosts: [], methods: [], notPaths: [], target: "", status: "" };
  for (const line of lines) {
    const [directive, ...args] = line.split(/\s+/);
    if (directive === "host") rule.hosts.push(...args);
    else if (directive === "method") rule.methods.push(...args);
    else if (directive === "not" && args[0] === "path") rule.notPaths.push(...args.slice(1));
    else throw new Error(`unexpected matcher line in ${file}: ${line}`);
  }
  const redir = text.match(/^\s*redir @www_to_apex (\S+) (\d{3})\s*$/m);
  expect(redir, `${file} has no redir for @www_to_apex`).not.toBeNull();
  rule.target = redir![1];
  rule.status = redir![2];
  return rule;
}

function pathMatches(glob: string, path: string): boolean {
  return glob.endsWith("*") ? path.startsWith(glob.slice(0, -1)) : path === glob;
}

function redirectFor(rule: WwwRule, request: { method: string; host: string; uri: string }) {
  const path = request.uri.split("?")[0];
  const matches =
    rule.hosts.includes(request.host) &&
    rule.methods.includes(request.method) &&
    !rule.notPaths.some((glob) => pathMatches(glob, path));
  return matches ? { status: Number(rule.status), location: rule.target.replace("{uri}", request.uri) } : null;
}

describe.each(["deploy/Caddyfile", "deploy/Caddyfile.site"])("%s www redirect", (file) => {
  const rule = wwwRule(file);

  it("sends www GET/HEAD to the apex with the same path and query (301)", () => {
    expect(redirectFor(rule, { method: "GET", host: "www.catchmeme.com", uri: "/memes/abc-%EB%B0%88?ref=x&y=1" }))
      .toEqual({ status: 301, location: "https://catchmeme.com/memes/abc-%EB%B0%88?ref=x&y=1" });
    expect(redirectFor(rule, { method: "HEAD", host: "www.catchmeme.com", uri: "/" }))
      .toEqual({ status: 301, location: "https://catchmeme.com/" });
    expect(redirectFor(rule, { method: "GET", host: "www.catchmeme.com", uri: "/sitemap.xml" }))
      .toEqual({ status: 301, location: "https://catchmeme.com/sitemap.xml" });
  });

  it("leaves /api/* on www so OAuth callbacks and webhooks keep working", () => {
    expect(redirectFor(rule, { method: "GET", host: "www.catchmeme.com", uri: "/api/auth/callback?code=1" })).toBeNull();
    expect(redirectFor(rule, { method: "POST", host: "www.catchmeme.com", uri: "/api/webhooks/x" })).toBeNull();
    expect(redirectFor(rule, { method: "GET", host: "www.catchmeme.com", uri: "/auth/callback?code=1" })).toBeNull();
    expect(redirectFor(rule, { method: "GET", host: "www.catchmeme.com", uri: "/auth/tiktok?state=x" })).toBeNull();
  });

  it("never redirects other methods or the apex host", () => {
    expect(redirectFor(rule, { method: "POST", host: "www.catchmeme.com", uri: "/submit" })).toBeNull();
    expect(redirectFor(rule, { method: "GET", host: "catchmeme.com", uri: "/" })).toBeNull();
  });

  it("uses {uri}, which carries both path and query", () => {
    expect(rule.target).toBe("https://catchmeme.com{uri}");
  });
});

describe("own-caddy site block", () => {
  it("keeps the matcher inside the SITE_ADDRESS block that proxies to the app", () => {
    const text = readFileSync(join(process.cwd(), "deploy/Caddyfile"), "utf8");
    const block = text.slice(text.indexOf("{$SITE_ADDRESS:catchmeme.com} {"));
    expect(block.indexOf("@www_to_apex")).toBeGreaterThan(0);
    expect(block.indexOf("@www_to_apex")).toBeLessThan(block.indexOf("reverse_proxy app:3000"));
  });
});
