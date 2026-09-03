import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "lib/actions/admin.ts"),
  "utf-8",
);
const sourceReview = readFileSync(
  join(process.cwd(), "lib/actions/admin-sources.ts"),
  "utf-8",
);
const mpeReview = readFileSync(
  join(process.cwd(), "lib/actions/admin-mpe.ts"),
  "utf-8",
);
const userAdmin = readFileSync(
  join(process.cwd(), "lib/actions/admin-users.ts"),
  "utf-8",
);

function section(start: string, end: string) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("canonical meme cache revalidation", () => {
  it("invalidates every public locale index and machine-readable artifact", () => {
    const helper = section(
      "function revalidateCanonicalMemePaths",
      "/* ── 제보 큐",
    );

    expect(helper).toContain('"/sitemap.xml"');
    expect(helper).toContain('"/llms.txt"');
    expect(helper).toContain('"/llms-full.txt"');
    expect(helper).toContain("SEO_CONTENT_LOCALES");
    expect(helper).toContain("paths.add(`/${locale}`)");
    expect(helper).toContain("paths.add(`/${locale}/llms.txt`)");
    expect(helper).toContain("paths.add(`/${locale}/llms-full.txt`)");
  });

  it("invalidates the Korean detail and each determinable localized detail", () => {
    const identityLoader = section(
      "async function loadMemeRevalidationIdentity",
      "/** 한국어 원문/공개 상태",
    );
    const helper = section(
      "function revalidateCanonicalMemePaths",
      "/* ── 제보 큐",
    );

    expect(identityLoader).toContain(
      'meme_translations(locale, localized_slug)',
    );
    expect(helper).toContain("memePathFrom(meme.short_id, meme.slug)");
    expect(helper).toContain("localizedMemePath(");
    expect(helper).toContain("translation.localized_slug");
  });

  it.each([
    ["approveSubmission", "updateMeme"],
    ["updateMeme", "export type KoreanReviewDraft"],
    ["transitionMemeStatus", "/* ── 신고 처리"],
  ])("wires %s into the shared invalidation contract", (action, next) => {
    expect(section(`export async function ${action}`, next)).toContain(
      "revalidateCanonicalMemePaths(",
    );
  });
});

describe("global feed cache revalidation", () => {
  it("invalidates after a source is published, but not after rejection", () => {
    const rejection = sourceReview.slice(
      sourceReview.indexOf('if (input.decision === "reject")'),
      sourceReview.indexOf("// ── 승인"),
    );
    const approval = sourceReview.slice(sourceReview.indexOf("// ── 승인"));

    expect(rejection).not.toContain('revalidatePath("/global")');
    expect(approval).toContain('revalidatePath("/global")');
  });

  it("invalidates only MPE publish decisions that project public content", () => {
    const review = mpeReview.slice(
      mpeReview.indexOf("export async function reviewMpeCandidate"),
      mpeReview.indexOf("export async function saveMpeCandidateRevision"),
    );

    expect(review).toContain('parsed.data.stage === "PUBLISH"');
    expect(review).toContain('["PUBLISHED", "LIMITED"].includes(parsed.data.decision)');
    expect(review).toContain('revalidatePath("/global")');
  });

  it("invalidates after submission approval publishes a meme", () => {
    expect(section("export async function approveSubmission", "/* ── 밈 관리")).toContain(
      'revalidatePath("/global")',
    );
  });

  it("does not walk house originals through fact/rights/approved in one request", () => {
    const create = section("export async function createHouseOriginal", "export async function updateMeme");
    expect(create).toContain('origin_kind: HOUSE_ORIGINAL');
    expect(create).toContain('moderation_status: "pending"');
    expect(create).not.toContain('["fact_checking", "rights_checking", "approved"]');
    expect(create).not.toContain("revalidateCanonicalMemePaths(");
  });
});

describe("admin audit durability", () => {
  it.each([
    ["content admin", source],
    ["user admin", userAdmin],
  ])("fails the action when the %s audit insert fails", (_name, actionSource) => {
    const start = actionSource.indexOf("async function logAudit");
    const end = actionSource.indexOf("function errMessage", start);
    const helper = actionSource.slice(start, end);

    expect(helper).toContain('const { error } = await admin.from("admin_audit_log").insert');
    expect(helper).toContain('if (error) throw new Error("감사 로그 저장에 실패했어요.")');
  });

  it.each([
    ["setUserPassword", "sendPasswordReset", "updateUserById"],
    ["sendPasswordReset", "setUserRole", "resetPasswordForEmail"],
    ["setUserRole", "", '.update({ role: input.role })'],
  ])("wraps %s with intent and completion/failure outcomes", (action, next, mutation) => {
    const start = userAdmin.indexOf(`export async function ${action}`);
    const end = next ? userAdmin.indexOf(`export async function ${next}`, start) : userAdmin.length;
    const actionBody = userAdmin.slice(start, end);

    expect(actionBody.indexOf('"intent"')).toBeLessThan(actionBody.indexOf(mutation));
    expect(actionBody.indexOf("finalizeAudit(")).toBeGreaterThan(actionBody.indexOf(mutation));
    expect(actionBody).toContain('"failed"');
  });

  it("audits Plus entitlement intent before its mutation and outcome afterward", () => {
    const actionBody = source.slice(source.indexOf("export async function setUserPlus"));
    const mutation = actionBody.indexOf('admin.rpc("admin_set_plus_entitlement"');

    expect(actionBody.indexOf('"intent"')).toBeLessThan(mutation);
    expect(actionBody.indexOf("finalizeAudit(")).toBeGreaterThan(mutation);
    expect(actionBody).toContain('"failed"');
  });

  it("audits discussion visibility around the service-role mutation", () => {
    const actionBody = section(
      "export async function setDiscussionVisibility",
      "export type DraftResult",
    );
    const mutation = actionBody.indexOf('.from("discussions")');

    expect(actionBody.indexOf('"intent"')).toBeLessThan(mutation);
    expect(actionBody.indexOf("finalizeAudit(")).toBeGreaterThan(mutation);
    expect(actionBody).toContain('"failed"');
  });

  it.each([
    ["content admin", source],
    ["user admin", userAdmin],
  ])("sanitizes %s completion reconciliation telemetry", (_name, actionSource) => {
    const start = actionSource.indexOf("async function finalizeAudit");
    const end = actionSource.indexOf("function errMessage", start);
    const helper = actionSource.slice(start, end);

    expect(helper).toContain('console.error({ event: "admin_audit_completion_pending", action })');
  });
});
