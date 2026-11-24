// /onboarding (batch B6): the chips, saving them, and what the profile row
// holds afterwards. Next posts a server action; the native page posts to
// POST /api/account/onboarding.
import { databaseSql, expect, open, requestsDuring, sqlText, test } from "../lib.mjs";

const profile = (userId) =>
  databaseSql(`select coalesce(array_to_string(interests, ','), '') || '|' || coalesce(age_group, '') || '|' || coalesce(use_purpose, '')
    || '|' || coalesce(array_to_string(preferred_platforms, ','), '') || '|' || nickname from public.profiles where id = ${sqlText(userId)}`);

test("signed out: the visitor is sent to sign in and back", async ({ page }) => {
  await page.goto("/onboarding?next=%2Fabout");
  await page.waitForURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/onboarding?next=/about");
});

for (const role of ["user", "operator"]) {
  test(`as ${role}: the chips are the form, saving writes the profile and goes to next`, async ({ page, signIn }) => {
    const session = await signIn(role);
    await open(page, "/onboarding?next=%2Fabout%3Fx%3D1");
    await expect(page.getByRole("heading", { name: "밈캐치에 오신 걸 환영해요" })).toBeVisible();
    const nickname = page.getByLabel("닉네임");
    await expect(nickname).toHaveValue(session.nickname);
    await expect(page.getByRole("link", { name: "건너뛰기" })).toHaveAttribute("href", "/about?x=1");

    const purposes = page.getByRole("radiogroup", { name: "어디에 밈을 활용하나요?" });
    await expect(purposes.getByRole("radio", { checked: true })).toHaveText("콘텐츠 크리에이터");
    await purposes.getByRole("radio").nth(1).click();
    await expect(purposes.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(purposes.getByRole("radio").nth(0)).toHaveAttribute("aria-checked", "false");

    const dance = page.getByRole("button", { name: "챌린지 댄스", exact: true });
    await dance.click();
    await expect(dance).toHaveAttribute("aria-pressed", "true");
    const song = page.getByRole("button", { name: "노래", exact: true });
    await song.click();
    await song.click();
    await expect(song).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "YouTube", exact: true }).click();
    await page.getByRole("button", { name: "X", exact: true }).click();
    await page.getByRole("button", { name: "X", exact: true }).click();
    const ages = page.getByRole("radiogroup", { name: "연령대" });
    await expect(ages.getByRole("radio", { checked: true })).toHaveText("선택 안 함");
    await ages.getByRole("radio", { name: "20대" }).click();

    const renamed = `on${session.nickname.slice(2)}`;
    await nickname.fill(` ${renamed} `);
    const sent = await requestsDuring(page, async () => {
      await page.getByRole("button", { name: "밈캐치 시작하기" }).click();
      await page.waitForURL((url) => url.pathname === "/about" && url.search === "?x=1");
    });
    const sends = sent.filter((request) => request.method === "POST" && ["<server action>", "/api/account/onboarding"].includes(request.path));
    expect(sends).toHaveLength(1);
    if (sends[0].path !== "<server action>") {
      expect(sends[0].body).toEqual({
        next: "/about?x=1",
        nickname: ` ${renamed} `,
        interests: ["dance", "challenge"],
        age_group: "20s",
        use_purpose: "brand",
        preferred_platforms: ["youtube"],
      });
    }
    expect(profile(session.userId)).toBe(`dance,challenge|20s|brand|youtube|${renamed}`);

    // The next visit starts from what was saved.
    await open(page, "/onboarding");
    await expect(page.getByLabel("닉네임")).toHaveValue(renamed);
    await expect(page.getByRole("button", { name: "챌린지 댄스", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "YouTube", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radiogroup", { name: "연령대" }).getByRole("radio", { checked: true })).toHaveText("20대");
    await expect(page.getByRole("radiogroup", { name: "어디에 밈을 활용하나요?" }).getByRole("radio", { checked: true })).toHaveText("브랜드 팀");
  });
}

test("a nickname someone else has: the action fails and the error page shows; the profile is unchanged", async ({ page, signIn }) => {
  const taken = await signIn("user");
  const session = await signIn("user");
  const before = profile(session.userId);
  await open(page, "/onboarding");
  await page.getByLabel("닉네임").fill(taken.nickname);
  await page.getByRole("button", { name: "밈캐치 시작하기" }).click();
  await expect(page.getByRole("heading", { name: "밈을 잡다가 놓쳤어요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  expect(profile(session.userId)).toBe(before);
});

test("the language switch changes the form's copy in place", async ({ page, signIn }) => {
  await signIn("user");
  await open(page, "/onboarding");
  await page.getByRole("combobox", { name: "언어 선택" }).selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  const english = await page.locator("main h1").textContent();
  expect(english).not.toBe("밈캐치에 오신 걸 환영해요");
  await expect(page.locator("main")).not.toContainText("건너뛰기");
});
