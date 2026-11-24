// lib/actions/admin-inquiries.ts: answerInquiry and setInquiryStatus over
// the inquiries of ../pages/b7-seed.sql.
import { sqlText } from "../harness.mjs";

const FILE = "lib/actions/admin-inquiries.ts";
const OPEN = "00000000-0000-4000-8b71-000000000201";
const CLOSED = "00000000-0000-4000-8b71-000000000203";

export function cases() {
  const ids = [OPEN, CLOSED].map(sqlText).join(", ");
  const setup = () => `update support_inquiries set status = 'open', admin_reply = null, replied_at = null where id = ${sqlText(OPEN)};
    update support_inquiries set status = 'closed', admin_reply = null, replied_at = null where id = ${sqlText(CLOSED)};
    delete from admin_audit_log where entity_type = 'support_inquiry';`;
  const rows = () => `select json_build_object(
      'inquiries', (select json_agg(json_build_object('status', status, 'reply', admin_reply, 'replied', replied_at is not null) order by id)
        from support_inquiries where id in (${ids})),
      'audit', (select coalesce(json_agg(json_build_object('action', action, 'entity', entity_id, 'detail', detail) order by id), '[]')
        from admin_audit_log where entity_type = 'support_inquiry'))`;
  const base = { file: FILE, page: "/admin/inquiries", setup, rows };
  const answer = (name, input) => ({ ...base, name, action: "answerInquiry", endpoint: "inquiry-answer", input });
  const status = (name, input) => ({ ...base, name, action: "setInquiryStatus", endpoint: "inquiry-status", input });
  return [
    answer("answerInquiry", { inquiryId: OPEN, reply: "  확인했어요 고쳤어요  " }),
    answer("answerInquiry, a blank reply", { inquiryId: OPEN, reply: "   " }),
    answer("answerInquiry, a reply too long", { inquiryId: OPEN, reply: "가".repeat(4001) }),
    answer("answerInquiry, not a uuid", { inquiryId: "x", reply: "a" }),
    answer("answerInquiry, no reply", { inquiryId: OPEN }),
    answer("answerInquiry, no such inquiry", { inquiryId: "00000000-0000-4000-8b71-00000000ffff", reply: "a" }),
    status("setInquiryStatus, closed", { inquiryId: OPEN, status: "closed" }),
    status("setInquiryStatus, open again", { inquiryId: CLOSED, status: "open" }),
    status("setInquiryStatus, answered is not offered", { inquiryId: OPEN, status: "answered" }),
    status("setInquiryStatus, not a uuid", { inquiryId: "x", status: "closed" }),
  ];
}
