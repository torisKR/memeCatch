// /admin/memes/{id}: the status moves (a plain one, the confirmed approval and
// limitation, a house original's attested publication), the origin country,
// the translation panel, the edit form with GPT's Korean draft (OpenAI stub)
// and the dictionary card of a house original, over b7-seed.sql.
import { TRANSLATION_STATE, databaseSql, expect, open, test } from "../lib.mjs";

const ONE = "00000000-0000-4000-8b71-000000000401";
const HIDDEN = "00000000-0000-4000-8b71-000000000404";
const HOUSE = "00000000-0000-4000-8b71-000000000405";
const reset = () => databaseSql(`set session_replication_role = replica;\n${TRANSLATION_STATE}`);
const status = (id) => databaseSql(`select moderation_status from memes where id = '${id}'`);
const main = (page) => page.getByRole("main");

test.describe("admin meme editor", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("a pending meme moves to fact checking", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/memes/${HIDDEN}`);
    await main(page).getByRole("button", { name: "사실 확인 시작" }).click();
    await expect(main(page).getByRole("button", { name: "저작권 확인으로" })).toBeVisible();
    expect(status(HIDDEN)).toBe("fact_checking");
  });

  test("a catalog approval and a limitation ask first", async ({ page, signIn }) => {
    await signIn("operator");
    databaseSql(`set session_replication_role = replica; update memes set moderation_status = 'rights_checking' where id = '${HIDDEN}';`);
    await open(page, `/admin/memes/${HIDDEN}`);
    await main(page).getByRole("button", { name: "게시 승인" }).click();
    await expect(main(page).getByRole("button", { name: "확인하고 게시" })).toBeVisible();
    await main(page).getByRole("button", { name: "취소" }).click();
    await expect(main(page).getByRole("button", { name: "확인하고 게시" })).toHaveCount(0);
    await main(page).getByRole("button", { name: "게시 승인" }).click();
    await main(page).getByRole("button", { name: "확인하고 게시" }).click();
    await expect(main(page).getByRole("button", { name: "노출 중단 (제한 공개)" })).toBeVisible();
    expect(status(HIDDEN)).toBe("approved");
    await main(page).getByRole("button", { name: "노출 중단 (제한 공개)" }).click();
    await main(page).getByRole("button", { name: "제한 공개로 전환" }).last().click();
    await expect(main(page).getByRole("button", { name: "게시 승인" })).toBeVisible();
    expect(status(HIDDEN)).toBe("limited");
  });

  test("a house original is published only with the attestation", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/memes/${HOUSE}`);
    await main(page).getByRole("button", { name: "수동 게시" }).click();
    await expect(main(page).getByRole("alert").first()).toHaveText("자체 제작 권리 확인에 동의해 주세요.");
    expect(status(HOUSE)).toBe("rights_checking");
    await main(page).getByRole("checkbox", { name: /밈캐치가 만들고 권리를 보유한/ }).check();
    await main(page).getByRole("button", { name: "수동 게시" }).click();
    await expect(main(page).getByText("게시됨")).toBeVisible();
    expect(status(HOUSE)).toBe("approved");
  });

  test("the origin country is saved and listed", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/memes/${ONE}`);
    await main(page).getByLabel("국가").selectOption("JP");
    await main(page).getByLabel("현지 제목").fill("B7 ミーム");
    await main(page).getByRole("button", { name: "출처 국가 검수 저장" }).click();
    await expect(main(page).getByText("출처 국가 검수를 저장했어요.")).toBeVisible();
    await expect(main(page).getByRole("list", { name: "현재 출처 국가 프로필" })).toContainText("일본 · B7 ミーム · reviewed");
  });

  test("a translation is saved, then published; a stale one cannot be marked again", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/memes/${ONE}`);
    await expect(main(page).getByRole("button", { name: "[ja] stale로 되돌리기" })).toBeDisabled();
    await main(page).getByLabel("[en] 제목").fill("B7 translation one, saved");
    await main(page).getByRole("button", { name: "[en] 초안 저장" }).click();
    await expect(main(page).getByText("English 번역을 저장했어요. 다시 검수해 주세요.")).toBeVisible();
    await main(page).getByRole("button", { name: "[en] 검수 완료·발행" }).click();
    await expect(main(page).getByText("English 번역을 검수 완료하고 발행했어요.")).toBeVisible();
    expect(databaseSql(`select status || '|' || title from meme_translations where meme_id = '${ONE}' and locale = 'en'`)).toBe("reviewed|B7 translation one, saved");
  });

  test("the edit form checks the year, saves, queues a safety change and takes GPT's draft", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/memes/${ONE}`);
    const form = main(page).locator("form").filter({ hasText: "밈 정보 편집" });
    await form.getByLabel("유행 시작 연도").fill("1970");
    await form.getByRole("button", { name: "저장" }).click();
    await expect(form.getByRole("status")).toHaveText("연도는 1980~2100 사이 숫자로 입력해 주세요.");
    await form.getByLabel("유행 시작 연도").fill("2021");
    await form.getByLabel("사용 안전 신호등").selectOption("red");
    await form.getByRole("button", { name: "저장" }).click();
    await expect(main(page).getByText("내용을 저장하고 안전 등급 변경은 Radar 검수 대기열에 추가했어요.")).toBeVisible();
    expect(databaseSql(`select proposed_level from safety_review_queue where meme_id = '${ONE}' and status = 'pending'`)).toBe("red");
    await main(page).locator("form").filter({ hasText: "밈 정보 편집" }).getByRole("button", { name: "GPT-5.6 Sol high로 검수 초안" }).click();
    await expect(main(page).getByText("한국어 검수 초안을 채웠어요. 사실관계와 고유명사를 확인한 뒤 저장해 주세요.")).toBeVisible();
    await expect(main(page).locator("form").filter({ hasText: "밈 정보 편집" }).getByLabel("한 줄 요약")).toHaveValue("스텁 요약");
  });

  test("a house original's dictionary card renders once the rights and URL are right", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/memes/${HOUSE}`);
    const studio = main(page).locator("section").filter({ hasText: "내 콘텐츠 출력" });
    await expect(studio.getByRole("alert")).toHaveText("https로 시작하는 올바른 주소를 입력해 주세요.");
    await expect(studio.getByRole("button", { name: "사전 카드 렌더" })).toBeDisabled();
    await studio.getByLabel("상세 URL").fill("https://catchmeme.com/memes/pgb7ho05-b7-house-five");
    await expect(studio.getByRole("alert")).toHaveCount(0);
    await expect(studio.getByRole("button", { name: "사전 카드 렌더" })).toBeDisabled();
    await studio.getByRole("checkbox").check();
    await expect(studio.getByText("렌더와 다운로드 전에 권리 확인이 필요합니다.")).toHaveCount(0);
    await studio.getByRole("button", { name: "사전 카드 렌더" }).click();
    await expect(studio.getByRole("button", { name: "PNG 내려받기" })).toBeEnabled();
  });
});
