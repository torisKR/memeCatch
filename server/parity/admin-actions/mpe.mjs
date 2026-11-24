// lib/actions/admin-mpe.ts: the MPE review console's actions over the
// candidates of ../pages/b7-seed.sql (ids 00000000-0000-4000-8b71-0000000006xx:
// 621 at the fact stage with a pending claim, 622 at publish, 623 at rights).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = "lib/actions/admin-mpe.ts";
const P = "00000000-0000-4000-8b71-0000000006";
const LIKE = `'${P}%'`;
const seed = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../pages/b7-seed.sql"), "utf8");
const STATE = seed.slice(seed.indexOf("-- b7-mpe:start"), seed.indexOf("-- b7-mpe:end"));

const rows = () => `select json_build_object(
    'candidates', (select json_agg(json_build_object('id', id, 'status', review_status, 'draft', draft_json) order by id) from meme_candidates where id::text like ${LIKE}),
    'claims', (select json_agg(json_build_object('id', id, 'status', review_status) order by id) from claim_evidence where id::text like ${LIKE}),
    'ingestions', (select json_agg(json_build_object('id', id, 'role', source_role, 'basis', rights_basis) order by id) from media_ingestions where id::text like ${LIKE}),
    'jobs', (select json_agg(json_build_object('id', id, 'status', status, 'attempts', attempts, 'error', error_code) order by id) from processing_jobs where ingestion_id::text like ${LIKE}),
    'revisions', (select coalesce(json_agg(json_build_object('candidate', candidate_id, 'number', revision_number, 'draft', draft_json) order by candidate_id, revision_number), '[]')
      from candidate_revisions where candidate_id::text like ${LIKE}),
    'audit', (select coalesce(json_agg(json_build_object('action', action, 'entity', entity_id, 'detail', detail) order by id), '[]')
      from admin_audit_log where entity_type = 'mpe_candidate' and entity_id like ${LIKE}))`;

export function cases() {
  const make = (action, endpoint) => (label, input) => ({
    name: `${action}, ${label}`,
    file: FILE,
    action,
    endpoint,
    page: `/admin/mpe/${P}21`,
    input,
    setup: () => STATE,
    rows,
  });
  const review = make("reviewMpeCandidate", "mpe-review");
  const revision = make("saveMpeCandidateRevision", "mpe-revision");
  const rights = make("setMpeIngestionSourceRights", "mpe-source-rights");
  const claim = make("reviewMpeClaim", "mpe-claim");
  const reprocess = make("reprocessMpeJob", "mpe-reprocess");
  const fact = `${P}21`;
  return [
    review("fact approval with a pending claim", { candidateId: fact, stage: "FACT_CHECKING", decision: "APPROVED" }),
    review("changes requested with a reason", { candidateId: fact, stage: "FACT_CHECKING", decision: "CHANGES_REQUESTED", reason: "  근거 보강  " }),
    review("rejected with a blank reason", { candidateId: fact, stage: "FACT_CHECKING", decision: "REJECTED", reason: "   " }),
    review("a stage out of order", { candidateId: fact, stage: "RIGHTS_CHECKING", decision: "APPROVED" }),
    review("approval at the publish stage", { candidateId: `${P}22`, stage: "PUBLISH", decision: "APPROVED" }),
    review("publishing before the publish stage", { candidateId: fact, stage: "FACT_CHECKING", decision: "PUBLISHED" }),
    review("published", { candidateId: `${P}22`, stage: "PUBLISH", decision: "PUBLISHED" }),
    review("limited", { candidateId: `${P}22`, stage: "PUBLISH", decision: "LIMITED", reason: "출처 확인 중" }),
    review("rights approval with unknown rights", { candidateId: `${P}23`, stage: "RIGHTS_CHECKING", decision: "APPROVED" }),
    review("no such candidate", { candidateId: `${P}99`, stage: "FACT_CHECKING", decision: "REJECTED" }),
    review("not a uuid", { candidateId: "x", stage: "FACT_CHECKING", decision: "REJECTED" }),
    review("a reason too long", { candidateId: fact, stage: "FACT_CHECKING", decision: "REJECTED", reason: "가".repeat(2001) }),
    review("a reason that is not text", { candidateId: fact, stage: "FACT_CHECKING", decision: "REJECTED", reason: 5 }),
    review("an unknown decision", { candidateId: fact, stage: "FACT_CHECKING", decision: "MAYBE" }),
    revision("saved", { candidateId: fact, draft: { title: "수정한 제목", 2: "숫자 키", 1: "먼저", nested: { a: [1, 2.5] } } }),
    revision("a draft that is a list", { candidateId: fact, draft: ["x"] }),
    revision("a draft that is null", { candidateId: fact, draft: null }),
    revision("a draft too large", { candidateId: fact, draft: { text: "x".repeat(100_000) } }),
    revision("no such candidate", { candidateId: `${P}99`, draft: {} }),
    revision("not a uuid", { candidateId: "x", draft: {} }),
    rights("set", { ingestionId: `${P}13`, sourceRole: "original", rightsBasis: "creator_permission" }),
    rights("a role that does not exist", { ingestionId: `${P}13`, sourceRole: "owner", rightsBasis: "creator_permission" }),
    rights("no such ingestion", { ingestionId: `${P}99`, sourceRole: "original", rightsBasis: "link_only" }),
    claim("approved", { candidateId: fact, claimId: `${P}61`, decision: "APPROVED" }),
    claim("rejected", { candidateId: fact, claimId: `${P}61`, decision: "REJECTED" }),
    claim("a claim of another candidate", { candidateId: fact, claimId: `${P}63`, decision: "APPROVED" }),
    claim("past the fact stage", { candidateId: `${P}22`, claimId: `${P}63`, decision: "REJECTED" }),
    claim("an unknown decision", { candidateId: fact, claimId: `${P}61`, decision: "PENDING" }),
    reprocess("a failed job", { jobId: `${P}32` }),
    reprocess("a queued job", { jobId: `${P}35` }),
    reprocess("no such job", { jobId: `${P}99` }),
    reprocess("not a uuid", { jobId: "x" }),
  ];
}
