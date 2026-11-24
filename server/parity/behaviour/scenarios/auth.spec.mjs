// The sign-in pages of batch B6: their forms, what each sends, and the rows a
// send leaves. Next posts a server action; the native page posts to the
// endpoint better-auth's client would call. Either is accepted by name, and
// the rows must be the same.
import { request as http } from "@playwright/test";
import { databaseSql, expect, mintUser, open, requestsDuring, sqlText, test } from "../lib.mjs";

const posted = (requests, paths) => requests.filter((request) => request.method === "POST" && paths.includes(request.path));

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

// A known password for a minted user, through better-auth's own reset.
const setPassword = async (baseURL, userId, password) => {
  const token = resetToken(userId);
  const context = await http.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${1 + Math.floor(Math.random() * 254)}` } });
  try {
    const response = await context.post("/api/auth/reset-password", { data: { newPassword: password, token } });
    expect(response.status()).toBe(200);
  } finally {
    await context.dispose();
  }
};
const sessions = (userId) => databaseSql(`select count(*) from public.session where "userId" = ${sqlText(userId)}`);

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

  // D2 (PLAN.md B6-27 M2): signed in without a token the form is
  // better-auth's `changePassword`: the current password, then every other
  // session ends. Next's server action asked for neither.
  for (const role of ["user", "operator"]) {
    test(`signed in as ${role} without a token: the current password, then the new one, other sessions end, and /my`, async ({ page, signIn, baseURL, server }) => {
      test.skip(server !== "axum", "Next's action asks for no current password (D2)");
      const session = await signIn(role);
      const email = databaseSql(`select email from public."user" where id = ${sqlText(session.userId)}`);
      await setPassword(baseURL, session.userId, "currentpass12");
      await open(page, "/reset-password");
      // Another device, signed in with the current password.
      expect(await signsIn(page, email, "currentpass12")).toBe(200);
      const before = passwordHash(session.userId);
      const devices = Number(sessions(session.userId));
      expect(devices).toBeGreaterThanOrEqual(2);
      await expect(page.locator("main")).toContainText(`${email} 계정의 새 비밀번호를 정해 주세요.`);
      const current = page.getByLabel("현재 비밀번호", { exact: true });
      const submit = page.getByRole("button", { name: "비밀번호 변경" });

      await current.fill("wrongpass9999");
      await page.getByLabel("새 비밀번호", { exact: true }).fill("signedinpass34");
      await page.getByLabel("새 비밀번호 확인").fill("signedinpass34");
      await submit.click();
      await expect(page.locator("main").getByRole("alert")).toHaveText("현재 비밀번호가 맞지 않아요");
      await expect(current).toHaveAttribute("aria-invalid", "true");
      expect(passwordHash(session.userId)).toBe(before);
      expect(Number(sessions(session.userId))).toBe(devices);

      await current.fill("currentpass12");
      await page.getByLabel("새 비밀번호", { exact: true }).fill("signedinpass34");
      await page.getByLabel("새 비밀번호 확인").fill("signedinpass34");
      const sent = await requestsDuring(page, async () => {
        await submit.click();
        await page.waitForURL((url) => url.pathname === "/my");
      });
      const sends = posted(sent, ["/api/account/password"]);
      expect(sends).toHaveLength(1);
      expect(sends[0].body).toEqual({ currentPassword: "currentpass12", password: "signedinpass34", confirm: "signedinpass34" });
      expect(passwordHash(session.userId)).not.toBe(before);
      expect(passwordHash(session.userId)).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      // Only this browser's session is left, and it still works.
      expect(sessions(session.userId)).toBe("1");
      await expect(page.locator("main")).not.toContainText("다시 만나서 반가워요");
      expect(await signsIn(page, email, "signedinpass34")).toBe(200);
    });
  }
});

test.describe("login", () => {
  const field = (page, name) => page.locator("main").getByLabel(name, { exact: true });

  test("sign in: checks the fields, refuses a wrong password, keeps the address and clears the password", async ({ page, baseURL }) => {
    const user = mintUser();
    await setPassword(baseURL, user.userId, "rightpassword12");
    await open(page, "/login?next=%2Fabout");
    await expect(page.getByRole("heading", { name: "다시 만나서 반가워요" })).toBeVisible();
    const submit = page.locator("main").getByRole("button", { name: "로그인", exact: true });

    const empty = await requestsDuring(page, () => submit.click());
    await expect(page.locator("main").getByRole("alert")).toHaveText(["이메일을 입력해 주세요", "비밀번호를 입력해 주세요"]);
    await expect(field(page, "이메일")).toHaveAttribute("aria-invalid", "true");
    await expect(field(page, "비밀번호")).toHaveAttribute("aria-invalid", "true");
    expect(posted(empty, ["/api/auth/sign-in/email"])).toEqual([]);

    await field(page, "이메일").fill(` ${user.email} `);
    await field(page, "비밀번호").fill("wrongpassword12");
    const before = sessions(user.userId);
    await submit.click();
    await expect(page.locator("main").getByRole("alert").filter({ hasText: "이메일 또는 비밀번호가 맞지 않아요" })).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveText("이메일 또는 비밀번호가 맞지 않아요");
    await expect(field(page, "이메일")).toHaveValue(user.email);
    await expect(field(page, "비밀번호")).toHaveValue("");
    await expect(field(page, "이메일")).toHaveAttribute("aria-invalid", "false");
    expect(sessions(user.userId)).toBe(before);
  });

  for (const role of ["user", "operator"]) {
    test(`sign in as ${role}: a session, and the page named by next`, async ({ page, baseURL, context }) => {
      const user = mintUser(role);
      await setPassword(baseURL, user.userId, "rightpassword12");
      const before = Number(sessions(user.userId));
      await open(page, "/login?next=%2Fabout%3Fx%3D1");
      await field(page, "이메일").fill(user.email);
      await field(page, "비밀번호").fill("rightpassword12");
      const sent = await requestsDuring(page, async () => {
        await page.locator("main").getByRole("button", { name: "로그인", exact: true }).click();
        await page.waitForURL((url) => url.pathname === "/about" && url.search === "?x=1");
      });
      const sends = posted(sent, ["<server action>", "/api/auth/sign-in/email"]);
      expect(sends).toHaveLength(1);
      if (sends[0].path !== "<server action>") expect(sends[0].body).toEqual({ email: user.email, password: "rightpassword12" });
      expect(Number(sessions(user.userId))).toBe(before + 1);
      const cookie = (await context.cookies()).find((item) => item.name.endsWith("better-auth.session_token"));
      expect(cookie?.httpOnly).toBe(true);
      // Next's header keeps the state it had before the action's client-side
      // redirect until the next document; the native page is a new document.
      await page.reload();
      await expect(page.getByRole("button", { name: `${user.nickname} · 내 계정` })).toBeVisible();
    });
  }

  test("sign up: checks every field, waits for consent, and shows the same notice for a new and a taken address", async ({ page }) => {
    await open(page, "/login?tab=signup");
    await expect(page.getByRole("heading", { name: "밈캐치에 어서 오세요" })).toBeVisible();
    const submit = page.locator("main").getByRole("button", { name: "가입하고 시작하기" });
    await expect(submit).toBeDisabled();
    await page.locator("main").getByRole("checkbox").check();
    await expect(submit).toBeEnabled();

    await field(page, "닉네임").fill("x");
    await field(page, "이메일").fill("someone@kakao.memecatch.internal");
    await field(page, "비밀번호").fill("short");
    const refused = await requestsDuring(page, () => submit.click());
    await expect(page.locator("main").getByRole("alert")).toHaveText([
      "닉네임은 2~20자로 지어 주세요",
      "가입할 수 없는 이메일 도메인이에요",
      "비밀번호는 영문과 숫자를 포함해 12자 이상이어야 해요",
    ]);
    await expect(field(page, "닉네임")).toHaveValue("x");
    await expect(field(page, "비밀번호")).toHaveValue("");
    expect(posted(refused, ["/api/auth/sign-up/email"])).toEqual([]);

    const email = `b6-signup-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    await field(page, "닉네임").fill(" 새밈러 ");
    await field(page, "이메일").fill(email);
    await field(page, "비밀번호").fill("signuppassword1");
    if (!(await page.locator("main").getByRole("checkbox").isChecked())) await page.locator("main").getByRole("checkbox").check();
    const sent = await requestsDuring(page, () => submit.click());
    const notice = "가입 요청을 접수했어요. 가입 가능한 이메일이면 확인 메일을 보내요. 메일의 링크를 열기 전에는 로그인되지 않아요.";
    await expect(page.locator("main").getByRole("status").filter({ hasText: "가입 요청을" })).toHaveText(notice);
    await expect(field(page, "닉네임")).toHaveValue("새밈러");
    await expect(field(page, "이메일")).toHaveValue(email);
    const sends = posted(sent, ["<server action>", "/api/auth/sign-up/email", "/api/auth/sign-out"]);
    if (sends[0]?.path !== "<server action>") {
      expect(sends.map((request) => request.path)).toEqual(["/api/auth/sign-up/email", "/api/auth/sign-out"]);
      expect(sends[0].body).toEqual({ email, password: "signuppassword1", name: "새밈러" });
    }
    const row = databaseSql(`select name || '|' || "emailVerified" || '|' || (select count(*) from public.account a where a."userId" = u.id and "providerId" = 'credential')
      || '|' || (select count(*) from public.session s where s."userId" = u.id) from public."user" u where email = ${sqlText(email)}`);
    expect(row).toBe("새밈러|false|1|0");

    // The same address again: the same notice, no second user.
    await field(page, "비밀번호").fill("signuppassword1");
    if (!(await page.locator("main").getByRole("checkbox").isChecked())) await page.locator("main").getByRole("checkbox").check();
    await submit.click();
    await expect(page.locator("main").getByRole("status").filter({ hasText: "가입 요청을" })).toHaveText(notice);
    expect(databaseSql(`select count(*) from public."user" where email = ${sqlText(email)}`)).toBe("1");
  });

  test("tabs, the callback notice, the social buttons and the TikTok link", async ({ page }) => {
    await open(page, "/login?error=auth&next=%2Fmy");
    await expect(page.locator("main").getByRole("alert")).toHaveText("로그인 링크가 만료됐거나 잘못됐어요. 다시 로그인해 주세요.");
    await expect(page.getByRole("link", { name: "TikTok으로 시작하기" })).toHaveAttribute("href", "/auth/tiktok?next=%2Fmy");
    const tabs = page.getByRole("tablist", { name: "로그인 방법 선택" });
    await expect(tabs.getByRole("tab", { name: "로그인" })).toHaveAttribute("aria-selected", "true");
    await field(page, "이메일").fill("typed@example.com");
    await tabs.getByRole("tab", { name: "가입하기" }).click();
    await expect(page.getByRole("heading", { name: "밈캐치에 어서 오세요" })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "가입하기" })).toHaveAttribute("aria-selected", "true");
    await expect(field(page, "닉네임")).toBeVisible();
    await tabs.getByRole("tab", { name: "로그인" }).click();
    // The other tab's form was unmounted: what was typed is gone.
    await expect(field(page, "이메일")).toHaveValue("");

    const social = await requestsDuring(page, () => page.getByRole("button", { name: "카카오로 시작하기" }).click());
    await expect(page.locator("main").getByRole("status").first()).toHaveText("카카오 로그인은 곧 열려요. 지금은 이메일로 시작해 주세요.");
    await expect(page.getByRole("button", { name: "카카오로 시작하기" })).toBeEnabled();
    const asked = posted(social, ["/api/auth/sign-in/social"]);
    expect(asked).toHaveLength(1);
    expect(asked[0].body).toEqual({ provider: "kakao", callbackURL: `${new URL(page.url()).origin}/auth/callback?next=%2Fmy`, disableRedirect: true });
  });

  test("the language switch changes the form's copy in place", async ({ page }) => {
    await open(page, "/login");
    await page.getByRole("combobox", { name: "언어 선택" }).selectOption("ar");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    const tabs = page.getByRole("tablist", { name: "Choose login method" });
    await expect(tabs.getByRole("tab")).toHaveText(["Log in", "Sign up"]);
    await expect(page.locator("main").getByRole("button", { name: "Continue with Kakao" })).toBeVisible();
    await tabs.getByRole("tab", { name: "Sign up" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to MemeCatch" })).toBeVisible();
    await expect(page.locator("main").getByLabel("Nickname", { exact: true })).toHaveAttribute("placeholder", "Use 2–20 characters");
    await expect(page.locator("main").getByRole("button", { name: "Create account" })).toBeDisabled();
  });
});
