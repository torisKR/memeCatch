import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

type Rule = Exclude<ReturnType<typeof robots>["rules"], undefined> extends infer Rules
  ? Rules extends readonly (infer Item)[]
    ? Item
    : Rules
  : never;

function rules(): Rule[] {
  const value = robots().rules;
  return Array.isArray(value) ? value : [value];
}

function agents(rule: Rule): string[] {
  return Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? "*"];
}

function ruleFor(userAgent: string): Rule | undefined {
  return rules().find((rule) => agents(rule).includes(userAgent));
}

describe("robots crawler-purpose policy", () => {
  const exactPrivateRoutes = [
    "/community/new",
    "/products/new",
    "/products/mine",
    "/en/community/new",
    "/ja/products/new",
    "/zh-tw/products/mine",
  ];

  it.each([
    "Googlebot",
    "Bingbot",
    "OAI-SearchBot",
    "PerplexityBot",
    "Claude-SearchBot",
    "ChatGPT-User",
    "Perplexity-User",
    "Claude-User",
  ])("allows public fetches for %s while retaining private route blocks", (userAgent) => {
    const rule = ruleFor(userAgent);
    expect(rule?.allow).toBe("/");
    expect(rule?.disallow).toEqual(expect.arrayContaining([
      "/admin",
      "/api/",
      "/en/admin",
      "/zh-tw/api/",
      ...exactPrivateRoutes,
    ]));
  });

  it.each(["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"])(
    "blocks model-training crawler %s",
    (userAgent) => {
      expect(ruleFor(userAgent)?.disallow).toBe("/");
    },
  );

  it("gives Mediapartners-Google explicit public access without exposing private routes", () => {
    const rule = ruleFor("Mediapartners-Google");
    expect(rule?.allow).toBe("/");
    expect(rule?.disallow).toEqual(expect.arrayContaining([
      "/admin",
      "/api/",
      "/ja/auth/",
      ...exactPrivateRoutes,
    ]));
  });

  it("keeps exact authoring routes private in every public crawler group", () => {
    for (const rule of rules().filter((candidate) => candidate.allow === "/")) {
      expect(rule.disallow).toEqual(expect.arrayContaining(exactPrivateRoutes));
    }
  });

  it("does not create a public exception for the API tree", () => {
    for (const rule of rules().filter((candidate) => candidate.allow === "/")) {
      expect(rule.disallow).toEqual(expect.arrayContaining(["/api/"]));
    }
  });
});
