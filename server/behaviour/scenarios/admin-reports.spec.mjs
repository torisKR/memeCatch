// /admin/reports: hiding a reported comment and resolving a report
// (components/admin/report-actions.tsx) over the reports of b7-seed.sql.
import { databaseSql, expect, open, postsAction, requestsDuring, test } from "../lib.mjs";

const reset = () =>
  databaseSql(`update reports set status = 'open', handled_by = null where id::text like '00000000-0000-4000-8b71-0000000001%';
    update discussions set status = 'visible' where id = '00000000-0000-4000-8b71-000000000d01';
    update discussions set status = 'hidden' where id = '00000000-0000-4000-8b71-000000000d02';`);

test.describe("admin reports", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("hiding a comment shows it hidden and offers to show it again", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/reports");
    const item = page.getByRole("main").getByRole("listitem").filter({ hasText: "신고된 댓글입니다" });
    await expect(item).toContainText("현재 상태: 공개");
    const sent = await requestsDuring(page, async () => {
      await item.getByRole("button", { name: "댓글 숨기기" }).click();
      await expect(item).toContainText("현재 상태: 숨김");
    });
    expect(postsAction(sent, "discussion-visibility")).toBe(true);
    await expect(item.getByRole("button", { name: "댓글 숨김 해제" })).toBeVisible();
  });

  test("a resolved report leaves the list", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/reports");
    const items = page.getByRole("main").getByRole("listitem");
    const before = await items.count();
    await items.filter({ hasText: "스팸 제보" }).getByRole("button", { name: "처리 완료 (resolve)" }).click();
    await expect(items).toHaveCount(before - 1);
    await expect(page.getByText("스팸 제보")).toHaveCount(0);
    expect(databaseSql("select status from reports where id = '00000000-0000-4000-8b71-000000000104'")).toBe("resolved");
  });

  test("a missing target says so", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/reports");
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "없는 대상" })).toContainText("대상을 찾을 수 없어요 (삭제됐을 수 있어요).");
  });
});
