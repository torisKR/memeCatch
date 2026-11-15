import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditInsert: vi.fn(),
  getUser: vi.fn(),
  isOperator: vi.fn(),
  revalidatePath: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.isOperator,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { updateUserById: mocks.updateUserById } },
    from: () => ({ insert: mocks.auditInsert }),
  }),
}));

import { setUserPassword } from "./admin-users";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "operator-1" } } });
  mocks.isOperator.mockResolvedValue({ data: true });
  mocks.auditInsert.mockResolvedValue({ error: null });
  mocks.updateUserById.mockResolvedValue({ error: null });
});

describe("admin user audit ordering", () => {
  it("does not mutate when the durable intent cannot be written", async () => {
    mocks.auditInsert.mockResolvedValueOnce({ error: new Error("audit unavailable") });

    await expect(setUserPassword({
      userId: "user-1",
      password: "long-enough-password",
    })).resolves.toEqual({ ok: false, error: "감사 로그 저장에 실패했어요." });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("records intent before mutation and completion after success", async () => {
    await expect(setUserPassword({
      userId: "user-1",
      password: "long-enough-password",
    })).resolves.toEqual({ ok: true });

    expect(mocks.auditInsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      action: "user.password_set.intent",
    }));
    expect(mocks.auditInsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      action: "user.password_set.completed",
    }));
    expect(mocks.auditInsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateUserById.mock.invocationCallOrder[0],
    );
    expect(mocks.updateUserById.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.auditInsert.mock.invocationCallOrder[1],
    );
  });

  it("records failure after a rejected mutation", async () => {
    mocks.updateUserById.mockResolvedValueOnce({
      error: new Error("auth update failed"),
    });

    await expect(setUserPassword({
      userId: "user-1",
      password: "long-enough-password",
    })).resolves.toEqual({ ok: false, error: "auth update failed" });
    expect(mocks.auditInsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      action: "user.password_set.failed",
    }));
  });

  it("returns mutation success when completion audit needs reconciliation", async () => {
    const telemetry = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.auditInsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("audit unavailable") });

    await expect(setUserPassword({
      userId: "user-1",
      password: "long-enough-password",
    })).resolves.toEqual({ ok: true });
    expect(telemetry).toHaveBeenCalledWith({
      event: "admin_audit_completion_pending",
      action: "user.password_set",
    });
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain("user-1");
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain("long-enough-password");
    telemetry.mockRestore();
  });
});
