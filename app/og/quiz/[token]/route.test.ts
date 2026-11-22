import { describe, expect, it } from "vitest";
import { GET } from "@/app/og/quiz/[token]/route";

const TOKEN = "a1fe" + ["abcdefgh", "jkmnpqrs", "tuvwxyz2", "3456789a", "bcdefghj", "kmnpqrst", "uvwxyz23", "456789ab", "cdefghjk", "mnpqrstu"].join("");

function call(token: string) {
  return GET(new Request(`https://catchmeme.com/og/quiz/${token}`), {
    params: Promise.resolve({ token }),
  });
}

describe("/og/quiz/[token]", () => {
  it("renders a 1200x630 PNG for a valid result token", async () => {
    const response = await call(TOKEN);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }, 30_000);

  it("returns 404 for a malformed token", async () => {
    const response = await call("nope");
    expect(response.status).toBe(404);
  });
});
