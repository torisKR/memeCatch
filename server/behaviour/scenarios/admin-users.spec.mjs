// /admin/users and /admin/users/{id}: who may open them, the search, and the
// account controls (components/admin/user-controls.tsx) with what each
// action leaves behind.
import { databaseSql, expect, newAccount, open, postsAction, requestsDuring, sqlText, test } from "../lib.mjs";

const auditRows = (userId) =>
  databaseSql(`select string_agg(action, ',' order by id) from admin_audit_log where entity_id = ${sqlText(userId)}`);

test.describe("admin users", () => {
  test("signed out: the screen sends to sign-in with the allowlisted query", async ({ page }) => {
    await page.goto("/admin/users?q=ab&zz=1");
    await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/admin/users?q=ab");
  });

  test("a user who is not an operator goes home", async ({ page, signIn }) => {
    await signIn("user");
    await page.goto("/admin/users");
    await expect(page).toHaveURL((url) => url.pathname === "/");
  });

  test("the search keeps its words in the address and the field", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/users");
    await expect(page.getByRole("heading", { name: "사용자 관리", level: 1 })).toBeVisible();
    await page.getByLabel("이메일 또는 닉네임 검색").fill("axum-behaviour");
    await page.getByRole("button", { name: "검색" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("q") === "axum-behaviour");
    await expect(page.getByLabel("이메일 또는 닉네임 검색")).toHaveValue("axum-behaviour");
  });

  test("an account's controls: password, reset mail and role", async ({ page, signIn }) => {
    await signIn("operator");
    const target = newAccount("user");
    await open(page, `/admin/users/${target.userId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/axum-behaviour-.*@example\.com/);
    await expect(page.getByText(target.nickname, { exact: true })).toBeVisible();

    const field = page.getByPlaceholder("새 비밀번호 (8자 이상)");
    const set = page.getByRole("button", { name: "직접 설정" });
    await expect(set).toBeDisabled();
    await field.fill("1234567");
    await expect(set).toBeDisabled();
    await field.fill("12345678");
    await expect(set).toBeEnabled();
    const setting = await requestsDuring(page, async () => {
      await set.click();
      await expect(page.getByRole("status")).toHaveText("비밀번호를 변경했어요.");
    });
    expect(postsAction(setting, "user-password")).toBe(true);
    await expect(field).toHaveValue("");
    await expect(set).toBeDisabled();

    await page.getByRole("button", { name: "재설정 메일 보내기" }).click();
    await expect(page.getByRole("status")).toHaveText("재설정 메일을 보냈어요.");

    await page.getByRole("button", { name: "운영자로 지정" }).click();
    await expect(page.getByRole("status")).toHaveText("운영자로 지정했어요.");
    await expect(page.getByRole("button", { name: "운영자 권한 해제" })).toBeVisible();
    await expect(page.getByText("운영자", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "운영자 권한 해제" }).click();
    await expect(page.getByRole("status")).toHaveText("일반 사용자로 변경했어요.");
    await expect(page.getByRole("button", { name: "운영자로 지정" })).toBeVisible();

    expect(auditRows(target.userId)).toBe(
      "user.password_set.intent,user.password_set.completed,user.role_set.intent,user.role_set.completed,user.role_set.intent,user.role_set.completed",
    );
    expect(databaseSql(`select role from profiles where id = ${sqlText(target.userId)}`)).toBe("user");
  });

  test("an operator cannot remove their own role", async ({ page, signIn }) => {
    const self = await signIn("operator");
    await open(page, `/admin/users/${self.userId}`);
    await page.getByRole("button", { name: "운영자 권한 해제" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("자기 자신의 운영자 권한은 해제할 수 없어요(잠금 방지).");
    expect(databaseSql(`select role from profiles where id = ${sqlText(self.userId)}`)).toBe("operator");
  });

  test("an unknown account shows the not-found text", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/users/00000000-0000-4000-8000-00000000dead");
    await expect(page.getByRole("heading", { name: "이 밈은... 아직 없네요" })).toBeVisible();
    await expect(page).toHaveTitle("사용자 상세 | 밈캐치 관리자");
  });
});
