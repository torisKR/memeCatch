// /my (batch B6): the nickname form, signing out, and the saved library's
// search, safety filter and pages. Next posts server actions; the native
// page posts to POST /api/account/nickname and better-auth's sign-out.
import { databaseSql, expect, requestsDuring, sqlText, test } from "../lib.mjs";

// Next's /my keeps its sections' requests going (the card owner check runs
// again on focus), so the page is never network-idle: wait for the load.
const open = (page, path) => page.goto(path, { waitUntil: "load" });

const nickname = (userId) => databaseSql(`select nickname from public.profiles where id = ${sqlText(userId)}`);
const sessions = (userId) => databaseSql(`select count(*) from public.session where "userId" = ${sqlText(userId)}`);
const seedLibrary = (userId) => {
  databaseSql(`set session_replication_role = replica;
    insert into public.saved_memes (user_id, meme_id, created_at)
    select ${sqlText(userId)}, m.id, now() - (row_number() over (order by m.short_id)) * interval '1 minute'
      from public.memes m where m.moderation_status in ('approved', 'limited') order by m.short_id limit 55
    on conflict do nothing;`);
};

test("signed out: /my sends the visitor to sign in", async ({ page }) => {
  await page.goto("/my");
  await expect(page).toHaveURL(/\/login\?next=%2Fmy$/);
});

for (const role of ["user", "operator"]) {
  test(`as ${role}: the nickname is checked, a taken one is refused, a new one is saved`, async ({ page, signIn }) => {
    const taken = await signIn("user");
    const session = await signIn(role);
    await open(page, "/my");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(session.nickname);
    const field = page.getByLabel("닉네임", { exact: true });
    await expect(field).toHaveValue(session.nickname);
    const save = page.getByRole("button", { name: "저장", exact: true });

    // One character: the browser stops the form, nothing is sent.
    await field.fill("a");
    const tooShort = await requestsDuring(page, () => save.click());
    expect(tooShort.filter((request) => request.method === "POST")).toEqual([]);

    await field.fill(taken.nickname);
    await save.click();
    await page.waitForURL((url) => url.searchParams.has("nickname_error"));
    await expect(page.locator("#nickname-error")).toHaveText("이미 사용 중인 닉네임이에요");
    await expect(page.getByLabel("닉네임", { exact: true })).toHaveAttribute("aria-invalid", "true");
    expect(nickname(session.userId)).toBe(session.nickname);

    const renamed = `my${session.nickname.slice(2)}`;
    await page.getByLabel("닉네임", { exact: true }).fill(` ${renamed} `);
    const sent = await requestsDuring(page, async () => {
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get("nickname_saved") === "1");
    });
    const sends = sent.filter((request) => request.method === "POST" && ["<server action>", "/api/account/nickname"].includes(request.path));
    expect(sends).toHaveLength(1);
    await expect(page.getByRole("status").filter({ hasText: "닉네임을 저장했어요." })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamed);
    expect(nickname(session.userId)).toBe(renamed);
  });
}

test("signing out ends the session and goes home", async ({ page, signIn }) => {
  const session = await signIn("user");
  await open(page, "/my");
  expect(sessions(session.userId)).toBe("1");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect.poll(() => sessions(session.userId)).toBe("0");
});

test("the saved library: search, safety filter, pages and clearing", async ({ page, signIn, server }) => {
  const session = await signIn("user");
  seedLibrary(session.userId);
  await open(page, "/my");
  const library = page.locator("#saved");
  await expect(library.getByRole("status")).toHaveText("55개 결과 · 전체 55개 저장됨");
  await expect(library.getByRole("listitem")).toHaveCount(50);
  await expect(library.getByText("1 / 2 페이지")).toBeVisible();
  await library.getByRole("link", { name: "다음" }).click();
  await page.waitForURL((url) => url.searchParams.get("saved_page") === "2");
  await expect(page.locator("#saved").getByRole("listitem")).toHaveCount(5);

  await page.getByLabel("저장한 밈 검색").fill("밈 22brm83m");
  await page.getByLabel("사용 신호").selectOption("green");
  await page.getByRole("button", { name: "적용" }).click();
  await page.waitForURL((url) => url.searchParams.get("saved_safety") === "green");
  await expect(page.locator("#saved").getByRole("status")).toHaveText("1개 결과 · 전체 55개 저장됨");
  // Next's link keeps the filters (PLAN.md B6-12); the native one clears them.
  const clear = page.locator("#saved").getByRole("link", { name: "필터 지우기" }).first();
  if (server === "axum") await expect(clear).toHaveAttribute("href", "/my#saved");
  await open(page, "/my#saved");
  await expect(page.locator("#saved").getByRole("status")).toHaveText("55개 결과 · 전체 55개 저장됨");

  // A page past the last goes to the last.
  await page.goto("/my?saved_page=9");
  await page.waitForURL((url) => url.searchParams.get("saved_page") === "2");
});
