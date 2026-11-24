// lib/actions/admin.ts, the submission queue: reviewMemeContribution over
// the contributions of ../pages/b7-seed.sql. (The new-submission actions
// are added with the detail screen.)
import { sqlText } from "../harness.mjs";

const FILE = "lib/actions/admin.ts";
const SOURCE = "00000000-0000-4000-8b71-000000000c01";
const EXAMPLE = "00000000-0000-4000-8b71-000000000c02";
const MEME = "00000000-0000-4000-8000-000000000001";
const EXAMPLES = `[{"text": "이쯤 되면 패리티 리치 아닌가요?", "situation": "회의가 길어질 때"}, {"text": "괜찮아, 그건 그냥 패리티 리치야.", "situation": "친구의 실수"}]`;

export function cases(ctx) {
  const operator = ctx.sessions.operator;
  const ids = [SOURCE, EXAMPLE].map(sqlText).join(", ");
  const setup = () => `update meme_contributions set status = 'pending', reject_reason = null, reviewed_by = null, reviewed_at = null, applied_source_id = null
      where id in (${ids});
    delete from meme_sources where meme_id = ${sqlText(MEME)} and source_url = 'https://example.com/b7-source';
    update memes set usage_examples = ${sqlText(EXAMPLES)}::jsonb where id = ${sqlText(MEME)};
    delete from admin_audit_log where entity_id in (${ids});`;
  const rows = () => `select json_build_object(
      'contributions', (select json_agg(json_build_object('status', status, 'reason', reject_reason, 'by', reviewed_by = ${sqlText(operator.userId)},
          'applied', applied_source_id is not null) order by id) from meme_contributions where id in (${ids})),
      'sources', (select coalesce(json_agg(json_build_object('title', title, 'platform', platform, 'role', source_role) order by id), '[]')
        from meme_sources where meme_id = ${sqlText(MEME)} and source_url = 'https://example.com/b7-source'),
      'examples', (select usage_examples from memes where id = ${sqlText(MEME)}),
      'audit', (select coalesce(json_agg(json_build_object('action', action, 'type', entity_type, 'detail', detail) order by id), '[]')
        from admin_audit_log where entity_id in (${ids})))`;
  const review = (name, input) => ({
    name,
    file: FILE,
    action: "reviewMemeContribution",
    endpoint: "contribution-review",
    page: "/admin/submissions",
    input,
    setup,
    rows,
  });
  return [
    review("reviewMemeContribution, a source approved with a title", { contributionId: SOURCE, decision: "approve", sourceTitle: "  원 출처  " }),
    review("reviewMemeContribution, a source approved without a title", { contributionId: SOURCE, decision: "approve", sourceTitle: "   " }),
    review("reviewMemeContribution, a source title too long", { contributionId: SOURCE, decision: "approve", sourceTitle: "가".repeat(301) }),
    review("reviewMemeContribution, an example approved", { contributionId: EXAMPLE, decision: "approve", situation: " 단톡방 ", text: " 패리티 리치 그 자체 " }),
    review("reviewMemeContribution, an example too long", { contributionId: EXAMPLE, decision: "approve", situation: "가".repeat(121), text: "a" }),
    review("reviewMemeContribution, rejected with a reason", { contributionId: SOURCE, decision: "reject", rejectReason: " 출처가 아니에요 " }),
    review("reviewMemeContribution, rejected without a reason", { contributionId: SOURCE, decision: "reject", rejectReason: "  " }),
    review("reviewMemeContribution, an unknown decision", { contributionId: SOURCE, decision: "maybe" }),
    review("reviewMemeContribution, no such contribution", { contributionId: "00000000-0000-4000-8b71-00000000ffff", decision: "approve" }),
    review("reviewMemeContribution, not a uuid", { contributionId: "x", decision: "approve" }),
  ];
}
