import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  put: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/integrations/memecatch-chatgpt/src/state.mjs", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/integrations/memecatch-chatgpt/src/state.mjs")>(),
  databaseStore: () => ({ put: mocks.put }),
}));

import { GET, POST } from "./route.js";
import { CLIENT, ORIGIN, REDIRECT, RESOURCE, SCOPE } from "@/integrations/memecatch-chatgpt/src/oauth.mjs";

const url = new URL(`${RESOURCE}/oauth/authorize`);
url.search = new URLSearchParams({
  response_type: "code", client_id: CLIENT, redirect_uri: REDIRECT,
  resource: RESOURCE, scope: SCOPE, code_challenge_method: "S256",
  code_challenge: createHash("sha256").update("v".repeat(43)).digest("base64url"),
  state: "opaque-chatgpt-state",
}).toString();

async function ticket() {
  const response = await GET(new Request(url));
  expect(response.status).toBe(200);
  const match = (await response.text()).match(/name="ticket" value="([^"]+)"/);
  expect(match).not.toBeNull();
  return match![1];
}
function submit(consent: string, origin?: string) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(origin ? { Origin: origin } : {}) },
    body: new URLSearchParams({ ticket: consent, decision: "allow" }),
  });
}

beforeEach(() => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "existing-operator" } } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.put.mockResolvedValue(undefined);
  vi.stubEnv("MCP_EVENT_STATE_KEY", Buffer.alloc(32, 9).toString("base64"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
    client_id: CLIENT, redirect_uris: [REDIRECT], token_endpoint_auth_methods_supported: ["none"],
  })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("operator OAuth browser consent", () => {
  it("keeps same-origin POST verifiable and allows only the registered callback redirect", async () => {
    const response = await GET(new Request(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
    const policy = response.headers.get("Content-Security-Policy")!;
    expect(policy).toContain(`form-action 'self' ${REDIRECT};`);
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("grants a bound code and redirects without disclosing its URL as a referrer", async () => {
    const response = await POST(submit(await ticket(), ORIGIN));
    expect(response.status).toBe(303);
    const target = new URL(response.headers.get("Location")!);
    expect(target.origin + target.pathname).toBe(REDIRECT);
    expect(target.searchParams.get("state")).toBe("opaque-chatgpt-state");
    expect(target.searchParams.get("iss")).toBe(ORIGIN);
    expect(target.searchParams.get("code")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.put).toHaveBeenCalledOnce();
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it.each([undefined, "null", "https://evil.invalid"])("rejects untrusted POST origin %s before issuing any code", async (origin) => {
    const response = await POST(submit(await ticket(), origin));
    expect(response.status).toBe(403);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("rejects a consent ticket after the operator identity changes", async () => {
    const consent = await ticket();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "other-operator" } } });
    expect((await POST(submit(consent, ORIGIN))).status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
