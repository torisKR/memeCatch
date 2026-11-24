// app/(default)/admin/growth/actions.ts: saveEnglishPilotSlot and
// recordGrowthPilotInterview, form actions that answer with a redirect.
import { psql, sqlText } from "../harness.mjs";

const FILE = "app/(default)/admin/growth/actions.ts";
const SLOT = 7;
// A reviewed English translation of the current Korean text makes a meme a
// candidate (is_growth_english_pilot_eligible); one without it is refused.
const ELIGIBLE_SQL = `select id from memes where moderation_status = 'approved' order by id limit 1`;
const NOT_ELIGIBLE_SQL = `select id from memes where moderation_status = 'approved' order by id offset 1 limit 1`;

export function cases(ctx) {
  const operator = ctx.sessions.operator;
  const eligible = psql(ELIGIBLE_SQL);
  const notEligible = psql(NOT_ELIGIBLE_SQL);
  const marker = "admin-actions-parity";
  const base = { file: FILE, page: "/admin/growth", form: true };
  const translation = `insert into meme_translations (meme_id, locale, localized_slug, title, summary, description, origin, status, source_updated_at, provider, model, reviewed_at, reviewed_by)
      select id, 'en', 'parity-en', 'Parity EN', 'summary', 'description', 'origin', 'reviewed', updated_at, 'parity', 'parity', now(), ${sqlText(operator.userId)} from memes where id = ${sqlText(eligible)}
      on conflict (meme_id, locale) do update set status = 'reviewed', source_updated_at = excluded.source_updated_at, localized_slug = 'parity-en',
        title = 'Parity EN', summary = 'summary', description = 'description', origin = 'origin', reviewed_at = now(), reviewed_by = excluded.reviewed_by;`;
  const resetSlot = `update growth_english_pilot_landings set meme_id = null, status = 'open', operator_note = '', assigned_by = null, published_at = null where slot = ${SLOT};`;
  const slotRows = () => `select json_build_object('slot', (select json_build_object('meme', meme_id, 'status', status, 'note', operator_note,
      'by', assigned_by = ${sqlText(operator.userId)}, 'published', published_at is not null) from growth_english_pilot_landings where slot = ${SLOT}))`;
  const slot = (name, fields) => ({
    ...base,
    name,
    action: "saveEnglishPilotSlot",
    endpoint: "growth-slot",
    input: fields,
    setup: () => `${translation} ${resetSlot}`,
    rows: slotRows,
  });
  const clearInterviews = `delete from growth_pilot_interviews where participant_reference like '${marker}%';`;
  const interviewRows = () => `select coalesce(json_agg(json_build_object('ref', participant_reference, 'at', interviewed_at, 'market', market,
      'segment', segment, 'summary', summary, 'url', evidence_url) order by participant_reference), '[]')
    from growth_pilot_interviews where participant_reference like '${marker}%'`;
  const interviewFields = {
    participantReference: `${marker}-1`,
    interviewedAt: "2026-01-02T03:04",
    market: " United States ",
    segment: "K-content creator",
    summary: "They search the meaning before they share a clip.",
    evidenceUrl: "",
  };
  const interview = (name, changes) => ({
    ...base,
    name,
    action: "recordGrowthPilotInterview",
    endpoint: "growth-interview",
    input: Object.fromEntries(Object.entries({ ...interviewFields, ...changes }).filter(([, value]) => value !== undefined)),
    setup: () => clearInterviews,
    rows: interviewRows,
  });

  return [
    slot("saveEnglishPilotSlot, open with a note", { slot: String(SLOT), memeId: "", status: "open", operatorNote: "  check later  " }),
    slot("saveEnglishPilotSlot, assigned to a candidate", { slot: String(SLOT), memeId: eligible, status: "assigned", operatorNote: "" }),
    slot("saveEnglishPilotSlot, published", { slot: String(SLOT), memeId: eligible, status: "published", operatorNote: "" }),
    slot("saveEnglishPilotSlot, a meme without a reviewed translation", { slot: String(SLOT), memeId: notEligible, status: "assigned", operatorNote: "" }),
    slot("saveEnglishPilotSlot, ready without a meme", { slot: String(SLOT), memeId: "", status: "ready", operatorNote: "" }),
    slot("saveEnglishPilotSlot, slot 21", { slot: "21", memeId: "", status: "open", operatorNote: "" }),
    slot("saveEnglishPilotSlot, slot written 0x7", { slot: "0x7", memeId: "", status: "open", operatorNote: "" }),
    slot("saveEnglishPilotSlot, not a number", { slot: "seven", memeId: "", status: "open", operatorNote: "" }),
    slot("saveEnglishPilotSlot, an unknown status", { slot: String(SLOT), memeId: "", status: "live", operatorNote: "" }),
    slot("saveEnglishPilotSlot, not a uuid", { slot: String(SLOT), memeId: "nope", status: "open", operatorNote: "" }),
    slot("saveEnglishPilotSlot, no meme field", { slot: String(SLOT), status: "open", operatorNote: "" }),
    interview("recordGrowthPilotInterview", {}),
    interview("recordGrowthPilotInterview, with evidence", { evidenceUrl: "https://example.com/notes" }),
    interview("recordGrowthPilotInterview, evidence over http", { evidenceUrl: "http://example.com/notes" }),
    interview("recordGrowthPilotInterview, evidence that is not a URL", { evidenceUrl: "notes" }),
    interview("recordGrowthPilotInterview, a short summary", { summary: "too short" }),
    interview("recordGrowthPilotInterview, a reference of one letter", { participantReference: " a " }),
    interview("recordGrowthPilotInterview, in the future", { interviewedAt: "2099-01-01T00:00" }),
    interview("recordGrowthPilotInterview, a time with a zone", { interviewedAt: "2026-01-02T03:04:05+09:00" }),
    interview("recordGrowthPilotInterview, no market field", { market: undefined }),
  ];
}
