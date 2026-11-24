// The sign-in pages of batch B6: their forms, what each sends, and the rows a
// send leaves. Next posts a server action; the native page posts to the
// endpoint better-auth's client would call. Either is accepted by name, and
// the rows must be the same.
import { request as http } from "@playwright/test";
import { databaseSql, expect, mintUser, open, requestsDuring, sqlText, test } from "../lib.mjs";

const posted = (requests, paths) => requests.filter((request) => request.method === "POST" && paths.includes(request.path));

test.describe("forgot password", () => {
  test("checks the address before anything is sent and keeps what was typed", async ({ page }) => {
    await open(page, "/forgot-password");
    const email = page.getByLabel("이메일");
    const submit = page.getByRole("button", { name: "재설정 메일 받기" });

    const empty = await requestsDuring(page, () => submit.click());
    await expect(page.locator("main").getByRole("alert")).toHaveText("이메일을 입력해 주세요");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAttribute("aria-describedby", /-error$/);
    await expect(email).toHaveValue("");
    expect(posted(empty, ["/api/auth/request-password-reset"])).toEqual([]);

    await email.fill("  not-an-address ");
    const invalid = await requestsDuring(page, () => submit.click());
    await expect(page.locator("main").getByRole("alert")).toHaveText("이메일 형식이 맞지 않아요");
    // The action returns the trimmed value and the form is reset to it.
    await expect(email).toHaveValue("not-an-address");
    expect(posted(invalid, ["/api/auth/request-password-reset"])).toEqual([]);
    await expect(page.locator("main").getByRole("status")).toHaveCount(0);
  });

  test("an address with an account: the notice, one reset row, and the button offers to send again", async ({ page }) => {
    const user = mintUser();
    const resets = () =>
      databaseSql(`select count(*) from public.verification where value = ${sqlText(user.userId)} and identifier like 'reset-password:%'`);
    expect(resets()).toBe("0");
    await open(page, "/forgot-password");
    await page.getByLabel("이메일").fill(` ${user.email} `);
    const sent = await requestsDuring(page, () => page.getByRole("button", { name: "재설정 메일 받기" }).click());
    const notice = page.locator("main").getByRole("status").filter({ hasText: "재설정 메일을 보냈어요" });
    await expect(notice).toHaveText("재설정 메일을 보냈어요. 메일함(스팸함도 함께) 을 확인해 주세요. 링크는 1시간 동안 유효해요.");
    await expect(page.getByLabel("이메일")).toHaveValue(user.email);
    await expect(page.getByLabel("이메일")).toHaveAttribute("aria-invalid", "false");
    await expect(page.getByRole("button", { name: "다시 보내기" })).toBeEnabled();
    const sends = posted(sent, ["<server action>", "/api/auth/request-password-reset"]);
    expect(sends).toHaveLength(1);
    if (sends[0].path !== "<server action>") {
      expect(sends[0].body).toEqual({ email: user.email, redirectTo: "/reset-password" });
    }
    await expect.poll(resets).toBe("1");
    // The token lives an hour, as better-auth's resetPasswordTokenExpiresIn.
    const minutes = databaseSql(`select round(extract(epoch from ("expiresAt" - now())) / 60) from public.verification
      where value = ${sqlText(user.userId)} and identifier like 'reset-password:%'`);
    expect(Number(minutes)).toBeGreaterThanOrEqual(59);
    expect(Number(minutes)).toBeLessThanOrEqual(60);
  });

  test("an address without an account: the same notice and no row", async ({ page }) => {
    const email = `nobody-${Date.now()}@example.com`;
    await open(page, "/forgot-password");
    await page.getByLabel("이메일").fill(email);
    await page.getByRole("button", { name: "재설정 메일 받기" }).click();
    await expect(page.locator("main").getByRole("status").filter({ hasText: "재설정 메일을 보냈어요" })).toBeVisible();
    expect(databaseSql(`select count(*) from public.verification v join public."user" u on u.id::text = v.value where u.email = ${sqlText(email)}`)).toBe("0");
  });
});

test.describe("reset password", () => {
  const passwordHash = (userId) =>
    databaseSql(`select password from public.account where "userId" = ${sqlText(userId)} and "providerId" = 'credential'`);
  // A reset token as better-auth stores one (`reset-password:<token>`, an hour).
  const resetToken = (userId) => {
    const token = `b6reset${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    databaseSql(`insert into public.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
      values (gen_random_uuid(), ${sqlText(`reset-password:${token}`)}, ${sqlText(userId)}, now() + interval '1 hour', now(), now())`);
    return token;
  };
  // From a context of its own: no session cookie, so no origin check.
  const signsIn = async (page, email, password) => {
    // One address of its own: better-auth on Next counts by a single
    // forwarded address, and without one every check shares one bucket.
    const visitor = `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
    const context = await http.newContext({ baseURL: new URL(page.url()).origin, extraHTTPHeaders: { "x-forwarded-for": visitor } });
    try {
      const response = await context.post("/api/auth/sign-in/email", { data: { email, password } });
      return response.status();
    } finally {
      await context.dispose();
    }
  };

  test("signed out without a token: the link has expired, and no form", async ({ page }) => {
    await open(page, "/reset-password");
    await expect(page.locator("main")).toContainText("재설정 링크가 만료됐거나 유효하지 않아요.");
    await expect(page.getByRole("link", { name: "재설정 메일 다시 받기" })).toHaveAttribute("href", "/forgot-password");
    await expect(page.getByLabel("새 비밀번호", { exact: true })).toHaveCount(0);
  });

  test("with the mail's token: checks the passwords, then sets the new one and goes to /my", async ({ page, server }) => {
    const user = mintUser();
    const token = resetToken(user.userId);
    const before = passwordHash(user.userId);
    await open(page, `/reset-password?token=${token}`);
    await expect(page.locator("main")).toContainText("메일의 재설정 링크로 새 비밀번호를 정해 주세요.");
    const password = page.getByLabel("새 비밀번호", { exact: true });
    const confirm = page.getByLabel("새 비밀번호 확인");
    await expect(password).toHaveAttribute("aria-describedby", /-hint$/);
    const submit = page.getByRole("button", { name: "비밀번호 변경" });

    await password.fill("short1");
    await confirm.fill("short1");
    const weak = await requestsDuring(page, () => submit.click());
    await expect(page.locator("main").getByRole("alert")).toHaveText("비밀번호는 영문과 숫자를 포함해 12자 이상이어야 해요");
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAttribute("aria-describedby", /-error$/);
    await expect(page.getByText("6자 이상으로 정해 주세요.")).toHaveCount(0);
    // The form is reset when the action ends.
    await expect(password).toHaveValue("");
    await expect(confirm).toHaveValue("");
    expect(posted(weak, ["/api/auth/reset-password", "/api/account/password"])).toEqual([]);

    await password.fill("newpassword12");
    await confirm.fill("newpassword13");
    await submit.click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("두 비밀번호가 서로 달라요");
    expect(passwordHash(user.userId)).toBe(before);

    await password.fill("newpassword12");
    await confirm.fill("newpassword12");
    const sent = await requestsDuring(page, async () => {
      await submit.click();
      // Not signed in by a reset: /my sends the visitor to sign in. Next's
      // client router shows the sign-in page under the URL /my; the native
      // page follows the redirect to its URL (PLAN.md B6-5).
      await expect(page.getByRole("heading", { name: "다시 만나서 반가워요" })).toBeVisible({ timeout: 15_000 });
    });
    if (server === "axum") await expect(page).toHaveURL(/\/login\?next=%2Fmy$/);
    else await expect(page).toHaveURL(/\/my$/);
    const sends = posted(sent, ["<server action>", "/api/auth/reset-password"]);
    expect(sends).toHaveLength(1);
    if (sends[0].path !== "<server action>") expect(sends[0].body).toEqual({ newPassword: "newpassword12", token });
    expect(passwordHash(user.userId)).not.toBe(before);
    expect(passwordHash(user.userId)).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(databaseSql(`select count(*) from public.verification where identifier = ${sqlText(`reset-password:${token}`)}`)).toBe("0");
    expect(await signsIn(page, user.email, "newpassword12")).toBe(200);
  });

  test("with a token that does not exist: the change fails and nothing is written", async ({ page }) => {
    const user = mintUser();
    const before = passwordHash(user.userId);
    await open(page, "/reset-password?token=nosuchtoken");
    await page.getByLabel("새 비밀번호", { exact: true }).fill("newpassword12");
    await page.getByLabel("새 비밀번호 확인").fill("newpassword12");
    await page.getByRole("button", { name: "비밀번호 변경" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("비밀번호 변경에 실패했어요. 잠시 후 다시 시도해 주세요.");
    await expect(page).toHaveURL(/\/reset-password\?token=nosuchtoken$/);
    expect(passwordHash(user.userId)).toBe(before);
  });

  test("the password endpoint: signed out it answers the action's expired-link state, another origin is refused", async ({ page, server }) => {
    test.skip(server !== "axum", "Next has a server action here, not an endpoint");
    await open(page, "/reset-password");
    const origin = new URL(page.url()).origin;
    const body = { password: "signedoutpass56", confirm: "signedoutpass56" };
    const anonymous = await page.request.post("/api/account/password", { data: body, headers: { origin } });
    expect(anonymous.status()).toBe(200);
    expect(await anonymous.json()).toEqual({ formError: "재설정 링크가 만료됐거나 유효하지 않아요. 메일을 다시 요청해 주세요." });
    const weak = await page.request.post("/api/account/password", { data: { password: "x", confirm: "x" }, headers: { origin } });
    expect(await weak.json()).toEqual({ fieldErrors: { password: "비밀번호는 영문과 숫자를 포함해 12자 이상이어야 해요" } });
    const foreign = await page.request.post("/api/account/password", { data: body, headers: { origin: "https://evil.example" } });
    expect(foreign.status()).toBe(403);
  });

  for (const role of ["user", "operator"]) {
    test(`signed in as ${role} without a token: sets the new password and goes to /my`, async ({ page, signIn }) => {
      const session = await signIn(role);
      const email = databaseSql(`select email from public."user" where id = ${sqlText(session.userId)}`);
      const before = passwordHash(session.userId);
      await open(page, "/reset-password");
      await expect(page.locator("main")).toContainText(`${email} 계정의 새 비밀번호를 정해 주세요.`);
      await page.getByLabel("새 비밀번호", { exact: true }).fill("signedinpass34");
      await page.getByLabel("새 비밀번호 확인").fill("signedinpass34");
      const sent = await requestsDuring(page, async () => {
        await page.getByRole("button", { name: "비밀번호 변경" }).click();
        await page.waitForURL((url) => url.pathname === "/my");
      });
      const sends = posted(sent, ["<server action>", "/api/account/password"]);
      expect(sends).toHaveLength(1);
      if (sends[0].path !== "<server action>") expect(sends[0].body).toEqual({ password: "signedinpass34", confirm: "signedinpass34" });
      expect(passwordHash(session.userId)).not.toBe(before);
      expect(passwordHash(session.userId)).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(await signsIn(page, email, "signedinpass34")).toBe(200);
    });
  }
});
