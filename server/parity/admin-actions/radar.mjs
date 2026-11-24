// lib/actions/radar-safety.ts: applyRadarSafetyReview over the proposals of
// ../pages/b7-seed.sql, which every call starts from.
import { sqlText } from "../harness.mjs";

const FILE = "lib/actions/radar-safety.ts";
const REVIEW = "00000000-0000-4000-8b70-000000000001";
const MEME = "00000000-0000-4000-8000-000000000001";

export function cases(ctx) {
  const operator = ctx.sessions.operator;
  const setup = () => `update safety_review_queue set status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null
      where id = ${sqlText(REVIEW)};
    update memes set safety_level = 'green' where id = ${sqlText(MEME)};
    delete from safety_history where meme_id = ${sqlText(MEME)};
    delete from notification_outbox where meme_id = ${sqlText(MEME)};
    delete from admin_audit_log where entity_id in (${sqlText(REVIEW)}, ${sqlText(MEME)});`;
  // What the review, the meme and the logs hold afterwards (not their
  // timestamps or generated ids).
  const rows = () => `select json_build_object(
      'review', (select json_build_object('status', status, 'by', reviewed_by = ${sqlText(operator.userId)}, 'at', reviewed_at is not null, 'note', review_note)
        from safety_review_queue where id = ${sqlText(REVIEW)}),
      'level', (select safety_level from memes where id = ${sqlText(MEME)}),
      'history', (select coalesce(json_agg(json_build_object('from', old_level, 'to', new_level, 'by', changed_by = ${sqlText(operator.userId)}, 'reason', reason) order by changed_at), '[]') from safety_history where meme_id = ${sqlText(MEME)}),
      'outbox', (select coalesce(json_agg(json_build_object('topic', topic, 'channel', channel, 'status', status) order by id), '[]') from notification_outbox where meme_id = ${sqlText(MEME)}),
      'audit', (select coalesce(json_agg(json_build_object('action', action, 'type', entity_type, 'detail', detail) order by id), '[]')
        from admin_audit_log where entity_id in (${sqlText(REVIEW)}, ${sqlText(MEME)})))`;
  const review = (name, input) => ({
    name,
    file: FILE,
    action: "applyRadarSafetyReview",
    endpoint: "radar-review",
    page: "/admin/radar-safety",
    input,
    setup,
    rows,
  });
  const base = { reviewId: REVIEW, decision: "approved", reviewNote: "  확인했어요  " };
  return [
    review("applyRadarSafetyReview, approved", base),
    review("applyRadarSafetyReview, rejected", { ...base, decision: "rejected" }),
    review("applyRadarSafetyReview, an unknown review", { ...base, reviewId: "00000000-0000-4000-8b70-00000000ffff" }),
    review("applyRadarSafetyReview, not a uuid", { ...base, reviewId: "x" }),
    review("applyRadarSafetyReview, another decision", { ...base, decision: "maybe" }),
    review("applyRadarSafetyReview, a blank note", { ...base, reviewNote: "   " }),
    review("applyRadarSafetyReview, a note too long", { ...base, reviewNote: "가".repeat(2001) }),
    review("applyRadarSafetyReview, no note", { reviewId: REVIEW, decision: "approved" }),
    {
      ...review("applyRadarSafetyReview, a proposal already decided", base),
      setup: () => `${setup()} update safety_review_queue set status = 'rejected', reviewed_by = ${sqlText(operator.userId)}, reviewed_at = now(), review_note = 'earlier' where id = ${sqlText(REVIEW)};`,
    },
  ];
}
