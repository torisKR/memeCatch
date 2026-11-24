// The sign-in pages of batch B6: their forms, what each sends, and the rows a
// send leaves. Next posts a server action; the native page posts to the
// endpoint better-auth's client would call. Either is accepted by name, and
// the rows must be the same.
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
