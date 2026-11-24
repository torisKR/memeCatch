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
    ...submissionCases(operator),
  ];
}

const PENDING = "00000000-0000-4000-8b71-000000000501";
const REVIEWING = "00000000-0000-4000-8b71-000000000503";
const DONE = "00000000-0000-4000-8b71-000000000504";

function submissionCases(operator) {
  const ids = [PENDING, REVIEWING, DONE].map(sqlText).join(", ");
  const title = (name) => sqlText(name);
  const setup = (name = "오래된 제보 밈") => `update meme_submissions set status = 'pending', claimed_by = null, reject_reason = null, name = ${title(name)}
      where id = ${sqlText(PENDING)};
    update meme_submissions set status = 'reviewing', claimed_by = (select id from profiles order by created_at, id limit 1) where id = ${sqlText(REVIEWING)};
    update meme_submissions set status = 'approved' where id = ${sqlText(DONE)};
    delete from meme_tags_map where meme_id in (select id from memes where title like 'B7 승인%');
    delete from meme_sources where meme_id in (select id from memes where title like 'B7 승인%');
    delete from memes where title like 'B7 승인%';
    delete from admin_audit_log where entity_id in (${ids});`;
  const rows = () => `select json_build_object(
      'submissions', (select json_agg(json_build_object('status', status, 'claimed', claimed_by = ${sqlText(operator.userId)}, 'reason', reject_reason) order by id)
        from meme_submissions where id in (${ids})),
      'memes', (select coalesce(json_agg(json_build_object('title', title, 'slug', regexp_replace(slug, '-[0-9a-z]{6,}$', '-<time>'), 'status', moderation_status,
          'summary', summary, 'description', description, 'origin', origin, 'safety', safety_level, 'category', category, 'difficulty', difficulty,
          'year', origin_year, 'usage', usage_context,
          'sources', (select coalesce(json_agg(json_build_object('platform', platform, 'url', source_url)), '[]') from meme_sources s where s.meme_id = m.id),
          'contents', (select count(*) from meme_contents c where c.meme_id = m.id),
          'tags', (select coalesce(json_agg(t.name order by t.name), '[]') from meme_tags_map mt join tags t on t.id = mt.tag_id where mt.meme_id = m.id))
        order by m.slug), '[]') from memes m where title like 'B7 승인%'),
      'audit', (select coalesce(json_agg(json_build_object('action', action, 'entity', entity_id,
          'detail', detail - 'meme_id') order by id), '[]') from admin_audit_log where entity_id in (${ids})))`;
  const base = { file: FILE, page: `/admin/submissions/${PENDING}`, setup: () => setup(), rows };
  const named = (name) => ({ setup: () => setup(name) });
  const claim = (label, input) => ({ ...base, name: `claimSubmission, ${label}`, action: "claimSubmission", endpoint: "submission-claim", input });
  const reject = (label, input) => ({ ...base, name: `rejectSubmission, ${label}`, action: "rejectSubmission", endpoint: "submission-reject", input });
  const draft = (label, input, extra = {}) => ({ ...base, name: `generateDraft, ${label}`, action: "generateDraft", endpoint: "submission-draft", input, stub: true, ...extra });
  const approval = {
    submissionId: PENDING,
    title: "  B7 승인 밈  ",
    summary: " 요약 ",
    description: " 설명 ",
    origin: " 유래 ",
    safetyLevel: "yellow",
    category: "phrase",
    difficulty: "normal",
    originYear: 2025,
    tags: ["밈", "새 태그 B7"],
    usageContext: { work: "yellow", friends: "green", family: "yellow", sns: "red" },
  };
  const approve = (label, changes = {}, extra = {}) => ({
    ...base,
    name: `approveSubmission, ${label}`,
    action: "approveSubmission",
    endpoint: "submission-approve",
    input: { ...approval, ...changes },
    maskIds: true,
    ...extra,
  });
  return [
    claim("a pending one", PENDING),
    claim("one another operator reviews", REVIEWING),
    claim("not a uuid", "x"),
    reject("with a category and a reason", { submissionId: PENDING, category: "출처 부족", reason: "  출처를 찾지 못했어요  " }),
    reject("an unknown category", { submissionId: PENDING, category: "기타", reason: "a" }),
    reject("a blank reason", { submissionId: PENDING, category: "중복", reason: "   " }),
    draft("a submission with every field", PENDING),
    draft("the answer in an output block", PENDING, named("[stub:blocks] 제보")),
    draft("the provider fails", PENDING, named("[stub:500] 제보")),
    draft("an empty answer", PENDING, named("[stub:empty] 제보")),
    draft("an answer that is not JSON", PENDING, named("[stub:text] 제보")),
    draft("no such submission", "00000000-0000-4000-8b71-00000000ffff"),
    approve("a submission with a source and tags"),
    approve("one with a title made of symbols", { title: "  B7 승인 !! 밈?  " }),
    approve("no year", { originYear: null, tags: [] }),
    approve("a year that is not whole", { originYear: 2025.5 }),
    approve("a category the enum lacks", { category: "meme" }),
    approve("a blank title", { title: "  " }),
    approve("a blank summary", { summary: "" }),
    approve("one already decided", {}, { page: `/admin/submissions/${DONE}`, input: { ...approval, submissionId: DONE } }),
  ];
}
