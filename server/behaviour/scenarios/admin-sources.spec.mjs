// /admin/sources: reviewing a candidate (components/admin/source-review-card.tsx)
// over b7-seed.sql. The player preview and the SNS intake are not driven:
// both reach the platforms.
import { databaseSql, expect, open, test } from "../lib.mjs";

const reset = () =>
  databaseSql(`update meme_media set review_state = 'pending', reviewer_note = null, reviewed_at = null, source_role = 'usage_example', rights_basis = 'unknown'
      where source_id::text like '00000000-0000-4000-8b71-0000000003%';
    delete from meme_sources where source_url in ('https://www.youtube.com/watch?v=b7embed0001', 'https://www.tiktok.com/@b7/video/1');
    delete from meme_contents where content_id = 'b7embed0001';`);

test.describe("admin sources", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("a rejection without a note says why, an approval takes the candidate off the queue", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/sources");
    const card = page.getByRole("main").getByRole("listitem").filter({ hasText: "공식 영상" });
    await expect(card.getByRole("button", { name: "YouTube 영상 재생" })).toBeEnabled();
    await card.getByRole("button", { name: "반려" }).click();
    await expect(card.getByText("반려 사유를 입력해 주세요.")).toBeVisible();
    await card.getByRole("combobox").first().selectOption("earliest_known");
    await card.getByRole("button", { name: "승인" }).click();
    // The action re-renders the queue without it.
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "공식 영상" })).toHaveCount(0);
    expect(databaseSql("select review_state || '|' || source_role from meme_media where source_id = '00000000-0000-4000-8b71-000000000301'")).toBe("approved|earliest_known");
  });

  test("a link that cannot be embedded has no player and refuses an embed", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/sources");
    const card = page.getByRole("main").getByRole("listitem").filter({ hasText: "tiktok.com/@b7" });
    await expect(card.getByRole("button", { name: "임베드 미리보기를 사용할 수 없어요" })).toBeDisabled();
    await card.getByRole("button", { name: "승인" }).click();
    await expect(card.getByText("임베드가 불가한 출처예요. 링크만 허용으로 승인해 주세요.")).toBeVisible();
  });
});
