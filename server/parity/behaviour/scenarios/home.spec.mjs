// Batch B4, the home page (app/(default)/page.tsx), on ../pages/seed.sql,
// b2-seed.sql and b4-seed.sql: the story and its scene, the recent deck, the
// safety showcase, the self-check, the daily quiz, the battle and the
// edition hint. The three.js scene itself draws on a canvas; what is
// compared is what the page around it does.
import { expect, focused, localStorageItem, mobileOnly, open, recordGaEvents, requestsDuring, test } from "../lib.mjs";

const scene = (page) => page.locator("figure[data-story-scene]");
const controls = (page) => scene(page).getByText("장면 조작");
const deck = (page) => page.locator("#home-latest");
const quiz = (page) => page.locator("section[data-home-section=daily-quiz]");
const selfCheck = (page) => page.locator("#home-safety-quiz");

// Today's question, answered by the scenario: the seed's quiz pool (the
// directory fixture) builds none, and a failed answer is a body the card
// never reads, which keeps the page from going idle on both servers.
const QUESTION = {
  question: "「패리티 리치」, 무슨 뜻일까요?",
  options: ["첫째 보기", "둘째 보기", "정답 보기", "넷째 보기"],
  answerIndex: 2,
  meme: { shortId: "pgrich01", slug: "parity-rich", title: "패리티 리치", originYear: 2020, safetyLevel: "green" },
};
// Next's service worker takes over the page's fetches, where a route cannot
// answer them; Axum's pages register none here. Neither runs one.
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/daily-quiz\?/, (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ date: new URL(route.request().url()).searchParams.get("d"), question: QUESTION }),
  }));
});

test.describe("the home frame", () => {
  test("heading, menu, chat and the language switch to an edition", async ({ page }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("밈을 발견하고, 맥락까지 읽으세요.");
    const menu = page.getByRole("button", { name: "메뉴", exact: true });
    await menu.click();
    await expect(page.getByRole("navigation", { name: "메뉴", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "메뉴", exact: true })).toHaveCount(0);
    expect(await focused(page)).toBe("button: 메뉴");
    await page.getByRole("button", { name: "밈캐치 챗봇 열기" }).click();
    await expect(page.getByRole("dialog", { name: "밈캐치에게 물어봐" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The home offers only the languages that have a home of their own.
    const languages = page.getByRole("combobox", { name: "언어 선택" });
    await expect(languages.locator("option")).toHaveCount(5);
    await languages.selectOption("ja");
    await expect(page).toHaveURL(/\/ja$/);
  });
});

test.describe("the home story", () => {
  test("the chapter links and the skip link move along the page", async ({ page }) => {
    await open(page, "/");
    const chapters = page.getByRole("navigation", { name: "홈 스토리 챕터" });
    await chapters.getByRole("link", { name: /맥락/ }).click();
    await expect(page).toHaveURL(/#home-story-context$/);
    await chapters.getByRole("link", { name: "최신 밈으로 건너뛰기" }).click();
    await expect(page).toHaveURL(/#home-latest$/);
  });

  test("the story's search goes to the search page", async ({ page }) => {
    await open(page, "/");
    const search = page.getByRole("search", { name: "밈 검색" });
    await search.getByRole("searchbox").fill("중꺾마");
    await search.getByRole("button", { name: "검색" }).click();
    await expect(page).toHaveURL(/\/search\?q=%EC%A4%91%EA%BA%BE%EB%A7%88$/);
  });
});

test.describe("the home scene", () => {
  test("a signal is chosen in the controls, which Escape closes", async ({ page }) => {
    await open(page, "/");
    await controls(page).click();
    const signals = scene(page).getByRole("group", { name: "사용 신호 살펴보기" });
    await signals.getByRole("button", { name: "맥락 주의" }).click();
    await expect(signals.getByRole("button", { name: "맥락 주의" })).toHaveAttribute("aria-pressed", "true");
    await expect(signals.getByRole("button", { name: "써도 됨" })).toHaveAttribute("aria-pressed", "false");
    await expect(scene(page).getByRole("status").filter({ hasText: "·" })).toHaveText(/^맥락 주의 · /);
    await page.keyboard.press("Escape");
    await expect(signals).toBeHidden();
    expect(await focused(page)).toBe("summary: 장면 조작");
  });

  test("once the renderer is ready, the layouts, playback and reset work", async ({ page }) => {
    await open(page, "/");
    await scene(page).scrollIntoViewIfNeeded();
    const playback = scene(page).getByRole("button", { name: "장면 멈추기" });
    await expect(playback).toBeVisible({ timeout: 20_000 });
    const cue = (text) => scene(page).getByText(text);
    await expect(cue("아래로 스크롤하면 펼쳐지고, 위로 올리면 다시 모입니다.")).toBeAttached();
    await playback.click();
    await expect(scene(page).getByRole("button", { name: "장면 재생하기" })).toBeVisible();
    await expect(cue("움직임을 멈췄어요. 재생하면 현재 스크롤에 맞춰 이어집니다.")).toBeAttached();
    await scene(page).getByRole("button", { name: "장면 재생하기" }).click();

    await controls(page).click();
    const layouts = scene(page).getByRole("group", { name: "3D 레이어 보기" });
    await expect(layouts.getByRole("radio", { name: "스크롤" })).toBeChecked();
    // The arrow keys move the choice (the canvas lies over part of the panel).
    await layouts.getByRole("radio", { name: "스크롤" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(layouts.getByRole("radio", { name: "모아보기" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(layouts.getByRole("radio", { name: "펼쳐보기" })).toBeChecked();
    await expect(cue(/^아래로 스크롤하면/)).toBeHidden();
    await expect(scene(page).getByRole("button", { name: "보기 초기화" })).toBeEnabled();
    await scene(page).getByRole("button", { name: "보기 초기화" }).focus();
    await page.keyboard.press("Enter");
    await layouts.getByRole("radio", { name: "펼쳐보기" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(layouts.getByRole("radio", { name: "스크롤" })).toBeChecked();
    await expect(cue("아래로 스크롤하면 펼쳐지고, 위로 올리면 다시 모입니다.")).toBeAttached();
  });

  test("with reduced motion the scroll movement is off and playback cannot start", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/");
    await scene(page).scrollIntoViewIfNeeded();
    await expect(scene(page).getByText("모션 감소 설정으로 스크롤 움직임을 껐어요. 버튼으로 직접 살펴보세요.")).toBeAttached();
    await expect(scene(page).getByRole("button", { name: "장면 재생하기" })).toBeDisabled({ timeout: 20_000 });
  });

  test("a device with little memory keeps the still picture and says so", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => 1 }));
    await open(page, "/");
    await expect(scene(page).getByText("정적 보기 · 3D 조작은 지원되지 않아요")).toBeAttached();
    await controls(page).click();
    await expect(scene(page).getByRole("group", { name: "3D 레이어 보기" })).toHaveCount(0);
    await expect(scene(page).getByRole("button", { name: "장면 멈추기" })).toHaveCount(0);
  });
});

test.describe("the recent deck", () => {
  test("typing filters the entries in place and offers the whole archive", async ({ page }) => {
    await open(page, "/");
    const status = deck(page).getByRole("status");
    const total = Number((await status.textContent()).match(/최근 항목 (\d+)개/)[1]);
    const filter = deck(page).getByRole("searchbox", { name: "최근 항목 필터" });
    await filter.fill("zzzz 없는 말");
    await expect(status).toHaveText(`최근 항목 ${total}개 중 0개를 표시합니다.`);
    await expect(deck(page).getByRole("heading", { name: "조건에 맞는 최근 항목이 없어요" })).toBeVisible();
    const archive = deck(page).getByRole("link", { name: /전체 밈에서 “zzzz 없는 말” 찾기/ });
    await expect(archive).toHaveAttribute("href", "/search?q=zzzz+%EC%97%86%EB%8A%94+%EB%A7%90");
    await deck(page).getByRole("button", { name: "필터 초기화" }).click();
    await expect(filter).toHaveValue("");
    await expect(status).toHaveText(`최근 항목 ${total}개 중 ${total}개를 표시합니다.`);
    await expect(deck(page).getByRole("link", { name: /전체 밈에서/ })).toHaveCount(0);

    const first = await deck(page).locator("ol li a[data-meme-card]").first().getAttribute("href");
    const title = await deck(page).locator("ol li").first().locator("[data-meme-card-title]").textContent();
    await filter.fill(title.slice(0, 4));
    await expect(status).not.toHaveText(/ 0개를/);
    await expect(deck(page).locator("ol li:visible a[data-meme-card]").first()).toHaveAttribute("href", first);
    await filter.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=/);
  });

  test("a category chip filters, and the preview steps through what is shown", async ({ page }) => {
    await open(page, "/");
    const chips = deck(page).getByRole("group", { name: "카테고리로 필터" });
    const preview = deck(page).getByRole("complementary", { name: "다음 선택 미리보기" });
    const firstTitle = await preview.locator("strong").textContent();
    await preview.getByRole("button", { name: "다음 선택 보기" }).click();
    await expect(preview.getByText("02", { exact: true })).toBeVisible();
    await expect(preview.locator("strong")).not.toHaveText(firstTitle);
    const read = preview.getByRole("link", { name: /^이 설명 열기: / });
    await expect(read).toHaveAttribute("aria-label", `이 설명 열기: ${await preview.locator("strong").textContent()}`);

    const chip = chips.getByRole("button").nth(1);
    const category = await chip.textContent();
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(chips.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "false");
    await expect(preview.getByText("01", { exact: true })).toBeVisible();
    await expect(preview.getByText(category, { exact: true })).toBeVisible();
    const shown = await deck(page).locator("ol li:visible").count();
    await expect(deck(page).getByRole("status")).toHaveText(new RegExp(` 중 ${shown}개를 표시합니다\\.$`));
    await chips.getByRole("button", { name: "전체" }).click();
    await expect(chips.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "true");
    await read.click();
    await expect(page).toHaveURL(/\/memes\//);
  });
});

test.describe("the safety showcase", () => {
  test("the three tabs show their memes", async ({ page }) => {
    await open(page, "/");
    const showcase = page.locator("#home-safety-showcase");
    await expect(showcase.locator("a h3")).toHaveText(["중요한 건 꺾이지 않는 마음 (중꺾마)", "오히려 좋아"]);
    await showcase.getByRole("button", { name: "⚠️ 주의·금기 밈" }).click();
    await expect(showcase.locator("a h3")).toHaveText(["너 뭐 돼?", "맑은 눈의 광인 (맑눈광)"]);
    await expect(showcase.getByText("주의 🔴")).toHaveCount(2);
    await showcase.getByRole("button", { name: "☕ 일상·친구 대화" }).click();
    await expect(showcase.locator("a h3")).toHaveText(["중요한 건 꺾이지 않는 마음 (중꺾마)", "오히려 좋아", "맑은 눈의 광인 (맑눈광)"]);
    await showcase.getByRole("link", { name: /맑은 눈의 광인/ }).click();
    await expect(page).toHaveURL(/\/memes\//);
  });
});

test.describe("the safety self-check", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("five answers, the verdicts and links, the score and a fresh start", async ({ page, isMobile }) => {
    await open(page, "/");
    const check = selfCheck(page);
    // Right, wrong (its meme is listed: a link), right (its meme is not: no
    // link), wrong, right: three of five.
    const picks = [/^🟢 써도 됨: 팀원들의/, /^🟢 써도 됨: 예능/, /^🟢 써도 됨: 뛰어난/, /^🟢 써도 됨: 악재를/, /^🔴 쓰면 위험: 상대의 고통/];
    const right = [true, false, true, true, true];
    for (const [index, pick] of picks.entries()) {
      await check.getByRole("button", { name: pick }).click();
      await expect(check.getByRole("button", { name: pick })).toBeDisabled();
      await expect(check.getByText(right[index] ? "정답입니다! 정확한 밈 판별 감각을 지니셨네요." : "주의가 필요해요! 상황별 파급력을 꼭 확인하세요.")).toBeVisible();
      if (index === 1) {
        await expect(check.getByRole("link", { name: /‘너’ 상세 사전 보기/ })).toHaveAttribute("href", "/memes/nmd2022k-ne-mwo-dwae");
        if (!isMobile) {
          await check.getByRole("button", { name: "안전 대체어 복사" }).click();
          await expect(check.getByText("복사됨!")).toBeVisible();
          expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("피드백 주셔서 감사합니다. 말씀해 주신 부분 검토해 볼게요!");
        }
      }
      if (index === 2) await expect(check.getByRole("link", { name: /상세 사전 보기/ })).toHaveCount(0);
      await check.getByRole("button", { name: index === 4 ? "결과 확인하기" : "다음 문항 풀기" }).click();
    }
    await expect(check.getByRole("heading", { name: "자가진단 완료!" })).toBeVisible();
    await expect(check.getByText(/총 5문항 중 4문항을 맞히셨습니다\./)).toBeVisible();
    await expect(check.getByText("안정적인 밈 센스를 갖추셨습니다!")).toBeVisible();
    await expect(check.getByRole("link", { name: "트렌드 밈 탐색하기" })).toHaveAttribute("href", "/explore");
    await check.getByRole("button", { name: "진단 다시 풀기" }).click();
    await expect(check.getByRole("button", { name: picks[0] })).toBeEnabled();
  });
});

test.describe("the daily quiz", () => {
  test("answering as a guest keeps the streak on this device", async ({ page }) => {
    await recordGaEvents(page);
    await open(page, "/");
    const card = quiz(page);
    const options = card.getByRole("listitem").getByRole("button");
    await expect(options).toHaveCount(4);
    await expect(card.getByLabel("연속 출석 0일, 최고 0일")).toBeVisible();
    const requests = await requestsDuring(page, () => options.first().click());
    expect(requests.filter((request) => request.path !== "/api/analytics/events")).toEqual([]);
    await expect(options.first()).toHaveAttribute("aria-pressed", "true");
    for (const option of await options.all()) await expect(option).toBeDisabled();
    await expect(card.getByText("아쉬워요, 정답은 3번이에요.")).toBeVisible();
    await expect(card.getByRole("link", { name: "이 밈 보러가기" })).toHaveAttribute("href", "/memes/pgrich01-parity-rich");
    await expect(card.getByText("출석 완료! 내일 새 문제가 열려요.")).toBeVisible();
    await expect(card.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login?next=/my");
    await expect(card.getByRole("link", { name: "10문제 더 풀기" })).toHaveAttribute("href", "/quiz");
    await expect(card.getByLabel("연속 출석 1일, 최고 1일")).toBeVisible();
    expect(JSON.parse(await localStorageItem(page, "mc_daily_quiz_v1"))).toMatchObject({ streak: 1, best: 1, total: 1, lastSelected: 0 });
    const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ga-events") || "[]"));
    expect(events.filter(([name]) => name === "quiz_complete")).toEqual([["quiz_complete", { mode: "daily", score: 0 }]]);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(quiz(page).getByRole("listitem").getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
    await expect(quiz(page).getByText("출석 완료! 내일 새 문제가 열려요.")).toBeVisible();
  });

  test("signed in, the account's status is read and the answer is saved", async ({ page, signIn }) => {
    await signIn("user");
    const loading = await requestsDuring(page, () => open(page, "/"), { settle: 1500 });
    const status = loading.filter((request) => request.body?.plan?.fn === "get_daily_meme_quiz_status");
    expect(status.map(({ method, path, body }) => ({ method, path, body }))).toEqual([{
      method: "POST",
      path: "/api/db/query",
      body: { plan: { op: "rpc", fn: "get_daily_meme_quiz_status", fields: [{ kind: "star" }], filters: [], orGroups: [], orders: [], limit: null, offset: null, single: true, maybeSingle: false, count: null, head: false, onConflict: null, ignoreDuplicates: false, returning: true, args: {} } },
    }]);
    const card = quiz(page);
    const options = card.getByRole("listitem").getByRole("button");
    const saving = await requestsDuring(page, () => options.nth(1).click(), { settle: 1500 });
    const saved = saving.filter((request) => request.body?.plan?.fn === "complete_daily_meme_quiz");
    expect(saved).toHaveLength(1);
    expect(saved[0].body.plan).toEqual({ ...status[0].body.plan, fn: "complete_daily_meme_quiz", args: { p_meme_short_id: "pgrich01", p_correct: false } });
    await expect(card.getByText("지금은 이 기기에만 기록돼요.")).toHaveCount(0);
    await expect(card.getByText(/출석 완료!|일 연속 출석!/)).toBeVisible();
    await expect(card.getByLabel(/연속 출석 1일, 최고 1일/)).toBeVisible();
  });
});

test.describe("the daily quiz, unavailable", () => {
  test("a question that cannot be had takes the card away", async ({ page }) => {
    await page.unrouteAll();
    await page.route(/\/api\/daily-quiz\?/, (route) => route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "오늘의 퀴즈를 불러오지 못했어요.", code: "DAILY_QUIZ_UNAVAILABLE" }),
    }));
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: /오늘의 밈 퀴즈/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "새로 정리된 밈을 훑어보세요." })).toBeVisible();
  });
});

test.describe("the community battle", () => {
  test("the periods switch in place", async ({ page, isMobile }) => {
    await open(page, "/");
    const battle = page.locator("section").filter({ has: page.getByRole("heading", { name: "밈대결" }) });
    const tabs = battle.getByRole("tablist", { name: "밈대결 기간" });
    const panel = battle.getByRole("tabpanel");
    await expect(tabs.getByRole("tab", { name: "오늘" })).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByRole("link")).toHaveCount(4);
    await expect(panel.getByRole("link").first()).toContainText("퇴근길 밈 모음");
    await expect(panel.getByText("상위 1% 후보")).toHaveCount(1);
    await expect(panel.getByText("참가 4개 중 상위 1개가 밈 사전 후보예요.")).toBeVisible();
    await tabs.getByRole("tab", { name: "이번 달" }).click();
    await expect(tabs.getByRole("tab", { name: "이번 달" })).toHaveAttribute("aria-selected", "true");
    await expect(tabs.getByRole("tab", { name: "오늘" })).toHaveAttribute("aria-selected", "false");
    await expect(panel).toHaveAccessibleName("이번 달");
    await expect(panel.getByRole("listitem")).toHaveCount(50);
    await expect(panel.getByRole("link", { name: "나머지 참가작은 커뮤니티에서 보기" })).toHaveAttribute("href", "/community");
    if (!isMobile) {
      await panel.getByRole("link").first().click();
      await expect(page).toHaveURL(/\/community\/[0-9a-f-]{36}$/);
    }
  });
});

test.describe("the edition hint", () => {
  test.use({ locale: "en-US" });

  test("an English browser is offered the English edition", async ({ page }) => {
    await open(page, "/");
    const hint = page.getByRole("link", { name: "Read the English edition" });
    await expect(hint).toHaveAttribute("href", "/en");
    await expect(hint).toHaveAttribute("hreflang", "en");
    await expect(page.getByText("New to Korean memes?")).toBeVisible();
  });

  test("a saved language with a home of its own goes there; Korean keeps the hint away", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "memecatch_locale", value: "ja", url: baseURL }]);
    await page.goto("/?utm_source=x", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/ja\?utm_source=x$/);
    await context.addCookies([{ name: "memecatch_locale", value: "ko", url: baseURL }]);
    await open(page, "/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("New to Korean memes?")).toHaveCount(0);
    await context.addCookies([{ name: "memecatch_locale", value: "fr", url: baseURL }]);
    await open(page, "/");
    await expect(page.getByText("New to Korean memes?")).toHaveCount(0);
  });
});

test.describe("the phone layout", () => {
  test("the battle follows the page on a phone", async ({ page, isMobile }) => {
    mobileOnly(isMobile);
    await open(page, "/");
    const top = async (locator) => (await locator.boundingBox()).y;
    expect(await top(page.getByRole("heading", { name: "밈대결" }))).toBeGreaterThan(await top(page.locator("#home-editorial")));
  });
});

// Batch B5, a translated edition's home (/en) on ../pages/b5-seed.sql: the
// same page in English, its deck the reviewed translations.
test.describe("an edition's home", () => {
  test("the layout choices wait for the renderer, then work", async ({ page }) => {
    await open(page, "/en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catch the meme. Follow the meaning.");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await scene(page).scrollIntoViewIfNeeded();
    await expect(scene(page).getByRole("button", { name: "Pause scene" })).toBeVisible({ timeout: 20_000 });
    await scene(page).getByText("Scene controls").click();
    const layouts = scene(page).getByRole("group", { name: "3D layer layout" });
    await expect(layouts.getByRole("radio", { name: "Stack" })).toBeEnabled();
    await layouts.getByRole("radio", { name: "Scroll" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(layouts.getByRole("radio", { name: "Stack" })).toBeChecked();
  });

  test("before the renderer, the choices are there but disabled", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => 1 }));
    await open(page, "/en");
    await scene(page).getByText("Scene controls").click();
    const layouts = scene(page).getByRole("group", { name: "3D layer layout" });
    await expect(layouts.getByRole("radio")).toHaveCount(3);
    for (const radio of await layouts.getByRole("radio").all()) await expect(radio).toBeDisabled();
    await expect(scene(page).getByRole("button", { name: "Reset view" })).toBeDisabled();
  });

  test("the deck filters the translations and shows their Korean titles", async ({ page }) => {
    await open(page, "/en");
    const status = deck(page).getByRole("status");
    await expect(status).toHaveText("Showing 5 of 5 recent entries.");
    await deck(page).getByRole("searchbox", { name: "Filter this recent set" }).fill("art1");
    await expect(status).toHaveText("Showing 1 of 5 recent entries.");
    const preview = deck(page).getByRole("complementary");
    await expect(preview.getByText("그림 카드 밈")).toBeVisible();
    await expect(preview.getByText("Original")).toBeVisible();
    await expect(preview.getByRole("link")).toHaveAttribute("href", "/en/memes/pgb2art1-pgb2art1-en");
    await expect(page.getByRole("heading", { name: /오늘의 밈 퀴즈/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "밈대결" })).toHaveCount(0);
  });
});
