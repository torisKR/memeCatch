// /support (batch B6): sending an inquiry and the list. Next calls the
// createInquiry server action; the native page posts to
// POST /api/support/inquiry. The rows must be the same.
import { databaseSql, expect, open, requestsDuring, sqlText, test } from "../lib.mjs";

const rows = (userId) => databaseSql(`select count(*) || '|' || coalesce(string_agg(category || ':' || subject || ':' || body || ':' || status, ',' order by created_at), '')
  from public.support_inquiries where user_id = ${sqlText(userId)}`);

test("signed out: no form, a sign-in link", async ({ page }) => {
  await open(page, "/support");
  await expect(page.getByRole("link", { name: "로그인하고 문의하기" })).toHaveAttribute("href", "/login?next=/support");
  await expect(page.getByLabel("제목")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "내 문의 내역" })).toHaveCount(0);
});

for (const role of ["user", "operator"]) {
  test(`as ${role}: an inquiry is checked, sent, listed, and the form empties`, async ({ page, signIn }) => {
    const session = await signIn(role);
    await open(page, "/support");
    // An operator reads every inquiry (row-level security), a user only theirs.
    if (role === "user") await expect(page.getByText("아직 보낸 문의가 없어요.")).toBeVisible();
    const subject = `정정 요청 ${session.nickname}`;
    const send = page.getByRole("button", { name: "문의 보내기" });

    // The browser stops an empty subject and a body under ten characters.
    const blocked = await requestsDuring(page, async () => {
      await send.click();
      await page.getByLabel("제목").fill("제목");
      await page.getByLabel("내용").fill("짧아요");
      await send.click();
    });
    expect(blocked.filter((request) => request.method === "POST")).toEqual([]);
    expect(rows(session.userId)).toBe("0|");

    await page.getByLabel("문의 유형").selectOption("content");
    await page.getByLabel("제목").fill(`  ${subject} `);
    await page.getByLabel("내용").fill(" 이 밈의 유래가 틀렸어요. 확인 부탁드려요. ");
    await expect(page.getByText("26/2,000")).toBeVisible();
    const sent = await requestsDuring(page, async () => {
      await send.click();
      await expect(page.getByRole("status").filter({ hasText: "문의를 접수했어요." })).toBeVisible();
    });
    const sends = sent.filter((request) => request.method === "POST" && ["/api/support/inquiry"].includes(request.path));
    expect(sends).toHaveLength(1);
    expect(sends[0].body).toEqual({ category: "content", subject: `  ${subject} `, body: " 이 밈의 유래가 틀렸어요. 확인 부탁드려요. " });
    await expect(page.getByLabel("제목")).toHaveValue("");
    await expect(page.getByLabel("내용")).toHaveValue("");
    await expect(page.getByText("0/2,000")).toBeVisible();
    const list = page.locator("section").filter({ has: page.getByRole("heading", { name: "내 문의 내역" }) });
    const item = list.getByRole("listitem").filter({ has: page.getByRole("heading", { name: subject }) });
    await expect(item).toHaveCount(1);
    await expect(list.getByRole("listitem").first()).toContainText(subject);
    await expect(item.getByText("콘텐츠 문의(정정·삭제 요청)")).toBeVisible();
    await expect(item.getByText("접수됨")).toBeVisible();
    expect(rows(session.userId)).toBe(`1|content:${subject}:이 밈의 유래가 틀렸어요. 확인 부탁드려요.:open`);
  });
}

test("the daily limit: the eleventh inquiry is refused with the action's message", async ({ page, signIn }) => {
  const session = await signIn("user");
  databaseSql(`insert into public.support_inquiries (user_id, category, subject, body)
    select ${sqlText(session.userId)}, 'bug', '제목 ' || n, '내용은 열 글자를 넘어요' from generate_series(1, 10) n`);
  await open(page, "/support");
  await page.getByLabel("제목").fill("열한 번째");
  await page.getByLabel("내용").fill("내용은 열 글자를 넘어요");
  await page.getByRole("button", { name: "문의 보내기" }).click();
  await expect(page.getByRole("status").filter({ hasText: "하루에 보낼 수 있는 문의 수를 넘었어요. 내일 다시 시도해 주세요." })).toBeVisible();
  await expect(page.getByLabel("제목")).toHaveValue("열한 번째");
  expect(rows(session.userId)).toMatch(/^10\|/);
});

test("the inquiry endpoint: signed out and from another origin", async ({ page }) => {
  await open(page, "/support");
  const origin = new URL(page.url()).origin;
  const input = { category: "bug", subject: "제목", body: "내용은 열 글자를 넘어요" };
  const anonymous = await page.request.post("/api/support/inquiry", { data: input, headers: { origin } });
  expect(await anonymous.json()).toEqual({ ok: false, error: "login_required", message: "로그인이 필요해요. 쓰던 내용은 저장해 둘게요." });
  const foreign = await page.request.post("/api/support/inquiry", { data: input, headers: { origin: "https://evil.example" } });
  expect(foreign.status()).toBe(403);
});
