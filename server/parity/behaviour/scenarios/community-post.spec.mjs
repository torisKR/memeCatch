// /community/{id} (batch B6): reading a post, the like button
// (`toggle_post_like` through the planner on both servers) and the comment
// form (Next's createCommunityComment server action; the native page posts
// to /api/community/post-comment). The rows written must be the same. Needs
// ../pages/b6-community.sql. Each writing scenario makes a post of its own:
// projects run side by side.
import { databaseSql, expect, localStorageItem, open, requestsDuring, sqlText, test } from "../lib.mjs";

const SEEDED = "b6000000-0000-4000-8000-000000000001";
const HIDDEN = "b6000000-0000-4000-8000-000000000003";
const author = "(select id from public.profiles where nickname is not null order by created_at limit 1)";
const freshPost = (title) => databaseSql(`insert into public.community_posts (user_id, title, body, like_count)
  values (${author}, ${sqlText(title)}, '본문', 7) returning id`);
const likes = (userId, postId) => databaseSql(`select count(*) || '|' || (select like_count from public.community_posts where id = ${sqlText(postId)})
  from public.community_post_likes where user_id = ${sqlText(userId)} and post_id = ${sqlText(postId)}`);
const comments = (userId, postId) => databaseSql(`select coalesce(string_agg(body, ',' order by created_at), '') || '|' || (select comment_count from public.community_posts where id = ${sqlText(postId)})
  from public.community_comments where user_id = ${sqlText(userId)} and post_id = ${sqlText(postId)}`);
const sends = (requests) => requests.filter((request) => request.method === "POST" && ["<server action>", "/api/community/post-comment"].includes(request.path));
const likeButton = (page) => page.getByRole("button", { name: /^좋아요/ });
const commentsSection = (page) => page.locator('section[aria-label="댓글"]');

test("a post as read: Markdown, its meme, the likes and the comments in order", async ({ page }) => {
  await open(page, `/community/${SEEDED}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("B6 첫 글: 밈 추천");
  const article = page.locator("article").first();
  await expect(article.locator("strong")).toHaveText("굵게");
  await expect(article.getByRole("img", { name: "사진" })).toHaveAttribute("src", "/api/media/meme-uploads/x/a.png");
  const link = article.getByRole("link", { name: "링크" });
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await expect(article.locator("pre code")).toHaveText("const a = 1;\n");
  await expect(article.locator('a[href^="/memes/"]')).toBeVisible();
  await expect(likeButton(page)).toHaveText("좋아요 1,234");
  await expect(likeButton(page)).toHaveAttribute("aria-pressed", "false");
  const section = commentsSection(page);
  await expect(section.getByRole("heading")).toHaveText("댓글 2");
  await expect(section.locator("article p")).toHaveText(["댓글 1", "댓글 2"]);
});

test("a missing, hidden or malformed post shows the not-found document", async ({ page }) => {
  for (const key of [HIDDEN, "b6000000-0000-4000-8000-000000000099", "nope"]) {
    await open(page, `/community/${key}`);
    await expect(page.getByText("이 밈은... 아직 없네요")).toBeVisible();
    await expect(page).toHaveTitle("글을 찾을 수 없어요 | 밈캐치");
  }
});

test("signed out: a like opens the sign-in dialog and counts nothing", async ({ page }) => {
  await open(page, `/community/${SEEDED}`);
  await likeButton(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "로그인하면 좋아요를 남길 수 있어요." })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "이메일로 시작하기" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/community/${SEEDED}`)}`);
  await page.keyboard.press("Escape");
  await expect(likeButton(page)).toHaveText("좋아요 1,234");
  await expect(likeButton(page)).toHaveAttribute("aria-pressed", "false");
});

test("signed out: a comment is refused and kept as a draft", async ({ page, server }) => {
  const postId = freshPost("로그아웃 댓글");
  await open(page, `/community/${postId}`);
  const section = commentsSection(page);
  await expect(section.getByText("아직 댓글이 없어요. 첫 댓글을 남겨보세요!")).toBeVisible();
  const send = section.getByRole("button", { name: "댓글 남기기" });
  await expect(send).toBeDisabled();
  await section.getByLabel("댓글 내용").fill("로그인 없이");
  await expect(section.getByText("6/1,000자 · 10분에 최대 10개까지 쓸 수 있어요")).toBeVisible();
  const sent = await requestsDuring(page, async () => {
    await send.click();
    // B6-20: Next runs create_community_comment as `anon`, which may not
    // execute it; the native endpoint answers what the function would.
    await expect(section.getByRole("alert")).toHaveText(server === "next"
      ? "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요."
      : "로그인이 필요해요. 쓰던 내용은 저장해 둘게요. 로그인하고 이어서 쓰기");
  });
  expect(sends(sent)).toHaveLength(1);
  expect(await localStorageItem(page, `memecatch:community-comment-draft:${postId}`)).toBe("로그인 없이");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(commentsSection(page).getByLabel("댓글 내용")).toHaveValue("로그인 없이");
});

for (const role of ["user", "operator"]) {
  test(`as ${role}: a like is read back, stored and taken back`, async ({ page, signIn }) => {
    const session = await signIn(role);
    const postId = freshPost(`좋아요 ${session.nickname}`);
    await open(page, `/community/${postId}`);
    const button = likeButton(page);
    await expect(button).toHaveText("좋아요 7");
    const added = await requestsDuring(page, async () => {
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
    });
    expect(added.filter((request) => request.path === "/api/db/query").map((request) => request.body.plan.args))
      .toEqual([{ p_post_id: postId }]);
    await expect(button).toHaveText("좋아요 8");
    expect(likes(session.userId, postId)).toBe("1|8");
    // The reader's like is read when the page opens.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toHaveText("좋아요 8");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button).toHaveText("좋아요 7");
    await expect.poll(() => likes(session.userId, postId)).toBe("0|7");
  });

  test(`as ${role}: a comment is posted, listed and counted`, async ({ page, signIn }) => {
    const session = await signIn(role);
    const postId = freshPost(`댓글 ${session.nickname}`);
    await open(page, `/community/${postId}`);
    const section = commentsSection(page);
    await section.getByLabel("댓글 내용").fill("  첫 댓글이에요 ");
    const sent = await requestsDuring(page, async () => {
      await section.getByRole("button", { name: "댓글 남기기" }).click();
      await expect(section.getByRole("status")).toHaveText("댓글을 남겼어요!");
    });
    const posts = sends(sent);
    expect(posts).toHaveLength(1);
    if (posts[0].path !== "<server action>") expect(posts[0].body).toEqual({ postId, body: "  첫 댓글이에요 " });
    await expect(section.getByLabel("댓글 내용")).toHaveValue("");
    await expect(section.getByRole("heading")).toHaveText("댓글 1");
    await expect(section.locator("article header")).toHaveText([`${session.nickname}방금 전`]);
    await expect(section.locator("article p")).toHaveText(["첫 댓글이에요"]);
    await expect(section.getByText("아직 댓글이 없어요. 첫 댓글을 남겨보세요!")).toHaveCount(0);
    expect(await localStorageItem(page, `memecatch:community-comment-draft:${postId}`)).toBeNull();
    expect(comments(session.userId, postId)).toBe("첫 댓글이에요|1");
  });
}

test("the comment limit: the eleventh in ten minutes is refused with the action's message", async ({ page, signIn }) => {
  const session = await signIn("user");
  const postId = freshPost("제한");
  databaseSql(`insert into public.community_comments (post_id, user_id, body)
    select ${sqlText(postId)}, ${sqlText(session.userId)}, '앞선 댓글' from generate_series(1, 10)`);
  await open(page, `/community/${postId}`);
  const section = commentsSection(page);
  await section.getByLabel("댓글 내용").fill("열한 번째");
  await section.getByRole("button", { name: "댓글 남기기" }).click();
  await expect(section.getByRole("alert")).toHaveText("잠깐만요 — 짧은 시간에 너무 많이 작성했어요. 잠시 후 다시 시도해 주세요.");
  await expect(section.getByLabel("댓글 내용")).toHaveValue("열한 번째");
  expect(comments(session.userId, postId)).not.toContain("열한 번째");
});

test("the endpoint: signed out, another origin, a hidden post, bad input", async ({ page, server, signIn }) => {
  test.skip(server !== "axum", "Next has a server action here, not an endpoint");
  await open(page, `/community/${SEEDED}`);
  const origin = new URL(page.url()).origin;
  const post = (data, headers = { origin }) => page.request.post("/api/community/post-comment", { data, headers });
  expect(await (await post({ postId: SEEDED, body: "몰래" })).json())
    .toEqual({ ok: false, error: "login_required", message: "로그인이 필요해요. 쓰던 내용은 저장해 둘게요." });
  expect((await post({ postId: SEEDED, body: "몰래" }, { origin: "https://evil.example" })).status()).toBe(403);
  expect(await (await post({ postId: SEEDED, body: " " })).json())
    .toEqual({ ok: false, error: "invalid_input", message: "내용을 입력해 주세요." });
  await signIn("user");
  expect(await (await post({ postId: HIDDEN, body: "숨긴 글에" })).json())
    .toEqual({ ok: false, error: "not_found", message: "글을 찾을 수 없어요. 삭제됐을 수 있어요." });
});
