import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/(default)/admin/require-operator", () => ({ requireOperatorPage: vi.fn() }));
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { getAdminGA4Report } from "./ga4-admin";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const fetchMock = vi.fn();
const names = ["activeUsers", "sessions", "screenPageViews", "eventCount"];
function response(daily = false, values = ["5", "10", "15", "20"]) {
  return {
    metricHeaders: names.map((name) => ({ name })),
    dimensionHeaders: daily ? [{ name: "date" }] : [],
    rows: [{ metricValues: values.map((value) => ({ value })), ...(daily ? { dimensionValues: [{ value: "20260920" }] } : {}) }],
    rowCount: 1,
    metadata: { timeZone: "Asia/Seoul", subjectToThresholding: true },
  };
}
function ok(body: unknown) { return new Response(JSON.stringify(body), { status: 200 }); }
function token() { fetchMock.mockResolvedValueOnce(ok({ access_token: "test-token" })); }

beforeEach(() => {
  vi.stubEnv("GA4_PROPERTY_ID", "123456");
  vi.stubEnv("GA4_SERVICE_ACCOUNT_EMAIL", "test@example.iam.gserviceaccount.com");
  vi.stubEnv("GA4_SERVICE_ACCOUNT_PRIVATE_KEY", privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(requireOperatorPage).mockReset().mockResolvedValue({} as never);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("authorized GA4 reporting", () => {
  it.each(["unauthenticated", "non-operator", "operator-check-failed"])("does not read reports for %s", async (reason) => {
    vi.mocked(requireOperatorPage).mockRejectedValue(new Error(reason));
    await expect(getAdminGA4Report()).rejects.toThrow(reason);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports missing configuration without inventing zero metrics", async () => {
    vi.stubEnv("GA4_PROPERTY_ID", "");
    expect(await getAdminGA4Report()).toEqual({ status: "missing_config", missing: ["GA4_PROPERTY_ID"] });
    expect(requireOperatorPage).toHaveBeenCalledWith("/admin/analytics");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["G-ABC", "properties/123456", " 123456", "123/evil"])("rejects invalid property ID %s", async (id) => {
    vi.stubEnv("GA4_PROPERTY_ID", id);
    expect(await getAdminGA4Report()).toEqual({ status: "invalid_config" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects invalid key without leaking it", async () => {
    vi.stubEnv("GA4_SERVICE_ACCOUNT_PRIVATE_KEY", "secret-invalid-key");
    expect(await getAdminGA4Report()).toEqual({ status: "invalid_config" });
  });
  it("signs a readonly JWT and returns real response totals rather than summing daily users", async () => {
    token();
    fetchMock.mockResolvedValueOnce(ok(response())).mockResolvedValueOnce(ok(response(true, ["3", "4", "5", "6"])));
    const result = await getAdminGA4Report();
    expect(result).toMatchObject({ status: "ready", totals: { activeUsers: 5, sessions: 10 }, daily: [{ date: "2026-09-20", activeUsers: 3 }], timeZone: "Asia/Seoul", thresholded: true });
    const assertion = new URLSearchParams(fetchMock.mock.calls[0][1].body).get("assertion")!;
    const [header, payload, signature] = assertion.split(".");
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims).toMatchObject({ scope: "https://www.googleapis.com/auth/analytics.readonly", aud: "https://oauth2.googleapis.com/token" });
    expect(claims.exp - claims.iat).toBe(3600);
    expect(fetchMock.mock.calls[1][0]).toBe("https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }], dimensions: [] });
    expect(fetchMock.mock.calls.every(([, init]) => init.cache === "no-store" && init.redirect === "error" && init.signal)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test-token");
  });
  it("keeps returned zero metrics as genuine data", async () => {
    token();
    fetchMock.mockResolvedValueOnce(ok(response(false, ["0", "0", "0", "0"]))).mockResolvedValueOnce(ok(response(true, ["0", "0", "0", "0"])));
    expect(await getAdminGA4Report()).toMatchObject({ status: "ready", totals: { activeUsers: 0 } });
  });
  it("accepts escaped PEM newlines", async () => {
    vi.stubEnv("GA4_SERVICE_ACCOUNT_PRIVATE_KEY", privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n"));
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await getAdminGA4Report()).toEqual({ status: "error", reason: "unavailable" });
    expect(fetchMock).toHaveBeenCalled();
  });
  it("distinguishes a successful empty report", async () => {
    token();
    for (const daily of [false, true]) {
      fetchMock.mockResolvedValueOnce(ok({ ...response(daily), rows: undefined, rowCount: undefined }));
    }
    expect(await getAdminGA4Report()).toEqual({ status: "empty" });
  });
  it.each([[401, "authentication"], [403, "permission"], [429, "quota"], [503, "unavailable"]])("handles HTTP %s safely", async (status, reason) => {
    token();
    fetchMock.mockResolvedValue(new Response("sensitive upstream details", { status: status as number }));
    expect(await getAdminGA4Report()).toEqual({ status: "error", reason });
  });
  it("handles failed token exchange without leaking response", async () => {
    fetchMock.mockResolvedValue(new Response("private credential details", { status: 400 }));
    expect(await getAdminGA4Report()).toEqual({ status: "error", reason: "authentication" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([{}, response(false, ["NaN", "2", "3", "4"]), response(false, ["", "2", "3", "4"]), { ...response(), metricHeaders: [] }, { ...response(), rowCount: 2 }])("rejects malformed upstream report %#", async (body) => {
    token();
    fetchMock.mockResolvedValueOnce(ok(body)).mockResolvedValueOnce(ok(response(true)));
    expect(await getAdminGA4Report()).toEqual({ status: "error", reason: "invalid_response" });
  });
  it("handles timeout/network errors without leaking messages", async () => {
    fetchMock.mockRejectedValue(new Error("secret details"));
    expect(await getAdminGA4Report()).toEqual({ status: "error", reason: "unavailable" });
  });
});
