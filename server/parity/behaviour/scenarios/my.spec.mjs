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

test("the card collection: shown once the owner is confirmed, filtered through the collection API", async ({ page, signIn }) => {
  const session = await signIn("user");
  databaseSql(`insert into public.user_meme_cards (user_id, card_id, created_at) values
    (${sqlText(session.userId)}, 'mc-0001', now() - interval '2 days'), (${sqlText(session.userId)}, 'mc-0002', now() - interval '1 day')`);
  const titles = databaseSql(`select string_agg(m.title, '|' order by c.card_no desc) from public.meme_collectible_cards c join public.memes m on m.id = c.meme_id where c.id in ('mc-0001', 'mc-0002')`).split("|");
  await open(page, "/my");
  const collection = page.locator("#meme-cards");
  await expect(collection.getByText("2 / 1,000")).toBeVisible();
  await expect(collection.getByText("2종 보유")).toBeVisible();
  const cards = collection.getByRole("link", { name: /· 소장 중$/ });
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toHaveAttribute("aria-label", `${titles[0]} · 소장 중`);
  await expect(cards.first()).toHaveAttribute("href", "/meme-cards?card=mc-0002&revealed=1#reveal");
  await expect(collection.getByRole("button", { name: "찾기" })).toBeEnabled();

  const filtered = await requestsDuring(page, async () => {
    await collection.getByLabel("카드 이름 검색").fill("zzzz-nothing");
    await collection.getByRole("button", { name: "찾기" }).click();
    await expect(collection.getByRole("heading", { name: "조건에 맞는 카드가 없어요" })).toBeVisible();
  });
  expect(filtered.some((request) => request.path === "/api/meme-cards/collection")).toBe(true);
  // The full count stays: it is the collection's, not the filter's.
  await expect(collection.getByText("2종 보유")).toBeVisible();
});

test("recently viewed memes: the cards of this browser's list, and clearing it", async ({ page, signIn }) => {
  await signIn("user");
  const memes = databaseSql(`select string_agg(id::text || '|' || title, E'\\n' order by short_id) from (select id, title, short_id from public.memes
    where moderation_status = 'approved' order by short_id limit 3) m`).split("\n").map((line) => line.split("|"));
  // Nothing viewed: no section at all.
  await open(page, "/my");
  await expect(page.getByRole("heading", { name: "최근 본 밈" })).toHaveCount(0);

  const ids = [memes[2][0], "00000000-0000-4000-8000-000000000000", memes[0][0]];
  await page.evaluate((value) => localStorage.setItem("mc_recent_memes", JSON.stringify(value)), ids);
  await open(page, "/my");
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "최근 본 밈" }) });
  await expect(section.locator("a[data-meme-card]")).toHaveCount(2);
  await expect(section.locator("[data-meme-card-title]")).toHaveText([memes[2][1], memes[0][1]]);
  await section.getByRole("button", { name: "전체 지우기" }).click();
  await expect(page.getByRole("heading", { name: "최근 본 밈" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("mc_recent_memes"))).toBeNull();
});

test("the daily quiz: without today's question the card goes away", async ({ page, signIn }) => {
  await signIn("user");
  await page.route("**/api/daily-quiz?*", (route) => route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"x"}' }));
  await open(page, "/my");
  await expect(page.getByRole("heading", { name: /오늘의 밈 퀴즈/ })).toHaveCount(0);
});

test("the daily quiz: today's question, an answer counted for the account, and the same answer on the next visit", async ({ page, signIn }) => {
  const session = await signIn("user");
  const meme = databaseSql(`select short_id || '|' || slug from public.memes where moderation_status = 'approved' order by short_id limit 1`).split("|");
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  // The test database has no pool for today's question: the same one is
  // given to both servers' pages.
  await page.route("**/api/daily-quiz?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ date, question: { question: "이 밈의 뜻은?", options: ["가", "나", "다", "라"], answerIndex: 1, meme: { shortId: meme[0], slug: meme[1], title: "t" } } }),
  }));
  const completions = () => databaseSql(`select count(*) || '|' || coalesce(bool_and(correct)::text, '') from public.daily_meme_quiz_completions where user_id = ${sqlText(session.userId)}`);
  expect(completions()).toBe("0|");
  await open(page, "/my");
  const quiz = page.locator('section[data-home-section="daily-quiz"]');
  await expect(quiz.getByText(date.slice(5).replace("-", "."))).toBeVisible();
  const options = quiz.getByRole("listitem").getByRole("button");
  await expect(options).toHaveCount(4);
  const answered = await requestsDuring(page, async () => {
    await options.nth(1).click();
    await expect(quiz.getByRole("status")).toContainText("출석 완료! 내일 새 문제가 열려요.");
  });
  await expect(options.first()).toBeDisabled();
  await expect(quiz.getByText("정답! 밈력이 느껴져요.")).toBeVisible();
  await expect(quiz.getByRole("link", { name: "이 밈 보러가기" })).toHaveAttribute("href", `/memes/${meme[0]}-${meme[1]}`);
  await expect(quiz.getByRole("link", { name: "10문제 더 풀기" })).toHaveCount(0);
  expect(answered.some((request) => request.path === "/api/db/query" && JSON.stringify(request.body).includes("complete_daily_meme_quiz"))).toBe(true);
  await expect.poll(completions).toBe("1|true");
  await expect(quiz.getByLabel("연속 출석 1일, 최고 1일")).toBeVisible();

  // The next visit shows today's answer and does not count it again.
  await open(page, "/my");
  await expect(quiz.getByRole("listitem").getByRole("button").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(quiz.getByRole("listitem").getByRole("button").first()).toBeDisabled();
  expect(completions()).toBe("1|true");
});
