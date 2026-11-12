import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/(default)/explore/page.tsx"),
  "utf-8",
);

describe("explore catalog window", () => {
  it("shows the retry state when the catalog fails and pages database rows on their own", () => {
    expect(source).toContain("if (queryFailed) return failed");
    expect(source).toContain("unavailable: true");
    expect(source).toContain("dbCount: page.scanned");
    expect(source).toContain("hasMore: page.hasMore");
    expect(source).toContain("initialOffset={initialLoad.dbCount}");
    expect(source).toContain("hasMoreInitial={initialLoad.hasMore}");
  });
});
