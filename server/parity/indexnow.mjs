#!/usr/bin/env node
// IndexNow after the admin actions (server/src/routes/admin/indexnow.rs):
// what Axum submits to the stub against what lib/indexnow.server.ts would
// submit for the same row after the same action. Next never submits in a
// parity run (production on the apex host only), so the TypeScript's own
// functions are the reference: `indexNowUrlsForMeme` over the row as
// `INDEXNOW_MEME_SELECT` reads it, then `indexNowPayloads`.
//
//   node --import ./scripts/register-ts-paths.mjs --import ./server/parity/next-server.mjs \
//     server/parity/indexnow.mjs <next> <axum> --stub=<https origin>,<ca.pem>
//
// Axum must run with AXUM_TEST_INDEXNOW_ORIGIN=<the stub> and its CA in
// AXUM_EXTRA_CA_CERTS. Needs DATABASE_URL, BETTER_AUTH_SECRET and
// TEST_DB_CONTAINER like admin-actions.mjs.
import https from "node:https";
import { readFileSync } from "node:fs";
import { indexNowUrlsForMeme } from "../../lib/indexnow.server.ts";
import { indexNowPayloads } from "../../lib/indexnow.ts";
import { TRANSLATION_STATE } from "./admin-actions/translations.mjs";
import { axumBase, fail, pass, psql, run, send, sqlText } from "./harness.mjs";
import { cookieOf, mintSession } from "./sessions.mjs";

const stubOption = process.argv.find((arg) => arg.startsWith("--stub="))?.slice("--stub=".length);
if (!stubOption) {
  console.error("--stub=<https origin>,<ca.pem> is required");
  process.exit(2);
}
const [stubOrigin, stubCa] = stubOption.split(",");
// The action answers before it submits; give the task time to finish.
const SETTLE_MS = 2500;

function submissions() {
  return new Promise((resolveRequests, reject) => {
    https
      .get(`${stubOrigin}/__indexnow`, { ca: readFileSync(stubCa) }, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolveRequests(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
      })
      .on("error", reject);
  });
}

/** The meme as `INDEXNOW_MEME_SELECT` gives it to the TypeScript. */
const rowOf = (memeId) =>
  JSON.parse(
    psql(`select json_build_object('id', m.id, 'short_id', m.short_id, 'slug', m.slug, 'moderation_status', m.moderation_status, 'updated_at', m.updated_at,
      'description', m.description, 'origin', m.origin, 'usage_note', m.usage_note, 'caution', m.caution, 'usage_examples', m.usage_examples,
      'meme_sources', (select coalesce(json_agg(json_build_object('source_url', s.source_url, 'hidden_from_public', s.hidden_from_public)), '[]') from meme_sources s where s.meme_id = m.id),
      'meme_contents', (select coalesce(json_agg(json_build_object('availability', c.availability, 'moderation_status', c.moderation_status)), '[]') from meme_contents c where c.meme_id = m.id),
      'meme_tags_map', (select coalesce(json_agg(json_build_object('tag_id', g.tag_id)), '[]') from meme_tags_map g where g.meme_id = m.id),
      'meme_translations', (select coalesce(json_agg(json_build_object('locale', t.locale, 'status', t.status, 'localized_slug', t.localized_slug, 'title', t.title,
          'summary', t.summary, 'description', t.description, 'origin', t.origin, 'source_updated_at', t.source_updated_at)), '[]') from meme_translations t where t.meme_id = m.id))
      from memes m where m.id = ${sqlText(memeId)}`) || "null",
  );

async function check(label, { setup, endpoint, input, memeOf }, cookie) {
  psql(`set session_replication_role = replica;\n${setup}`);
  await submissions();
  const response = await send(axumBase, {
    method: "POST",
    path: `/_axum/admin/${endpoint}`,
    headers: { "content-type": "application/json", origin: axumBase, cookie },
    body: JSON.stringify(input),
  });
  const answer = JSON.parse(response.body.toString("utf8") || "null");
  await new Promise((done) => setTimeout(done, SETTLE_MS));
  const sent = await submissions();
  const memeId = answer?.ok ? memeOf(answer) : null;
  const expected = memeId
    ? indexNowPayloads(indexNowUrlsForMeme(rowOf(memeId))).map((payload) => ({
        method: "POST",
        url: "/indexnow",
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(payload),
      }))
    : [];
  const text = (list) => JSON.stringify(list, null, 1);
  if (text(sent) === text(expected)) {
    pass(label, `${answer?.ok ? "ok" : answer?.error} | ${expected.length ? JSON.parse(expected[0].body).urlList.join(" ") : "nothing submitted"}`);
  } else {
    fail(label, `answer ${JSON.stringify(answer)}\n  sent:     ${text(sent)}\n  expected: ${text(expected)}`);
  }
}

// Enough of its own prose for `isIndexableMeme`: 400+ characters of
// description, 60+ of origin and a usage note and caution of 40+.
const RICH = `update memes set description = ${sqlText("설명 ".repeat(140))}, origin = ${sqlText("유래 ".repeat(30))},
    usage_note = ${sqlText("사용법 ".repeat(15))}, caution = ${sqlText("주의할 점 ".repeat(10))}
  where id = '00000000-0000-4000-8b71-000000000401';`;
const ONE = "00000000-0000-4000-8b71-000000000401";
const CONTENT = { title: "B7 translation one", summary: "The first meme", description: "Described.", origin: "From here.", usageNote: "", caution: "", aliases: [] };
const review = (expected) => ({ memeId: ONE, locale: "en", expectedTranslationUpdatedAt: expected, ...CONTENT });

const PENDING = "00000000-0000-4000-8b71-000000000501";
const APPROVAL_STATE = `update meme_submissions set status = 'pending', claimed_by = null, reject_reason = null where id = ${sqlText(PENDING)};
  delete from meme_tags_map where meme_id in (select id from memes where title like 'B7 승인%');
  delete from meme_sources where meme_id in (select id from memes where title like 'B7 승인%');
  delete from memes where title like 'B7 승인%';`;
const approval = (description, origin) => ({
  submissionId: PENDING,
  title: "B7 승인 IndexNow",
  summary: "요약",
  description,
  origin,
  safetyLevel: "green",
  category: "phrase",
  difficulty: "normal",
  originYear: 2025,
  tags: ["밈", "새 태그 B7", "셋째 태그"],
  usageContext: { work: "green", friends: "green", family: "green", sns: "green" },
});

const cases = [
  ["reviewMemeTranslation of an indexable meme: the Korean page and the reviewed translations",
    { setup: `${TRANSLATION_STATE}${RICH}`, endpoint: "translation-review", input: review("2026-11-12T01:02:03.456789+00:00"), memeOf: () => ONE }],
  ["reviewMemeTranslation of a thin meme: nothing to submit",
    { setup: TRANSLATION_STATE, endpoint: "translation-review", input: review("2026-11-12T01:02:03.456789+00:00"), memeOf: () => ONE }],
  ["reviewMemeTranslation refused: nothing submitted",
    { setup: `${TRANSLATION_STATE}${RICH}`, endpoint: "translation-review", input: review("2026-11-12T01:02:03Z"), memeOf: () => ONE }],
  ["approveSubmission of an indexable meme: its page",
    { setup: APPROVAL_STATE, endpoint: "submission-approve", input: approval("설명 ".repeat(140), "유래 ".repeat(30)), memeOf: (answer) => answer.data.memeId }],
  ["approveSubmission of a thin meme: nothing to submit",
    { setup: APPROVAL_STATE, endpoint: "submission-approve", input: approval("짧은 설명", "짧은 유래"), memeOf: (answer) => answer.data.memeId }],
];

await run({
  indexnow: async () => {
    const cookie = cookieOf(mintSession("operator"));
    for (const [label, testCase] of cases) await check(label, testCase, cookie);
    psql(`set session_replication_role = replica;\n${TRANSLATION_STATE}${APPROVAL_STATE}`);
  },
});
