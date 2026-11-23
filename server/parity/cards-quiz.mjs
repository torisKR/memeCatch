#!/usr/bin/env node
// The meme card routes and /api/quiz, Next against Axum on one database:
// every status each route answers, signed out and signed in, bad input, the
// other methods, and the rows a claim leaves. See README.md in this directory.
//
//   PARITY_USER="$(cat user1.json)" PARITY_USER_2="$(cat user2.json)" \
//     node server/parity/cards-quiz.mjs <next-base-url> <axum-base-url> [cards] [quiz]
//
// PARITY_USER and PARITY_USER_2 are each one line printed by
// server/tests/better_auth_cookie.mjs (two different users). TEST_DB_CONTAINER
// names the database container. Throwaway database only: the script replaces
// the cards, the card owners and the approved memes.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { axumBase, compare, compareOnce, expectEqual, fail, nextBase, pass, psql, run, send, sqlText } from "./harness.mjs";

const user = JSON.parse(process.env.PARITY_USER ?? "null");
const otherUser = JSON.parse(process.env.PARITY_USER_2 ?? "null");
if (!user?.cookie || !otherUser?.cookie) {
  console.error("PARITY_USER and PARITY_USER_2 must hold the output of server/tests/better_auth_cookie.mjs");
  process.exit(2);
}
const SITE = new URL(nextBase).origin; // NEXT_PUBLIC_SITE_URL of the Next build
const NEXT_OWN = `http://localhost:${new URL(nextBase).port}`; // what Next takes for its own origin
const CATEGORIES = ["phrase", "dance", "song", "image", "comment", "challenge"];
const cardId = (n) => `mc-${String(n).padStart(4, "0")}`;
const memeId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TIMESTAMP = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?\+00:00/g;
const maskTime = (text) => text.replace(TIMESTAMP, "<time>");

// Cards 1-30 are public. 31 is inactive, and the memes of 32-34 are limited,
// yellow and unpublished: none of the four may ever be served.
const TITLES = { 1: "100% 리얼 밈", 2: "under_score 밈", 3: "back\\slash 밈", 4: "Hype Boy 챌린지", 5: "hype boy 커버", 6: "퍼센트 없는 100 리얼", 7: "underXscore 밈" };
function seedCards() {
  const memes = [];
  const cards = [];
  for (let n = 1; n <= 34; n += 1) {
    const hidden = { 32: ["limited", "green", true], 33: ["approved", "yellow", true], 34: ["approved", "green", false] }[n];
    const [status, safety, published] = hidden ?? ["approved", "green", true];
    memes.push(
      `(${[memeId(n), `pc${String(n).padStart(6, "0")}`, n === 1 ? "parity-밈 1/a?" : `parity-card-${n}`, TITLES[n] ?? `패리티 카드 ${n}`, `${n}번 카드의 밈이 어디에서 왔고 언제 쓰는지 설명하는 충분히 긴 요약이에요.`]
        .map(sqlText)
        .join(", ")}, ${sqlText(CATEGORIES[n % 6])}::meme_category, ${n % 5 === 0 ? "null" : 1995 + n}, ${sqlText(safety)}::safety_level, ${sqlText(status)}::moderation_status, ${published ? "now()" : "null"})`,
    );
    cards.push(`(${sqlText(cardId(n))}, ${n}, ${sqlText(memeId(n))}, 1, ${1000 + n}, ${n !== 31})`);
  }
  psql(`begin;
delete from public.user_meme_cards;
delete from public.meme_collectible_cards;
delete from public.memes where slug like 'parity-%';
insert into public.memes (id, short_id, slug, title, summary, category, origin_year, safety_level, moderation_status, published_at) values
${memes.join(",\n")};
insert into public.meme_collectible_cards (id, card_no, meme_id, edition, art_seed, active) values
${cards.join(",\n")};
commit;`);
}

const get = (path, headers = {}) => ({ path, headers });
const signedIn = (path, who = user) => ({ path, headers: { cookie: who.cookie } });
// `origin: null` sends no Origin header; by default it is the site's.
const claim = (body, { origin = SITE, ...headers } = {}) => ({ method: "POST", path: "/api/meme-cards/claim", headers: origin === null ? headers : { origin, ...headers }, body });
const claimAs = (who, card) => claim(JSON.stringify({ cardId: card }), { cookie: who.cookie });
const ownedRows = (userId) => psql(`select card_id from public.user_meme_cards where user_id = ${sqlText(userId)} order by card_id`);

async function cardReads() {
  seedCards();
  for (const [label, path, status] of [
    ["catalogue page 1", "/api/meme-cards", 200],
    ["catalogue page 2 (the last six)", "/api/meme-cards?page=2", 200],
    ["catalogue page past the end", "/api/meme-cards?page=3", 200],
    ["catalogue last allowed page", "/api/meme-cards?page=42", 200],
    ["catalogue by category", "/api/meme-cards?category=dance", 200],
    ["catalogue by name, Korean", "/api/meme-cards?query=%EB%B0%88", 200],
    ["catalogue by name, % is not a wildcard", "/api/meme-cards?query=100%25", 200],
    ["catalogue by name, _ is not a wildcard", "/api/meme-cards?query=under_", 200],
    ["catalogue by name, backslash", "/api/meme-cards?query=back%5C", 200],
    ["catalogue by name, any case, + is a space", "/api/meme-cards?query=HYPE+boy", 200],
    ["catalogue by name and category, page 1", "/api/meme-cards?query=%EC%B9%B4%EB%93%9C&category=song&page=1", 200],
    ["catalogue by name with no match", "/api/meme-cards?query=zzzz", 200],
    ["blank query and empty category are no filter", "/api/meme-cards?query=%20%20&category=", 200],
    ["query of 80 characters", `/api/meme-cards?query=${"a".repeat(80)}`, 200],
    ["query of 81 characters", `/api/meme-cards?query=${"a".repeat(81)}`, 400],
    ["page 0", "/api/meme-cards?page=0", 400],
    ["page 43", "/api/meme-cards?page=43", 400],
    ["page with a leading zero", "/api/meme-cards?page=01", 400],
    ["empty page", "/api/meme-cards?page=", 400],
    ["page twice", "/api/meme-cards?page=1&page=2", 400],
    ["unknown category", "/api/meme-cards?category=meme", 400],
    ["unknown parameter", "/api/meme-cards?x=1", 400],
    ["_rsc is an unknown parameter too", "/api/meme-cards?_rsc=abc", 400],
    ["one card", "/api/meme-cards/mc-0001", 200],
    ["one card, query string ignored", "/api/meme-cards/mc-0030?x=1", 200],
    ["inactive card", "/api/meme-cards/mc-0031", 404],
    ["card of a limited meme", "/api/meme-cards/mc-0032", 404],
    ["card of a yellow meme", "/api/meme-cards/mc-0033", 404],
    ["card of an unpublished meme", "/api/meme-cards/mc-0034", 404],
    ["card number with no row", "/api/meme-cards/mc-0999", 404],
    ["card id out of range", "/api/meme-cards/mc-1001", 400],
    ["card id in capitals", "/api/meme-cards/MC-0001", 400],
    ["not a card id", "/api/meme-cards/nope", 400],
    ["card id with an escape Next decodes", "/api/meme-cards/mc%2D0001", 200],
    ["card id with an escaped slash", "/api/meme-cards/mc-0001%2F", 400],
    ["card id that is not UTF-8 (Next answers 500)", "/api/meme-cards/%ff", 500],
    ["card path with a trailing slash (redirect)", "/api/meme-cards/mc-0001/", 308],
    ["collection, signed out", "/api/meme-cards/collection", 401],
    ["collection card ids, signed out", "/api/meme-cards/collection?cardIds=mc-0001", 401],
    ["collection, bad page, signed out", "/api/meme-cards/collection?page=x", 400],
    ["collection, empty card ids", "/api/meme-cards/collection?cardIds=", 400],
    ["collection, card ids with another parameter", "/api/meme-cards/collection?cardIds=mc-0001&page=1", 400],
    ["collection, card ids twice", "/api/meme-cards/collection?cardIds=mc-0001&cardIds=mc-0002", 400],
    ["collection, 25 card ids", `/api/meme-cards/collection?cardIds=${Array.from({ length: 25 }, (_, i) => cardId(i + 1)).join(",")}`, 400],
  ]) {
    await compare(label, get(path), { status });
  }
  for (const target of ["/api/meme-cards", "/api/meme-cards?page=0", "/api/meme-cards/mc-0001", "/api/meme-cards/nope", "/api/meme-cards/collection"]) {
    await compare(`HEAD ${target}`, { method: "HEAD", path: target });
  }
  for (const [method, path] of [["POST", "/api/meme-cards"], ["OPTIONS", "/api/meme-cards"], ["DELETE", "/api/meme-cards/mc-0001"], ["OPTIONS", "/api/meme-cards/mc-0001"], ["POST", "/api/meme-cards/collection"], ["GET", "/api/meme-cards/claim"], ["HEAD", "/api/meme-cards/claim"], ["OPTIONS", "/api/meme-cards/claim"]]) {
    await compare(`${method} ${path} (Next's own answer)`, { method, path });
  }
  await compare("collection with a session cookie that is not signed", get("/api/meme-cards/collection", { cookie: `${user.cookieName}=forged.token` }), { status: 401 });
  await compare("collection, signed in, nothing owned", signedIn("/api/meme-cards/collection"), { status: 200 });
  await compare("owned card ids, nothing owned", signedIn("/api/meme-cards/collection?cardIds=mc-0001,mc-0002"), { status: 200 });
}

async function claims() {
  const big = JSON.stringify({ cardId: "mc-0001", pad: "p".repeat(1024) });
  for (const [label, request, status] of [
    ["claim without Origin or Sec-Fetch-Site", claim("{}", { origin: null }), 403],
    ["claim with an empty Origin", claim("{}", { origin: "" }), 403],
    ["claim with Sec-Fetch-Site: cross-site", claim("{}", { origin: null, "sec-fetch-site": "cross-site" }), 403],
    ["claim from another origin", claim("{}", { origin: "https://evil.example" }), 403],
    ["claim, same-origin fetch, signed out", claim('{"cardId":"mc-0001"}', { origin: null, "sec-fetch-site": "same-origin" }), 401],
    ["claim from the site origin, signed out", claim('{"cardId":"mc-0001"}'), 401],
    ["claim from Next's own origin, signed out", claim('{"cardId":"mc-0001"}', { origin: NEXT_OWN }), 401],
    ["claim, body over 1 KiB, declared", claim(big), 413],
    ["claim, body over 1 KiB, chunked", { ...claim(big), chunked: true }, 413],
    ["claim, body is not JSON", claim("{"), 400],
    ["claim, empty body", claim(""), 400],
    ["claim, body is an array", claim('["mc-0001"]'), 400],
    ["claim, two keys", claim('{"cardId":"mc-0001","x":1}'), 400],
    ["claim, card id is not a string", claim('{"cardId":1}'), 400],
    ["claim, card id out of range", claim('{"cardId":"mc-0000"}'), 400],
    ["claim, repeated key, last one valid, signed out", claim('{"cardId":"x","cardId":"mc-0001"}'), 401],
    ["claim, unsigned session cookie", claim('{"cardId":"mc-0001"}', { cookie: `${user.cookieName}=forged.token` }), 401],
    ["claim a card number with no row", claimAs(user, "mc-0999"), 404],
    ["claim an inactive card", claimAs(user, "mc-0031"), 404],
    ["claim the card of a limited meme", claimAs(user, "mc-0032"), 404],
  ]) {
    await compare(label, request, { status });
  }
  expectEqual("no row was written by a refused claim", ownedRows(user.userId), "");

  // A claim Next makes first, then the same claim through Axum, and the other
  // way round: the second answer is the first one's row, byte for byte.
  await compareOnce("claim mc-0001: Next writes, Axum finds the row", claimAs(user, "mc-0001"), { status: 200 });
  await compareOnce("claim mc-0002: Axum writes, Next finds the row", claimAs(user, "mc-0002"), { status: 200, order: "axum-first" });
  await compare("claim mc-0001 again", claimAs(user, "mc-0001"), { status: 200 });
  await compare("claim mc-0002 again from Next's own origin", claim('{"cardId":"mc-0002"}', { cookie: user.cookie, origin: NEXT_OWN }), { status: 200 });
  await compare("claim mc-0002 again as a same-origin fetch", claim('{"cardId":"mc-0002"}', { cookie: user.cookie, origin: null, "sec-fetch-site": "same-origin" }), { status: 200 });
  expectEqual("each claimed card has exactly one row", ownedRows(user.userId), "mc-0001\nmc-0002");

  // The first claim of a card by each server, on two cards: same answer but
  // for the card and the time, and the same kind of row.
  const viaNext = await send(nextBase, claimAs(user, "mc-0003"));
  const viaAxum = await send(axumBase, claimAs(user, "mc-0004"));
  expectEqual(
    "a first claim through Axum answers like one through Next",
    maskTime(viaAxum.body.toString()).replace("mc-0004", "<card>") + viaAxum.status,
    maskTime(viaNext.body.toString()).replace("mc-0003", "<card>") + viaNext.status,
  );
  const row = (card) => psql(`select user_id, created_at is not null, created_at > now() - interval '1 minute' from public.user_meme_cards where user_id = ${sqlText(user.userId)} and card_id = ${sqlText(card)}`);
  expectEqual("the row Axum wrote equals the row Next wrote", row("mc-0004"), row("mc-0003"), row("mc-0003"));

  // A user whose auth.users row is gone cannot own a card (foreign key): 409.
  psql(`delete from auth.users where id = ${sqlText(otherUser.userId)}`);
  await compare("claim by a user without an auth.users row", claimAs(otherUser, "mc-0005"), { status: 409 });
  expectEqual("no row was written for that user", ownedRows(otherUser.userId), "");
}

async function collections() {
  // 26 more cards with known claim times, two of them at the same instant,
  // and the inactive card 31, which the user owned before it was hidden.
  const values = [];
  for (let n = 5; n <= 31; n += 1) {
    const second = n === 11 ? 10 : n; // cards 10 and 11 share a claim time
    values.push(`(${sqlText(user.userId)}, ${sqlText(cardId(n))}, timestamptz '2026-01-01 00:00:00.123456+00' + interval '${second} seconds')`);
  }
  psql(`insert into public.user_meme_cards (user_id, card_id, created_at) values ${values.join(", ")}`);
  for (const [label, path] of [
    ["collection page 1 (the newest 24)", "/api/meme-cards/collection"],
    ["collection page 2, with the hidden card", "/api/meme-cards/collection?page=2"],
    ["collection page past the end", "/api/meme-cards/collection?page=3"],
    ["collection by category (hidden card left out)", "/api/meme-cards/collection?category=phrase"],
    ["collection by name", "/api/meme-cards/collection?query=hype"],
    ["collection by name and category", "/api/meme-cards/collection?query=%EC%B9%B4%EB%93%9C&category=image&page=1"],
    ["collection by name with no match", "/api/meme-cards/collection?query=zzzz"],
    ["owned card ids among some", "/api/meme-cards/collection?cardIds=mc-0031,mc-0001,mc-0034,mc-0002,mc-0001,mc-0999"],
    ["owned card ids, 24 of them", `/api/meme-cards/collection?cardIds=${Array.from({ length: 24 }, (_, i) => cardId(i + 8)).join(",")}`],
  ]) {
    await compare(label, signedIn(path), { status: 200 });
  }
  await compare("collection, signed in, unknown parameter", signedIn("/api/meme-cards/collection?x=1"), { status: 400 });
  await compare("another user sees only their own cards", signedIn("/api/meme-cards/collection", otherUser), { status: 200 });
  await compare("HEAD collection, signed in", { method: "HEAD", ...signedIn("/api/meme-cards/collection") });
}

async function emptyCatalogue() {
  psql("delete from public.user_meme_cards; delete from public.meme_collectible_cards;");
  await compare("catalogue with no card", get("/api/meme-cards"), { status: 200 });
  await compare("one card with no card", get("/api/meme-cards/mc-0001"), { status: 404 });
  await compare("collection with no card, signed in", signedIn("/api/meme-cards/collection"), { status: 200 });
  await compare("claim with no card, signed in", claimAs(user, "mc-0001"), { status: 404 });
}

function seedQuizPool(count) {
  const seed = fileURLToPath(new URL("./seed-memes.mjs", import.meta.url));
  psql(execFileSync(process.execPath, [seed, count === 0 ? "empty" : "pool", String(count)], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
}
const approved = (where = "true") => psql(`select short_id from public.memes where moderation_status = 'approved' and ${where} order by short_id`).split("\n").filter(Boolean);
const quiz = (query) => get(`/api/quiz${query}`);

/** Random quizzes: the answers differ, so their shape and their memes are compared. */
async function randomQuiz(label, query, allowed, draws) {
  const seen = { next: new Set(), axum: new Set() };
  let shape = null;
  for (let draw = 0; draw < draws; draw += 1) {
    for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
      const response = await send(base, quiz(query));
      const body = JSON.parse(response.body.toString());
      const problems = [];
      if (response.status !== 200 || body.questions?.length !== 10) problems.push(`status ${response.status}, ${body.questions?.length} questions`);
      for (const question of body.questions ?? []) {
        if (!allowed.has(question.meme.shortId)) problems.push(`${question.meme.shortId} is not in the pool of this mode`);
        if (new Set(question.options).size !== 4 || !(question.answerIndex >= 0 && question.answerIndex < 4)) problems.push("options");
        seen[name].add(question.meme.shortId);
      }
      // Everything but the questions themselves: status, headers, key order.
      const outline = JSON.stringify([response.status, body.mode, Object.keys(body), (body.questions ?? []).map((q) => [Object.keys(q), Object.keys(q.meme)]), response.headers["cache-control"], response.headers["content-type"], response.headers.vary]);
      shape ??= outline;
      if (outline !== shape) problems.push(`shape differs: ${outline}`);
      if (problems.length) return fail(`${label}, ${name}, draw ${draw + 1}`, problems.join("\n"));
    }
  }
  pass(label, `${draws} draws each: 10 questions from the pool; Next reached ${seen.next.size} memes, Axum ${seen.axum.size}`);
  return seen;
}

async function quizzes() {
  seedQuizPool(300);
  const all = approved();
  const pick = (from, count, step) => Array.from({ length: count }, (_, i) => from[(i * step + 7) % from.length]);
  const ten = pick(all, 10, 29);
  const unknown = ["zzzzzzz1", "zzzzzzz2", "zzzzzzz3", "zzzzzzz4", "zzzzzzz5", "zzzzzzz6"];
  for (const [label, query, status] of [
    ["shared set of ten", `?set=${ten.join(",")}`, 200],
    ["shared set, mode now (the wrong options change)", `?mode=now&set=${ten.join(",")}`, 200],
    ["shared set, mode retro", `?mode=retro&set=${ten.join(",")}`, 200],
    ["shared set, unknown mode is all", `?mode=x&set=${ten.join(",")}`, 200],
    ["shared set of one", `?set=${all[0]}`, 200],
    ["shared set in another order", `?set=${[...ten].reverse().join(",")}`, 200],
    ["shared set with spaces around the ids", `?set=%20${ten[0]}%20,%09${ten[1]}`, 200],
    ["shared set, half of it unknown", `?set=${[...ten.slice(0, 3), ...unknown.slice(0, 3)].join(",")}`, 200],
    ["shared set, more than half unknown", `?set=${[...ten.slice(0, 2), ...unknown.slice(0, 3)].join(",")}`, 502],
    ["shared set, all unknown", `?set=${unknown.slice(0, 2).join(",")}`, 502],
    ["set twice: the first counts", `?set=${ten.slice(0, 4).join(",")}&set=x`, 200],
    ["empty set", "?set=", 400],
    ["set of eleven", `?set=${pick(all, 11, 13).join(",")}`, 400],
    ["set with a repeated id", `?set=${ten[0]},${ten[0]}`, 400],
    ["set in capitals", `?set=${ten[0].toUpperCase()}`, 400],
    ["set with a short id", "?set=abcdefg", 400],
    ["set with a trailing comma", `?set=${ten[0]},`, 400],
    ["invalid set with a mode", "?mode=now&set=x", 400],
  ]) {
    await compare(label, quiz(query), { status });
  }
  await compare("HEAD shared set", { method: "HEAD", path: `/api/quiz?set=${ten.join(",")}` });
  for (const method of ["POST", "OPTIONS", "DELETE"]) await compare(`${method} /api/quiz (Next's own answer)`, { method, path: "/api/quiz" });

  await randomQuiz("random quiz", "", new Set(all), 15);
  await randomQuiz("random quiz, mode now", "?mode=now", new Set(approved("origin_year >= 2020")), 15);
  await randomQuiz("random quiz, mode retro", "?mode=retro", new Set(approved("origin_year <= 2009")), 15);

  // A pool barely large enough: every quiz uses almost all of it, so both
  // servers must reach the same memes.
  seedQuizPool(16);
  const small = await randomQuiz("random quiz from a pool of 16", "", new Set(approved()), 40);
  if (small) expectEqual("both servers reach the same memes of the small pool", [...small.axum].sort().join(), [...small.next].sort().join(), `${small.next.size} memes`);
  await compare("shared set from the small pool", quiz(`?set=${approved().slice(0, 5).join(",")}`), { status: 200 });

  seedQuizPool(4);
  await compare("random quiz, pool too small", quiz(""), { status: 502 });
  await compare("random quiz, mode with no meme", quiz("?mode=retro"), { status: 502 });
  seedQuizPool(0);
  await compare("random quiz, no approved meme", quiz(""), { status: 502 });
  await compare("shared set, no approved meme", quiz(`?set=${ten.join(",")}`), { status: 502 });
  await compare("HEAD random quiz, no approved meme", { method: "HEAD", path: "/api/quiz" });
}

await run({
  cards: async () => {
    await cardReads();
    await claims();
    await collections();
    await emptyCatalogue();
  },
  quiz: quizzes,
});
