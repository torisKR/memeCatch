import { CompiledQuery, type Transaction } from "kysely";
import {
  attachDottedFilters,
  isIdent,
  quoteIdent,
  type PlanEmbed,
  type PlanField,
  type PlanFilter,
  type PlanOrder,
  type QueryPlan,
  type QueryResult,
} from "@/lib/db/plan";
import { getDb, withIdentity, type DbIdentity } from "@/lib/db/pool";

type ColumnMap = Map<string, Map<string, string>>;

type ForeignKey = {
  name: string;
  srcTable: string;
  srcCols: string[];
  dstTable: string;
  dstCols: string[];
};

type Meta = {
  columns: ColumnMap;
  foreignKeys: ForeignKey[];
  primaryKeys: Map<string, string[]>;
};

type SqlParts = { sql: string; params: unknown[] };

const globalMeta = globalThis as unknown as { __memecatchMeta?: Meta };

function bindValue(value: unknown, udt: string | undefined): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (udt === "jsonb" || udt === "json") return JSON.stringify(value);
  if (typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
  return value;
}

function castFor(udt: string | undefined, value: unknown): string {
  if (Array.isArray(value)) {
    if (udt === "jsonb" || udt === "json") return "::jsonb";
    if (udt === "_uuid" || udt === "uuid") return "::uuid[]";
    if (udt === "_int2" || udt === "_int4" || udt === "_int8" || udt === "int2" || udt === "int4" || udt === "int8") {
      return "::bigint[]";
    }
    if (udt === "_bool" || udt === "bool") return "::boolean[]";
    return "::text[]";
  }
  switch (udt) {
    case "uuid":
      return "::uuid";
    case "timestamptz":
    case "timestamp":
    case "date":
      return "::timestamptz";
    case "jsonb":
    case "json":
      return "::jsonb";
    case "bool":
      return "::boolean";
    case "int2":
    case "int4":
    case "int8":
      return "::bigint";
    case "numeric":
      return "::numeric";
    case "float4":
    case "float8":
      return "::double precision";
    case "text":
    case "varchar":
    case "bpchar":
    case undefined:
      return "";
    default:
      return "";
  }
}

function compileFilter(
  filter: PlanFilter,
  alias: string,
  columns: Map<string, string>,
  params: unknown[],
): string {
  if (!isIdent(filter.column)) throw new Error("invalid identifier");
  const udt = columns.get(filter.column);
  const ref = `${alias}.${quoteIdent(filter.column)}`;
  switch (filter.op) {
    case "is":
      if (filter.value === null) return filter.negate ? `${ref} IS NOT NULL` : `${ref} IS NULL`;
      if (typeof filter.value === "boolean") {
        return `${ref} IS ${filter.negate ? "NOT " : ""}${filter.value ? "TRUE" : "FALSE"}`;
      }
      return compare(ref, filter.negate ? "<>" : "=", filter.value, udt, params);
    case "in": {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      if (values.length === 0) return filter.negate ? "TRUE" : "FALSE";
      params.push(values.map((item) => bindValue(item, udt)));
      const expr = `${ref} = ANY($${params.length}${castFor(udt, values)})`;
      return filter.negate ? `NOT (${expr})` : expr;
    }
    case "contains": {
      params.push(bindValue(filter.value, udt));
      const expr = `${ref} @> $${params.length}${castFor(udt, filter.value)}`;
      return filter.negate ? `NOT (${expr})` : expr;
    }
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
    case "like":
    case "ilike":
      if (filter.value === null && (filter.op === "eq" || filter.op === "neq")) {
        return filter.op === "eq" ? `${ref} IS NULL` : `${ref} IS NOT NULL`;
      }
      return compare(ref, operatorSql(filter.op), filter.value, udt, params, filter.negate);
    default: {
      const unknownOp: never = filter.op;
      throw new Error(`invalid filter ${String(unknownOp)}`);
    }
  }
}

function operatorSql(op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike"): string {
  switch (op) {
    case "eq":
      return "=";
    case "neq":
      return "<>";
    case "gt":
      return ">";
    case "gte":
      return ">=";
    case "lt":
      return "<";
    case "lte":
      return "<=";
    case "like":
      return "LIKE";
    case "ilike":
      return "ILIKE";
    default: {
      const unknownOp: never = op;
      throw new Error(`invalid filter ${String(unknownOp)}`);
    }
  }
}

function compare(
  ref: string,
  op: string,
  value: unknown,
  udt: string | undefined,
  params: unknown[],
  negate = false,
): string {
  params.push(bindValue(value, udt));
  const expr = `${ref} ${op} $${params.length}${castFor(udt, value)}`;
  return negate ? `NOT (${expr})` : expr;
}

function whereSql(
  filters: PlanFilter[],
  orGroups: PlanFilter[][],
  alias: string,
  columns: Map<string, string>,
  params: unknown[],
): string {
  const parts = filters.map((filter) => compileFilter(filter, alias, columns, params));
  for (const group of orGroups) {
    if (group.length === 0) continue;
    parts.push(`(${group.map((filter) => compileFilter(filter, alias, columns, params)).join(" OR ")})`);
  }
  return parts.length ? parts.join(" AND ") : "TRUE";
}

function orderSql(orders: PlanOrder[], alias: string, params: unknown[]): string {
  if (orders.length === 0) return "";
  const parts = orders.map((order) => {
    if (!isIdent(order.column)) throw new Error("invalid identifier");
    const direction = order.ascending ? "ASC" : "DESC";
    const nulls = order.nullsFirst === undefined ? "" : order.nullsFirst ? " NULLS FIRST" : " NULLS LAST";
    return `${alias}.${quoteIdent(order.column)} ${direction}${nulls}`;
  });
  void params;
  return ` ORDER BY ${parts.join(", ")}`;
}

function limitSql(limit: number | null, offset: number | null, params: unknown[]): string {
  let sql = "";
  if (limit !== null) {
    if (!Number.isInteger(limit) || limit < 0 || limit > 5000) throw new Error("invalid identifier");
    params.push(limit);
    sql += ` LIMIT $${params.length}::int`;
  }
  if (offset !== null) {
    if (!Number.isInteger(offset) || offset < 0) throw new Error("invalid identifier");
    params.push(offset);
    sql += ` OFFSET $${params.length}::int`;
  }
  return sql;
}

function tableColumns(meta: Meta, table: string): Map<string, string> {
  if (!isIdent(table)) throw new Error("invalid identifier");
  const columns = meta.columns.get(table);
  if (!columns) throw new Error("invalid identifier");
  return columns;
}

function pickForeignKey(parent: string, embed: PlanEmbed, foreignKeys: ForeignKey[]): ForeignKey {
  const candidates = foreignKeys.filter(
    (fk) =>
      (fk.srcTable === parent && fk.dstTable === embed.table) ||
      (fk.srcTable === embed.table && fk.dstTable === parent),
  );
  const hinted = embed.hint ? candidates.filter((fk) => fk.name === embed.hint) : candidates;
  if (hinted.length === 1) return hinted[0]!;
  const singular = embed.table.endsWith("ies")
    ? `${embed.table.slice(0, -3)}y`
    : embed.table.endsWith("s")
      ? embed.table.slice(0, -1)
      : embed.table;
  const preferred = hinted.filter((fk) =>
    fk.srcCols.some((column) => column === `${singular}_id` || column === `${parent.replace(/s$/, "")}_id`),
  );
  if (preferred.length === 1) return preferred[0]!;
  throw new Error("invalid identifier");
}

function joinSql(parent: string, parentAlias: string, childAlias: string, fk: ForeignKey): { manyToOne: boolean; sql: string } {
  if (fk.srcTable === parent) {
    return {
      manyToOne: true,
      sql: fk.srcCols
        .map((column, index) => `${childAlias}.${quoteIdent(fk.dstCols[index] ?? "")} = ${parentAlias}.${quoteIdent(column)}`)
        .join(" AND "),
    };
  }
  return {
    manyToOne: false,
    sql: fk.srcCols
      .map((column, index) => `${childAlias}.${quoteIdent(column)} = ${parentAlias}.${quoteIdent(fk.dstCols[index] ?? "")}`)
      .join(" AND "),
  };
}

let aliasSeq = 0;

function nextAlias(): string {
  aliasSeq += 1;
  return `r${aliasSeq}`;
}

function renderEmbed(parent: string, parentAlias: string, embed: PlanEmbed, meta: Meta, params: unknown[]): { select: string; exists: string | null } {
  const childAlias = nextAlias();
  const fk = pickForeignKey(parent, embed, meta.foreignKeys);
  const joined = joinSql(parent, parentAlias, childAlias, fk);
  const columns = tableColumns(meta, embed.table);
  const where = `${joined.sql} AND ${whereSql(embed.filters, embed.orGroups, childAlias, columns, params)}`;
  const projected = renderFieldList(embed.fields, embed.table, childAlias, meta, params);
  const limited = `${orderSql(embed.orders, childAlias, params)}${limitSql(embed.limit, null, params)}`;
  const select = joined.manyToOne
    ? `(SELECT row_to_json(e) FROM (SELECT ${projected} FROM public.${quoteIdent(embed.table)} ${childAlias} WHERE ${where}${limited}) e) AS ${quoteIdent(embed.alias)}`
    : `(SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT ${projected} FROM public.${quoteIdent(embed.table)} ${childAlias} WHERE ${where}${limited}) e) AS ${quoteIdent(embed.alias)}`;
  const exists = embed.inner
    ? `EXISTS (SELECT 1 FROM public.${quoteIdent(embed.table)} ${childAlias} WHERE ${where})`
    : null;
  return { select, exists };
}

function renderFieldList(fields: PlanField[], table: string, alias: string, meta: Meta, params: unknown[]): string {
  const scalars = fields.filter((field) => field.kind !== "embed");
  const cols: string[] = [];
  if (scalars.length === 0 || scalars.some((field) => field.kind === "star")) cols.push(`${alias}.*`);
  for (const field of scalars) {
    if (field.kind === "column") cols.push(`${alias}.${quoteIdent(field.name)}`);
  }
  const exists: string[] = [];
  for (const field of fields) {
    if (field.kind !== "embed") continue;
    const rendered = renderEmbed(table, alias, field.embed, meta, params);
    cols.push(rendered.select);
    if (rendered.exists) exists.push(rendered.exists);
  }
  void exists;
  return cols.join(", ");
}

function innerExists(fields: PlanField[], table: string, alias: string, meta: Meta, params: unknown[]): string[] {
  const checks: string[] = [];
  for (const field of fields) {
    if (field.kind !== "embed" || !field.embed.inner) continue;
    const childAlias = nextAlias();
    const fk = pickForeignKey(table, field.embed, meta.foreignKeys);
    const joined = joinSql(table, alias, childAlias, fk);
    const columns = tableColumns(meta, field.embed.table);
    checks.push(
      `EXISTS (SELECT 1 FROM public.${quoteIdent(field.embed.table)} ${childAlias} WHERE ${joined.sql} AND ${whereSql(field.embed.filters, field.embed.orGroups, childAlias, columns, params)})`,
    );
  }
  return checks;
}

function selectSql(plan: QueryPlan, meta: Meta, counting: boolean): SqlParts {
  const table = plan.table ?? "";
  const columns = tableColumns(meta, table);
  const params: unknown[] = [];
  aliasSeq = 0;
  const alias = nextAlias();
  const projected = counting ? "count(*)::int AS count" : renderFieldList(plan.fields, table, alias, meta, params);
  const filters = whereSql(plan.filters, plan.orGroups, alias, columns, params);
  const exists = innerExists(plan.fields, table, alias, meta, params).join(" AND ");
  const where = exists ? `${filters} AND ${exists}` : filters;
  const page = counting ? "" : `${orderSql(plan.orders, alias, params)}${limitSql(plan.limit, plan.offset, params)}`;
  return {
    sql: `SELECT ${projected} FROM public.${quoteIdent(table)} ${alias} WHERE ${where}${page}`,
    params,
  };
}

function columnList(rows: Record<string, unknown>[]): string[] {
  const keys = Object.keys(rows[0] ?? {});
  if (keys.length === 0) throw new Error("invalid identifier");
  for (const key of keys) if (!isIdent(key)) throw new Error("invalid identifier");
  return keys;
}

function writeRows(plan: QueryPlan): { columns: string[]; records: Record<string, unknown>[] } {
  const raw = Array.isArray(plan.values) ? plan.values : [plan.values];
  const records = raw.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));
  if (records.length === 0) throw new Error("invalid identifier");
  return { columns: columnList(records), records };
}

function valuesSql(records: Record<string, unknown>[], columns: string[], types: Map<string, string>, params: unknown[]): string {
  return records
    .map((record) => {
      const slots = columns.map((column) => {
        const udt = types.get(column);
        params.push(bindValue(record[column] ?? null, udt));
        return `$${params.length}${castFor(udt, record[column] ?? null)}`;
      });
      return `(${slots.join(", ")})`;
    })
    .join(", ");
}

function mutationSql(plan: QueryPlan, meta: Meta): SqlParts {
  const table = plan.table ?? "";
  const types = tableColumns(meta, table);
  const params: unknown[] = [];
  const returning = plan.returning ? " RETURNING *" : "";
  if (plan.op === "insert" || plan.op === "upsert") {
    const { columns, records } = writeRows(plan);
    const inserted = `INSERT INTO public.${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES ${valuesSql(records, columns, types, params)}`;
    if (plan.op === "insert") return { sql: `${inserted}${returning}`, params };
    const conflict = (plan.onConflict ? plan.onConflict.split(",") : meta.primaryKeys.get(table) ?? []).map((column) => column.trim()).filter(Boolean);
    if (conflict.length === 0 || conflict.some((column) => !isIdent(column))) throw new Error("invalid identifier");
    const action = plan.ignoreDuplicates
      ? "DO NOTHING"
      : `DO UPDATE SET ${columns.filter((column) => !conflict.includes(column)).map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`).join(", ") || `${quoteIdent(conflict[0]!)} = public.${quoteIdent(table)}.${quoteIdent(conflict[0]!)}`}`;
    return {
      sql: `${inserted} ON CONFLICT (${conflict.map(quoteIdent).join(", ")}) ${action}${returning}`,
      params,
    };
  }
  aliasSeq = 0;
  const alias = nextAlias();
  const where = whereSql(plan.filters, plan.orGroups, alias, types, params);
  if (plan.op === "delete") {
    return { sql: `DELETE FROM public.${quoteIdent(table)} ${alias} WHERE ${where}${returning}`, params };
  }
  const values = plan.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("invalid identifier");
  const entries = Object.entries(values as Record<string, unknown>);
  if (entries.length === 0 || entries.some(([column]) => !isIdent(column))) throw new Error("invalid identifier");
  const assignments = entries.map(([column, value]) => {
    const udt = types.get(column);
    params.push(bindValue(value, udt));
    return `${quoteIdent(column)} = $${params.length}${castFor(udt, value)}`;
  });
  return {
    sql: `UPDATE public.${quoteIdent(table)} ${alias} SET ${assignments.join(", ")} WHERE ${where}${returning}`,
    params,
  };
}

type PgFunction = { proretset: boolean; names: string[] | null; types: string[] | null };

async function loadFunctions(name: string): Promise<PgFunction[]> {
  if (!isIdent(name)) throw new Error("invalid identifier");
  const result = await getDb()
    .transaction()
    .execute(async (trx) =>
      trx.executeQuery<{ proretset: boolean; names: string[] | null; types: string[] | null }>(
        CompiledQuery.raw(
          `SELECT p.proretset,
                  p.proargnames AS names,
                  (SELECT array_agg(t.typname ORDER BY args.ord)
                     FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS args(typ, ord)
                     JOIN pg_type t ON t.oid = args.typ) AS types
             FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = $1`,
          [name],
        ),
      ),
    );
  return result.rows;
}

function rpcSql(plan: QueryPlan, fn: PgFunction): SqlParts {
  const name = plan.fn ?? "";
  const args = plan.args ?? {};
  const params: unknown[] = [];
  const names = fn.names ?? [];
  const types = fn.types ?? [];
  const pairs = Object.entries(args).map(([key, value]) => {
    if (!isIdent(key)) throw new Error("invalid identifier");
    const index = names.indexOf(key);
    const udt = index >= 0 ? types[index] : undefined;
    params.push(bindValue(value, udt));
    return `${quoteIdent(key)} => $${params.length}${castFor(udt, value)}`;
  });
  const call = `public.${quoteIdent(name)}(${pairs.join(", ")})`;
  return fn.proretset
    ? { sql: `SELECT * FROM ${call}`, params }
    : { sql: `SELECT ${call} AS result`, params };
}

function pgArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
  return [];
}

async function loadMeta(): Promise<Meta> {
  if (globalMeta.__memecatchMeta) return globalMeta.__memecatchMeta;
  const db = getDb();
  const loaded = await db.transaction().execute(async (trx) => {
    const columns = await trx.executeQuery<{ table_name: string; column_name: string; udt: string }>(
      CompiledQuery.raw(
        `SELECT c.relname AS table_name, a.attname AS column_name, t.typname AS udt
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
           JOIN pg_type t ON t.oid = a.atttypid
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'p')`,
      ),
    );
    const keys = await trx.executeQuery<{ table_name: string; column_name: string }>(
      CompiledQuery.raw(
        `SELECT rel.relname AS table_name, att.attname AS column_name
           FROM pg_index idx
           JOIN pg_class rel ON rel.oid = idx.indrelid
           JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
           JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (idx.indkey)
          WHERE nsp.nspname = 'public' AND idx.indisprimary
          ORDER BY rel.relname, array_position(idx.indkey, att.attnum)`,
      ),
    );
    const foreignKeys = await trx.executeQuery<{
      name: string;
      src_table: string;
      dst_table: string;
      src_cols: string[];
      dst_cols: string[];
    }>(
      CompiledQuery.raw(
        `SELECT con.conname AS name,
                src.relname AS src_table,
                dst.relname AS dst_table,
                (SELECT array_agg(a.attname ORDER BY cols.ord)
                   FROM unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = cols.attnum) AS src_cols,
                (SELECT array_agg(a.attname ORDER BY cols.ord)
                   FROM unnest(con.confkey) WITH ORDINALITY AS cols(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = cols.attnum) AS dst_cols
           FROM pg_constraint con
           JOIN pg_class src ON src.oid = con.conrelid
           JOIN pg_class dst ON dst.oid = con.confrelid
           JOIN pg_namespace nsp ON nsp.oid = src.relnamespace
          WHERE con.contype = 'f' AND nsp.nspname = 'public'`,
      ),
    );
    return { columns: columns.rows, keys: keys.rows, foreignKeys: foreignKeys.rows };
  });
  const columns: ColumnMap = new Map();
  for (const row of loaded.columns) {
    const table = columns.get(row.table_name) ?? new Map<string, string>();
    table.set(row.column_name, row.udt);
    columns.set(row.table_name, table);
  }
  const primaryKeys = new Map<string, string[]>();
  for (const row of loaded.keys) {
    primaryKeys.set(row.table_name, [...(primaryKeys.get(row.table_name) ?? []), row.column_name]);
  }
  const meta: Meta = {
    columns,
    primaryKeys,
    foreignKeys: loaded.foreignKeys.map((row) => ({
      name: row.name,
      srcTable: row.src_table,
      dstTable: row.dst_table,
      srcCols: pgArray(row.src_cols),
      dstCols: pgArray(row.dst_cols),
    })),
  };
  globalMeta.__memecatchMeta = meta;
  return meta;
}

function queryError(error: unknown): QueryResult["error"] {
  if (error instanceof Error && error.message === "invalid identifier") {
    return { message: "invalid identifier", code: "42602", status: 400 };
  }
  const pgError = error as { code?: string; message?: string; detail?: string; hint?: string };
  return {
    message: pgError.message ?? "query failed",
    code: pgError.code,
    details: pgError.detail ?? null,
    hint: pgError.hint ?? null,
    status: pgError.code === "57014" ? 408 : 400,
  };
}

function shapeRows(plan: QueryPlan, rows: Record<string, unknown>[], count: number | null, scalar: boolean): QueryResult {
  if (plan.head) return { data: null, error: null, count };
  let data: unknown = rows;
  if (scalar) data = rows[0]?.result ?? null;
  else if (plan.single) {
    if (rows.length !== 1) {
      return {
        data: null,
        error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", status: 406 },
        count,
        status: 406,
        statusText: "Not Acceptable",
      };
    }
    data = rows[0];
  } else if (plan.maybeSingle) {
    if (rows.length > 1) {
      return {
        data: null,
        error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", status: 406 },
        count,
        status: 406,
      };
    }
    data = rows[0] ?? null;
  }
  return { data, error: null, count, status: 200, statusText: "OK" };
}

async function runQuery(
  identity: DbIdentity,
  sqlText: string,
  params: unknown[],
  signal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
  return withIdentity(identity, async (trx: Transaction<Record<string, Record<string, unknown>>>, cancel) => {
    if (signal?.aborted) throw Object.assign(new Error("canceling statement due to user request"), { code: "57014" });
    signal?.addEventListener("abort", cancel, { once: true });
    const result = await trx.executeQuery<Record<string, unknown>>(CompiledQuery.raw(sqlText, params));
    return result.rows;
  });
}

export async function executePlan(plan: QueryPlan, identity: DbIdentity, signal?: AbortSignal): Promise<QueryResult> {
  try {
    attachDottedFilters(plan);
    const meta = await loadMeta();
    if (plan.op === "rpc") {
      const matches = await loadFunctions(plan.fn ?? "");
      const fn = matches.find((item) => {
        const names = new Set(item.names ?? []);
        return Object.keys(plan.args ?? {}).every((key) => names.has(key) || names.size === 0);
      }) ?? matches[0];
      if (!fn) return { data: null, error: { message: "function not found", code: "42883", status: 404 }, count: null };
      const built = rpcSql(plan, fn);
      const rows = await runQuery(identity, built.sql, built.params, signal);
      return shapeRows(plan, rows, null, !fn.proretset);
    }
    if (plan.op === "select") {
      const dataSql = selectSql(plan, meta, false);
      const countSql = plan.count === "exact" ? selectSql(plan, meta, true) : null;
      const rows = plan.head ? [] : await runQuery(identity, dataSql.sql, dataSql.params, signal);
      let count: number | null = null;
      if (countSql) {
        const counted = await runQuery(identity, countSql.sql, countSql.params, signal);
        count = Number(counted[0]?.count ?? 0);
      }
      return shapeRows(plan, rows, count, false);
    }
    const built = mutationSql(plan, meta);
    const rows = await runQuery(identity, built.sql, built.params, signal);
    return shapeRows(plan, rows, null, false);
  } catch (error) {
    return { data: null, error: queryError(error), count: null };
  }
}

export function resetQueryMetadata(): void {
  globalMeta.__memecatchMeta = undefined;
}
