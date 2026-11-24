// Batch B3, the Korean meme document: what its sections do below the answer
// card (the frame and saving are in frame.spec.mjs and account.spec.mjs). On
// ../pages/seed.sql and ../pages/b3-seed.sql.
import { MEME, expect, open, requestsDuring, test } from "../lib.mjs";

// components/export-button.tsx. The PNG is answered here: what is compared
// is the request and the download, not Next's image renderer.
test.describe("the card export", () => {
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  test("opens in place, keeps the choices, downloads the chosen card and closes", async ({ page }) => {
    const asked = [];
    await page.route("**/memes/pgrich01/export?*", (route) => {
      asked.push(new URL(route.request().url()).search);
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    });
    await open(page, MEME.path);
    await page.getByRole("button", { name: "카드 내보내기" }).click();
    const panel = page.getByRole("region", { name: "밈 카드로 저장" });
    await expect(panel).toBeVisible();
    await expect(page.getByRole("button", { name: "카드 내보내기" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "클래식" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "미니멀" })).toHaveAttribute("aria-pressed", "false");
    await expect(panel.getByRole("button", { name: "카드", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toContainText("저장한 카드에는 catchmeme.com 표시가 들어가요.");

    await panel.getByRole("button", { name: "미니멀" }).click();
    await panel.getByRole("button", { name: "스토리" }).click();
    await expect(panel.getByRole("button", { name: "미니멀" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "클래식" })).toHaveAttribute("aria-pressed", "false");
    await expect(panel.getByRole("button", { name: "스토리" })).toHaveAttribute("aria-pressed", "true");

    const downloaded = page.waitForEvent("download");
    const requests = await requestsDuring(page, () => panel.getByRole("button", { name: "다운로드" }).click());
    expect((await downloaded).suggestedFilename()).toBe("memecatch-pgrich01-minimal-story.png");
    expect(asked).toEqual(["?template=minimal&format=story"]);
    expect(requests.filter((request) => request.path.includes("/export"))).toEqual([
      { method: "GET", path: "/memes/pgrich01/export", body: null, shape: null },
    ]);

    await panel.getByRole("button", { name: "닫기" }).click();
    await expect(page.getByRole("region", { name: "밈 카드로 저장" })).toHaveCount(0);
    await page.getByRole("button", { name: "카드 내보내기" }).click();
    await expect(page.getByRole("region", { name: "밈 카드로 저장" }).getByRole("button", { name: "미니멀" })).toHaveAttribute("aria-pressed", "true");
  });

  test("says so while rendering and when the export fails, until the next choice", async ({ page }) => {
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route("**/memes/pgrich01/export?*", async (route) => {
      await held;
      await route.fulfill({ status: 500, body: "" });
    });
    await open(page, MEME.path);
    await page.getByRole("button", { name: "카드 내보내기" }).click();
    const panel = page.getByRole("region", { name: "밈 카드로 저장" });
    await panel.getByRole("button", { name: "다운로드" }).click();
    await expect(panel.getByRole("button", { name: "만드는 중…" })).toBeDisabled();
    release();
    await expect(panel.getByText("저장에 실패했어요. 다시 시도해 주세요.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "다운로드" })).toBeEnabled();
    await panel.getByRole("button", { name: "볼드" }).click();
    await expect(panel.getByText("저장에 실패했어요. 다시 시도해 주세요.")).toHaveCount(0);
  });

  test("speaks the language chosen in place", async ({ page }) => {
    await open(page, MEME.path);
    await page.getByRole("combobox", { name: "언어 선택" }).selectOption("ar");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await page.getByRole("button", { name: "Export card" }).click();
    const panel = page.getByRole("region", { name: "Save as meme card" });
    await expect(panel.getByRole("button", { name: "Classic" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "Download" })).toBeVisible();
  });
});

// ContinueStream and MemeNeighbourLinks: plain links to other documents.
test.describe("the links to other memes", () => {
  test("a similar meme's card and a neighbour link open their documents", async ({ page }) => {
    await open(page, MEME.path);
    const similar = page.getByRole("region", { name: "비슷한 밈" });
    const card = similar.getByRole("link").first();
    const title = (await card.locator("[data-meme-card-title]").textContent()).trim();
    await card.click();
    await expect(page).toHaveURL(/\/memes\/[a-z0-9]{8}-/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

    await open(page, MEME.path);
    const neighbours = page.getByRole("region", { name: "이어서 읽을 밈" });
    const link = neighbours.getByRole("listitem").first().getByRole("link");
    const name = (await link.textContent()).trim();
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await open(page, MEME.path);
    await page.getByRole("link", { name: "밈 전체 목록(가나다순) 보기" }).click();
    await expect(page).toHaveURL(/\/memes$/);
  });
});
