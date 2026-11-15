import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth/server";

const before = authOptions.databaseHooks.user.create.before;

describe("reserved provider email namespaces", () => {
  it("rejects public credential signup even when it bypasses the form", async () => {
    for (const email of ["123@kakao.memecatch.internal", "123@KAKAO.MEMECATCH.INTERNAL", "x@auth.memecatch.internal", "x@wallet.memecatch.internal"]) {
      await expect(before({ email }, { path: "/sign-up/email" })).rejects.toThrow("blocked email domain");
    }
  });

  it("allows Kakao's validated provider callback but not other callback providers", async () => {
    const user = { email: "123@kakao.memecatch.internal" };
    await expect(before(user, { path: "/callback/kakao" })).resolves.toEqual({ data: user });
    await expect(before(user, { path: "/callback/:id", params: { id: "kakao" } })).resolves.toEqual({ data: user });
    await expect(before(user, { path: "/callback/:id", params: { id: "google" } })).rejects.toThrow("blocked email domain");
    await expect(before({ email: "x@wallet.memecatch.internal" }, { path: "/callback/kakao" })).rejects.toThrow("blocked email domain");
  });
});
