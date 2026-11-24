// /community/new (batch B6): the writing form. Next's createCommunityPost is
// a server action and its preview renders in the browser; the native page
// posts to /api/community/post and asks /api/community/preview for the
// preview. The rows written must be the same. Uploads are answered by a
// stub on both servers (the form's handling is under test here; Next
// refuses this harness's origin for real uploads).
import { databaseSql, expect, localStorageItem, open, requestsDuring, sqlText, test } from "../lib.mjs";

const DRAFT_KEY = "memecatch:community-post-draft";
const posts = (userId) => databaseSql(`select coalesce(string_agg(p.title || ':' || p.body || ':' || coalesce(m.short_id, '-'), ',' order by p.created_at), '')
  from public.community_posts p left join public.memes m on m.id = p.meme_id where p.user_id = ${sqlText(userId)}`);
const sends = (requests) => requests.filter((request) => request.method === "POST" && ["/api/community/post"].includes(request.path));
const editor = (page) => page.locator("form").filter({ has: page.getByLabel("제목") });

test("signed out: the page sends the visitor to sign in", async ({ page }) => {
  await page.goto("/community/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fcommunity%2Fnew$|\/login\?next=\/community\/new$/);
});

for (const role of ["user", "operator"]) {
  test(`as ${role}: a post is written, previewed, given a meme and published`, async ({ page, signIn }) => {
    const session = await signIn(role);
    await open(page, "/community/new");
    const form = editor(page);
    const submit = form.getByRole("button", { name: "글 올리기" });
    await expect(submit).toBeDisabled();
    const title = `  밈 이야기 ${session.nickname} `;
    await form.getByLabel("제목").fill(title);
    await expect(form.getByText(`${title.length}/100자 · 2자 이상`)).toBeVisible();
    await expect(submit).toBeDisabled();
    const body = form.getByLabel("내용");
    await body.fill("앞 굵게 뒤\n[누르기](javascript:alert(1))");
    await expect(form.getByText("마크다운 지원 · 이미지/영상을 끌어다 놓거나 붙여넣으면 업로드돼요 · 33/5,000자")).toBeVisible();
    // The bold button wraps the selection.
    await body.evaluate((element) => element.setSelectionRange(2, 4));
    await form.getByRole("button", { name: "굵게" }).click();
    await expect(body).toHaveValue("앞 **굵게** 뒤\n[누르기](javascript:alert(1))");
    expect(JSON.parse(await localStorageItem(page, DRAFT_KEY))).toEqual({ title, body: "앞 **굵게** 뒤\n[누르기](javascript:alert(1))" });

    // The preview: MarkdownBody of the draft, the hostile link only text.
    await form.getByRole("button", { name: "미리보기" }).click();
    await expect(form.getByRole("button", { name: "미리보기" })).toHaveAttribute("aria-pressed", "true");
    await expect(body).toBeHidden();
    await expect(form.locator("strong")).toHaveText("굵게");
    await expect(form.locator("span").filter({ hasText: /^누르기$/ })).toBeVisible();
    await expect(form.locator('a[href^="javascript"]')).toHaveCount(0);
    await expect(form.getByRole("button", { name: "굵게" })).toBeDisabled();
    await form.getByRole("button", { name: "쓰기" }).click();
    await expect(body).toBeVisible();

    // A meme from the search, its chip, then cleared and picked again.
    const search = form.getByLabel("첨부할 밈 검색");
    await search.fill("패리티 리치");
    const pick = form.getByRole("button", { name: /패리티 리치/ });
    await expect(pick).toBeVisible();
    await pick.click();
    await expect(search).toHaveCount(0);
    // At phone width the fixed bottom bar covers it: pressed from the keyboard.
    await form.getByRole("button", { name: "밈 첨부 해제" }).focus();
    await page.keyboard.press("Enter");
    await form.getByLabel("첨부할 밈 검색").fill("패리티 리치");
    await form.getByRole("button", { name: /패리티 리치/ }).click();

    const sent = await requestsDuring(page, async () => {
      await submit.click();
      await page.waitForURL(/\/community\/[0-9a-f-]{36}$/);
    });
    const send = sends(sent);
    expect(send).toHaveLength(1);
    expect(send[0].body).toEqual({ title, body: "앞 **굵게** 뒤\n[누르기](javascript:alert(1))", memeId: "00000000-0000-4000-8000-000000000001" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title.trim());
    expect(await localStorageItem(page, DRAFT_KEY)).toBeNull();
    expect(posts(session.userId)).toBe(`${title.trim()}:앞 **굵게** 뒤\n[누르기](javascript:alert(1)):pgrich01`);
  });
}

test("the draft is kept on this device and an empty preview says so", async ({ page, signIn }) => {
  await signIn("user");
  await open(page, "/community/new");
  const form = editor(page);
  await form.getByLabel("제목").fill("초안 제목");
  await form.getByRole("button", { name: "미리보기" }).click();
  await expect(form.getByText("미리 볼 내용이 없어요.")).toBeVisible();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(editor(page).getByLabel("제목")).toHaveValue("초안 제목");
});

test("an upload puts its Markdown at the caret", async ({ page, signIn }) => {
  await signIn("user");
  await page.route("**/api/upload", (route) => route.fulfill({ json: { ok: true, path: "meme-uploads/u/x.png" } }));
  await open(page, "/community/new");
  const form = editor(page);
  await form.getByLabel("내용").fill("앞");
  await form.locator('input[type="file"]').setInputFiles({ name: "내 [사진].png", mimeType: "image/png", buffer: Buffer.from("x") });
  await expect(form.getByLabel("내용")).toHaveValue("앞\n![내 사진.png](/api/media/meme-uploads/u/x.png)\n");
  // A refused file: the form's own message.
  await form.locator('input[type="file"]').setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(form.getByRole("alert")).toHaveText("이미지(JPG·PNG·WebP·GIF) 또는 동영상(MP4·WebM)만 올릴 수 있어요");
});

test("the post limit: the sixth in an hour is refused with the action's message", async ({ page, signIn }) => {
  const session = await signIn("user");
  databaseSql(`insert into public.community_posts (user_id, title, body)
    select ${sqlText(session.userId)}, '앞선 글 ' || n, '본문' from generate_series(1, 5) n`);
  await open(page, "/community/new");
  const form = editor(page);
  await form.getByLabel("제목").fill("여섯 번째");
  await form.getByLabel("내용").fill("본문");
  await form.getByRole("button", { name: "글 올리기" }).click();
  await expect(form.getByRole("alert")).toHaveText("잠깐만요 — 짧은 시간에 너무 많이 작성했어요. 잠시 후 다시 시도해 주세요.");
  await expect(page).toHaveURL(/\/community\/new$/);
  expect(posts(session.userId)).not.toContain("여섯 번째");
});

test("the endpoints: signed out, another origin, bad input, the preview's bounds", async ({ page }) => {
  await open(page, "/community");
  const origin = new URL(page.url()).origin;
  const post = (path, data, headers = { origin }) => page.request.post(path, { data, headers });
  expect(await (await post("/api/community/post", { title: "제목", body: "본문" })).json())
    .toEqual({ ok: false, error: "login_required", message: "로그인이 필요해요. 쓰던 내용은 저장해 둘게요." });
  expect(await (await post("/api/community/post", { title: "가", body: "본문" })).json())
    .toEqual({ ok: false, error: "invalid_input", message: "제목은 2자 이상 써 주세요." });
  expect((await post("/api/community/post", { title: "제목", body: "본문" }, { origin: "https://evil.example" })).status()).toBe(403);
  const preview = await post("/api/community/preview", { body: "**a** <script>x</script>" });
  expect(await preview.json()).toEqual({
    html: '<div class="break-words text-base leading-relaxed "><p class="my-3 leading-relaxed first:mt-0 last:mb-0"><strong>a</strong> &lt;script&gt;x&lt;/script&gt;</p></div>',
  });
  expect((await post("/api/community/preview", { body: "a" }, { origin: "https://evil.example" })).status()).toBe(403);
  expect((await post("/api/community/preview", { body: "가".repeat(5001) })).status()).toBe(413);
  expect((await post("/api/community/preview", { draft: "a" })).status()).toBe(400);
});
