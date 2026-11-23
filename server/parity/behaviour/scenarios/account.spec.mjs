// The account control in the header, signed out and signed in, and saving a
// meme, which needs to know who is signed in.
import { MEME, cookieValue, expect, focusRing, focused, localStorageItem, open, requestsDuring, test } from "../lib.mjs";

const asksFor = (requests, path, text) =>
  requests.some((request) => request.method === "POST" && request.path === path && JSON.stringify(request.body).includes(text));

for (const path of ["/about", MEME.path]) {
  test.describe(`account on ${path}`, () => {
    test("signed out: the header offers a sign-in link that comes back here", async ({ page }) => {
      await open(page, path);
      await expect(page.locator("header").getByRole("link", { name: "로그인", exact: true })).toHaveAttribute("href", `/login?next=${encodeURIComponent(path)}`);
    });

    for (const role of ["user", "operator"]) {
      test(`signed in as ${role}: the account menu names the user, traps nothing, and signs out`, async ({ page, signIn }) => {
        const session = await signIn(role);
        const loading = await requestsDuring(page, () => open(page, path));
        const name = `${session.nickname} · 내 계정`;
        const button = page.getByRole("button", { name });
        await expect(button).toBeVisible();
        await expect(button).toHaveText(session.nickname[0].toUpperCase());
        await expect(page.locator("header").getByRole("link", { name: "로그인", exact: true })).toHaveCount(0);
        expect(loading).toContainEqual(expect.objectContaining({ method: "GET", path: "/api/auth/get-session" }));
        expect(asksFor(loading, "/api/db/query", "nickname")).toBe(true);
        // Kept so that the next page shows the avatar without waiting.
        expect(await localStorageItem(page, "mc_auth_nick")).toBe(session.nickname);

        await expect(button).toHaveAttribute("aria-haspopup", "menu");
        await expect(button).toHaveAttribute("aria-expanded", "false");
        await button.click();
        const menu = page.getByRole("menu", { name: "내 계정" });
        await expect(menu).toBeVisible();
        await expect(button).toHaveAttribute("aria-expanded", "true");
        await expect.poll(() => focused(page)).toBe("menuitem: MY");
        // The same three entries for an operator: the frame has no operator link.
        await expect(menu.getByRole("menuitem")).toHaveText(["MY", "저장한 밈", "로그아웃"]);
        expect(await menu.getByRole("menuitem").evaluateAll((items) => items.map((item) => item.getAttribute("href")))).toEqual(["/my", "/my#saved", null]);
        await expect(menu.getByText(session.nickname, { exact: true })).toBeVisible();
        await expect(menu.getByText("님, 어서 오세요")).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
        await expect(button).toHaveAttribute("aria-expanded", "false");
        expect(await focused(page)).toBe(`button: ${name}`);
        expect(await focusRing(page)).toBe("solid 2px");

        await button.click();
        await expect(menu).toBeVisible();
        await page.mouse.click(4, 330);
        await expect(menu).toHaveCount(0);

        await button.click();
        const leaving = await requestsDuring(page, async () => {
          await menu.getByRole("menuitem", { name: "로그아웃" }).click();
          await page.waitForURL((url) => url.pathname === "/");
        });
        // Next posts a server action; a page without Next's runtime posts to
        // better-auth's own endpoint. Either ends the session.
        expect(leaving.some((request) => request.method === "POST" && ["<server action>", "/api/auth/sign-out"].includes(request.path))).toBe(true);
        expect(await cookieValue(page, session.cookieName)).toBeNull();
        await open(page, path);
        await expect(page.locator("header").getByRole("link", { name: "로그인", exact: true })).toBeVisible();
        expect(await localStorageItem(page, "mc_auth_nick")).toBeNull();
      });
    }
  });
}

test.describe("saving a meme", () => {
  test("signed out: the choice is kept on this device and a sign-in dialog opens", async ({ page }) => {
    await open(page, MEME.path);
    const save = page.getByRole("button", { name: "이 밈 저장하기" });
    await expect(save).toHaveAttribute("aria-pressed", "false");
    const requests = await requestsDuring(page, () => save.click());

    const dialog = page.getByRole("dialog", { name: "로그인하면 밈을 저장할 수 있어요." });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByRole("button", { name: "저장한 밈", exact: true })).toHaveAttribute("aria-pressed", "true");
    const intents = JSON.parse(await localStorageItem(page, "memecatch:save-intents:v1"));
    expect(intents).toEqual([{ memeId: MEME.id, createdAt: expect.any(Number) }]);
    expect(requests).toContainEqual(expect.objectContaining({
      path: "/api/analytics/events",
      body: expect.objectContaining({ eventName: "follow_click", params: { meme_id: MEME.id } }),
    }));

    const next = encodeURIComponent(MEME.path);
    await expect(dialog.getByRole("button", { name: "카카오로 시작하기" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "구글로 시작하기" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "TikTok으로 시작하기" })).toHaveAttribute("href", `/auth/tiktok?next=${next}`);
    await expect(dialog.locator(`a[href="/login?next=${next}"]`)).toBeVisible();
    // A modal: Tab never leaves it.
    for (let press = 0; press < 8; press += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => focused(page)).toBe("button: 저장한 밈");
  });

  test("signed in: saving and removing are stored on the server and announced", async ({ page, signIn }) => {
    await signIn("user");
    const loading = await requestsDuring(page, () => open(page, MEME.path));
    expect(asksFor(loading, "/api/db/query", "saved_memes")).toBe(true);
    const save = page.getByRole("button", { name: "이 밈 저장하기" });
    const saved = page.getByRole("button", { name: "저장한 밈", exact: true });
    await expect(save).toHaveAttribute("aria-pressed", "false");

    const saving = await requestsDuring(page, () => save.click());
    expect(asksFor(saving, "/api/db/query", "toggle_save")).toBe(true);
    await expect(saved).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("status").filter({ hasText: "MY에 저장했어요." })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await open(page, MEME.path);
    await expect(saved).toHaveAttribute("aria-pressed", "true");
    await saved.click();
    await expect(save).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("status").filter({ hasText: "저장을 해제했어요." })).toBeVisible();
  });
});
