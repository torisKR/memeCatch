import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { cronPathsForSchedule, dispatchScheduledCron } from "@/lib/cloudflare-cron";
import { deployStep } from "@/lib/cloudflare-deploy";
import { releaseShaForWorker, wwwToApexRedirect, withReleaseSha } from "@/lib/cloudflare-host";
import { detailDataCacheStores, detailHttpState } from "@/lib/detail-document-state";

describe("detail document states", () => {
  it("keeps a row, a miss, and an outage distinct", () => {
    expect(detailHttpState("row", false)).toEqual({ status: 200, body: "document", storedSuccess: false });
    expect(detailHttpState("empty", true)).toEqual({ status: 200, body: "document", storedSuccess: false });
    expect(detailHttpState("error", true)).toEqual({ status: 200, body: "document", storedSuccess: false });
    expect(detailHttpState("empty", false)).toEqual({ status: 404, body: "missing", storedSuccess: false });
    expect(detailHttpState("error", false)).toEqual({ status: 200, body: "outage", storedSuccess: false });
  });

  it("stores only a successful catalog row", () => {
    expect(detailDataCacheStores("row")).toBe(true);
    expect(detailDataCacheStores("empty")).toBe(false);
    expect(detailDataCacheStores("error")).toBe(false);
  });
});

describe("cron dispatch", () => {
  it("fans one shared schedule out to both routes and ignores an unknown schedule", () => {
    expect(cronPathsForSchedule("15 0 * * *")).toEqual([
      "/api/cron/growth-baseline",
      "/api/cron/plus-expiry-reminders",
    ]);
    expect(cronPathsForSchedule("0 0 * * *")).toEqual([]);
  });

  it("logs a failed route without rejecting the scheduled event", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchRoute = vi.fn(async (request: Request) => {
      if (new URL(request.url).pathname.endsWith("growth-baseline")) {
        return new Response("no", { status: 502 });
      }
      throw new Error("upstream down");
    });
    const results = await dispatchScheduledCron(fetchRoute, "15 0 * * *", "cron-secret");
    expect(results).toEqual([
      { cron: "15 0 * * *", path: "/api/cron/growth-baseline", status: 502 },
      { cron: "15 0 * * *", path: "/api/cron/plus-expiry-reminders", status: 0 },
    ]);
    expect(fetchRoute.mock.calls[0][0].headers.get("authorization")).toBe("Bearer cron-secret");
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("schedules the same expressions as vercel.json", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const wrangler = JSON.parse(readFileSync("wrangler.jsonc", "utf8")) as {
      triggers: { crons: string[] };
    };
    const fromVercel = [...new Set(vercel.crons.map((cron) => cron.schedule))].sort();
    expect([...wrangler.triggers.crons].sort()).toEqual(fromVercel);
    for (const cron of vercel.crons) {
      expect(cronPathsForSchedule(cron.schedule)).toContain(cron.path);
    }
  });
});

describe("deploy pipeline", () => {
  it("moves from preview to production only when credentials exist", () => {
    expect(deployStep("pull_request", false)).toBe("skip");
    expect(deployStep("push_main", false)).toBe("skip");
    expect(deployStep("pull_request", true)).toBe("preview");
    expect(deployStep("push_main", true)).toBe("production");
    expect(deployStep("other", true)).toBe("skip");
  });

  it("gates production on the GitHub environment and skips a deploy without credentials", () => {
    const workflow = readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("CLOUDFLARE_API_TOKEN");
    expect(workflow).toContain("CLOUDFLARE_ACCOUNT_ID");
    expect(workflow).toContain("--env preview");
  });
});

describe("apex redirect", () => {
  it("sends www to the apex and preserves the path and query", () => {
    const response = wwwToApexRedirect(new Request("http://www.catchmeme.com/memes/abc?q=1"));
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://catchmeme.com/memes/abc?q=1");
    expect(wwwToApexRedirect(new Request("https://catchmeme.com/"))).toBeNull();
  });

  it("uses RELEASE_SHA on the Worker, then version metadata", () => {
    expect(releaseShaForWorker({
      RELEASE_SHA: "build-sha",
      CF_VERSION_METADATA: { id: "version-id" },
    })).toBe("build-sha");
    expect(releaseShaForWorker({ CF_VERSION_METADATA: { id: "version-id" } })).toBe("version-id");
    expect(releaseShaForWorker({})).toBeUndefined();
  });

  it("adds a release header only when the response does not already have one", () => {
    const filled = withReleaseSha(new Response("ok"), "version-1");
    expect(filled.headers.get("X-MemeCatch-Release-Sha")).toBe("version-1");
    const existing = new Response("ok", { headers: { "X-MemeCatch-Release-Sha": "build" } });
    expect(withReleaseSha(existing, "version-1").headers.get("X-MemeCatch-Release-Sha")).toBe("build");
  });
});
