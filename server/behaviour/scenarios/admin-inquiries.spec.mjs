// /admin/inquiries: answering and closing an inquiry
// (components/admin/inquiry-actions.tsx) over the inquiries of b7-seed.sql.
import { databaseSql, expect, open, test } from "../lib.mjs";

const reset = () =>
  databaseSql(`update support_inquiries set status = 'open', admin_reply = null, replied_at = null where id = '00000000-0000-4000-8b71-000000000201';
    update support_inquiries set status = 'answered', admin_reply = '고쳤어요' where id = '00000000-0000-4000-8b71-000000000202';
    update support_inquiries set status = 'closed', admin_reply = null where id = '00000000-0000-4000-8b71-000000000203';`);

test.describe("admin inquiries", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("an answer is saved and the inquiry shows as answered", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/inquiries");
    const item = page.getByRole("main").getByRole("listitem").filter({ hasText: "버튼이 안 눌려요" });
    await expect(item).toContainText("접수됨");
    const save = item.getByRole("button", { name: "답변 저장" });
    await expect(save).toBeDisabled();
    await item.getByLabel("답변").fill("   ");
    await expect(save).toBeDisabled();
    await item.getByLabel("답변").fill("다시 확인해 주세요");
    await save.click();
    await expect(item).toContainText("답변 완료");
    await expect(item.getByLabel("답변 (수정 가능)")).toHaveValue("다시 확인해 주세요");
    expect(databaseSql("select status from support_inquiries where id = '00000000-0000-4000-8b71-000000000201'")).toBe("answered");
  });

  test("a closed inquiry can be opened again", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/inquiries");
    const item = page.getByRole("main").getByRole("listitem").filter({ hasText: "기타 문의" });
    await item.getByRole("button", { name: "다시 열기" }).click();
    await expect(item.getByRole("button", { name: "종료" })).toBeVisible();
    await expect(item).toContainText("접수됨");
  });
});
