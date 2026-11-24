// Malformed and hostile plans for db-query.mjs: every field the TypeScript
// reads, given the wrong type, a value at and past each bound, quotes,
// semicolons, comments, unicode and control characters, system columns,
// other schemas and tables the browser has no business with, overloaded and
// unknown functions, and writes that row-level security must stop. Each is
// sent to both servers; what matters is that the answers (and rows) agree,
// not what they are.
import { SEED } from "./seed-ids.mjs";

const M = SEED.memes;

const select = (extra = {}) => ({
  op: "select",
  table: "memes",
  fields: [{ kind: "column", name: "id" }, { kind: "column", name: "title" }],
  filters: [],
  orGroups: [],
  orders: [{ column: "id", ascending: true }],
  limit: 5,
  offset: null,
  single: false,
  maybeSingle: false,
  count: null,
  head: false,
  onConflict: null,
  ignoreDuplicates: false,
  returning: true,
  ...extra,
});

const rpc = (fn, args, extra = {}) => ({ ...select({ op: "rpc", table: undefined, fields: [{ kind: "star" }], orders: [], limit: null, ...extra }), fn, args });

const embed = (table, extra = {}) => ({
  kind: "embed",
  embed: { alias: table, table, inner: false, hint: null, fields: [{ kind: "star" }], filters: [], orGroups: [], orders: [], limit: null, ...extra },
});

const write = (op, table, extra = {}) => ({ ...select({ op, table, fields: [{ kind: "star" }], orders: [], limit: null, returning: false }), ...extra });

const filter = (column, op, value, negate) => ({ column, op, value, ...(negate === undefined ? {} : { negate }) });

const HOSTILE_NAMES = [
  5, null, true, {}, ["title"], [["title"]], ["a", "b"], "", " title", "title ", "TITLE", "title;", "title--", "title/*x*/",
  'title"', '"title"', "ti tle", "títle", "title\u0000", "title\n", "ctid", "xmin", "tableoid", "a".repeat(70), "_", "1title",
];

const HOSTILE_TABLES = [
  undefined, null, 5, true, ["memes"], "", "memes;", "memes--", 'memes"', '"memes"', "MEMES", "Memes", "mémes", "memes\n",
  "pg_class", "pg_catalog.pg_class", "public.memes", "user", "session", "account", "verification", "information_schema",
  "a".repeat(64), "_memes", "generation_vote_stats", "youtube_channel_connections", "notification_outbox", "admin_audit_log",
  "profiles", "api_rate_limits", "billing_orders", "mcp_operator_state", "web_push_subscriptions", "saved_memes",
];

const VALUES = [
  null, true, 0, -0, 1.5, 1e300, 2147483648, "", "'; drop table memes; --", "/* */", "\u0000", "😀 é", "a\\b\"c", [], [1, "a", null],
  [[1]], [{}], { a: 1, 1: "b" }, "{a,b}", "now", "infinity", "2024-13-01", "abc", "1e400",
];

/** Each plan with a name and whether it may write. */
export function fuzzPlans(self) {
  const plans = [];
  const add = (name, plan, writes = false) => plans.push({ name, body: { plan }, writes });
  const raw = (name, body) => plans.push({ name, body, writes: false });

  for (const op of [undefined, 5, null, "SELECT", " select", "rpc;", ["select"], "upsert "]) add(`op ${JSON.stringify(op)}`, select({ op }));
  for (const table of HOSTILE_TABLES) add(`table ${JSON.stringify(table)?.slice(0, 30)}`, select({ table, fields: [{ kind: "star" }], orders: [] }));
  for (const name of HOSTILE_NAMES) add(`field ${JSON.stringify(name)?.slice(0, 30)}`, select({ fields: [{ kind: "column", name }] }));
  for (const fields of [[], [{}], [[]], [{ kind: "other" }], [{ kind: "embed" }], [{ kind: "embed", embed: 5 }], [5], [null], [{ kind: "star" }, { kind: "column", name: "id" }], [{ kind: "column" }]]) {
    add(`fields ${JSON.stringify(fields)}`, select({ fields }));
  }
  for (const column of HOSTILE_NAMES.concat(["meme_contents.platform", ".title", "title.", "a..b", "meme_contents.x;y"])) {
    add(`filter column ${JSON.stringify(column)?.slice(0, 30)}`, select({ filters: [filter(column, "eq", "x")] }));
    add(`or column ${JSON.stringify(column)?.slice(0, 30)}`, select({ orGroups: [[filter(column, "eq", "x")]] }));
  }
  for (const op of ["zz", null, 5, "not", "EQ", "eq;", undefined]) add(`filter op ${JSON.stringify(op)}`, select({ filters: [filter("title", op, "x")] }));
  for (const value of VALUES) {
    for (const [column, op] of [["title", "eq"], ["id", "eq"], ["published_at", "gte"], ["trend_score", "lt"], ["usage_examples", "contains"], ["moderation_status", "in"], ["aliases", "contains"], ["title", "ilike"]]) {
      add(`value ${column} ${op} ${JSON.stringify(value)?.slice(0, 20)}`, select({ filters: [filter(column, op, value)] }));
    }
    add(`is ${JSON.stringify(value)?.slice(0, 20)}`, select({ filters: [filter("published_at", "is", value, true)] }));
  }
  for (const negate of ["yes", 0, [], {}, null, "false"]) add(`negate ${JSON.stringify(negate)}`, select({ filters: [filter("title", "eq", null, negate), filter("id", "in", [], negate)] }));
  for (const elements of [[null], [5], ["x"], [[]]]) {
    add(`filters ${JSON.stringify(elements)}`, select({ filters: elements }));
    add(`orGroup ${JSON.stringify(elements)}`, select({ orGroups: [elements] }));
    add(`orders ${JSON.stringify(elements)}`, select({ orders: elements }));
  }
  add("orGroups not arrays", select({ orGroups: [5] }));
  add("orGroups empty group", select({ orGroups: [[]] }));
  for (const [key, count] of [["filters", 50], ["filters", 51], ["orGroups", 20], ["orGroups", 21], ["orders", 20], ["orders", 21]]) {
    const item = key === "filters" ? filter("title", "neq", "z") : key === "orGroups" ? [filter("title", "neq", "z")] : { column: "id", ascending: false };
    add(`${key} x${count}`, select({ [key]: Array.from({ length: count }, () => item) }));
  }
  add("or group of 51", select({ orGroups: [Array.from({ length: 51 }, () => filter("title", "eq", "z"))] }));
  for (const order of [{ column: "id", ascending: "no" }, { column: "id", ascending: true, nullsFirst: null }, { column: "id", nullsFirst: "x" }, { column: "id", nullsFirst: 0 }, { column: ["id"] }, { column: "id;" }, {}]) {
    add(`order ${JSON.stringify(order)}`, select({ orders: [order] }));
  }
  for (const limit of [0, 1000, 1001, -1, 1.5, "5", 1e300, null, undefined, true, -0]) add(`limit ${JSON.stringify(limit)}`, select({ limit }));
  for (const offset of [undefined, -1, 1.5, "1", 1e300, 2147483648, 2147483647, true, 0, -0]) add(`offset ${JSON.stringify(offset)}`, select({ offset }));
  for (const value of ["false", 0, 1, [], {}, null]) {
    add(`single ${JSON.stringify(value)}`, select({ single: value }));
    add(`maybeSingle ${JSON.stringify(value)}`, select({ maybeSingle: value, limit: 2 }));
    add(`head ${JSON.stringify(value)}`, select({ head: value, count: "exact" }));
  }
  for (const count of ["exact", "EXACT", true, "planned"]) add(`count ${JSON.stringify(count)}`, select({ count }));

  // Embeds.
  for (const table of ["meme_contents", "pg_class", 5, ["meme_contents"], "memes", "user", "saved_memes", "profiles", null, "meme_tags_map"]) {
    add(`embed table ${JSON.stringify(table)}`, select({ fields: [{ kind: "star" }, embed(table)] }));
  }
  for (const alias of ["x;", 5, ["a"], null, "ok_alias", 'a"b']) add(`embed alias ${JSON.stringify(alias)}`, select({ fields: [{ kind: "star" }, embed("meme_contents", { alias })] }));
  for (const hint of ["discussions_user_id_fkey", 5, "nope", ["x"], ""]) {
    add(`embed hint ${JSON.stringify(hint)}`, select({ table: "discussions", fields: [{ kind: "star" }, embed("profiles", { hint })], orders: [] }));
  }
  for (const inner of ["yes", 0, 1, [], "false"]) add(`embed inner ${JSON.stringify(inner)}`, select({ fields: [{ kind: "star" }, embed("meme_contents", { inner })] }));
  for (const limit of [101, -1, 1.5, "5", 100, 0]) add(`embed limit ${JSON.stringify(limit)}`, select({ fields: [embed("meme_contents", { limit })] }));
  add("embed nested 2", select({ table: "discussions", orders: [], fields: [embed("memes", { fields: [embed("meme_contents")] })] }));
  add("embed nested 3", select({ table: "discussions", orders: [], fields: [embed("memes", { fields: [embed("meme_contents", { fields: [embed("memes")] })] })] }));
  add("embed filters", select({ fields: [embed("meme_contents", { filters: [filter("platform", "ilike", "YOUTUBE"), filter(5, "eq", 1)] })] }));
  add("embed filter null", select({ fields: [embed("meme_contents", { filters: [null] })] }));
  add("embed filter number", select({ fields: [embed("meme_contents", { filters: [5] })] }));
  add("embed or", select({ fields: [embed("meme_contents", { orGroups: [[filter("platform", "eq", "tiktok"), filter("availability", "eq", "live")]] })] }));
  add("embed orders", select({ fields: [embed("meme_contents", { orders: [{ column: "created_at", ascending: "no" }, null] })] }));
  add("embed inner filtered", select({ fields: [{ kind: "star" }, embed("meme_contents", { inner: true, filters: [filter("platform", "eq", "tiktok")] })] }));
  add("dotted inner", select({ fields: [embed("meme_contents", { inner: true })], filters: [filter("meme_contents.availability", "in", "(dead,region_blocked)", true)] }));
  add("dotted deep", select({ fields: [embed("meme_tags_map", { fields: [embed("tags")] })], filters: [filter("meme_tags_map.tags.name", "eq", "AI 밈")] }));
  add("embed fields 51", select({ fields: [embed("meme_contents", { fields: Array.from({ length: 51 }, () => ({ kind: "star" })) })] }));
  add("nodes 101", select({ fields: Array.from({ length: 2 }, () => embed("meme_contents", { fields: Array.from({ length: 50 }, () => ({ kind: "star" })) })) }));
  add("embed missing arrays", select({ fields: [{ kind: "embed", embed: { alias: "a", table: "meme_contents", fields: [] } }] }));
  add("embed over budget", select({ limit: 1000, fields: [embed("meme_contents", { limit: 100 }), embed("meme_sources", { limit: 100 })] }));

  // Functions.
  for (const fn of [undefined, null, "", 5, true, ["toggle_save"], [["toggle_save"]], "TOGGLE_SAVE", "toggle_save;", "public.toggle_save", "pg_sleep", "version", "now", "current_setting", "set_config", "is_operator", "get_my_profile", "a".repeat(70), `search_memes${"x".repeat(60)}`]) {
    add(`fn ${JSON.stringify(fn)?.slice(0, 30)}`, rpc(fn, { p_meme_id: M.approved }), true);
  }
  for (const args of ["abc", "", [], [1], 5, true, null, {}, { p_meme_id: "x" }, { p_meme_id: 5 }, { p_meme_id: [1] }, { p_meme_id: { a: 1 } }, { "p_meme_id); select 1; --": "x" }, { P_MEME_ID: M.approved }, { p_meme_id: M.approved, extra: 1 }, JSON.parse('{"__proto__":1}'), { p_meme_id: "\u0000" }]) {
    add(`args ${JSON.stringify(args)?.slice(0, 40)}`, rpc("toggle_save", args), true);
  }
  add("rpc single scalar", rpc("toggle_save", { p_meme_id: M.approved }, { single: true }), true);
  add("rpc head", rpc("is_operator", {}, { head: true, count: "exact" }));
  add("rpc limit 1001", rpc("get_my_profile", {}, { limit: 1001 }));
  add("rpc setof limit 0", rpc("get_my_profile", {}, { limit: 0 }));
  add("rpc setof single", rpc("get_my_profile", {}, { single: true }));
  add("search no offset", rpc("search_memes", { p_query: "seed", p_limit: 5 }, { offset: undefined }));
  add("search filters", rpc("search_memes", { p_query: "seed", p_limit: 50 }, {
    fields: [{ kind: "column", name: "id" }, embed("meme_contents", { inner: true, fields: [{ kind: "column", name: "platform" }] })],
    filters: [filter("meme_contents.platform", "ilike", "youtube"), filter("category", "in", ["phrase"])],
    orders: [{ column: "trend_score", ascending: false }], offset: 0, limit: 10,
  }));
  add("search bad embed", rpc("search_ai_memes", { p_query: "seed", p_limit: 5 }, { fields: [embed("pg_class")], offset: 0 }));
  add("search args extra", rpc("search_memes", { p_query: "seed", p_limit: 5, p_extra: 1 }, { offset: 0 }));
  add("search query types", rpc("search_memes", { p_query: ["a", "b"], p_limit: "x" }, { offset: 0 }));
  add("search dotted non-search", rpc("get_my_profile", {}, { filters: [filter("a.b", "eq", 1)] }));

  // Writes.
  const saved = { user_id: self, meme_id: M.second };
  for (const [name, values] of [["one", saved], ["two", [saved, { meme_id: M.limited, user_id: self }]], ["empty array", []], ["numbers", [1]], ["empty object", {}],
    ["bad key", { "x;": 1 }], ["second lacks key", [saved, { meme_id: M.limited }]], ["proto key", JSON.parse(`{"__proto__":1,"meme_id":"${M.second}"}`)], ["object value", { ...saved, note: { a: 1 } }],
    ["array value", { ...saved, note: ["a", "b"] }], ["missing", undefined], ["string", "x"]]) {
    add(`insert ${name}`, write("insert", "saved_memes", { values }), true);
    add(`insert ${name} returning`, write("insert", "saved_memes", { values, returning: "yes" }), true);
  }
  for (const onConflict of ["user_id,meme_id", "user_id, meme_id ", " ", 5, ["user_id"], "user_id\u0085,meme_id", "x;y", "meme_id", null]) {
    add(`upsert ${JSON.stringify(onConflict)}`, write("upsert", "saved_memes", { values: { ...saved, note: "n" }, onConflict }), true);
  }
  add("upsert ignore", write("upsert", "saved_memes", { values: saved, onConflict: "user_id,meme_id", ignoreDuplicates: "yes" }), true);
  add("upsert only keys", write("upsert", "saved_memes", { values: saved, onConflict: "user_id,meme_id" }), true);
  add("upsert view", write("upsert", "generation_vote_stats", { values: { meme_id: M.approved } }), true);
  for (const [name, values, filters] of [["nickname", { nickname: "hacked" }, [filter("id", "eq", self)]], ["role", { role: "operator" }, [filter("id", "eq", self)]],
    ["all rows", { nickname: "everyone" }, []], ["array values", [{ nickname: "x" }], []], ["bad key", { "a b": 1 }, []], ["none", {}, []], ["in empty", { nickname: "zz" }, [filter("id", "in", [])]]]) {
    add(`update profiles ${name}`, write("update", "profiles", { values, filters }), true);
  }
  add("update memes", write("update", "memes", { values: { title: "x" }, filters: [filter("id", "eq", M.approved)], returning: true }), true);
  add("delete saved", write("delete", "saved_memes", { filters: [filter("meme_id", "eq", M.approved)], returning: true }), true);
  add("delete saved all", write("delete", "saved_memes"), true);
  add("delete outbox", write("delete", "notification_outbox"), true);
  add("insert user", write("insert", "user", { values: { name: "x", email: "x@example.com", emailVerified: true } }), true);
  add("delete dotted", write("delete", "saved_memes", { filters: [filter("memes.id", "eq", M.approved)] }), true);
  add("insert memes", write("insert", "memes", { values: { title: "x", slug: "x" } }), true);

  // Bodies that are not plans at all.
  raw("plan string", { plan: "select" });
  raw("plan number", { plan: 5 });
  raw("two plans", JSON.stringify({ plan: select() }).replace("}", `},"plan":${JSON.stringify(select({ table: "pg_class" }))}`));
  raw("duplicate key", `{"plan":${JSON.stringify(select()).replace('"table":"memes"', '"table":"memes","table":"profiles"')}}`);
  raw("lone surrogate", `{"plan":${JSON.stringify(select({ filters: [filter("title", "eq", "x")] })).replace('"value":"x"', '"value":"\\ud800"')}}`);
  raw("huge number", `{"plan":${JSON.stringify(select()).replace('"limit":5', '"limit":1e400')}}`);
  raw("bom", `﻿${JSON.stringify({ plan: select() })}`);
  return plans;
}
