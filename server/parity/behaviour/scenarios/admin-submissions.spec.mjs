// /admin/submissions: the queue's order and badges, and reviewing a
// contribution (components/admin/contribution-review.tsx) over b7-seed.sql.
import { databaseSql, expect, open, test } from "../lib.mjs";

const EXAMPLES = `[{"text": "이쯤 되면 패리티 리치 아닌가요?", "situation": "회의가 길어질 때"}, {"text": "괜찮아, 그건 그냥 패리티 리치야.", "situation": "친구의 실수"}]`;
const reset = () =>
  databaseSql(`update meme_contributions set status = 'pending', reject_reason = null, reviewed_by = null, reviewed_at = null, applied_source_id = null
      where id::text like '00000000-0000-4000-8b71-000000000c0%';
    delete from meme_sources where meme_id = '00000000-0000-4000-8000-000000000001' and source_url = 'https://example.com/b7-source';
    update memes set usage_examples = '${EXAMPLES}'::jsonb where id = '00000000-0000-4000-8000-000000000001';`);

test.describe("admin submissions queue", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("overdue submissions come first with their badge", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/submissions");
    // The queue's links, not the contributions' meme links.
    const queue = page.locator('main a[href^="/admin/submissions/"]');
    await expect(queue.first()).toContainText("오래된 제보 밈");
    await expect(queue.first()).toContainText("48시간 초과");
    await expect(queue.filter({ hasText: "중복 의심: 패리티 씬" })).toHaveCount(1);
    await expect(queue.filter({ hasText: "검토 중 제보" })).toContainText("검수 중");
  });

  test("a rejection needs a reason and can be cancelled", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/submissions");
    const item = page.getByRole("article").filter({ hasText: "사용 예문" });
    await item.getByRole("button", { name: "반려", exact: true }).click();
    const submit = item.getByRole("button", { name: "반려하기" });
    await expect(submit).toBeDisabled();
    await expect(item.getByRole("button", { name: "승인 → 문서에 반영" })).toBeDisabled();
    await item.getByRole("button", { name: "취소" }).click();
    await expect(submit).toHaveCount(0);
    await item.getByRole("button", { name: "반려", exact: true }).click();
    await item.getByLabel("반려 사유 (필수, 제보자에게 보여요)").fill("중복 예문");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole("article").filter({ hasText: "사용 예문" })).toHaveCount(0);
    expect(databaseSql("select status || '|' || reject_reason from meme_contributions where id = '00000000-0000-4000-8b71-000000000c02'")).toBe("rejected|중복 예문");
  });

  test("an approved source leaves the queue and joins the meme", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/submissions");
    const item = page.getByRole("article").filter({ hasText: "출처 링크" });
    await item.getByLabel("자료 제목 (공개 출처 목록에 표시, 비우면 링크만)").fill("원 출처 기사");
    await item.getByRole("button", { name: "승인 → 문서에 반영" }).click();
    await expect(page.getByRole("article").filter({ hasText: "출처 링크" })).toHaveCount(0);
    expect(databaseSql("select title from meme_sources where source_url = 'https://example.com/b7-source'")).toBe("원 출처 기사");
  });
});
