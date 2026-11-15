/**
 * 출처 파이프라인 스크립트 공용 DB 헬퍼.
 * 예전 PostgREST 경로 문법(`table?col=eq.v&select=...`)을 그대로 받아
 * 자체 호스팅 Postgres(DATABASE_URL)의 service-role 플랜 클라이언트로 실행한다.
 * 실행: node scripts/<script>.mjs (Node 22.18+ 타입 스트리핑; 경로 훅은 여기서 등록)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RESERVED = new Set(["select", "order", "offset", "limit", "on_conflict"]);

export function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local이 없으면 프로세스 환경변수만 사용한다(CI).
  }
  return env;
}

/** `eq.x`, `not.is.null`, `in.(a,b)` → [op, value, negate] */
export function parseFilterValue(raw) {
  const negate = raw.startsWith("not.");
  const rest = negate ? raw.slice(4) : raw;
  const dot = rest.indexOf(".");
  if (dot < 1) throw new Error(`unsupported filter: ${raw}`);
  const op = rest.slice(0, dot);
  let value = rest.slice(dot + 1);
  if (op === "in") {
    if (!/^\(.*\)$/.test(value)) throw new Error(`unsupported in filter: ${raw}`);
    value = value.slice(1, -1).split(",").map((v) => v.trim()).filter(Boolean);
  } else if (op === "is") {
    value = value === "null" ? null : value === "true" ? true : value === "false" ? false : value;
  }
  return [op, value, negate];
}

/** PostgREST 경로 + fetch init → 플랜 빌더 체인. */
export function buildRestQuery(db, path, init = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const [table, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  const prefer = String(init.headers?.Prefer ?? init.headers?.prefer ?? "");
  const body = init.body === undefined ? undefined : JSON.parse(init.body);
  const returning = prefer.includes("return=representation");
  const from = db.from(table);

  let query;
  if (method === "GET") query = from.select(params.get("select") ?? "*");
  else if (method === "POST") {
    const onConflict = params.get("on_conflict") ?? undefined;
    const ignore = prefer.includes("resolution=ignore-duplicates");
    query = onConflict || ignore || prefer.includes("resolution=merge-duplicates")
      ? from.upsert(body, { onConflict, ignoreDuplicates: ignore })
      : from.insert(body);
    if (returning) query = query.select(params.get("select") ?? "*");
  } else if (method === "PATCH") {
    query = from.update(body);
    if (returning) query = query.select(params.get("select") ?? "*");
  } else if (method === "DELETE") query = from.delete();
  else throw new Error(`unsupported method: ${method}`);

  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    if (key === "or") {
      if (!/^\(.*\)$/.test(raw)) throw new Error(`unsupported or filter: ${raw}`);
      query = query.or(raw.slice(1, -1));
      continue;
    }
    const [op, value, negate] = parseFilterValue(raw);
    query = negate ? query.not(key, op, value) : query.filter(key, op, value);
  }
  for (const part of (params.get("order") ?? "").split(",").filter(Boolean)) {
    const [column, ...modifiers] = part.split(".");
    const nulls = modifiers.find((m) => m === "nullsfirst" || m === "nullslast");
    query = query.order(column, {
      ascending: !modifiers.includes("desc"),
      ...(nulls ? { nullsFirst: nulls === "nullsfirst" } : {}),
    });
  }
  if (params.has("limit")) {
    const offset = Number(params.get("offset") ?? 0);
    query = query.range(offset, offset + Number(params.get("limit")) - 1);
  }
  return query;
}

/** role "anon" reads through RLS like a public visitor; the default is service_role. */
export function createRestClient(env = loadEnv(), { role = "service_role" } = {}) {
  if (!env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL 누락 (.env.local 또는 환경변수)");
    process.exit(1);
  }
  process.env.DATABASE_URL ??= env.DATABASE_URL;
  let client;
  const db = async () => {
    // `@/` 경로 훅 — 커맨드라인에 --import 없이 실행해도 TS 앱 모듈을 불러온다.
    client ??= import("./register-ts-paths.mjs").then(() => role === "anon"
      ? Promise.all([import("../lib/db/plan.ts"), import("../lib/db/execute.ts")]).then(
          ([{ createPlanClient }, { executePlan }]) =>
            createPlanClient((plan, signal) =>
              executePlan(plan, { userId: null, role: "anon", anonymous: false }, signal)),
        )
      : import("../lib/db/admin.ts").then((m) => m.createAdminClient()));
    return client;
  };

  return async function rest(path, init = {}) {
    const { data, error } = await buildRestQuery(await db(), path, init);
    if (error) {
      throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} → ${error.message}`);
    }
    return data ?? null;
  };
}

/** 행 전체를 페이지네이션으로 가져온다. */
export async function restAll(rest, path, { pageSize = 1000 } = {}) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await rest(`${path}${sep}offset=${offset}&limit=${pageSize}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}
