// /admin/translations: the review queue's cards (approve, reject, delete, the
// GPT review against the OpenAI stub) and the missing-translation preview
// with its draft (components/admin/translation-review.tsx,
// missing-translation-draft-preview.tsx), over the translations of
// b7-seed.sql.
import { TRANSLATION_STATE } from "../../admin-actions/translations.mjs";
import { databaseSql, expect, open, postsAction, requestsDuring, test } from "../lib.mjs";

const ONE = "00000000-0000-4000-8b71-000000000401";
const THREE = "00000000-0000-4000-8b71-000000000403";
const reset = () => databaseSql(`set session_replication_role = replica;\n${TRANSLATION_STATE}`);
const card = (page, prefix) => page.getByRole("article").filter({ has: page.getByLabel(`${prefix} 제목`) });
const translation = (meme, locale, columns) =>
  databaseSql(`select ${columns} from meme_translations where meme_id = '${meme}' and locale = '${locale}'`);

test.describe("admin translations", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("an approval publishes the edited translation and takes it off the queue", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/translations");
    await card(page, "[pgb7tr01/en]").getByLabel("[pgb7tr01/en] 제목").fill("B7 translation one, edited");
    const sent = await requestsDuring(page, async () => {
      await card(page, "[pgb7tr01/en]").getByRole("button", { name: "승인·발행" }).click();
      await expect(card(page, "[pgb7tr01/en]")).toHaveCount(0);
    });
    expect(postsAction(sent, "translation-review")).toBe(true);
    expect(translation(ONE, "en", "status || '|' || title")).toBe("reviewed|B7 translation one, edited");
  });

  test("a translation of an older source cannot be approved", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/translations");
    const older = card(page, "[pgb7tr02/en]");
    await expect(older.getByText("stale — 원문 revision 불일치")).toBeVisible();
    await expect(older.getByRole("button", { name: "승인·발행" })).toBeDisabled();
  });

  test("a rejection needs a reason, then is recorded and the reason cleared", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/translations");
    const one = card(page, "[pgb7tr01/en]");
    await one.getByRole("button", { name: "반려" }).click();
    await expect(one.getByRole("alert")).toHaveText("반려 사유를 입력해 주세요.");
    await one.getByLabel("[pgb7tr01/en] 반려 사유").fill("고유명사가 틀려요");
    await one.getByRole("button", { name: "반려" }).click();
    await expect(one.getByRole("status")).toHaveText("반려 사유를 감사 로그에 기록했어요.");
    await expect(one.getByLabel("[pgb7tr01/en] 반려 사유")).toHaveValue("");
    expect(databaseSql(`select detail->>'reason' from admin_audit_log where action = 'meme_translation.reject' and entity_id = '${ONE}'`)).toBe("고유명사가 틀려요");
  });

  test("a deletion asks again before it removes the row", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/translations?status=");
    const one = card(page, "[pgb7tr01/en]");
    await one.getByRole("button", { name: "삭제" }).click();
    await expect(one.getByRole("button", { name: "정말 삭제할까요? 다시 클릭" })).toBeVisible();
    expect(translation(ONE, "en", "count(*)")).toBe("1");
    await one.getByRole("button", { name: "정말 삭제할까요? 다시 클릭" }).click();
    await expect(card(page, "[pgb7tr01/en]")).toHaveCount(0);
    expect(translation(ONE, "en", "count(*)")).toBe("0");
  });

  test("the GPT review fills the fields and says what it thinks", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/translations");
    const one = card(page, "[pgb7tr01/en]");
    await one.getByRole("button", { name: "GPT-5.6 Sol high 검수" }).click();
    await expect(one.getByRole("status")).toHaveText("GPT 검수 의견: 교정 후 발행 · 신뢰도 medium · Note one · Note two");
    await expect(one.getByLabel("[pgb7tr01/en] 제목")).toHaveValue("Stub title");
    await expect(one.getByLabel("[pgb7tr01/en] 별칭")).toHaveValue("stub, 스텁");
    await expect(one.getByLabel("[pgb7tr01/en] 사용법")).toHaveValue("");
    expect(translation(ONE, "en", "title")).toBe("B7 translation one");
  });

  test("a preview is edited and saved as a machine draft", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/translations?locale=en&focus=${THREE}`);
    const row = page.getByRole("listitem").filter({ hasText: "B7 번역 밈 셋" });
    await expect(row.getByText("요청 우선")).toBeVisible();
    await row.getByRole("button", { name: "B7 번역 밈 셋 GPT-5.6 Sol high 번역 초안 미리보기" }).click();
    await expect(page.getByRole("heading", { name: "B7 번역 밈 셋 번역 초안 미리보기" })).toBeVisible();
    await page.getByLabel("title", { exact: true }).fill("Stub preview, edited");
    await page.getByRole("button", { name: "검수 대기 초안 저장" }).click();
    await expect(page.getByText("machine 초안을 검수 큐에 저장했어요. 공개 발행은 아직 되지 않았습니다.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "B7 번역 밈 셋" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "B7 번역 밈 셋 번역 초안 미리보기" })).toBeVisible();
    expect(translation(THREE, "en", "status || '|' || title || '|' || array_to_string(aliases, ',')")).toBe("machine|Stub preview, edited|preview");
  });

  test("the zh lane moves to the next candidate after a save", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/translations?locale=zh&focus=${THREE}`);
    await expect(page.getByText("ZH ROUTE-UNLOCK OPERATOR LANE")).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: "B7 번역 밈 셋" });
    await expect(row.getByText("현재 후보")).toBeVisible();
    await row.getByRole("button", { name: "B7 번역 밈 셋 GPT-5.6 Sol high 번역 초안 미리보기" }).click();
    await page.getByRole("button", { name: "검수 대기 초안 저장" }).click();
    await expect(page.getByText(/^machine 초안을 저장했어요\. 공개 발행은 아직 되지 않았습니다\. 다음 후보: /)).toBeVisible();
    await expect(page.getByRole("heading", { name: "B7 번역 밈 셋 번역 초안 미리보기" })).toHaveCount(0);
    await expect(page.getByText("현재 후보")).toHaveCount(1);
    expect(translation(THREE, "zh", "status")).toBe("machine");
  });

  test("a page past the last shows the error screen", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/translations?page=999999999");
    await expect(page.getByText("문제가 발생했어요")).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  });
});
