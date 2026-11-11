import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth/server";

describe("email verification at sign-up", () => {
  it("blocks a password session until the address is verified", () => {
    expect(authOptions.emailAndPassword.requireEmailVerification).toBe(true);
    expect(authOptions.emailAndPassword.autoSignIn).toBe(false);
    expect(authOptions.emailVerification?.sendOnSignUp).toBe(true);
    expect(authOptions.emailVerification?.autoSignInAfterVerification).toBe(false);
    expect(authOptions.emailVerification?.sendVerificationEmail).toEqual(expect.any(Function));
  });
});
