// lib/actions/admin.ts, the meme editor (/admin/memes/{id}): transitionMemeStatus,
// setMemeOriginCountry, updateMeme and generateKoreanReviewDraft (against
// the OpenAI stub), over the memes 00000000-0000-4000-8b71-0000000004xx of
// ../pages/b7-seed.sql (405 is a house original in rights checking).
import { TRANSLATION_STATE } from "./translations.mjs";

const FILE = "lib/actions/admin.ts";
const ONE = "00000000-0000-4000-8b71-000000000401";
const HIDDEN = "00000000-0000-4000-8b71-000000000404";
const HOUSE = "00000000-0000-4000-8b71-000000000405";
const NOBODY = "00000000-0000-4000-8b71-00000000ffff";
const LIKE = "'00000000-0000-4000-8b71-0000000004%'";

const rows = () => `select json_build_object(
    'memes', (select json_agg(json_build_object('short', short_id, 'status', moderation_status, 'attested', house_rights_attested_at is not null,
        'title', title, 'summary', summary, 'description', description, 'origin', origin, 'note', usage_note, 'caution', caution, 'aliases', aliases,
        'safety', safety_level, 'lifecycle', lifecycle_status, 'category', category, 'difficulty', difficulty, 'sentiment', sentiment,
        'year', origin_year, 'usage', usage_context) order by short_id) from memes where id::text like ${LIKE}),
    'profiles', (select coalesce(json_agg(json_build_object('meme', meme_id, 'market', market_code, 'tag', language_tag, 'role', role, 'local', local_title,
        'state', review_state) order by meme_id, market_code), '[]') from meme_market_profiles where meme_id::text like ${LIKE}),
    'safety', (select coalesce(json_agg(json_build_object('meme', meme_id, 'level', proposed_level, 'status', status) order by meme_id), '[]')
      from safety_review_queue where meme_id::text like ${LIKE}),
    'audit', (select coalesce(json_agg(json_build_object('action', action, 'entity', entity_id, 'detail', detail) order by id), '[]')
      from admin_audit_log where entity_type = 'meme' and entity_id like ${LIKE}))`;

const EDIT = {
  memeId: ONE,
  title: "  B7 번역 밈 하나 고침  ",
  summary: " 고친 요약 ",
  description: " 고친 설명 ",
  origin: " 고친 유래 ",
  usageNote: "  ",
  caution: " 조심 ",
  aliases: [" 별칭 ", "", "둘"],
  safetyLevel: "green",
  lifecycleStatus: "rising",
  category: "dance",
  difficulty: "deep",
  sentiment: "ironic",
  originYear: 2019,
  usageContext: { work: "red", friends: "green", family: "yellow", sns: "gray" },
};

export function cases() {
  const make = (action, endpoint, stub = false) => (label, input, extra = "") => ({
    name: `${action}, ${label}`,
    file: FILE,
    action,
    endpoint,
    page: `/admin/memes/${ONE}`,
    input,
    setup: () => `${TRANSLATION_STATE}${extra}`,
    rows,
    stub,
  });
  const transition = make("transitionMemeStatus", "meme-transition");
  const country = make("setMemeOriginCountry", "meme-origin-country");
  const update = make("updateMeme", "meme-update");
  const draft = make("generateKoreanReviewDraft", "meme-korean-draft", true);
  const published = `update memes set moderation_status = 'approved', house_rights_attested_at = now() where id = '${HOUSE}';`;
  return [
    transition("pending to fact checking", { memeId: HIDDEN, to: "fact_checking" }),
    transition("a move the trigger refuses", { memeId: HIDDEN, to: "approved" }),
    transition("a status that does not exist", { memeId: HIDDEN, to: "gone" }),
    transition("no such meme", { memeId: NOBODY, to: "fact_checking" }),
    transition("not a uuid", { memeId: "x", to: "fact_checking" }),
    transition("a house original without the attestation", { memeId: HOUSE, to: "approved" }),
    transition("a house original attested", { memeId: HOUSE, to: "approved", attested: true }),
    transition("a house original limited, attested", { memeId: HOUSE, to: "limited", attested: true }),
    transition("a house original without rights evidence", { memeId: HOUSE, to: "approved", attested: true }, `delete from meme_sources where meme_id = '${HOUSE}';`),
    transition("a house original back to fact checking", { memeId: HOUSE, to: "fact_checking" }),
    country("set", { memeId: ONE, country: "JP", localTitle: "  B7 ミーム  " }),
    country("set again with another country", { memeId: ONE, country: "US", localTitle: "B7 meme" }, `insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by) values ('${ONE}', 'JP', 'ja-JP', 'origin', '前', 'reviewed', now(), (select id from profiles order by created_at, id limit 1));`),
    country("a malformed id", { memeId: "1234", country: "JP", localTitle: "a" }),
    country("an upper-case id", { memeId: ONE.toUpperCase(), country: "JP", localTitle: "a" }),
    country("a country that is not listed", { memeId: ONE, country: "XX", localTitle: "a" }),
    country("a blank local title", { memeId: ONE, country: "JP", localTitle: "   " }),
    country("a local title too long", { memeId: ONE, country: "JP", localTitle: "가".repeat(301) }),
    country("no such meme", { memeId: NOBODY, country: "JP", localTitle: "a" }),
    update("saved", EDIT),
    update("a new safety level is queued for review", { ...EDIT, safetyLevel: "red" }),
    update("no title", { ...EDIT, title: "  " }),
    update("a lifecycle that does not exist", { ...EDIT, lifecycleStatus: "dead" }),
    update("a safety level that does not exist", { ...EDIT, safetyLevel: "blue" }),
    update("operator notes in a house original", { ...EDIT, memeId: HOUSE, origin: "pending으로 저장" }),
    update("operator notes in a catalog meme are kept", { ...EDIT, origin: "pending으로 저장" }),
    update("a published house original's copy goes back to rights checking", { ...EDIT, memeId: HOUSE, title: "B7 자체 다섯 고침" }, published),
    update("no such meme", { ...EDIT, memeId: NOBODY }),
    draft("drafted", ONE),
    draft("the provider fails", ONE, `update memes set title = 'B7 [stub:500]' where id = '${ONE}';`),
    draft("an answer that is not JSON", ONE, `update memes set title = 'B7 [stub:text]' where id = '${ONE}';`),
    draft("no such meme", NOBODY),
    draft("not a uuid", "x"),
  ];
}
