/**
 * Browser-safe description of a PostgREST-shaped query.
 * The browser posts this plan. The server turns it into parameterized SQL.
 * No SQL strings and no role travel in the plan.
 */

export type FilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "is"
  | "in"
  | "contains";

export type PlanFilter = {
  column: string;
  op: FilterOp;
  value: unknown;
  negate?: boolean;
};

export type PlanOrder = {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
};

export type PlanEmbed = {
  alias: string;
  table: string;
  inner: boolean;
  hint: string | null;
  fields: PlanField[];
  filters: PlanFilter[];
  orGroups: PlanFilter[][];
  orders: PlanOrder[];
  limit: number | null;
};

export type PlanField =
  | { kind: "star" }
  | { kind: "column"; name: string }
  | { kind: "embed"; embed: PlanEmbed };

export type PlanOp = "select" | "insert" | "update" | "delete" | "upsert" | "rpc";

export type QueryPlan = {
  op: PlanOp;
  table?: string;
  fn?: string;
  fields: PlanField[];
  filters: PlanFilter[];
  orGroups: PlanFilter[][];
  orders: PlanOrder[];
  limit: number | null;
  offset: number | null;
  single: boolean;
  maybeSingle: boolean;
  count: "exact" | null;
  head: boolean;
  values?: unknown;
  onConflict?: string | null;
  ignoreDuplicates?: boolean;
  returning: boolean;
  args?: Record<string, unknown>;
};

export type QueryError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  name?: string;
};

// Call sites infer row fields from this default the same way supabase-js did.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResult<T = any> = {
  data: T;
  error: QueryError | null;
  count: number | null;
  status?: number;
  statusText?: string;
};

const IDENT = /^[a-z_][a-z0-9_]*$/i;

export function isIdent(value: string): boolean {
  return IDENT.test(value);
}

export function quoteIdent(value: string): string {
  if (!isIdent(value)) throw new Error("invalid identifier");
  return `"${value}"`;
}

function splitTop(input: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === separator && depth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = input.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

function parseFields(input: string): PlanField[] {
  if (!input.trim() || input.trim() === "*") return [{ kind: "star" }];
  return splitTop(input, ",").map(parseField);
}

function parseField(token: string): PlanField {
  const embed = token.match(
    /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)(?:!([A-Za-z_][A-Za-z0-9_]*))?(?:!([A-Za-z_][A-Za-z0-9_]*))?\((.*)\)$/,
  );
  if (!embed) {
    if (token === "*") return { kind: "star" };
    if (!isIdent(token)) throw new Error("invalid identifier");
    return { kind: "column", name: token };
  }
  const alias = embed[1] ?? embed[2];
  const table = embed[2];
  const mods = [embed[3], embed[4]].filter((item): item is string => Boolean(item));
  if (!alias || !table || !isIdent(alias) || !isIdent(table)) throw new Error("invalid identifier");
  const inner = mods.includes("inner");
  const hint = mods.find((item) => item !== "inner") ?? null;
  if (hint && !isIdent(hint)) throw new Error("invalid identifier");
  return {
    kind: "embed",
    embed: {
      alias,
      table,
      inner,
      hint,
      fields: parseFields(embed[5] ?? ""),
      filters: [],
      orGroups: [],
      orders: [],
      limit: null,
    },
  };
}

const OR_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "not"]);

export function parseOrFilter(raw: string): PlanFilter[] {
  return splitTop(raw, ",").map((part) => {
    const pieces = part.trim().split(".");
    let opIndex = 1;
    while (opIndex < pieces.length && !OR_OPS.has(pieces[opIndex] ?? "")) opIndex += 1;
    const column = pieces.slice(0, opIndex).join(".");
    let rest = pieces.slice(opIndex);
    let negate = false;
    if (rest[0] === "not") {
      negate = true;
      rest = rest.slice(1);
    }
    const op = rest[0] as FilterOp;
    let value: unknown = rest.slice(1).join(".");
    if (!column || !op) throw new Error("invalid filter");
    if (op === "is") {
      if (value === "null") value = null;
      else if (value === "true") value = true;
      else if (value === "false") value = false;
    } else if ((op === "like" || op === "ilike") && typeof value === "string") {
      value = value.replaceAll("*", "%");
    } else if (op === "in" && typeof value === "string") {
      value = value.replace(/^\(|\)$/g, "").split(",").filter(Boolean);
    }
    return { column, op, value, negate };
  });
}

type RelationOptions = { referencedTable?: string; foreignTable?: string };

function relationOf(options?: RelationOptions): string | undefined {
  return options?.referencedTable ?? options?.foreignTable;
}

function findEmbed(fields: PlanField[], relation: string): PlanEmbed | null {
  for (const field of fields) {
    if (field.kind !== "embed") continue;
    if (field.embed.alias === relation || field.embed.table === relation) return field.embed;
    const nested = findEmbed(field.embed.fields, relation);
    if (nested) return nested;
  }
  return null;
}

export type PlanExecutor = (plan: QueryPlan, signal?: AbortSignal) => Promise<QueryResult>;

class QueryBuilder implements PromiseLike<QueryResult> {
  private plan: QueryPlan;
  private signal?: AbortSignal;
  private readonly execute: PlanExecutor;

  constructor(
    execute: PlanExecutor,
    op: PlanOp,
    target: { table?: string; fn?: string; values?: unknown; args?: Record<string, unknown> },
  ) {
    this.execute = execute;
    this.plan = {
      op,
      table: target.table,
      fn: target.fn,
      fields: [{ kind: "star" }],
      filters: [],
      orGroups: [],
      orders: [],
      limit: null,
      offset: null,
      single: false,
      maybeSingle: false,
      count: null,
      head: false,
      values: target.values,
      onConflict: null,
      ignoreDuplicates: false,
      returning: op === "select" || op === "rpc",
      args: target.args,
    };
  }

  select(columns?: string, options?: { count?: "exact"; head?: boolean }): this {
    if (typeof columns === "string") this.plan.fields = parseFields(columns);
    if (options?.count === "exact") this.plan.count = "exact";
    if (options?.head) this.plan.head = true;
    this.plan.returning = true;
    return this;
  }

  eq(column: string, value: unknown): this { return this.filter(column, "eq", value); }
  neq(column: string, value: unknown): this { return this.filter(column, "neq", value); }
  gt(column: string, value: unknown): this { return this.filter(column, "gt", value); }
  gte(column: string, value: unknown): this { return this.filter(column, "gte", value); }
  lt(column: string, value: unknown): this { return this.filter(column, "lt", value); }
  lte(column: string, value: unknown): this { return this.filter(column, "lte", value); }
  like(column: string, value: unknown): this { return this.filter(column, "like", value); }
  ilike(column: string, value: unknown): this { return this.filter(column, "ilike", value); }
  is(column: string, value: unknown): this { return this.filter(column, "is", value); }
  in(column: string, value: unknown): this { return this.filter(column, "in", value); }
  contains(column: string, value: unknown): this { return this.filter(column, "contains", value); }

  not(column: string, op: FilterOp, value: unknown): this {
    this.plan.filters.push({ column, op, value, negate: true });
    return this;
  }

  filter(column: string, op: FilterOp, value: unknown): this {
    this.plan.filters.push({ column, op, value });
    return this;
  }

  or(filters: string, options?: RelationOptions): this {
    const group = parseOrFilter(filters);
    const relation = relationOf(options);
    if (relation) {
      const embed = findEmbed(this.plan.fields, relation);
      if (!embed) throw new Error("invalid identifier");
      embed.orGroups.push(group);
      if (filters.includes("!inner") || this.plan.fields.some((field) => field.kind === "embed" && field.embed.alias === relation && field.embed.inner)) {
        embed.inner = embed.inner || true;
      }
    } else {
      this.plan.orGroups.push(group);
    }
    return this;
  }

  order(column: string, options?: RelationOptions & { ascending?: boolean; nullsFirst?: boolean }): this {
    const order: PlanOrder = {
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    };
    const relation = relationOf(options);
    if (relation) {
      const embed = findEmbed(this.plan.fields, relation);
      if (!embed) throw new Error("invalid identifier");
      embed.orders.push(order);
    } else {
      this.plan.orders.push(order);
    }
    return this;
  }

  limit(count: number, options?: RelationOptions): this {
    const relation = relationOf(options);
    if (relation) {
      const embed = findEmbed(this.plan.fields, relation);
      if (!embed) throw new Error("invalid identifier");
      embed.limit = count;
    } else {
      this.plan.limit = count;
    }
    return this;
  }

  range(from: number, to: number): this {
    this.plan.offset = from;
    this.plan.limit = to - from + 1;
    // search_memes applies p_limit inside the function, before this page
    // window. Raise it to the end of the window so a later page is not cut
    // off at the first 50 rows. The executor then applies offset and limit.
    const args = this.plan.args;
    const pageEnd = to + 1;
    if (
      this.plan.op === "rpc"
      && args
      && typeof args.p_limit === "number"
      && Number.isInteger(args.p_limit)
      && args.p_limit < pageEnd
    ) {
      args.p_limit = Math.min(pageEnd, 5000);
    }
    return this;
  }

  single(): this {
    this.plan.single = true;
    this.plan.returning = true;
    return this;
  }

  maybeSingle(): this {
    this.plan.maybeSingle = true;
    this.plan.returning = true;
    return this;
  }

  abortSignal(signal: AbortSignal): this {
    this.signal = signal;
    return this;
  }

  /** Call sites use this to name the row shape. Runtime rows already match the select list. */
  returns<T>(): PromiseLike<QueryResult<T>> {
    return this.execute(this.plan, this.signal) as PromiseLike<QueryResult<T>>;
  }

  /**
   * Same terminal as returns(). Supabase-js uses the second type argument
   * only to decide whether the row type replaces or merges the inferred row.
   * The eleven server callers pass `{ merge: false }` and await this directly.
   */
  overrideTypes<T, Options extends { merge?: boolean } = { merge: false }>(): PromiseLike<QueryResult<T>> {
    // Options is type-only at every call site. Reading it keeps the second
    // type argument in the signature so `{ merge: false }` still typechecks.
    const typedMerge: Options["merge"] | undefined = undefined;
    void typedMerge;
    return this.execute(this.plan, this.signal) as PromiseLike<QueryResult<T>>;
  }

  upsert(values: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
    this.plan.op = "upsert";
    this.plan.values = values;
    this.plan.onConflict = options?.onConflict ?? null;
    this.plan.ignoreDuplicates = options?.ignoreDuplicates === true;
    this.plan.returning = false;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute(this.plan, this.signal).then(onfulfilled, onrejected);
  }
}

export function createPlanClient(execute: PlanExecutor) {
  return {
    from(table: string) {
      const builder = new QueryBuilder(execute, "select", { table });
      return {
        select: builder.select.bind(builder),
        insert(values: unknown) {
          const write = new QueryBuilder(execute, "insert", { table, values });
          return write;
        },
        update(values: unknown) {
          return new QueryBuilder(execute, "update", { table, values });
        },
        delete() {
          return new QueryBuilder(execute, "delete", { table });
        },
        upsert: builder.upsert.bind(builder),
      };
    },
    rpc(fn: string, args?: Record<string, unknown>) {
      const next = { ...(args ?? {}) };
      if (
        (fn === "search_memes" || fn === "search_ai_memes")
        && typeof next.p_query === "string"
      ) {
        next.p_query = next.p_query.normalize("NFC").replaceAll("\uAEBD", "\uAEBE");
      }
      return new QueryBuilder(execute, "rpc", { fn, args: next });
    },
  };
}

export function attachDottedFilters(plan: QueryPlan): void {
  const keep: PlanFilter[] = [];
  for (const filter of plan.filters) {
    const dot = filter.column.indexOf(".");
    if (dot === -1) {
      keep.push(filter);
      continue;
    }
    const relation = filter.column.slice(0, dot);
    const column = filter.column.slice(dot + 1);
    const embed = findEmbed(plan.fields, relation);
    if (!embed) throw new Error("invalid identifier");
    embed.filters.push({ ...filter, column });
    if (embed.inner) embed.inner = true;
  }
  plan.filters = keep;
}
