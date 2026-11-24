// lib/actions/admin.ts: handleReport and setDiscussionVisibility over the
// reports and comments of ../pages/b7-seed.sql.
import { sqlText } from "../harness.mjs";

const FILE = "lib/actions/admin.ts";
const REPORT = "00000000-0000-4000-8b71-000000000102";
const DISCUSSION = "00000000-0000-4000-8b71-000000000d01";

export function cases(ctx) {
  const operator = ctx.sessions.operator;
  const ids = [REPORT, DISCUSSION, "nope", "00000000-0000-4000-8b71-00000000ffff"].map(sqlText).join(", ");
  const setup = () => `update reports set status = 'open', handled_by = null where id = ${sqlText(REPORT)};
    update discussions set status = 'visible' where id = ${sqlText(DISCUSSION)};
    delete from admin_audit_log where entity_id in (${ids});`;
  const rows = () => `select json_build_object(
      'report', (select json_build_object('status', status, 'by', handled_by = ${sqlText(operator.userId)}) from reports where id = ${sqlText(REPORT)}),
      'discussion', (select status from discussions where id = ${sqlText(DISCUSSION)}),
      'audit', (select coalesce(json_agg(json_build_object('action', action, 'type', entity_type, 'entity', entity_id, 'detail', detail) order by id), '[]')
        from admin_audit_log where entity_id in (${ids})))`;
  const base = { file: FILE, page: "/admin/reports", setup, rows };
  const handle = (name, input) => ({ ...base, name, action: "handleReport", endpoint: "report-handle", input });
  const visibility = (name, input) => ({ ...base, name, action: "setDiscussionVisibility", endpoint: "discussion-visibility", input });
  return [
    handle("handleReport, resolved", { reportId: REPORT, action: "resolved" }),
    handle("handleReport, dismissed", { reportId: REPORT, action: "dismissed" }),
    handle("handleReport, an action the enum lacks", { reportId: REPORT, action: "open-again" }),
    handle("handleReport, a report already handled", { reportId: REPORT, action: "resolved" }),
    handle("handleReport, not a uuid", { reportId: "nope", action: "resolved" }),
    handle("handleReport, no such report", { reportId: "00000000-0000-4000-8b71-00000000ffff", action: "resolved" }),
    visibility("setDiscussionVisibility, hidden", { discussionId: DISCUSSION, status: "hidden" }),
    visibility("setDiscussionVisibility, visible", { discussionId: DISCUSSION, status: "visible" }),
    visibility("setDiscussionVisibility, a status the enum lacks", { discussionId: DISCUSSION, status: "gone" }),
    visibility("setDiscussionVisibility, not a uuid", { discussionId: "nope", status: "hidden" }),
  ].map((testCase) =>
    testCase.name.includes("already handled")
      ? { ...testCase, setup: () => `${setup()} update reports set status = 'dismissed' where id = ${sqlText(REPORT)};` }
      : testCase,
  );
}
