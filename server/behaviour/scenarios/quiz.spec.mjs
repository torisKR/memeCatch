// Batch B2, /quiz and /quiz/r/{token} (components/quiz-app.tsx). /api/quiz
// draws new questions on every request, so the scenario answers it with ten
// questions on memes of seeds/b2-seed.sql whose answers it knows.
import { expect, open, recordGaEvents, requestsDuring, test } from "../lib.mjs";

const MEMES = [
  ["pgb2art1", "그림 카드 밈", 2023], ["pgb2c17h", "90년대 개그 유행어", 1994], ["pgb2c18j", "CF 카피 밈", 1998],
  ["pgb2d19k", "싸이월드 감성 밈", 2004], ["pgb2d20m", "디시 짤방 밈", 2006], ["pgb2d21n", "플래시 애니 밈", 2003],
  ["pgb2ded8", "끊긴 영상 밈", 2019], ["pgb2g14e", "게임 중계 어록", 2014], ["pgb2g15f", "롤 채팅 밈", 2013],
  ["pgb2g16g", "배틀그라운드 밈", 2018],
];
const QUESTIONS = MEMES.map(([shortId, title, originYear], i) => ({
  question: `「${title}」, 무슨 뜻일까요?`,
  options: [0, 1, 2, 3].map((n) => `${title} 보기 ${n + 1}`),
  answerIndex: i % 4,
  meme: { shortId, slug: `b2-${shortId}`, title, originYear, safetyLevel: "green" },
}));
// Seven right, then three wrong: 7/10, 밈잘알, the 2000s.
const PICKS = QUESTIONS.map((q, i) => (i < 7 ? q.answerIndex : (q.answerIndex + 1) % 4));
const TOKEN = `a07f${MEMES.map(([id]) => id).join("")}`;

async function answerQuiz(page) {
  await page.route("**/api/quiz?**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ questions: QUESTIONS }) }));
}

async function play(page) {
  for (const [i, pick] of PICKS.entries()) {
    const question = page.getByRole("region", { name: `문항 ${i + 1} / 10` });
    await expect(question.getByRole("heading", { level: 2 })).toHaveText(QUESTIONS[i].question);
    await expect(question.getByRole("progressbar", { name: "퀴즈 진행도" })).toHaveAttribute("aria-valuenow", String(i + 1));
    // Every other question by key: 1–4, then Enter.
    if (i % 2) await page.keyboard.press(String(pick + 1));
    else await question.getByRole("button", { name: QUESTIONS[i].options[pick] }).click();
    await expect(question.getByRole("status")).toHaveText(i < 7 ? "정답! 밈력이 느껴져요." : `아쉬워요 — 정답은 ${QUESTIONS[i].answerIndex + 1}번.`);
    await expect(question.getByRole("button", { name: QUESTIONS[i].options[0] })).toBeDisabled();
    await expect(question.getByRole("link", { name: "이 밈 보러가기" })).toHaveAttribute("href", `/memes/${MEMES[i][0]}-b2-${MEMES[i][0]}`);
    if (i % 2) await page.keyboard.press("Enter");
    else await question.getByRole("button", { name: i === 9 ? "결과 보기" : "다음" }).click();
  }
}

test.describe("the meme quiz", () => {
  test("ten questions by click and by key, then the grade, the era and the review", async ({ page }) => {
    await recordGaEvents(page);
    await answerQuiz(page);
    await open(page, "/quiz");
    const requests = await requestsDuring(page, async () => {
      await page.getByRole("button", { name: /^전체/ }).click();
      await expect(page.getByRole("region", { name: "문항 1 / 10" })).toBeVisible();
    });
    expect(requests.filter((r) => r.path === "/api/quiz")).toHaveLength(1);
    await play(page);
    const result = page.getByRole("region", { name: "밈력고사 결과" });
    await expect(result.getByText("나의 밈력")).toBeVisible();
    await expect(result.locator(".stat-mono")).toHaveText("7");
    await expect(result.getByText("밈잘알", { exact: true })).toBeVisible();
    await expect(result.getByText("대화방 밈 해설 담당은 당신이었군요.")).toBeVisible();
    await expect(result.getByText("당신의 밈 감성은 2000년대")).toBeVisible();
    const review = result.getByRole("list").getByRole("link");
    await expect(review).toHaveCount(3);
    await expect(review.first()).toHaveAttribute("href", "/memes/pgb2g14e-b2-pgb2g14e");
    await expect(review.first()).toContainText("게임 중계 어록");
    const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ga-events") || "[]"));
    expect(events.filter(([name]) => name.startsWith("quiz_")).map(([name, params]) => [name, params.mode, params.score])).toEqual([
      ["quiz_start", "all", undefined],
      ["quiz_complete", "all", 7],
    ]);

    await result.getByRole("button", { name: "모드 변경" }).click();
    await expect(page.getByRole("region", { name: "밈력고사 시작" })).toBeVisible();
  });

  test("the result link is copied, and the card image saved", async ({ page, context, isMobile }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
    await answerQuiz(page);
    await open(page, "/quiz");
    await page.getByRole("button", { name: /^전체/ }).click();
    await play(page);
    const result = page.getByRole("region", { name: "밈력고사 결과" });
    await result.getByRole("button", { name: "결과 링크 공유" }).click();
    await expect(result.getByRole("button", { name: "결과 링크 복사됨!" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`나의 밈력 7/10점 (밈잘알) — 같은 문제로 내 점수 이겨볼 사람? ${new URL(process.env.AXUM_URL).origin}/quiz/r/${TOKEN}`);
    await expect(result.getByRole("button", { name: "결과 링크 공유" })).toBeVisible({ timeout: 4000 });

    if (!isMobile) {
      const download = page.waitForEvent("download");
      await result.getByRole("button", { name: "성적표 이미지 저장 (인스타/카톡)" }).click();
      expect((await download).suggestedFilename()).toBe("밈력고사_성적표_밈잘알_7점.png");
      await expect(result.getByText("성적표 이미지가 다운로드되었습니다!")).toBeVisible();
    }
  });

  test("a quiz that does not load can be tried again", async ({ page }) => {
    await open(page, "/quiz");
    await page.route("**/api/quiz?**", (route) => route.fulfill({ status: 500, body: "" }));
    await page.getByRole("button", { name: /^요즘 밈만/ }).click();
    const failed = page.getByRole("region", { name: "출제 실패" });
    await expect(failed.getByRole("status")).toHaveText("문제를 불러오지 못했어요.");
    await expect(failed.getByRole("button", { name: "새 문제로 풀기" })).toHaveCount(0);
    await page.unroute("**/api/quiz?**");
    await answerQuiz(page);
    const again = page.waitForRequest("**/api/quiz?**");
    await failed.getByRole("button", { name: "다시 시도" }).click();
    expect(new URL((await again).url()).searchParams.get("mode")).toBe("now");
    await expect(page.getByRole("region", { name: "문항 1 / 10" })).toBeVisible();
  });

  test("a friend's challenge asks for the same questions and compares the scores", async ({ page }) => {
    await answerQuiz(page);
    // The friend got the first three right.
    await open(page, `/quiz/r/a007${MEMES.map(([id]) => id).join("")}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("친구의 밈력은 3점!");
    const card = page.getByRole("region", { name: "친구의 밈력고사 결과" });
    await expect(card.getByRole("list", { name: "친구의 문항별 정답" }).getByRole("listitem")).toHaveCount(10);
    await expect(card.getByRole("listitem", { name: "3번 정답" })).toHaveCount(1);
    await expect(card.getByRole("listitem", { name: "4번 오답" })).toHaveCount(1);
    const quizRequest = page.waitForRequest("**/api/quiz?**");
    await card.getByRole("button", { name: "내 점수 이겨보기" }).click();
    const query = new URL((await quizRequest).url()).searchParams;
    expect(query.get("mode")).toBe("all");
    expect(query.get("set")).toBe(MEMES.map(([id]) => id).join(","));
    await play(page);
    const result = page.getByRole("region", { name: "밈력고사 결과" });
    await expect(result.getByRole("status")).toHaveText("친구 3/10 vs 나 7/10 — 친구를 이겼어요! 결과 링크로 자랑해 보세요.");
    await expect(result.getByRole("button", { name: "같은 문제 다시 풀기" })).toBeVisible();

    await open(page, `/quiz/r/a007${MEMES.map(([id]) => id).join("")}`);
    await page.getByRole("button", { name: "새 문제로 풀기" }).click();
    await expect(page.getByRole("region", { name: "밈력고사 시작" })).toBeVisible();
  });
});
