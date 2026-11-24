// /admin/radar-safety: the pending proposals of b7-seed.sql and the review
// form under each (app/(default)/admin/radar-safety/review-form.tsx).
import { databaseSql, expect, open, requestsDuring, postsAction, test } from "../lib.mjs";

const FIRST = "00000000-0000-4000-8b70-000000000001";
const SECOND = "00000000-0000-4000-8b70-000000000002";

const reset = () =>
  databaseSql(`set session_replication_role = replica;
    update safety_review_queue set status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null
      where id::text like '00000000-0000-4000-8b70-%';
    update memes set safety_level = 'green' where id = '00000000-0000-4000-8000-000000000001';
    update memes set safety_level = 'yellow' where id = '00000000-0000-4000-8000-000000000002';`);

test.describe("admin radar safety", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("the queue shows each proposal with its evidence", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/radar-safety");
    const items = page.getByRole("main").getByRole("listitem");
    await expect(items).toHaveCount(3);
    await expect(items.first().getByRole("heading", { level: 2 })).toHaveText("패리티 리치");
    await expect(items.first()).toContainText("현재 안전 → 제안 주의");
    await expect(items.first().locator("pre")).toHaveText(/^\{\n {2}"2": "two",\n {2}"note": null,\n {2}"signals": \[\n {4}1,/);
    await expect(items.first().locator("time")).toHaveText("2026. 11. 20. 오전 10:02");
  });

  test("a rejection takes the proposal off the queue", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/radar-safety");
    const item = page.getByRole("main").getByRole("listitem").filter({ hasText: "패리티 리치" });
    await item.getByLabel("검수 메모").fill("근거가 약해요");
    const sent = await requestsDuring(page, async () => {
      await item.getByRole("button", { name: "제안 반려" }).click();
      await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(2);
    });
    expect(postsAction(sent, "radar-review")).toBe(true);
    expect(databaseSql(`select status || '|' || review_note from safety_review_queue where id = '${FIRST}'`)).toBe("rejected|근거가 약해요");
  });

  test("a proposal decided elsewhere says so and clears the note", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/radar-safety");
    databaseSql(`set session_replication_role = replica;
      update safety_review_queue set status = 'approved', reviewed_at = now(), review_note = 'elsewhere',
        reviewed_by = (select id from profiles where role = 'operator' limit 1) where id = '${SECOND}';`);
    const item = page.getByRole("main").getByRole("listitem").filter({ hasText: "부정 맥락 보도" });
    await item.getByLabel("검수 메모").fill("승인합니다");
    await item.getByRole("button", { name: "등급 변경 승인" }).click();
    await expect(item.getByRole("alert")).toHaveText("이미 처리된 검수 요청이에요.");
    await expect(item.getByLabel("검수 메모")).toHaveValue("");
    await expect(item.getByRole("button", { name: "등급 변경 승인" })).toBeEnabled();
  });
});
