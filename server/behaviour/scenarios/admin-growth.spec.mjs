// /admin/growth: the English pilot slot form and the interview ledger, each
// a form action that redirects back with a message. Needs b7-seed.sql (the
// text[] overload that lets Next's page render, PLAN B7-3).
import { databaseSql, expect, open, test } from "../lib.mjs";

const SLOT = 9;
const MARKER = "behaviour-growth";

test.describe("admin growth", () => {
  test.beforeEach(() => {
    databaseSql(`set session_replication_role = replica;
      update growth_english_pilot_landings set meme_id = null, status = 'open', operator_note = '', assigned_by = null, published_at = null where slot = ${SLOT};
      delete from growth_pilot_interviews where participant_reference like '${MARKER}%';`);
  });

  test("a slot saves its note and says so", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/growth");
    await expect(page.getByRole("heading", { name: "성장 운영", level: 1 })).toBeVisible();
    const form = page.locator("form").filter({ has: page.getByRole("heading", { name: `슬롯 ${SLOT}`, exact: true }) });
    await form.getByLabel("운영 메모").fill("  first look  ");
    await form.getByRole("button", { name: "슬롯 저장" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("saved") === `${SLOT}번 슬롯을 저장했어요.`);
    await expect(page.getByRole("status").filter({ hasText: `${SLOT}번 슬롯을 저장했어요.` })).toBeVisible();
    await expect(form.getByLabel("운영 메모")).toHaveValue("first look");
    expect(databaseSql(`select operator_note from growth_english_pilot_landings where slot = ${SLOT}`)).toBe("first look");
  });

  test("a slot set to ready without a landing is refused", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/growth");
    const form = page.locator("form").filter({ has: page.getByRole("heading", { name: `슬롯 ${SLOT}`, exact: true }) });
    await form.getByLabel("상태").selectOption("ready");
    await form.getByRole("button", { name: "슬롯 저장" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("error") === "배정할 영문 랜딩을 선택해 주세요.");
    await expect(page.getByRole("main").getByRole("alert").filter({ hasText: "배정할 영문 랜딩을 선택해 주세요." })).toBeVisible();
    expect(databaseSql(`select status from growth_english_pilot_landings where slot = ${SLOT}`)).toBe("open");
  });

  test("an interview is recorded and listed", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/growth");
    await page.getByLabel("참가자 참조값").fill(`${MARKER}-1`);
    await page.getByLabel("인터뷰 시각").fill("2026-01-02T03:04");
    await page.getByLabel("시장").fill("United States");
    await page.getByLabel("사용자군").fill("K-content creator");
    await page.getByLabel("확인한 내용").fill("They look a meme up before sharing a clip.");
    await page.getByRole("button", { name: "실제 인터뷰 기록" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("saved") === "실제 인터뷰 기록을 저장했어요.");
    const entry = page.getByRole("listitem").filter({ hasText: `${MARKER}-1` });
    await expect(entry).toContainText("United States · K-content creator");
    // The field's time is read in the server's zone (UTC) and shown in KST.
    await expect(entry.locator("time")).toHaveText("2026. 1. 2. 오후 12:04");
    expect(databaseSql(`select count(*) from growth_pilot_interviews where participant_reference = '${MARKER}-1'`)).toBe("1");
  });
});
