import { describe, expect, it } from "vitest";
import { hasTrustedOrigin } from "./origin";

function request(headers: HeadersInit = {}, url = "http://localhost/api/action") {
  return new Request(url, { method: "POST", headers });
}

describe("hasTrustedOrigin", () => {
  it("accepts the request origin and the configured canonical origin", () => {
    expect(hasTrustedOrigin(request({ origin: "http://localhost" }))).toBe(true);
    expect(hasTrustedOrigin(request({ origin: "https://catchmeme.com" }))).toBe(true);
  });

  it("rejects cross-origin, opaque, and malformed Origin headers", () => {
    expect(hasTrustedOrigin(request({ origin: "https://evil.example" }))).toBe(false);
    expect(hasTrustedOrigin(request({ origin: "null" }))).toBe(false);
    expect(hasTrustedOrigin(request({ origin: "not a url" }))).toBe(false);
  });

  it("allows a missing Origin only with browser-provided same-origin metadata", () => {
    expect(hasTrustedOrigin(request({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(hasTrustedOrigin(request({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(hasTrustedOrigin(request())).toBe(false);
  });
});
