// /admin/memes/catalog/new: CatalogRegistrationForm
// (components/admin/catalog-registration-form.tsx): the duplicate check,
// adding and removing a source, a refused registration and one that lands
// on the new meme.
import { databaseSql, expect, open, test } from "../lib.mjs";

const TITLE = "'B7 화면 카탈로그%'";
const reset = () =>
  databaseSql(`delete from admin_audit_log where action like 'catalog%' and detail->>'title' like ${TITLE};
    delete from meme_claims where meme_id in (select id from memes where title like ${TITLE});
    delete from meme_media where meme_id in (select id from memes where title like ${TITLE});
    delete from meme_tags_map where meme_id in (select id from memes where title like ${TITLE});
    delete from memes where title like ${TITLE};
    delete from media_sources where canonical_url in ('https://b7-screen.example.org/first', 'https://b7-screen.example.org/second');`);

async function fill(page, title) {
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByLabel("한 줄 요약").fill("화면에서 등록한 외부 밈의 뜻");
  await page.getByLabel("설명", { exact: true }).fill("설명이에요");
  await page.getByLabel("기원·확산 설명").fill("유래예요");
  await page.getByLabel("태그 (쉼표로 구분)").fill("b7, 화면");
  await page.getByLabel("원문 출처 URL").fill("https://b7-screen.example.org/first");
  await page.getByLabel("검증 출처 URL").fill("https://b7-screen.example.org/second");
}

test.describe("admin catalog registration", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("the duplicate check names an existing meme and blocks the registration", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/memes/catalog/new");
    await fill(page, "패리티 리치");
    await page.getByRole("button", { name: "중복 검사" }).click();
    await expect(page.getByRole("status")).toHaveText("기존 항목과 겹칠 가능성이 있어요. 기존 밈을 확인한 뒤 등록 여부를 다시 판단해 주세요.");
    await expect(page.getByRole("list", { name: "중복 후보" }).getByRole("link", { name: "패리티 리치" })).toBeVisible();
    await expect(page.getByRole("button", { name: "대기 상태로 등록" })).toBeDisabled();
    await page.getByLabel("제목", { exact: true }).fill("B7 화면 카탈로그 새 밈");
    await expect(page.getByRole("list", { name: "중복 후보" })).toHaveCount(0);
    await page.getByRole("button", { name: "중복 검사" }).click();
    await expect(page.getByRole("status")).toHaveText("중복 후보가 없어요. 이제 대기 상태로 등록할 수 있어요.");
  });

  test("a source is added and removed", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/memes/catalog/new");
    await page.getByRole("button", { name: "출처 추가 (2/8)" }).click();
    await expect(page.getByRole("group", { name: "추가 출처 1" })).toBeVisible();
    await page.getByRole("button", { name: "출처 추가 (3/8)" }).click();
    await expect(page.getByRole("group", { name: "추가 출처 2" })).toBeVisible();
    await page.getByRole("group", { name: "추가 출처 1" }).getByRole("button", { name: "이 출처 제거" }).click();
    await expect(page.getByRole("group", { name: "추가 출처 2" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "출처 추가 (3/8)" })).toBeVisible();
  });

  test("a registration the validation refuses, then one that lands on the meme", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/memes/catalog/new");
    await fill(page, "B7 화면 카탈로그 밈");
    await page.getByLabel("한 줄 요약").fill("B7 화면 카탈로그 밈!");
    await page.getByRole("button", { name: "대기 상태로 등록" }).click();
    await expect(page.getByRole("status")).toHaveText("등록 내용을 확인해 주세요.");
    await page.getByLabel("한 줄 요약").fill("화면에서 등록한 외부 밈의 뜻");
    await page.getByRole("button", { name: "대기 상태로 등록" }).click();
    await page.waitForURL((url) => /^\/admin\/memes\/[0-9a-f-]{36}$/.test(url.pathname));
    expect(databaseSql(`select moderation_status || '|' || origin_kind from memes where title = 'B7 화면 카탈로그 밈'`)).toBe("pending|catalog");
  });
});
