// /admin/memes/new: HouseOriginalForm (components/admin/house-original-form.tsx):
// the year check, saving to pending and landing on the new meme, and the
// Bedrock drafts answered by the scenario (applying one, saving one directly).
import { databaseSql, expect, open, test } from "../lib.mjs";

const LIKE = "'B7 화면 자체%'";
const reset = () =>
  databaseSql(`delete from admin_audit_log where action = 'meme.create_house_original' and detail->>'title' like ${LIKE};
    delete from meme_market_profiles where meme_id in (select id from memes where title like ${LIKE});
    delete from meme_sources where meme_id in (select id from memes where title like ${LIKE});
    delete from memes where title like ${LIKE};`);

const CONCEPT = {
  headline: "B7 화면 자체 초안",
  caption: "초안 한 줄",
  local_caption: "下書き",
  cultural_anchor: "회의 문화",
  visual_brief: "회의실 사진",
  why_it_works: "모두 겪어 봤으니까",
  usage_context: "단톡방",
  country_code: "JP",
};

test.describe("admin house original", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("a year out of range is refused, then the meme is saved pending", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/memes/new");
    await page.getByLabel("제목").fill("B7 화면 자체 밈");
    await page.getByLabel("한 줄 요약").fill("화면에서 만든 밈");
    await page.getByLabel("제작 연도 (선택)").fill("1970");
    await page.getByRole("button", { name: "대기로 저장" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("제작 연도는 1980~2100 사이 숫자로 입력해 주세요.");
    await page.getByLabel("제작 연도 (선택)").fill("2026");
    await page.getByRole("button", { name: "대기로 저장" }).click();
    await page.waitForURL((url) => /^\/admin\/memes\/[0-9a-f-]{36}$/.test(url.pathname));
    expect(databaseSql(`select moderation_status || '|' || origin_kind || '|' || origin_year from memes where title = 'B7 화면 자체 밈'`)).toBe("pending|house_original|2026");
  });

  test("a draft is applied to the fields, another saved directly", async ({ page, signIn }) => {
    await signIn("operator");
    await page.route("**/api/admin/meme-studio", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "ai", provider: "bedrock", concepts: [CONCEPT, { ...CONCEPT, headline: "B7 화면 자체 둘째" }] }) }),
    );
    await open(page, "/admin/memes/new");
    const generate = page.getByRole("button", { name: "자체 밈 초안 3개 만들기" });
    await expect(generate).toBeDisabled();
    await page.getByLabel("자체 밈 주제").fill("회의가 일찍 끝난 날");
    await generate.click();
    await expect(page.getByText("AWS Bedrock 초안")).toBeVisible();
    await page.getByRole("button", { name: "“B7 화면 자체 초안” 초안 사용" }).click();
    await expect(page.getByLabel("제목")).toHaveValue("B7 화면 자체 초안");
    await expect(page.getByRole("button", { name: "“B7 화면 자체 초안” 초안 사용" })).toHaveText("아래 항목에 적용됨");
    await page.getByLabel("자체 밈 주제").fill("다른 주제");
    await expect(page.getByText("AWS Bedrock 초안")).toHaveCount(0);
    await page.getByRole("button", { name: "자체 밈 초안 3개 만들기" }).click();
    await page.getByRole("button", { name: "“B7 화면 자체 둘째” 대기로 바로 저장" }).click();
    await page.waitForURL((url) => /^\/admin\/memes\/[0-9a-f-]{36}$/.test(url.pathname));
    expect(databaseSql(`select p.market_code || '|' || p.local_title from memes m join meme_market_profiles p on p.meme_id = m.id where m.title = 'B7 화면 자체 둘째'`)).toBe("JP|下書き");
  });

  test("a failed draft request says so", async ({ page, signIn }) => {
    await signIn("operator");
    await page.route("**/api/admin/meme-studio", (route) => route.fulfill({ status: 429, contentType: "application/json", body: '{"error":"rate"}' }));
    await open(page, "/admin/memes/new");
    await page.getByLabel("자체 밈 주제").fill("회의");
    await page.getByRole("button", { name: "자체 밈 초안 3개 만들기" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  });
});
