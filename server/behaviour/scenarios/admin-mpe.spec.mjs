// /admin/mpe and /admin/mpe/{id}: MpeUploadForm and MpeReviewConsole
// (components/admin/mpe-upload-form.tsx, mpe-review-console.tsx) over the
// candidates of seeds/b7-seed.sql (621 at the fact stage, 622 at
// publish, 623 at rights), put back before each scenario.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { databaseSql, expect, open, test } from "../lib.mjs";

const P = "00000000-0000-4000-8b71-0000000006";
const seed = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../seeds/b7-seed.sql"), "utf8");
const reset = () => databaseSql(seed.slice(seed.indexOf("-- b7-mpe:start"), seed.indexOf("-- b7-mpe:end")));

test.describe("admin mpe", () => {
  test.beforeEach(reset);
  test.afterAll(reset);

  test("a claim's approval opens the fact approval, which moves on with the memo kept", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/mpe/${P}21`);
    const approve = page.getByRole("button", { name: "사실 검수 승인" });
    await expect(approve).toBeDisabled();
    await page.getByRole("button", { name: "근거 승인" }).click();
    await expect(page.getByRole("status").filter({ hasText: "주장 근거를" })).toHaveText("주장 근거를 승인했어요.");
    await expect(page.getByText("ORIGIN · APPROVED · 62%")).toBeVisible();
    await expect(approve).toBeEnabled();
    await page.getByLabel("검수 메모").fill("  근거 충분  ");
    await approve.click();
    await expect(page.getByRole("status").filter({ hasText: "검수 결정을" })).toHaveText("검수 결정을 반영했어요.");
    await expect(page.getByText("VIDEO_SCENE · 권리 검수")).toBeVisible();
    await expect(page.getByLabel("검수 메모")).toHaveValue("  근거 충분  ");
    expect(databaseSql(`select review_status from meme_candidates where id = '${P}21'`)).toBe("RIGHTS_CHECKING");
  });

  test("a draft that is not JSON is refused before saving, then a revision is saved", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/mpe/${P}21`);
    const draft = page.getByLabel("편집 초안 JSON");
    await draft.fill("{ title: ");
    await page.getByRole("button", { name: "수정 이력 저장" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "초안" })).toHaveText("초안 JSON 형식을 확인해 주세요.");
    await draft.fill('{"title": "화면에서 고친 초안"}');
    await page.getByRole("button", { name: "수정 이력 저장" }).click();
    await expect(page.getByRole("status").filter({ hasText: "초안 이력" })).toHaveText("수정 전·후 초안 이력을 저장했어요.");
    await expect(page.getByText(/^revision 2 · /)).toBeVisible();
    await expect(draft).toHaveValue('{"title": "화면에서 고친 초안"}');
  });

  test("source rights: both are required, and approvable rights open the rights approval", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/mpe/${P}22`);
    await expect(page.getByRole("button", { name: "공개", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "제한 공개" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "수정 요청" })).toHaveCount(0);
    await page.getByRole("button", { name: "출처·권리 저장" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "출처 역할" })).toHaveText("출처 역할과 권리 근거를 모두 선택해 주세요.");

    await open(page, `/admin/mpe/${P}23`);
    const approve = page.getByRole("button", { name: "권리 검수 승인" });
    await expect(approve).toBeDisabled();
    await expect(page.getByLabel("출처 역할")).toHaveValue("original");
    await page.getByLabel("권리 근거").selectOption("creator_permission");
    await page.getByRole("button", { name: "출처·권리 저장" }).click();
    await expect(page.getByRole("status").filter({ hasText: "출처 역할" })).toHaveText("출처 역할과 권리 근거를 저장했어요.");
    await expect(page.getByLabel("권리 근거")).toHaveValue("creator_permission");
    await expect(approve).toBeEnabled();
  });

  test("a failed job is reprocessed", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, `/admin/mpe/${P}21`);
    await page.getByRole("listitem").filter({ hasText: "ocr · failed" }).getByRole("button", { name: "재처리" }).click();
    await expect(page.getByRole("status").filter({ hasText: "재처리" })).toHaveText("재처리를 등록하고 기존 근거 승인과 검수 단계를 초기화했어요.");
    expect(databaseSql(`select status from processing_jobs where id = '${P}32'`)).toBe("queued");
  });

  test("the upload form checks the file and the rights, then creates a candidate from the answer", async ({ page, signIn }) => {
    await signIn("operator");
    await open(page, "/admin/mpe");
    const main = page.getByRole("main");
    const submit = page.getByRole("button", { name: "분석 작업 접수" });
    await submit.click();
    await expect(main.getByRole("alert")).toHaveText("업로드할 파일을 선택해 주세요.");
    await page.getByLabel("미디어 파일").setInputFiles({ name: "frame.png", mimeType: "image/png", buffer: Buffer.from("png") });
    await submit.click();
    await expect(main.getByRole("alert")).toHaveText("직접 제작했거나 분석 권한이 있는 파일인지 확인해 주세요.");

    await page.route("**/api/mpe/uploads", (route) =>
      route.fulfill({ json: { ok: true, data: { ingestionId: `${P}11`, jobIds: ["a", "b"], status: "queued" } } }),
    );
    let created = null;
    await page.route("**/api/admin/mpe-candidates", (route) => {
      created = route.request().postDataJSON();
      return route.fulfill({ status: 409, json: { ok: false, error: "processing_jobs_not_terminal" } });
    });
    await page.getByLabel("이 파일을 직접 제작했거나").check();
    await submit.click();
    await expect(main.getByRole("status")).toContainText(`ingestion: ${P}11`);
    await expect(main.getByRole("status")).toContainText("jobs: a, b");
    await expect(main.getByRole("alert")).toHaveCount(0);
    const create = page.getByRole("button", { name: "분석 완료 후 후보 생성" });
    await create.click();
    await expect(main.getByRole("alert")).toHaveText("후보 제목을 입력해 주세요.");
    await page.getByLabel("후보 제목").fill("  화면 후보  ");
    await page.getByLabel("밈 유형").selectOption("SOUND");
    await create.click();
    await expect(main.getByRole("alert")).toHaveText("분석 작업이 아직 끝나지 않았어요. 잠시 후 다시 시도해 주세요.");
    expect(created).toEqual({ action: "create", ingestionId: `${P}11`, title: "화면 후보", memeType: "SOUND" });
  });
});
