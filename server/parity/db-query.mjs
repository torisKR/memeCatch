// POST /api/db/query on the real Next and on Axum, one seeded database:
//
//   node server/parity/db-query.mjs <next> <axum> --container=<pg container> \
//     --sessions=<sessions.jsonl> --site=<NEXT_PUBLIC_SITE_URL> [section...]
//
// Sections (all by default): fixture, fuzz, limits, video.
//
// - fixture: every plan of tests/fixtures/db_query_plans.json as anon, a
//   user, another user and an operator. Same status, headers and body; for
//   a write, the database is restored before each server and the rows left
//   after must be the same. The statements each server sent are read back
//   from the Postgres log and must be the same text.
// - fuzz: the hostile plans of db-query/fuzz-plans.mjs, as anon and a user,
//   compared the same way.
// - limits: origin, body size, malformed bodies, the busy cap (six queries
//   held on a row lock), the per-address and global rate limits.
// - video: record_instagram_post_video_verification as operator, user and
//   anon, repeated, and with the operation's advisory lock held (the 40001
//   retry).
//
// Setup (THROWAWAY database only): scripts/test-db.sh, Postgres logging on
// (`log_statement = 'all'`, `log_line_prefix = '@@%a|'`), three sessions
// from parity/behaviour/session.mjs (user, user, operator) in sessions.jsonl,
// db-query/seed.sql with their ids, then db-query/snapshot.sql and
// `select parity.save()`. Both servers with the same NEXT_PUBLIC_SITE_URL
// and CRON_SECRET. parity/README.md ("Database door") has the commands.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fuzzPlans } from "./db-query/fuzz-plans.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [nextBase, axumBase, ...rest] = args.filter((arg) => !arg.startsWith("--"));
const container = flag("container");
const site = flag("site");
const sessions = readFileSync(flag("sessions"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
const sections = rest.length ? rest : ["fixture", "fuzz", "limits", "video"];
const fixture = JSON.parse(readFileSync(new URL("../tests/fixtures/db_query_plans.json", import.meta.url), "utf8"));

const IDENTITIES = [
  { name: "anon", session: null, self: sessions[0].userId },
  { name: "user", session: sessions[0], self: sessions[0].userId },
  { name: "other", session: sessions[1], self: sessions[1].userId },
  { name: "operator", session: sessions[2], self: sessions[2].userId },
];
// Headers that differ between any two answers of one server.
const VOLATILE = new Set(["date", "connection", "keep-alive", "transfer-encoding", "content-length"]);

let failures = 0;
let checks = 0;
let address = 0;

function psql(sql) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "memecatch", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim();
}

const restore = () => psql("select parity.restore()");
const digest = () => psql("select rel || ' ' || digest from parity.digest()");
const mark = (label) => psql(`select 'dbq-mark ${label.replace(/'/g, "")}'`);

/** A request as a browser on the site sends it, from an address of its own. */
async function post(base, body, { session, headers = {} } = {}) {
  address += 1;
  const response = await fetch(`${base}/api/db/query`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: new URL(site).origin,
      "x-forwarded-for": `10.${(address >> 16) & 255}.${(address >> 8) & 255}.${address & 255}`,
      ...(session ? { cookie: `${session.cookieName}=${session.cookieValue}` } : {}),
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  const kept = [...response.headers].filter(([name]) => !VOLATILE.has(name)).sort();
  return { status: response.status, headers: kept, body: text };
}

function same(label, next, axum) {
  checks += 1;
  const a = JSON.stringify(next);
  const b = JSON.stringify(axum);
  if (a === b) return true;
  failures += 1;
  let at = 0;
  while (at < a.length && a[at] === b[at]) at += 1;
  const from = Math.max(0, at - 300);
  console.log(`DIFF ${label} (from character ${at})\n  next: ${a.slice(from, at + 700)}\n  axum: ${b.slice(from, at + 700)}`);
  return false;
}

/** One plan on both servers; a write is restored before each. */
async function compare(label, body, identity, writes) {
  const run = async (base, server, retried = false) => {
    if (writes) restore();
    mark(`${label}|${server}`);
    let answer;
    try {
      answer = await post(base, body, identity);
    } catch (error) {
      // undici can pick a kept-alive socket the server has just closed: the
      // request never arrived. Once more, from a restored database.
      if (retried || error.cause?.code !== "ECONNRESET") throw error;
      console.log(`retry ${label} on ${server}: connection reset`);
      return run(base, server, true);
    }
    // A write stamps rows with now(): today's timestamps differ by run.
    if (writes) answer.body = answer.body.replace(new RegExp(`${new Date().toISOString().slice(0, 10)}T[0-9:.]+\\+00:00`, "g"), "<now>");
    return { answer, rows: writes ? digest() : null };
  };
  const next = await run(nextBase, "next");
  const axum = await run(axumBase, "axum");
  same(`${label} answer`, next.answer, axum.answer);
  if (writes) same(`${label} rows`, next.rows, axum.rows);
  return next.answer;
}

function withSelf(plan, self) {
  return JSON.parse(JSON.stringify(plan).replaceAll("$SELF", self));
}

async function fixtureSection() {
  const since = new Date().toISOString();
  const statuses = {};
  for (const item of fixture) {
    for (const identity of IDENTITIES) {
      const label = `${item.id}/${identity.name}`;
      const answer = await compare(label, { plan: withSelf(item.plan, identity.self) }, identity, item.writes);
      statuses[`${answer.status}`] = (statuses[`${answer.status}`] ?? 0) + 1;
    }
  }
  restore();
  console.log(`fixture: ${fixture.length} plans x ${IDENTITIES.length} identities, statuses ${JSON.stringify(statuses)}`);
  const segments = compareStatements(since);
  if (flag("write-sql")) writeSqlFixture(flag("write-sql"), segments);
}

// The tables the fixture's plans name, for the compiler test's metadata.
const SQL_FIXTURE_TABLES = ["memes", "meme_contents", "meme_sources", "meme_tags_map", "tags", "meme_market_profiles", "profiles",
  "discussions", "community_post_likes", "generation_vote_stats", "generation_votes", "saved_memes"];

/**
 * tests/fixtures/db_query_sql.json: what Next sent for each fixture plan as
 * the signed-in user, and the metadata (as loadMeta reads it) of the tables
 * those plans touch, so src/routes/db_query/sql_tests.rs can compile the
 * same plans without a database and compare the text.
 */
function writeSqlFixture(path, segments) {
  const list = SQL_FIXTURE_TABLES.map((table) => `'${table}'`).join(",");
  const meta = JSON.parse(psql(`select json_build_object(
    'columns', (select json_object_agg(t, cols) from (select c.relname as t, json_object_agg(a.attname, ty.typname order by a.attnum) as cols
        from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
        join pg_type ty on ty.oid = a.atttypid where n.nspname = 'public' and c.relname in (${list}) group by c.relname) x),
    'foreignKeys', (select json_agg(json_build_object('name', con.conname, 'srcTable', src.relname, 'dstTable', dst.relname,
        'srcCols', (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n),
        'dstCols', (select array_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n)) order by con.conname)
        from pg_constraint con join pg_class src on src.oid = con.conrelid join pg_class dst on dst.oid = con.confrelid
        where con.contype = 'f' and src.relname in (${list}) and dst.relname in (${list}) and src.relnamespace = 'public'::regnamespace),
    'functions', (select json_object_agg(p.proname, json_build_object('proretset', p.proretset, 'names', p.proargnames))
        from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (${[...new Set(fixture.map((item) => item.plan.fn).filter(Boolean))].map((fn) => `'${fn}'`).join(",")})))`));
  const cases = fixture.map((item) => ({ id: item.id, sql: segments.get(`${item.id}/user`)?.next ?? [] }));
  writeFileSync(path, `${JSON.stringify({ meta, cases }, null, 1)}\n`);
  console.log(`wrote ${path}: ${cases.length} cases`);
}

/** The plan statements of each marked case, Next's against Axum's. */
function compareStatements(since) {
  // Postgres logs to stderr, which `docker logs` passes on as its own.
  const log = execFileSync("sh", ["-c", 'docker logs --since "$0" "$1" 2>&1', since, container], { encoding: "utf8", maxBuffer: 1 << 30 });
  const segments = new Map();
  let current = null;
  for (const line of log.split("\n")) {
    const marker = line.match(/'dbq-mark ([^|']+)\|(next|axum)'/);
    if (marker) {
      current = { label: marker[1], server: marker[2] };
      continue;
    }
    // node-pg sends a statement without parameters over the simple
    // protocol (`statement:`), the rest as `execute <unnamed>:`.
    const statement = line.match(/^@@(memecatch|memecatch-axum)\|LOG:\s+(?:execute [^:]+|statement): (.*)$/);
    if (!current || !statement) continue;
    const [, app, sql] = statement;
    if ((app === "memecatch") !== (current.server === "next")) continue;
    if (!/^(WITH __q AS \(|SELECT count\(\*\)::int AS count|INSERT INTO public\.|UPDATE public\.|DELETE FROM public\.)/.test(sql) || sql.includes("p.proretset")) continue;
    if (!segments.has(current.label)) segments.set(current.label, { next: [], axum: [] });
    segments.get(current.label)[current.server].push(sql);
  }
  let statements = 0;
  for (const [label, { next, axum }] of segments) {
    statements += next.length;
    same(`${label} statements`, next, axum);
  }
  console.log(`statements: ${statements} plan statements over ${segments.size} cases compared as text`);
  return segments;
}

async function fuzzSection() {
  const plans = fuzzPlans(sessions[0].userId);
  const kinds = {};
  const since = new Date().toISOString();
  for (const [index, plan] of plans.entries()) {
    for (const identity of IDENTITIES.slice(0, 2)) {
      const answer = await compare(`fuzz-${index} ${plan.name}/${identity.name}`, plan.body, identity, plan.writes);
      const kind = `${answer.status} ${answer.body.slice(0, 90)}`;
      kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
  }
  restore();
  console.log(`fuzz: ${plans.length} plans x 2 identities; answers by kind:`);
  for (const [kind, count] of Object.entries(kinds).sort()) console.log(`  ${String(count).padStart(4)}  ${kind}`);
  compareStatements(since);
}

/** Starts a psql session that holds `sql` open until `release()`. */
async function hold(sql) {
  const holder = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "memecatch", "-qAt"], { stdio: ["pipe", "pipe", "inherit"] });
  holder.stdin.write(`begin; ${sql}; select 'held';\n`);
  await new Promise((resolve) => holder.stdout.on("data", (chunk) => String(chunk).includes("held") && resolve()));
  return async () => {
    holder.stdin.end("rollback;\n");
    await new Promise((resolve) => holder.on("exit", resolve));
  };
}

/** Six `toggle_save` calls that wait on a row lock, then a seventh. */
async function busy(base) {
  const user = sessions[0];
  const release = await hold(`select 1 from profiles where id = '${user.userId}' for update`);
  const plan = { plan: fixture.find((item) => item.id === "save-toggle").plan };
  const held = Array.from({ length: 6 }, () => post(base, plan, { session: user }));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const seventh = await post(base, plan, { session: user });
  await release();
  const answers = await Promise.all(held);
  return { seventh, held: answers.map((answer) => answer.status) };
}

async function limitsSection() {
  const plan = { plan: fixture.find((item) => item.id === "saved-state").plan };
  const cases = [
    ["no origin", plan, { origin: "" }],
    ["same-origin fetch", plan, { origin: "", "sec-fetch-site": "same-origin" }],
    ["same-site fetch", plan, { origin: "", "sec-fetch-site": "same-site" }],
    ["other origin", plan, { origin: "https://evil.example" }],
    ["not json", "{", {}],
    ["empty body", "", {}],
    ["null body", "null", {}],
    ["array body", "[]", {}],
    ["no plan", {}, {}],
    ["plan array", { plan: [] }, {}],
    ["body 1 MiB + 1", `{"plan":${JSON.stringify(" ".repeat(1024 * 1024 - 10))}}`, {}],
    ["body exactly 1 MiB", `{"plan":${JSON.stringify(" ".repeat(1024 * 1024 - 11))}}`, {}],
  ];
  for (const [label, body, headers] of cases) {
    same(`limits ${label}`, await post(nextBase, body, { headers }), await post(axumBase, body, { headers }));
  }
  restore();
  const next = await busy(nextBase);
  restore();
  const axum = await busy(axumBase);
  restore();
  console.log(`busy: next ${next.seventh.status} (held ${next.held}); axum ${axum.seventh.status} (held ${axum.held})`);
  same("limits busy seventh", next.seventh, axum.seventh);
  same("limits busy held", next.held, axum.held);
  for (const [label, count, fixed] of [["per address", 181, true], ["global", 1201, false]]) {
    const flood = async (base) => {
      const statuses = [];
      let last;
      for (let i = 0; i < count; i += 1) {
        last = await post(base, "{", { headers: fixed ? { "x-forwarded-for": "10.255.0.1" } : {} });
        statuses.push(last.status);
      }
      const retry = Number(last.headers.find(([name]) => name === "retry-after")?.[1]);
      last.headers = last.headers.filter(([name]) => name !== "retry-after");
      return { last, refused: statuses.filter((status) => status === 429).length, retryInWindow: retry >= 1 && retry <= 60 };
    };
    same(`limits ${label}`, await flood(nextBase), await flood(axumBase));
  }
}

async function videoSection() {
  const base = fixture.find((item) => item.id === "video-verification").plan;
  const [user, , operator] = sessions;
  await compare("video operator", { plan: base }, { session: operator }, true);
  await compare("video user", { plan: base }, { session: user }, true);
  await compare("video anon", { plan: base }, {}, true);
  const twice = async (server) => {
    restore();
    await post(server, { plan: base }, { session: operator });
    return { answer: await post(server, { plan: base }, { session: operator }), rows: digest() };
  };
  same("video idempotent", await twice(nextBase), await twice(axumBase));
  // Another session holds the operation's lock: each attempt fails with
  // 40001 and the route gives up after three.
  const locked = async (server) => {
    restore();
    const release = await hold(`select pg_advisory_xact_lock(hashtextextended('${base.args.p_operation_id}', 1))`);
    const answer = await post(server, { plan: base }, { session: operator });
    await release();
    return { answer, rows: digest() };
  };
  same("video conflict", await locked(nextBase), await locked(axumBase));
  restore();
}

for (const section of sections) {
  const run = { fixture: fixtureSection, fuzz: fuzzSection, limits: limitsSection, video: videoSection }[section];
  if (!run) throw new Error(`unknown section ${section}`);
  await run();
}
console.log(`${checks} checks, ${failures} differences`);
process.exit(failures ? 1 : 0);
