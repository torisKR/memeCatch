// Batch B2, /studio (components/studio/meme-studio-app.tsx, components/studio/artifact-studio.tsx).
// The concepts come from the template generator of POST /api/meme-studio (no AI key).
import { expect, open, requestsDuring, test } from "../lib.mjs";

// A 2×2 red PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==", "base64");

const ideas = (page) => page.getByRole("region", { name: "생성된 밈 아이디어" });
const artifacts = (page) => page.getByRole("region", { name: "내 콘텐츠 출력" });

test.describe("the studio", () => {
  test("the workspaces take turns", async ({ page }) => {
    await open(page, "/studio");
    const toArtifacts = page.getByRole("button", { name: /내 콘텐츠 출력/ });
    await expect(page.locator("#studio-workspace-artifacts")).toBeHidden();
    await toArtifacts.click();
    await expect(toArtifacts).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#studio-workspace-ideas")).toBeHidden();
    await expect(artifacts(page)).toBeVisible();
    await page.getByRole("button", { name: /아이디어 생성/ }).click();
    await expect(page.locator("#studio-workspace-ideas")).toBeVisible();
    await expect(toArtifacts).toHaveAttribute("aria-pressed", "false");
  });

  test("a topic, a tone and a format make three ideas to copy", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "/studio");
    const make = page.getByRole("button", { name: "밈 아이디어 만들기" });
    await expect(make).toBeDisabled();
    await page.getByRole("button", { name: /다정하게/ }).click();
    await expect(page.getByRole("button", { name: /다정하게/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /신나게/ })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "리액션" }).click();
    await page.getByLabel("어떤 내용인가요?").fill("고");
    await expect(make).toBeDisabled();
    await page.getByLabel("어떤 내용인가요?").fill("고양이 의자");
    await expect(make).toBeEnabled();

    const sent = await requestsDuring(page, async () => {
      await page.getByLabel("어떤 내용인가요?").press("Enter");
      await expect(ideas(page).getByRole("article")).toHaveCount(3);
    });
    const studio = sent.filter((request) => request.path === "/api/meme-studio");
    expect(studio.map((request) => [request.method, request.body])).toEqual([["POST", { topic: "고양이 의자", tone: "wholesome", format: "reaction" }]]);
    await expect(ideas(page).getByRole("heading")).toHaveText("“고양이 의자” 게시물 아이디어 3개");
    await expect(ideas(page).getByText("기본 템플릿")).toBeVisible();
    // The heading follows the box.
    await page.getByLabel("어떤 내용인가요?").fill("고양이 의자 2");
    await expect(ideas(page).getByRole("heading")).toHaveText("“고양이 의자 2” 게시물 아이디어 3개");

    const first = ideas(page).getByRole("article").first();
    const caption = (await first.locator("blockquote").textContent()).replace(/^“|”$/g, "");
    await first.getByRole("button", { name: "문구 복사" }).click();
    await expect(first.getByRole("button", { name: "문구를 복사했어요" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(caption);
    await expect(first.getByRole("button", { name: "문구 복사" })).toBeVisible({ timeout: 4000 });
  });

  test("says why ideas could not be made", async ({ page }) => {
    await open(page, "/studio");
    await page.route("**/api/meme-studio", (route) => route.fulfill({ status: 429, contentType: "application/json", body: '{"error":"rate_limited"}' }));
    await page.getByLabel("어떤 내용인가요?").fill("고양이 의자");
    await page.getByRole("button", { name: "밈 아이디어 만들기" }).click();
    await expect(ideas(page).getByRole("alert")).toHaveText("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    await expect(ideas(page).getByText("아직 만든 아이디어가 없습니다")).toHaveCount(0);
    await page.unroute("**/api/meme-studio");
    await page.route("**/api/meme-studio", (route) => route.abort());
    await page.getByRole("button", { name: "밈 아이디어 만들기" }).click();
    await expect(ideas(page).getByRole("alert")).toHaveText("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
  });

  test("the reference search follows the topic", async ({ page }) => {
    await open(page, "/studio");
    const section = page.getByRole("region", { name: "제작 참고 밈" });
    const find = section.getByRole("button", { name: "제작 참고 밈 찾기" });
    await expect(find).toBeDisabled();
    await page.getByLabel("어떤 내용인가요?").fill("중꺾마");
    await expect(find).toBeEnabled();
    await find.click();
    await expect(section.getByRole("status")).toContainText("의미 검색이 준비되지 않아 이름·별칭 검색 결과를 보여드려요.");
    await expect(section.getByRole("link").first()).toHaveAttribute("href", /^\/memes\//);
    // A new topic is a new search.
    await page.getByLabel("어떤 내용인가요?").fill("중꺾마 밈");
    await expect(section.getByRole("status")).toHaveText("");
    await expect(section.getByRole("link")).toHaveCount(0);
  });

  test("an image meme is drawn and saved once the rights are confirmed", async ({ page }) => {
    await open(page, "/studio");
    await page.getByRole("button", { name: /내 콘텐츠 출력/ }).click();
    const studio = artifacts(page);
    const render = studio.getByRole("button", { name: "미리보기 렌더" });
    const save = studio.getByRole("button", { name: "PNG 내려받기" });
    const canvas = studio.getByLabel("밈 이미지 결과");
    await expect(studio.getByRole("status")).toHaveText("렌더와 다운로드 전에 권리 확인이 필요합니다.");

    await studio.getByLabel("내 이미지 업로드").setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(studio.getByRole("alert")).toHaveText("JPG·PNG·WebP·GIF 이미지만 올릴 수 있어요");
    await studio.getByLabel("내 이미지 업로드").setInputFiles({ name: "mine.png", mimeType: "image/png", buffer: PNG });
    await expect(studio.getByRole("alert")).toHaveCount(0);
    await studio.getByLabel("상단 문구").fill("의자는 이제");
    await studio.getByLabel("하단 문구").fill("고양이 것");
    await studio.getByLabel("이미지 출처 표기").fill("직접 제작");
    await expect(render).toBeDisabled();
    await studio.getByRole("checkbox").check();
    await expect(studio.getByRole("status")).toHaveCount(0);
    await expect(render).toBeEnabled();
    await expect(save).toBeDisabled();
    await studio.getByLabel("출력 크기").selectOption("landscape");
    await render.click();
    await expect(canvas).toBeVisible();
    await expect(studio.getByText("권리를 확인하고 이미지를 선택한 뒤 미리보기를 렌더하세요.")).toHaveCount(0);
    expect(await canvas.evaluate((node) => [node.width, node.height])).toEqual([1200, 630]);
    const download = page.waitForEvent("download");
    await save.click();
    expect((await download).suggestedFilename()).toBe("memecatch-meme.png");

    // An edit asks for a new render.
    await studio.getByLabel("하단 문구").fill("고양이 것이다");
    await expect(canvas).toBeHidden();
    await expect(save).toBeDisabled();
    await studio.getByRole("checkbox").uncheck();
    await expect(studio.getByRole("status")).toBeVisible();
    await expect(render).toBeDisabled();
  });

  test("a dictionary card checks its address, and a change of kind starts afresh", async ({ page }) => {
    await open(page, "/studio");
    await page.getByRole("button", { name: /내 콘텐츠 출력/ }).click();
    const studio = artifacts(page);
    await studio.getByLabel("이미지 출처 표기").fill("직접 제작");
    await studio.getByRole("checkbox").check();
    await studio.getByRole("button", { name: "사전 카드", exact: true }).click();
    await expect(studio.getByRole("button", { name: "사전 카드", exact: true })).toHaveAttribute("aria-pressed", "true");
    const render = studio.getByRole("button", { name: "사전 카드 렌더" });
    await studio.getByLabel("밈 이름").fill("중꺾마");
    await studio.getByLabel("한 줄 정의").fill("중요한 건 꺾이지 않는 마음");
    await studio.getByLabel("상세 URL").fill("http://catchmeme.com/memes/a");
    await expect(studio.getByLabel("상세 URL")).toHaveAttribute("aria-invalid", "true");
    await expect(studio.getByRole("alert")).toHaveText("https로 시작하는 올바른 주소를 입력해 주세요.");
    await studio.getByLabel("사전 카드 출처 표기").fill("직접 제작");
    await expect(render).toBeDisabled();
    await studio.getByLabel("상세 URL").fill("https://catchmeme.com/memes/a");
    await expect(studio.getByLabel("상세 URL")).toHaveAttribute("aria-invalid", "false");
    await expect(studio.getByRole("alert")).toHaveCount(0);
    await render.click();
    const canvas = studio.getByLabel("밈 사전 카드 결과");
    await expect(canvas).toBeVisible();
    expect(await canvas.evaluate((node) => [node.width, node.height])).toEqual([1080, 1080]);
    const download = page.waitForEvent("download");
    await studio.getByRole("button", { name: "PNG 내려받기" }).click();
    expect((await download).suggestedFilename()).toBe("memecatch-dictionary-card.png");

    await studio.getByRole("button", { name: "이미지 밈" }).click();
    await expect(studio.getByLabel("이미지 출처 표기")).toHaveValue("");
    await studio.getByRole("button", { name: "사전 카드", exact: true }).click();
    await expect(studio.getByLabel("밈 이름")).toHaveValue("");
    await expect(studio.getByRole("checkbox")).toBeChecked();
  });
});
