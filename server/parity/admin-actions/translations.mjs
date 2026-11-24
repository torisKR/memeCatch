// lib/actions/admin-translations.ts: the review queue (GPT review, approve,
// reject, delete), the missing-translation preview and its draft, and the
// save and stale marks of /admin/memes/{id}, over the translations of
// ../pages/b7-seed.sql (memes 00000000-0000-4000-8b71-0000000004xx). The GPT
// cases run against the OpenAI stub; a marker in the meme's title picks its
// answer.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = "lib/actions/admin-translations.ts";
// Not harness.mjs's: the behaviour scenario imports TRANSLATION_STATE, and harness.mjs reads its arguments on load.
const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;
const ONE = "00000000-0000-4000-8b71-000000000401";
const TWO = "00000000-0000-4000-8b71-000000000402";
const THREE = "00000000-0000-4000-8b71-000000000403";
const HIDDEN = "00000000-0000-4000-8b71-000000000404";
const LIKE = "'00000000-0000-4000-8b71-0000000004%'";
// The revisions of the seed as the servers write them.
const ONE_EN = "2026-11-12T01:02:03.456789+00:00";
const ONE_JA = "2026-11-12T01:00:00+00:00";
const ONE_ZH = "2026-11-13T00:00:00+00:00";
const TWO_EN = "2026-11-12T00:00:00+00:00";
const THREE_SOURCE = "2026-11-11T12:00:00+00:00";

const seed = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../pages/b7-seed.sql"), "utf8");
/** The seed's translation state, which every case starts from. */
export const TRANSLATION_STATE = seed.slice(seed.indexOf("-- b7-translations:start"), seed.indexOf("-- b7-translations:end"));

const titled = (meme, title) => `update public.memes set title = ${sqlText(title)} where id = ${sqlText(meme)};`;

const rows = () => `select json_build_object(
    'translations', (select coalesce(json_agg(json_build_object('meme', meme_id, 'locale', locale, 'slug', localized_slug, 'title', title, 'summary', summary,
        'description', description, 'origin', origin, 'note', usage_note, 'caution', caution, 'aliases', aliases, 'status', status, 'source', source_updated_at,
        'provider', provider, 'model', model, 'prompt', prompt_version, 'reviewed', reviewed_at is not null, 'by', reviewed_by is not null,
        'touched', updated_at > '2026-11-20') order by meme_id, locale), '[]') from meme_translations where meme_id::text like ${LIKE}),
    'events', (select coalesce(json_agg(json_build_object('meme', meme_id, 'kind', kind, 'locale', locale) order by meme_id, kind, locale), '[]')
      from meme_public_change_events where meme_id::text like ${LIKE}),
    'audit', (select coalesce(json_agg(json_build_object('action', action, 'type', entity_type, 'entity', entity_id, 'actor', actor_id is not null,
        'detail', detail - 'reviewed_at') order by id), '[]')
      from admin_audit_log where entity_type = 'meme_translation' and entity_id like ${LIKE}))`;

const CONTENT = {
  title: "  Edited title  ",
  summary: " Edited summary ",
  description: " Edited description ",
  origin: " Edited origin ",
  usageNote: "   ",
  caution: " Mind it ",
  aliases: [" a ", "b", "a", "  ", "c"],
};

export function cases() {
  const make = (action, endpoint, page, stub = false) => (name, input, extra = "") => ({
    name: `${action}, ${name}`,
    file: FILE,
    action,
    endpoint,
    page,
    input,
    setup: () => `${TRANSLATION_STATE}${extra}`,
    rows,
    stub,
  });
  const queue = "/admin/translations";
  const memePage = `/admin/memes/${ONE}`;
  const gpt = make("reviewMemeTranslationWithGpt", "translation-gpt-review", queue, true);
  const preview = make("previewMissingMemeTranslationWithGpt", "translation-preview", queue, true);
  const draft = make("saveMissingMemeTranslationDraft", "translation-draft", queue);
  const save = make("saveMemeTranslation", "translation-save", memePage);
  const review = make("reviewMemeTranslation", "translation-review", queue);
  const reject = make("rejectMemeTranslationDraft", "translation-reject", queue);
  const remove = make("deleteMemeTranslation", "translation-delete", queue);
  const stale = make("markMemeTranslationStale", "translation-stale", memePage);
  const revision = (memeId, locale, expectedTranslationUpdatedAt) => ({ memeId, locale, expectedTranslationUpdatedAt });
  const source = (memeId, locale, expectedSourceUpdatedAt) => ({ memeId, locale, expectedSourceUpdatedAt });
  return [
    gpt("reviewed by GPT", revision(ONE, "en", ONE_EN)),
    gpt("the answer in an output block", revision(ONE, "en", ONE_EN), titled(ONE, "B7 [stub:blocks]")),
    gpt("a failed call", revision(ONE, "en", ONE_EN), titled(ONE, "B7 [stub:500]")),
    gpt("an empty answer", revision(ONE, "en", ONE_EN), titled(ONE, "B7 [stub:empty]")),
    gpt("an answer that is not JSON", revision(ONE, "en", ONE_EN), titled(ONE, "B7 [stub:text]")),
    gpt("the same instant written otherwise", revision(ONE, "en", "2026-11-12T01:02:03.456Z")),
    gpt("a revision that is not a time", revision(ONE, "en", "x")),
    gpt("a locale that is not a content locale", revision(ONE, "ko", ONE_EN)),
    gpt("no translation", revision(THREE, "en", ONE_EN)),
    gpt("not a uuid", revision("x", "en", ONE_EN)),
    preview("previewed", source(THREE, "en", THREE_SOURCE)),
    preview("the same instant in another zone", source(THREE, "zh-tw", "2026-11-11T21:00:00+09:00")),
    preview("a failed call", source(THREE, "en", THREE_SOURCE), titled(THREE, "B7 [stub:500]")),
    preview("a changed source", source(THREE, "en", "2026-11-11T12:00:00.001Z")),
    preview("already translated", source(ONE, "en", "2026-11-10T00:00:00.123+00:00")),
    preview("a meme that is not public", source(HIDDEN, "en", "2026-11-11T13:00:00+00:00")),
    preview("not a uuid", source("x", "en", THREE_SOURCE)),
    draft("saved", { ...source(THREE, "ja", THREE_SOURCE), ...CONTENT }),
    draft("a title with no letters keeps the meme's slug", { ...source(THREE, "en", THREE_SOURCE), ...CONTENT, title: " !!! " }),
    draft("a slug from a long title", { ...source(THREE, "en", THREE_SOURCE), ...CONTENT, title: `Ｗｉｄｅ ${"x".repeat(120)}` }),
    draft("already translated", { ...source(ONE, "en", "2026-11-10T00:00:00.123456+00:00"), ...CONTENT }),
    draft("a changed source", { ...source(THREE, "en", "2026-11-11T12:00:01Z"), ...CONTENT }),
    draft("no description", { ...source(THREE, "en", THREE_SOURCE), ...CONTENT, description: "  " }),
    draft("a title too long", { ...source(THREE, "en", THREE_SOURCE), ...CONTENT, title: "가".repeat(301) }),
    draft("a meme that is not public", { ...source(HIDDEN, "en", "2026-11-11T13:00:00+00:00"), ...CONTENT }),
    draft("not a uuid", { ...source("x", "en", THREE_SOURCE), ...CONTENT }),
    save("current, back to machine", { ...revision(ONE, "en", ONE_EN), ...CONTENT }),
    save("an older source, to stale", { ...revision(TWO, "en", TWO_EN), ...CONTENT }),
    save("a changed translation", { ...revision(ONE, "en", "2026-11-12T01:02:03Z"), ...CONTENT }),
    save("no title", { ...revision(ONE, "en", ONE_EN), ...CONTENT, title: " " }),
    save("a revision that is not a time", { ...revision(ONE, "en", "x"), ...CONTENT }),
    review("published", { ...revision(ONE, "en", ONE_EN), ...CONTENT }),
    review("a reviewed one again", { ...revision(ONE, "zh", ONE_ZH), ...CONTENT }),
    review("an older source", { ...revision(TWO, "en", TWO_EN), ...CONTENT }),
    review("no description", { ...revision(ONE, "en", ONE_EN), ...CONTENT, description: "" }),
    review("a changed translation", { ...revision(ONE, "en", "2026-11-12T01:02:03Z"), ...CONTENT }),
    review("no meme id", { ...revision("", "en", ONE_EN), ...CONTENT }),
    reject("with a reason", { ...revision(ONE, "en", ONE_EN), reason: "  표기가 틀려요  " }),
    reject("without a reason", { ...revision(ONE, "en", ONE_EN), reason: "   " }),
    reject("the same instant written otherwise", { ...revision(ONE, "en", "2026-11-12T01:02:03.456789Z"), reason: "x" }),
    reject("no translation", { ...revision(THREE, "en", ONE_EN), reason: "x" }),
    reject("a locale that is not a content locale", { ...revision(ONE, "fr", ONE_EN), reason: "x" }),
    remove("deleted", revision(ONE, "ja", ONE_JA)),
    remove("a changed translation", revision(ONE, "ja", "2026-11-12T01:00:01Z")),
    remove("a revision that is not a time", revision(ONE, "ja", "x")),
    remove("no translation", revision(THREE, "ja", ONE_JA)),
    stale("marked", revision(ONE, "en", ONE_EN)),
    stale("already stale", revision(ONE, "ja", ONE_JA)),
    stale("a changed translation", revision(ONE, "en", "2026-11-12T01:02:04Z")),
    stale("a revision that is not a time", revision(ONE, "en", "")),
  ];
}
