// Batch B2, /meme-cards (components/meme-collectible-gallery.tsx and
// components/meme-collectible-scratch.tsx) on seeds/b2b-seed.sql: 30
// cards, mc-0003 on the meme "엽기".
import { expect, focused, open, requestsDuring, test } from "../lib.mjs";

const seal = (page, n) => page.getByRole("button", { name: `미공개 카드 ${n} 선택`, exact: true });
const reveal = (page) => page.locator("section#reveal");

test.describe("the meme cards", () => {
  test("choose a sealed card, reveal it with the button, and put it back", async ({ page }) => {
    await open(page, "/meme-cards");
    await seal(page, 3).click();
    await expect(page).toHaveURL(/\/meme-cards\?card=mc-0003#reveal$/);
    await expect(seal(page, 3)).toHaveAttribute("aria-pressed", "true");
    await expect(reveal(page).getByRole("heading", { level: 2 })).toHaveText("오늘 내 취향에 들어올 카드");
    await expect.poll(() => focused(page)).toBe("h2: 오늘 내 취향에 들어올 카드");
    await expect(reveal(page).getByRole("progressbar", { name: "공개까지" })).toHaveAttribute("aria-valuenow", "0");

    const requests = await requestsDuring(page, async () => {
      await reveal(page).getByRole("button", { name: "바로 공개" }).click();
      await expect(reveal(page).getByRole("heading", { level: 2 })).toHaveText("엽기");
    });
    expect(requests.map((request) => `${request.method} ${request.path}`)).toContain("GET /api/meme-cards/mc-0003");
    await expect(page).toHaveURL(/\/meme-cards\?card=mc-0003&revealed=1#reveal$/);
    await expect(reveal(page).getByText("NO. 0003 / 1000")).toBeVisible();
    await expect(reveal(page).getByRole("status")).toHaveText("✦ 카드가 공개됐어요");
    await expect.poll(() => focused(page)).toBe("h2: 엽기");
    const login = reveal(page).getByRole("link", { name: "로그인하고 보유하기" });
    await expect(login).toHaveAttribute("href", `/login?next=${encodeURIComponent("/meme-cards?card=mc-0003&revealed=1#reveal")}`);
    await expect(reveal(page).getByRole("link", { name: "밈 뜻 · 유래 보기 ↗" })).toHaveAttribute("href", /^\/memes\/[a-z0-9]{8}-/);

    await reveal(page).getByRole("button", { name: "선택 취소" }).click();
    await expect(page).toHaveURL(/\/meme-cards$/);
    await expect(reveal(page)).toHaveCount(0);
    await expect(seal(page, 3)).toHaveAttribute("aria-pressed", "false");
  });

  test("scratching a third of the coat reveals the card", async ({ page }) => {
    await open(page, "/meme-cards?card=mc-0005");
    const canvas = reveal(page).locator("canvas");
    await expect(canvas).toHaveAttribute("data-canvas-state", "ready");
    // The page settles after load (on both servers): read the box each row.
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    let box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let row = 0; row < 14 && (await reveal(page).getAttribute("data-revealed")) !== "true"; row++) {
      box = await canvas.boundingBox();
      if (!box) break;
      const y = box.y + (row + 0.5) * box.height / 14;
      await page.mouse.move(box.x + 8, y, { steps: 4 });
      await page.mouse.move(box.x + box.width - 8, y, { steps: 12 });
    }
    await page.mouse.up();
    await expect(reveal(page)).toHaveAttribute("data-revealed", "true");
    await expect(page).toHaveURL(/\/meme-cards\?card=mc-0005&revealed=1#reveal$/);
    await expect(reveal(page).getByText("NO. 0005 / 1000")).toBeVisible();
    await expect(canvas).toHaveCount(0);
  });

  test("a card that does not load can be tried again; one that is gone cannot", async ({ page }) => {
    await open(page, "/meme-cards?card=mc-0004");
    await page.route("**/api/meme-cards/mc-0004", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"unavailable"}' }));
    await reveal(page).getByRole("button", { name: "바로 공개" }).click();
    const alert = reveal(page).getByRole("alert");
    await expect(alert).toContainText("카드를 불러오지 못했어요. 선택은 그대로예요. 다시 시도해 주세요.");
    await page.unroute("**/api/meme-cards/mc-0004");
    await alert.getByRole("button", { name: "다시 시도" }).click();
    await expect(reveal(page).getByText("NO. 0004 / 1000")).toBeVisible();
    await expect(page).toHaveURL(/revealed=1#reveal$/);

    await open(page, "/meme-cards?card=mc-0007");
    await page.route("**/api/meme-cards/mc-0007", (route) => route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"not_found"}' }));
    await reveal(page).getByRole("button", { name: "바로 공개" }).click();
    await expect(reveal(page).getByRole("alert")).toHaveText("지금은 이 카드를 보유할 수 없어요. 다른 카드를 골라 주세요.");
    await expect(reveal(page).getByRole("button", { name: "바로 공개" })).toBeDisabled();
    await expect(reveal(page).getByRole("alert").getByRole("button")).toHaveCount(0);
  });

  test("signed in, a revealed card is claimed and marked as owned", async ({ page, signIn }) => {
    await signIn("user");
    await open(page, "/meme-cards?card=mc-0006&revealed=1");
    const claim = reveal(page).getByRole("button", { name: "보유하기" });
    await expect(claim).toBeEnabled();
    const requests = await requestsDuring(page, async () => {
      await claim.click();
      await expect(reveal(page).getByText("소장 중 ✓")).toBeVisible();
    });
    const posted = requests.find((request) => request.path === "/api/meme-cards/claim");
    expect(posted.method).toBe("POST");
    expect(posted.body).toEqual({ cardId: "mc-0006" });
    await expect(reveal(page).getByRole("link", { name: "내 밈카드", exact: true })).toHaveAttribute("href", "/my#meme-cards");
    await expect(reveal(page).getByText("공개는 누구나, 보유는 로그인 후.", { exact: false })).toHaveCount(0);
    await expect(seal(page, 6).getByText("소장 중", { exact: true })).toBeVisible();

    // Again on another visit: the collection says so.
    await open(page, "/meme-cards");
    await expect(seal(page, 6).getByText("소장 중", { exact: true })).toBeVisible();
    await expect(seal(page, 5).getByText("소장 중", { exact: true })).toHaveCount(0);
  });

  test("shuffle reorders the same cards and their labels", async ({ page }) => {
    await open(page, "/meme-cards");
    const ids = () => page.locator("main ul button[data-card-id]").evaluateAll((buttons) => buttons.map((button) => button.dataset.cardId));
    const before = await ids();
    expect(before).toHaveLength(24);
    let after = before;
    for (let tries = 0; tries < 5 && after.join() === before.join(); tries++) {
      await page.getByRole("button", { name: "카드 뒤섞기 ↻" }).click();
      after = await ids();
    }
    expect(after.join()).not.toBe(before.join());
    expect([...after].sort()).toEqual([...before].sort());
    const labels = await page.locator("main ul button[data-card-id]").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(labels).toEqual(before.map((_, index) => `미공개 카드 ${index + 1} 선택`));
  });

  test("a card that cannot be opened leaves a notice until another is chosen", async ({ page }) => {
    await open(page, "/meme-cards?card=mc-0031");
    const notice = page.getByText("선택한 카드를 지금은 공개할 수 없어요. 다른 카드를 골라 주세요.");
    await expect(notice).toBeVisible();
    await expect(reveal(page)).toHaveCount(0);
    await seal(page, 2).click();
    await expect(notice).toHaveCount(0);
    await reveal(page).getByRole("button", { name: "선택 취소" }).click();
    await expect(notice).toBeVisible();
  });
});
