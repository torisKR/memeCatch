import { describe, expect, it } from "vitest";
import { getSaveFailure } from "@/components/save-button";

describe("getSaveFailure", () => {
  it("recognizes login and free save limit errors without exposing database details", () => {
    expect(getSaveFailure("login_required")).toBe("login");
    expect(getSaveFailure("premium_save_limit: 30")).toBe("premium-limit");
    expect(getSaveFailure("database unavailable")).toBe("retry");
  });
});
