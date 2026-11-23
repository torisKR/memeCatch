// The chat launcher and panel. The answer comes from /api/memes/chat, which
// needs a language model; the scenario answers that request itself, the same
// way for both servers, and checks what the panel sends and shows.
import { MEME, expect, focusRing, focused, open, requestsDuring, test } from "../lib.mjs";

const QUESTION = "중꺾마는 무슨 뜻이야?";
const ANSWER = "꺾이지 않는 마음이 중요하다는 뜻이에요.";
const RESULT = {
  answer: ANSWER,
  mode: "generated",
  retrievalMode: "hybrid",
  items: [{
    id: MEME.id,
    short_id: "pgrich01",
    slug: "parity-rich",
    title: MEME.title,
    summary: "검증용 요약",
    href: MEME.path,
    sources: [{ url: "https://news.example.org/a", label: "기사" }],
  }],
};
const stream = (lines) => lines.map((line) => JSON.stringify(line)).join("\n") + "\n";

async function answerWith(page, response) {
  await page.route("**/api/memes/chat", (route) => route.fulfill(response));
}

for (const path of ["/about", MEME.path]) {
  test.describe(`chat on ${path}`, () => {
    test("opens as a labelled dialog, asks, shows the answer with its references, and closes with Escape", async ({ page }) => {
      await answerWith(page, {
        status: 200,
        contentType: "application/x-ndjson",
        body: stream([
          { type: "progress", progress: { stage: "searching" } },
          { type: "progress", progress: { stage: "found", count: 1 } },
          { type: "result", result: RESULT },
        ]),
      });
      await open(page, path);
      const launcher = page.getByRole("button", { name: "밈캐치 챗봇 열기" });
      await expect(launcher).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await launcher.click();
      const dialog = page.getByRole("dialog", { name: "밈캐치에게 물어봐" });
      await expect(dialog).toBeVisible();
      const openLauncher = page.getByRole("button", { name: "채팅 닫기", expanded: true });
      await expect(openLauncher).toHaveAttribute("aria-controls", await dialog.getAttribute("id"));
      await expect.poll(() => focused(page)).toBe("textarea: 밈에 관한 질문");
      await expect(dialog.getByText("어떤 밈을 찾고 있나요? 상황이나 궁금한 표현을 알려주세요.")).toBeVisible();
      const send = dialog.getByRole("button", { name: "보내기" });
      await expect(send).toBeDisabled();

      await dialog.getByRole("button", { name: QUESTION }).click();
      const input = dialog.getByRole("textbox", { name: "밈에 관한 질문" });
      await expect(input).toHaveValue(QUESTION);
      await expect(dialog.getByText("12/120")).toBeVisible();
      expect(await focused(page)).toBe("textarea: 밈에 관한 질문");
      await expect(send).toBeEnabled();

      const asked = await requestsDuring(page, () => page.keyboard.press("Enter"));
      expect(asked.filter((request) => request.path === "/api/memes/chat")).toEqual([
        expect.objectContaining({ method: "POST", body: { question: QUESTION, locale: "ko" } }),
      ]);
      await expect(dialog.getByText(ANSWER)).toBeVisible();
      await expect(dialog.getByText("AI 답변")).toBeVisible();
      await expect(dialog.getByText(QUESTION)).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "함께 볼 밈" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: MEME.title })).toHaveAttribute("href", MEME.path);
      await expect(dialog.getByRole("link", { name: "기사" })).toHaveAttribute("href", "https://news.example.org/a");
      await expect(input).toHaveValue("");
      await expect(dialog.getByText("0/120")).toBeVisible();
      await expect.poll(() => focused(page)).toBe("textarea: 밈에 관한 질문");

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(launcher).toHaveAttribute("aria-expanded", "false");
      expect(await focused(page)).toBe("button: 밈캐치 챗봇 열기");
      expect(await focusRing(page)).toBe("solid 2px");

      // The conversation is kept while the page stays open.
      await launcher.click();
      await expect(dialog.getByText(ANSWER)).toBeVisible();
      await dialog.getByRole("button", { name: "대화 지우기" }).click();
      await expect(dialog.getByText(ANSWER)).toHaveCount(0);
      await expect(dialog.getByText("어떤 밈을 찾고 있나요? 상황이나 궁금한 표현을 알려주세요.")).toBeVisible();
      await dialog.getByRole("button", { name: "채팅 닫기" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await focused(page)).toBe("button: 밈캐치 챗봇 열기");
    });

    test("says why when the question is too short or the service refuses", async ({ page }) => {
      await answerWith(page, { status: 429, contentType: "application/json", body: "{}" });
      await open(page, path);
      await page.getByRole("button", { name: "밈캐치 챗봇 열기" }).click();
      const dialog = page.getByRole("dialog", { name: "밈캐치에게 물어봐" });
      const input = dialog.getByRole("textbox", { name: "밈에 관한 질문" });

      await input.fill("밈");
      const short = await requestsDuring(page, () => page.keyboard.press("Enter"));
      expect(short.filter((request) => request.path === "/api/memes/chat")).toEqual([]);
      await expect(dialog.getByRole("alert")).toHaveText("질문을 2~120자로 입력해 주세요.");

      await input.fill("요즘 밈 알려줘");
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      await page.keyboard.press("Enter");
      await expect(dialog.getByRole("alert")).toHaveText("잠시 쉬었다가 다시 질문해 주세요.");
      await expect(input).toHaveValue("요즘 밈 알려줘");
    });
  });
}
