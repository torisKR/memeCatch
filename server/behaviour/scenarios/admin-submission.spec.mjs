// /admin/submissions/{id}: claim, the GPT draft (against the OpenAI stub,
// openai-stub.mjs), the reject form's checks and an approval
// (components/admin/submission-review.tsx), over b7-seed.sql.
import { databaseSql, expect, open, postsAction, requestsDuring, test } from "../lib.mjs";

const PENDING = "00000000-0000-4000-8b71-000000000501";
const reset = () =>
  databaseSql(`update meme_submissions set status = 'pending', claimed_by = null, reject_reason = null, name = '오래된 제보 밈' where id = '${PENDING}';
    delete from meme_tags_map where meme_id in (select id from memes where title like 'B7 화면%');
    delete from meme_sources where meme_id in (select id from memes where title like 'B7 화면%');
    delete from memes where title like 'B7 화면%';`);

test.describe("admin submission review", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("claiming marks it as under review", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/submissions/${PENDING}`);
    const sent = await requestsDuring(page, async () => {
      await page.getByRole("button", { name: "내가 검토하기 (claim)" }).click();
      await expect(page.getByRole("button", { name: "내가 검토하기 (claim)" })).toHaveCount(0);
    });
    expect(postsAction(sent, "submission-claim")).toBe(true);
    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("검수 중");
  });

  test("the GPT draft fills the approval form", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/submissions/${PENDING}`);
    await page.getByRole("button", { name: "GPT-5.6 Sol high로 검수 초안" }).click();
    await expect(page.getByRole("status")).toHaveText("GPT-5.6 Sol high 검수 초안을 채웠어요. 내용을 검토하고 수정해 주세요.");
    await expect(page.getByLabel("한 줄 요약")).toHaveValue("스텁 요약");
    await expect(page.getByLabel("유래")).toHaveValue("스텁 유래");
    await expect(page.getByLabel("사용 안전 신호등")).toHaveValue("red");
    await expect(page.getByLabel("공개 SNS에서")).toHaveValue("gray");
  });

  test("a rejection needs a category before it is sent", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/submissions/${PENDING}`);
    await page.getByRole("button", { name: "반려", exact: true }).click();
    await page.getByLabel("상세 사유 (필수)").fill("출처가 없어요");
    const sent = await requestsDuring(page, async () => {
      await page.getByRole("button", { name: "반려하기" }).click();
      await expect(page.getByRole("status")).toHaveText("반려 사유 카테고리를 선택해 주세요.");
    });
    expect(postsAction(sent, "submission-reject")).toBe(false);
    await page.getByText("출처 부족", { exact: true }).click();
    await page.getByRole("button", { name: "반려하기" }).click();
    await page.waitForURL((url) => url.pathname === "/admin/submissions");
    expect(databaseSql(`select reject_reason from meme_submissions where id = '${PENDING}'`)).toBe("[출처 부족] 출처가 없어요");
  });

  test("a year outside the range is refused, then the approval publishes", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/submissions/${PENDING}`);
    await page.getByRole("button", { name: "승인 → 밈 생성" }).click();
    await page.getByLabel("제목").fill("B7 화면 승인");
    await page.getByLabel("한 줄 요약").fill("화면에서 승인한 밈");
    await page.getByLabel("유행 시작 연도").fill("1979");
    await page.getByRole("button", { name: "밈 생성 및 게시" }).click();
    await expect(page.getByRole("status")).toHaveText("연도는 1980~2100 사이 숫자로 입력해 주세요.");
    await page.getByLabel("유행 시작 연도").fill("2024");
    await page.getByRole("button", { name: "밈 생성 및 게시" }).click();
    await page.waitForURL((url) => url.pathname === "/admin/submissions");
    expect(databaseSql("select moderation_status || '|' || origin_year from memes where title = 'B7 화면 승인'")).toBe("approved|2024");
  });
});
