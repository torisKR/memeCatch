// The meme page's community parts (batch B6), with the community on: the
// reaction bar (`toggle_reaction` through the planner on both servers) and
// the comments (read through the planner; Next's forms call the
// postComment and reportContent server actions, the native page posts to
// /api/community/comment and /api/community/report). The rows written must
// be the same. Needs seeds/b6-meme-community.sql.
import { MEME, databaseSql, expect, localStorageItem, open, requestsDuring, sqlText, test } from "../lib.mjs";

const reactions = (userId) => databaseSql(`select coalesce(string_agg(reaction::text, ',' order by reaction), '')
  from public.meme_reactions where user_id = ${sqlText(userId)} and meme_id = ${sqlText(MEME.id)}`);
const comments = (userId) => databaseSql(`select coalesce(string_agg(body || ':' || (parent_id is not null) || ':' || status, ',' order by created_at), '')
  from public.discussions where user_id = ${sqlText(userId)}`);
const reports = (userId) => databaseSql(`select coalesce(string_agg(target_type || ':' || target_id || ':' || reason, ','), '')
  from public.reports where reporter_id = ${sqlText(userId)}`);
const SEEDED = "b6000000-0000-4000-a000-000000000001";
const DRAFT = `memecatch:comment-draft:${MEME.id}:root`;
const sends = (requests, path) => requests.filter((request) => request.method === "POST" && [path].includes(request.path));

const reactionButton = (page, label) => page.locator('section[aria-labelledby="reaction-bar-title"] button').filter({ hasText: label });
const countOf = async (button) => Number((await button.locator(".stat-mono").textContent().catch(() => null)) ?? 0);
const commentsSection = (page) => page.locator('section[aria-label="댓글"]');

test("the comments as read: newest first, replies under, hidden and deleted ones not readable", async ({ page }) => {
  await open(page, MEME.path);
  const section = commentsSection(page);
  await expect(section.getByRole("heading", { name: /^댓글 \d+$/ })).toBeVisible();
  const first = section.locator(":scope > ul > li").filter({ hasText: "처음 본 건 단톡방이었어요." });
  await expect(first.locator("article").first().locator("p")).toHaveText("처음 본 건 단톡방이었어요.\n두 줄째");
  await expect(first.locator("ul article")).toContainText("저도요");
  await expect(section.getByText("<b>태그</b>는 글자로")).toBeVisible();
  // Row-level security gives a reader only visible comments, so the masked
  // forms ("가려진 댓글이에요", "삭제된 댓글이에요") never show.
  await expect(section.getByText("가려진 내용")).toHaveCount(0);
  await expect(section.getByText("가려진 댓글이에요")).toHaveCount(0);
  await expect(section.getByText("삭제된 댓글이에요")).toHaveCount(0);
  // Seeded long ago: shown as a date. Older comment, lower in the list.
  await expect(first.locator("time").first()).toHaveText("2026. 9. 1.");
  const order = await section.locator(":scope > ul > li > article > p").allTextContents();
  expect(order.indexOf("<b>태그</b>는 글자로")).toBeLessThan(order.indexOf("처음 본 건 단톡방이었어요.\n두 줄째"));
  // A reply has no reply button.
  await expect(first.locator("ul article").getByRole("button")).toHaveText(["신고"]);
});

test("signed out: a reaction opens the sign-in dialog and counts nothing", async ({ page }) => {
  await open(page, MEME.path);
  const funny = reactionButton(page, "웃김");
  const before = await countOf(funny);
  await funny.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "로그인하면 반응을 남길 수 있어요." })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "이메일로 시작하기" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(MEME.path)}`);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(funny).toHaveAttribute("aria-pressed", "false");
  expect(await countOf(funny)).toBe(before);
});

test("signed out: a comment is refused and kept as a draft", async ({ page }) => {
  await open(page, MEME.path);
  const section = commentsSection(page);
  const send = section.getByRole("button", { name: "댓글 남기기" });
  await expect(send).toBeDisabled();
  await section.getByLabel("댓글 내용").fill("   ");
  await expect(send).toBeDisabled();
  await section.getByLabel("댓글 내용").fill("로그인 없이 쓴 댓글");
  await expect(section.getByText("11/2,000자 · 10분에 최대 10개까지 쓸 수 있어요")).toBeVisible();
  const sent = await requestsDuring(page, async () => {
    await send.click();
    // B6-20: Next runs post_comment as `anon`, which may not execute it, and
    // answers a temporary error; the native endpoint answers what the
    // function would, with the form's sign-in link.
    await expect(section.getByRole("alert")).toHaveText("로그인이 필요해요. 쓰던 내용은 저장해 둘게요. 로그인하고 이어서 쓰기");
  });
  expect(sends(sent, "/api/community/comment")).toHaveLength(1);
  await expect(section.getByRole("link", { name: "로그인하고 이어서 쓰기" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(MEME.path)}`);
  expect(await localStorageItem(page, DRAFT)).toBe("로그인 없이 쓴 댓글");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(commentsSection(page).getByLabel("댓글 내용")).toHaveValue("로그인 없이 쓴 댓글");
});

for (const role of ["user", "operator"]) {
  test(`as ${role}: a reaction counts, is stored, and is taken back`, async ({ page, signIn }) => {
    const session = await signIn(role);
    await open(page, MEME.path);
    const funny = reactionButton(page, "웃김");
    const before = await countOf(funny);
    const added = await requestsDuring(page, async () => {
      await funny.click();
      await expect(funny).toHaveAttribute("aria-pressed", "true");
    });
    expect(added.filter((request) => request.path === "/api/db/query").map((request) => request.body.plan.args))
      .toEqual([{ p_meme_id: MEME.id, p_reaction: "funny" }]);
    // Next keeps the leaving number in place for its exit animation.
    await expect.poll(() => countOf(funny)).toBe(before + 1);
    await expect(funny).toHaveClass(/border-accent bg-accent-soft text-accent/);
    expect(reactions(session.userId)).toBe("funny");
    await funny.click();
    await expect(funny).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => reactions(session.userId)).toBe("");
    await expect.poll(() => countOf(funny)).toBe(before);
  });

  // D2: Next never read the reader's own reactions, so this tap showed +1
  // while `toggle_reaction` removed the row. Axum only.
  test(`as ${role}: a reaction left before shows as theirs, and a tap takes it back`, async ({ page, signIn }) => {
    const session = await signIn(role);
    databaseSql(`insert into public.meme_reactions (user_id, meme_id, reaction)
      values (${sqlText(session.userId)}, ${sqlText(MEME.id)}, 'risky') on conflict do nothing`);
    try {
      await open(page, MEME.path);
      const risky = reactionButton(page, "쓰면 위험하다");
      await expect(risky).toHaveAttribute("aria-pressed", "true");
      const before = await countOf(risky);
      expect(before).toBeGreaterThan(0);
      await risky.click();
      await expect(risky).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => reactions(session.userId)).toBe("");
      // The count drops by one; at zero the number is not shown.
      if (before === 1) await expect(risky.locator(".stat-mono")).toHaveCount(0);
      else await expect.poll(() => countOf(risky)).toBe(before - 1);
    } finally {
      databaseSql(`delete from public.meme_reactions where user_id = ${sqlText(session.userId)} and meme_id = ${sqlText(MEME.id)}`);
    }
  });

  test(`as ${role}: a comment and a reply are posted and listed`, async ({ page, signIn }) => {
    const session = await signIn(role);
    await open(page, MEME.path);
    const section = commentsSection(page);
    const body = `처음 본 곳은 ${session.nickname}`;
    await section.getByLabel("댓글 내용").fill(`  ${body} `);
    expect(await localStorageItem(page, DRAFT)).toBe(`  ${body} `);
    const sent = await requestsDuring(page, async () => {
      await section.getByRole("button", { name: "댓글 남기기" }).click();
      await expect(section.getByRole("status")).toHaveText("댓글을 남겼어요!");
    });
    const posts = sends(sent, "/api/community/comment");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ memeId: MEME.id, parentId: null, body: `  ${body} ` });
    await expect(section.getByLabel("댓글 내용")).toHaveValue("");
    expect(await localStorageItem(page, DRAFT)).toBeNull();
    const mine = section.locator(":scope > ul > li").filter({ hasText: body });
    await expect(mine.locator("article").first().locator("header")).toHaveText(`${session.nickname}방금 전`);
    expect(comments(session.userId)).toBe(`${body}:false:visible`);

    await mine.getByRole("button", { name: "답글" }).click();
    await expect(mine.getByRole("button", { name: "답글 닫기" })).toBeVisible();
    const reply = mine.getByPlaceholder("답글을 남겨 주세요.");
    await expect(reply).toBeFocused();
    await reply.fill("답글이에요");
    await mine.getByRole("button", { name: "답글 남기기" }).click();
    await expect(mine.locator("ul article")).toContainText("답글이에요");
    await expect(mine.getByPlaceholder("답글을 남겨 주세요.")).toHaveCount(0);
    await expect(mine.getByRole("button", { name: "답글", exact: true })).toBeVisible();
    expect(comments(session.userId)).toBe(`${body}:false:visible,답글이에요:true:visible`);
  });

  test(`as ${role}: a comment is reported once, with its reason`, async ({ page, signIn }) => {
    const session = await signIn(role);
    // A comment of its own: reports hide a comment after a few (trg_auto_hide).
    const body = `신고할 댓글 ${session.nickname}`;
    const target = databaseSql(`insert into public.discussions (meme_id, user_id, body)
      select ${sqlText(MEME.id)}, id, ${sqlText(body)} from public.profiles where nickname is not null order by created_at limit 1
      returning id`);
    await open(page, MEME.path);
    const item = commentsSection(page).locator("article").filter({ hasText: body });
    const toggle = item.getByRole("button", { name: "신고", exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const submit = item.getByRole("button", { name: "신고하기" });
    await expect(submit).toBeDisabled();
    await item.getByLabel("신고 사유").fill(" 스팸이에요 ");
    const sent = await requestsDuring(page, async () => {
      await submit.click();
      await expect(item.getByRole("status")).toHaveText("신고가 접수됐어요. 검토 후 처리할게요.");
    });
    const posts = sends(sent, "/api/community/report");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ targetType: "discussion", targetId: target, reason: " 스팸이에요 " });
    await expect(item.getByLabel("신고 사유")).toHaveCount(0);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(reports(session.userId)).toBe(`discussion:${target}:스팸이에요`);
  });
}

test("the comment rate limit: the eleventh in ten minutes is refused with the action's message", async ({ page, signIn }) => {
  const session = await signIn("user");
  // check_rate_limit counts the user's comments of the last ten minutes, on any meme.
  databaseSql(`insert into public.discussions (meme_id, user_id, body)
    select '00000000-0000-4000-8000-000000000002', ${sqlText(session.userId)}, '앞선 댓글' from generate_series(1, 10)`);
  await open(page, MEME.path);
  const section = commentsSection(page);
  await section.getByLabel("댓글 내용").fill("열한 번째");
  await section.getByRole("button", { name: "댓글 남기기" }).click();
  await expect(section.getByRole("alert")).toHaveText("잠깐만요 — 짧은 시간에 너무 많이 작성했어요. 잠시 후 다시 시도해 주세요.");
  await expect(section.getByLabel("댓글 내용")).toHaveValue("열한 번째");
  expect(comments(session.userId)).not.toContain("열한 번째");
});

test("the endpoints: signed out and from another origin", async ({ page }) => {
  await open(page, MEME.path);
  const origin = new URL(page.url()).origin;
  const comment = { memeId: MEME.id, parentId: null, body: "몰래" };
  const report = { targetType: "discussion", targetId: SEEDED, reason: "몰래" };
  const refused = { ok: false, error: "login_required", message: "로그인이 필요해요. 쓰던 내용은 저장해 둘게요." };
  for (const [path, data] of [["/api/community/comment", comment], ["/api/community/report", report]]) {
    const anonymous = await page.request.post(path, { data, headers: { origin } });
    expect(await anonymous.json()).toEqual(refused);
    const foreign = await page.request.post(path, { data, headers: { origin: "https://evil.example" } });
    expect(foreign.status()).toBe(403);
  }
});
