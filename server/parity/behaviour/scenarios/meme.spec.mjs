// Batch B3, the Korean meme document: what its sections do below the answer
// card (the frame and saving are in frame.spec.mjs and account.spec.mjs). On
// ../pages/seed.sql and ../pages/b3-seed.sql.
import { MEME, databaseSql, expect, open, requestsDuring, sqlText, test } from "../lib.mjs";

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

// components/meme-contribute.tsx. Next submits with its server action, the
// native page posts to /api/memes/contribution: either is accepted by name.
const THIN = "/memes/pgthin02-parity-thin";
const THIN_ID = "00000000-0000-4000-8000-000000000002";
const SUBMITTED = (request) => request.method === "POST" && ["<server action>", "/api/memes/contribution"].includes(request.path);

test.describe("the contribution form", () => {
  test("the page's links open it on their tab, and the button waits for the fields", async ({ page }) => {
    await open(page, THIN);
    const form = page.locator("details#contribute");
    await expect(form).not.toHaveAttribute("open");
    await page.getByRole("link", { name: "출처를 아시면 알려 주세요" }).click();
    await expect(page).toHaveURL(/#contribute-source$/);
    await expect(form).toHaveAttribute("open");
    await expect(form.getByRole("radio", { name: "출처 링크" })).toBeChecked();
    const send = form.getByRole("button", { name: "검수 요청 보내기" });
    await expect(send).toBeDisabled();
    await form.getByRole("textbox", { name: "링크" }).fill("   ");
    await expect(send).toBeDisabled();
    await form.getByRole("textbox", { name: "링크" }).fill("https://news.example.org/x");
    await expect(send).toBeEnabled();

    await page.getByRole("link", { name: "아는 내용 보태기" }).click();
    await expect(page).toHaveURL(/#contribute-example$/);
    await expect(form.getByRole("radio", { name: "사용 예문" })).toBeChecked();
    await expect(form.getByRole("textbox", { name: "링크" })).toHaveCount(0);
    await expect(send).toBeDisabled();
    await form.getByRole("textbox", { name: "어떤 상황에서 썼나요?" }).fill("단톡방");
    await expect(send).toBeDisabled();
    await form.getByRole("textbox", { name: "실제로 쓴 문장" }).fill("패리티 씬이네");
    await expect(send).toBeEnabled();
    // Back to the source tab: what was typed there is still there.
    await form.getByText("출처 링크").click();
    await expect(form.getByRole("textbox", { name: "링크" })).toHaveValue("https://news.example.org/x");
    await expect(form.getByRole("textbox", { name: "어떤 상황에서 썼나요?" })).toHaveCount(0);
  });

  test("signed out, sending asks to sign in and links back to the tab", async ({ page }) => {
    await open(page, `${THIN}#contribute-source`);
    const form = page.locator("details#contribute");
    await expect(form).toHaveAttribute("open");
    await form.getByRole("textbox", { name: "링크" }).fill("https://news.example.org/signed-out");
    const sent = await requestsDuring(page, () => form.getByRole("button", { name: "검수 요청 보내기" }).click());
    expect(sent.filter(SUBMITTED)).toHaveLength(1);
    const alert = form.getByRole("alert");
    await expect(alert).toHaveText("로그인하면 제보할 수 있어요. 로그인하고 이어서 쓰기");
    await expect(alert.getByRole("link", { name: "로그인하고 이어서 쓰기" }))
      .toHaveAttribute("href", `/login?next=${encodeURIComponent(`${THIN}#contribute-source`)}`);
  });

  test("signed in, an example is stored for review with the credit choice, and the fields empty", async ({ page, signIn }) => {
    const session = await signIn("user");
    await open(page, `${THIN}#contribute-example`);
    const form = page.locator("details#contribute");
    await form.getByRole("textbox", { name: "어떤 상황에서 썼나요?" }).fill("  시험이 끝났을 때  ");
    await form.getByRole("textbox", { name: "실제로 쓴 문장" }).fill(`패리티 씬 ${session.userId}`);
    await form.getByRole("checkbox", { name: "반영되면 내 닉네임을 기여자로 표시해 주세요" }).check();
    const sent = await requestsDuring(page, () => form.getByRole("button", { name: "검수 요청 보내기" }).click());
    expect(sent.filter(SUBMITTED)).toHaveLength(1);
    await expect(form.getByRole("status")).toHaveText("고마워요! 검수를 거쳐 반영되면 「함께 채운 사람」에 닉네임이 올라가요.");
    await expect(form.getByRole("textbox", { name: "어떤 상황에서 썼나요?" })).toHaveValue("");
    await expect(form.getByRole("textbox", { name: "실제로 쓴 문장" })).toHaveValue("");
    await expect(form.getByRole("checkbox")).toBeChecked();
    const row = databaseSql(`select meme_id, kind, source_url, note, example_situation, example_text, credit_public, status
                               from public.meme_contributions where contributor_id = ${sqlText(session.userId)}::uuid`);
    expect(row).toBe(`${THIN_ID}|example|||시험이 끝났을 때|패리티 씬 ${session.userId}|t|pending`);
  });

  test("signed in, the database's refusal is said in the form's words", async ({ page, signIn }) => {
    const session = await signIn("user");
    await open(page, `${MEME.path}#contribute-source`);
    const form = page.locator("details#contribute");
    await form.getByRole("textbox", { name: "링크" }).fill("https://news.example.org/articles/parity-rich");
    await form.getByRole("textbox", { name: "어떤 자료인가요? (선택)" }).fill("이미 있는 기사");
    await form.getByRole("button", { name: "검수 요청 보내기" }).click();
    await expect(form.getByRole("alert")).toHaveText("이미 이 문서에 연결된 링크예요.");
    await expect(form.getByRole("textbox", { name: "링크" })).toHaveValue("https://news.example.org/articles/parity-rich");
    expect(databaseSql(`select count(*) from public.meme_contributions where contributor_id = ${sqlText(session.userId)}::uuid`)).toBe("0");
  });
});

// components/auth-invite.tsx: held invisible until the session is known.
test.describe("the sign-in invite", () => {
  test("a guest sees it, can reach its links, and they come back to this page", async ({ page }) => {
    await open(page, MEME.path);
    const invite = page.getByRole("complementary", { name: "로그인 안내" });
    await expect(invite).toBeVisible();
    await expect(invite).toContainText("로그인하면 밈캐치를 200% 즐길 수 있어요");
    const login = invite.getByRole("link", { name: "로그인", exact: true });
    await expect(login).toHaveAttribute("href", `/login?next=${encodeURIComponent(MEME.path)}`);
    await expect(invite.getByRole("link", { name: "회원가입" })).toHaveAttribute("href", `/login?tab=signup&next=${encodeURIComponent(MEME.path)}`);
    await login.focus();
    await expect(login).toBeFocused();
  });

  test("a member does not see it", async ({ page, signIn }) => {
    await signIn("user");
    await open(page, MEME.path);
    await expect(page.locator("header").getByRole("link", { name: "로그인", exact: true })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "로그인 안내" })).toHaveCount(0);
    await expect(page.getByText("로그인하면 밈캐치를 200% 즐길 수 있어요")).toHaveCount(0);
  });
});

// components/meme-market-passport.tsx: a reviewed variant is a link.
test.describe("the market passport", () => {
  test("lists the reviewed markets and opens a reviewed variant", async ({ page }) => {
    await open(page, "/memes/pgpas006-parity-passport");
    const passport = page.getByRole("region", { name: "이 밈은 어디에서 어떻게 쓰이나요?" });
    await expect(passport.getByRole("article")).toHaveCount(2);
    await expect(passport.getByRole("article").first()).toContainText("현재 사용 시장");
    await expect(passport.getByRole("link")).toHaveCount(1);
    await passport.getByRole("link", { name: /현지 변형/ }).click();
    await expect(page).toHaveURL(/\/memes\/pgrich01-parity-rich$/);
  });
});

// components/meme-lifecycle-guide.tsx: the suggestion's copy button.
test.describe("the lifecycle guide", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies the suggestion for the meme's stage", async ({ page }) => {
    await open(page, MEME.path);
    const guide = page.getByRole("region", { name: "지금도 쓰이나요? · 트렌드 수명 분석" });
    await expect(guide).toContainText("유행 중");
    await guide.getByRole("button", { name: "실전 사용 제안 복사" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "대다수가 맥락을 이해하므로 편하게 쓰셔도 좋습니다. 직장 내에서는 친밀한 동료와의 슬랙이나 티타임에 유쾌하게 쓸 수 있습니다.",
    );
  });
});

// components/context-nav.tsx: a meme opened from a collection.
test.describe("the collection navigation", () => {
  test("steps to the next meme of the collection and back to the collection", async ({ page }) => {
    await open(page, "/memes/pgrich01-parity-rich?ctx=challenge&prev=%2Fmemes%2Fpgthin02-parity-thin&next=%2Fmemes%2Fpgevt004-parity-event&i=2&total=10");
    const nav = page.getByRole("navigation", { name: "챌린지 모음 이어보기" });
    const collection = nav.getByRole("link", { name: "챌린지 모음" });
    await expect(collection).toHaveAttribute("href", "/collections/challenge");
    await expect(collection).toHaveText("챌린지 모음(2/10)");
    await nav.getByRole("link", { name: "다음", exact: true }).click();
    await expect(page).toHaveURL(/\/memes\/pgevt004-parity-event$/);
    await expect(page.getByRole("navigation", { name: /이어보기$/ })).toHaveCount(0);
  });
});

// components/house-original-visual.tsx: a house original's card and storyboard.
test.describe("a house original", () => {
  test("shows its card and switches to the storyboard and back", async ({ page }) => {
    await open(page, "/memes/pgown009-parity-original");
    const slot = page.getByRole("region", { name: "대표 콘텐츠" });
    await expect(slot.getByRole("img", { name: "패리티 오리지널 자체 밈 카드" })).toBeVisible();
    await slot.getByRole("button", { name: "🎬 숏폼 스토리보드" }).click();
    await expect(slot.getByRole("img")).toHaveCount(0);
    await expect(slot).toContainText("\"패리티 오리지널\" 요즘 대세 밈 30초 완성");
    await expect(slot).toContainText("Scene 4 (00:12 - 00:15)");
    await slot.getByRole("button", { name: "🎨 밈 카드" }).click();
    await expect(slot.getByRole("img", { name: "패리티 오리지널 자체 밈 카드" })).toBeVisible();
    await expect(slot).not.toContainText("Scene 1");
    await expect(page.getByRole("heading", { name: "어떻게 만들었나요?" })).toBeVisible();
  });
});

// What the page reports to Google Analytics from its sections: tracked links
// (components/tracked-block.tsx), the collection steps and a contribution.
// Needs both servers built and started with NEXT_PUBLIC_GA_ID.
async function recordGaEvents(page) {
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  await page.route(/^https:\/\/(news|sports|tv)\.example\.org\//, (route) => route.fulfill({ status: 200, body: "" }));
  await page.route(/^https:\/\/(namu\.wiki|ko\.wikipedia\.org)\//, (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    let layer;
    Object.defineProperty(window, "dataLayer", {
      configurable: true,
      get: () => layer,
      set(value) {
        layer = value;
        const push = value.push.bind(value);
        value.push = (...items) => {
          for (const item of items) {
            const args = Array.from(item);
            if (args[0] !== "event") continue;
            const seen = JSON.parse(sessionStorage.getItem("ga-events") || "[]");
            sessionStorage.setItem("ga-events", JSON.stringify([...seen, args.slice(1)]));
          }
          return push(...items);
        };
      },
    });
  });
}
const gaEvents = (page, name) =>
  page.evaluate((wanted) => JSON.parse(sessionStorage.getItem("ga-events") || "[]").filter(([event]) => event === wanted), name);

test.describe("what the sections report", () => {
  test("an evidence link, the trust note's and the status note's links, and a collection step", async ({ page }) => {
    await recordGaEvents(page);
    await open(page, MEME.path);
    const evidence = page.getByRole("region", { name: "이 문서가 참고한 자료" });
    const popup = page.waitForEvent("popup");
    await evidence.getByRole("link", { name: /패리티 리치가 퍼진 과정/ }).click();
    await (await popup).close();
    expect(await gaEvents(page, "meme_source_opened")).toEqual([
      ["meme_source_opened", { short_id: "pgrich01", platform: "other", to: "https://news.example.org/articles/parity-rich" }],
    ]);

    await open(page, THIN);
    await page.getByRole("link", { name: "출처를 아시면 알려 주세요" }).click();
    await page.getByRole("link", { name: "아는 내용 보태기" }).click();
    expect(await gaEvents(page, "correction_report_started")).toEqual([
      ["correction_report_started", { short_id: "pgthin02", from: "trust_note", to: "#contribute-source" }],
      ["correction_report_started", { short_id: "pgthin02", from: "doc_status", to: "#contribute-example" }],
    ]);

    await open(page, "/memes/pgrich01-parity-rich?ctx=challenge&prev=%2Fmemes%2Fpgthin02-parity-thin&i=2&total=10");
    await page.getByRole("navigation", { name: "챌린지 모음 이어보기" }).getByRole("link", { name: "이전", exact: true }).click();
    await expect(page).toHaveURL(/\/memes\/pgthin02-parity-thin$/);
    expect(await gaEvents(page, "context_nav")).toEqual([["context_nav", { dir: "prev", ctx: "challenge" }]]);
  });

  test("a contribution that was taken", async ({ page, signIn }) => {
    await recordGaEvents(page);
    await signIn("user");
    await open(page, `${THIN}#contribute-source`);
    const form = page.locator("details#contribute");
    await form.getByRole("textbox", { name: "링크" }).fill(`https://news.example.org/tracked-${Date.now()}`);
    await form.getByRole("button", { name: "검수 요청 보내기" }).click();
    await expect(form.getByRole("status")).toHaveText("고마워요! 검수를 거쳐 이 문서에 반영할게요.");
    expect(await gaEvents(page, "meme_contribution_submitted")).toEqual([
      ["meme_contribution_submitted", { short_id: "pgthin02", kind: "source" }],
    ]);
  });
});

// components/meme-embed.tsx and related-video-list.tsx. Nothing leaves the
// machine: the players, stills and Next's oEmbed check are answered here.
const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");
async function stubPlayers(page, oembed) {
  await page.route(/^https:\/\/(www\.youtube-nocookie\.com|www\.tiktok\.com|www\.instagram\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>player</title>" }));
  await page.route(/^https:\/\/i\.ytimg\.com\//, (route) => route.fulfill({ status: 200, contentType: "image/gif", body: PIXEL_GIF }));
  await page.route("**/api/oembed?*", (route) => route.fulfill(oembed));
}

test.describe("the media", () => {
  test("the representative video plays in place; a related still becomes its player when pressed", async ({ page }) => {
    await stubPlayers(page, { status: 502, contentType: "application/json", body: "{}" });
    await open(page, "/memes/pgvid012-parity-video");
    const slot = page.getByRole("region", { name: "대표 콘텐츠" });
    await expect(slot.locator('iframe[title="패리티 영상 — 대표 영상"]')).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/pgvid012aaa?rel=0");
    const related = page.getByRole("region", { name: "관련 영상" });
    await expect(related).toContainText("검수된 공개 사용 예시 5개예요.");
    const stills = related.getByRole("button", { name: "패리티 영상 관련 영상 재생" });
    await expect(stills).toHaveCount(4);
    await stills.first().click();
    await expect(related.locator('iframe[title="패리티 영상 — 관련 영상"]')).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/pgvid012bbb?rel=0&autoplay=1");
    await expect(stills).toHaveCount(3);
  });

  test("past four, the related videos wait as links until their region opens", async ({ page }) => {
    await stubPlayers(page, { status: 502, contentType: "application/json", body: "{}" });
    await open(page, "/memes/pgvid012-parity-video");
    const related = page.getByRole("region", { name: "관련 영상" });
    const more = related.getByText("관련 영상 1개 더 보기");
    await expect(related.getByRole("link", { name: "YouTube 관련 영상 5", includeHidden: true })).toHaveAttribute("href", "https://www.youtube.com/watch?v=pgvid012fff");
    await more.click();
    await expect(related.getByRole("button", { name: "패리티 영상 관련 영상 재생" })).toHaveCount(5);
    await expect(related.getByRole("link", { name: "YouTube 관련 영상 5" })).toHaveCount(0);
    await expect(related.getByRole("button", { name: /더 재생하기/ })).toHaveCount(0);
    await more.click();
    await expect(related.getByRole("button", { name: "패리티 영상 관련 영상 재생" })).toHaveCount(4);
  });

  test("a social post's player the link names stays when the post cannot be checked", async ({ page }) => {
    const checked = [];
    await stubPlayers(page, { status: 502, contentType: "application/json", body: JSON.stringify({ error: "게시물을 확인하지 못했어요." }) });
    page.on("request", (request) => {
      if (request.url().includes("/api/oembed?")) checked.push(new URL(request.url()).searchParams.get("url"));
    });
    await open(page, "/memes/pgb2rel4-b2-pgb2rel4");
    const slot = page.getByRole("region", { name: "대표 콘텐츠" });
    await expect.poll(() => checked).toEqual(["https://www.instagram.com/reel/B2reelCode1/"]);
    await expect(slot.locator("iframe")).toHaveAttribute("src", "https://www.instagram.com/reel/B2reelCode1/embed/captioned/");
    await expect(slot.getByRole("alert")).toHaveCount(0);
    await expect(slot.getByRole("link", { name: "게시물 열기" })).toHaveAttribute("href", "https://www.instagram.com/reel/B2reelCode1/");
  });
});
