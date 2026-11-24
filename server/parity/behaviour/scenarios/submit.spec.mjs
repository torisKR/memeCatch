// /submit (batch B6): the report form. Next's form calls the
// submitMemeWithAttachment server action; the native page posts to
// /api/submit. The rows written must be the same. Needs
// ../pages/b6-submit.sql (a test-only stand-in for a function no migration
// defines, PLAN.md B6-28). Uploads and the oEmbed preview are answered by
// stubs on both servers: no request leaves the machine.
import { databaseSql, expect, localStorageItem, open, requestsDuring, sqlText, test } from "../lib.mjs";

const DRAFT_KEY = "memecatch:submit-draft:v1";
const rows = (userId) => databaseSql(`select coalesce(string_agg(name || '|' || coalesce(seen_at, '-') || '|' || coalesce(source_url, '-') || '|' || description || '|' || coalesce(guess_reason, '-') || '|' || array_to_string(tags, ';') || '|' || coalesce(attachment_path, '-'), ',' order by created_at), '')
  from public.meme_submissions where submitter_id = ${sqlText(userId)}`);
const sends = (requests) => requests.filter((request) => request.method === "POST" && ["<server action>", "/api/submit"].includes(request.path));
const field = (page, label) => page.getByLabel(label, { exact: true });

test("signed out: the page sends the visitor to sign in, keeping the name", async ({ page }) => {
  await page.goto("/submit?name=%EC%9A%B0%EB%8B%B9%ED%83%95&x=1");
  await expect(page).toHaveURL(/\/login\?next=%2Fsubmit%3Fname%3D%25EC%259A%25B0%25EB%258B%25B9%25ED%2583%2595$/);
});

for (const role of ["user", "operator"]) {
  test(`as ${role}: a report is checked, sent and stored`, async ({ page, signIn }) => {
    const session = await signIn(role);
    await open(page, "/submit");
    const name = `제보 ${session.nickname}`;
    const send = page.getByRole("button", { name: "제보 보내기" });

    // The action's checks, as its messages.
    await field(page, "원본 콘텐츠 링크").fill("http://example.com/x");
    await send.click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(["밈 이름을 입력해 주세요", "https:// 로 시작하는 링크만 넣을 수 있어요"]);
    await expect(page.getByLabel(/밈 이름/)).toHaveAttribute("aria-invalid", "true");
    expect(rows(session.userId)).toBe("");

    await page.getByLabel(/밈 이름/).fill(` ${name} `);
    await field(page, "어디서 봤나요?").fill("단톡방");
    await field(page, "원본 콘텐츠 링크").fill("https://example.com/x");
    await expect(page.getByText("일반 출처 링크로 제출할 수 있어요. 영상 미리보기는 YouTube·Instagram·TikTok을 지원해요.")).toBeVisible();
    await field(page, "설명").fill("이런 뜻이에요");
    await field(page, "태그").fill("직장인, 유행어 ,직장인,");
    // The draft is saved 500 ms after the last keystroke; a send inside that
    // window has it saved again after the success clears it (both servers).
    await expect.poll(() => localStorageItem(page, DRAFT_KEY)).toContain("유행어");
    const sent = await requestsDuring(page, async () => {
      await send.click();
      await expect(page.getByRole("heading", { name: "접수됨" })).toBeVisible();
    });
    const posts = sends(sent);
    expect(posts).toHaveLength(1);
    if (posts[0].path !== "<server action>") {
      expect(posts[0].body).toEqual({ name: ` ${name} `, seenAt: "단톡방", sourceUrl: "https://example.com/x", description: "이런 뜻이에요", guessReason: "", tags: "직장인, 유행어 ,직장인,", attachmentPath: "" });
    }
    await expect(page.getByRole("link", { name: "MY에서 제보 상태 보기" })).toHaveAttribute("href", "/my");
    expect(await localStorageItem(page, DRAFT_KEY)).toBeNull();
    expect(rows(session.userId)).toBe(`${name}|단톡방|https://example.com/x|이런 뜻이에요|-|직장인;유행어|-`);
  });
}

test("the name is checked against the catalogue as it is typed", async ({ page, signIn }) => {
  await signIn("user");
  await open(page, "/submit");
  await page.getByLabel(/밈 이름/).fill("패리티 리치");
  const box = page.getByRole("status").filter({ hasText: "이미 등록된 밈 아닌가요?" });
  await expect(box.getByRole("link", { name: "패리티 리치" })).toHaveAttribute("href", "/memes/pgrich01-parity-rich");
});

test("the draft is kept on this device and a name in the address wins", async ({ page, signIn }) => {
  await signIn("user");
  await open(page, "/submit");
  await page.getByLabel(/밈 이름/).fill("초안 이름");
  await field(page, "설명").fill("초안 설명");
  await expect.poll(() => localStorageItem(page, DRAFT_KEY)).toContain("초안 설명");
  await open(page, "/submit?name=%EC%A3%BC%EC%86%8C");
  await expect(page.getByText("작성하던 내용을 불러왔어요.")).toBeVisible();
  await expect(page.getByLabel(/밈 이름/)).toHaveValue("주소");
  await expect(field(page, "설명")).toHaveValue("초안 설명");
});

test("an image is uploaded when the form is sent, and a refused file says why", async ({ page, signIn }) => {
  const session = await signIn("user");
  // The shape /api/upload gives: an attachment of any other shape is refused (D2-8).
  const path = `meme-uploads/${session.userId}/0f8fad5b-d9cb-469f-a165-70867728950e.png`;
  await page.route("**/api/upload", (route) => route.fulfill({ json: { ok: true, path } }));
  await open(page, "/submit");
  const upload = page.locator('input[type="file"]');
  await upload.setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.locator("form").getByRole("alert")).toContainText("JPG·PNG·WebP·GIF 이미지만 올릴 수 있어요");
  await upload.setInputFiles({ name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") });
  await expect(page.getByRole("img", { name: "첨부한 이미지 미리보기" })).toBeVisible();
  await page.getByLabel(/밈 이름/).fill(`첨부 ${session.nickname}`);
  await page.getByRole("button", { name: "제보 보내기" }).click();
  await expect(page.getByRole("heading", { name: "접수됨" })).toBeVisible();
  expect(rows(session.userId)).toBe(`첨부 ${session.nickname}|-|-||-||${path}`);
});

test("a provider link is previewed after the check", async ({ page, signIn }) => {
  await signIn("user");
  await page.route("**/api/oembed?**", (route) => route.fulfill({
    json: { provider: "youtube", sourceUrl: "https://www.youtube.com/watch?v=abc", embedUrl: "https://www.youtube-nocookie.com/embed/abc", embedHtml: null, contentId: "abc", title: "제목", authorName: "채널" },
  }));
  await open(page, "/submit");
  await field(page, "원본 콘텐츠 링크").fill("https://www.youtube.com/watch?v=abc");
  const preview = page.getByRole("region", { name: "콘텐츠 링크 미리보기" });
  await preview.getByRole("button", { name: "링크 확인하고 미리보기" }).click();
  await expect(preview.getByText("공개 콘텐츠를 확인했어요")).toBeVisible();
  await expect(preview.getByText("제목 · 채널")).toBeVisible();
  await expect(preview.locator("iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/abc");
});

test("the endpoint: signed out, another origin, another user's image", async ({ page, server, signIn }) => {
  test.skip(server !== "axum", "Next has a server action here, not an endpoint");
  await open(page, "/about");
  const origin = new URL(page.url()).origin;
  const post = (data, headers = { origin }) => page.request.post("/api/submit", { data, headers });
  expect(await (await post({ name: "이름" })).json()).toEqual({ status: "error", fieldErrors: {}, formError: "로그인이 필요해요. 로그인 후 다시 시도해 주세요" });
  expect((await post({ name: "이름" }, { origin: "https://evil.example" })).status()).toBe(403);
  await signIn("user");
  expect(await (await post({ name: "이름", attachmentPath: "meme-uploads/someone-else/x.png" })).json())
    .toEqual({ status: "error", fieldErrors: { attachment: "첨부 이미지 정보가 올바르지 않아요. 이미지를 다시 올려 주세요" } });
});
