/**
 * Static types for the PostgREST-shaped plan client in lib/db/plan.ts.
 *
 * Row shapes come from lib/database.types.ts. A select string is parsed at the
 * type level: plain columns pick from the row, `alias:column` renames, `*`
 * spreads the row, and `name(...)` / `alias:table!hint(...)` embeds resolve
 * cardinality from the generated Relationships metadata (forward FK → object,
 * reverse FK → array unless one-to-one). Unknown names fall back to `unknown`
 * rather than erroring, so a column the generated types lag behind on still
 * compiles; narrow it with `.returns<T>()` or `.overrideTypes<T>()`.
 */
import type { Database } from "@/lib/database.types";
import type { FilterOp, QueryError } from "@/lib/db/plan";

type Schema = Database["public"];
type Tables = Schema["Tables"];
type Views = Schema["Views"];
type Functions = Schema["Functions"];

export type TableName = keyof Tables & string;
export type ViewName = keyof Views & string;
export type RelationName = TableName | ViewName;
export type FunctionName = keyof Functions & string;

export type RowOf<R> = R extends TableName
  ? Tables[R]["Row"]
  : R extends ViewName
    ? Views[R]["Row"]
    : never;
export type InsertOf<R> = R extends TableName ? Tables[R]["Insert"] : never;
export type UpdateOf<R> = R extends TableName ? Tables[R]["Update"] : never;
type RelationshipsOf<R> = R extends TableName
  ? Tables[R]["Relationships"]
  : R extends ViewName
    ? Views[R] extends { Relationships: infer X } ? X : []
    : [];

type Simplify<T> = { [K in keyof T]: T[K] } & {};
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
  ? I
  : never;

type Whitespace = " " | "\n" | "\t" | "\r";
type TrimLeft<S extends string> = S extends `${Whitespace}${infer R}` ? TrimLeft<R> : S;
type TrimRight<S extends string> = S extends `${infer R}${Whitespace}` ? TrimRight<R> : S;
type Trim<S extends string> = TrimLeft<TrimRight<S>>;

/** Split on commas that are not inside parentheses. */
type SplitTop<
  S extends string,
  Depth extends unknown[] = [],
  Current extends string = "",
  Out extends string[] = [],
> = S extends `${infer C}${infer Rest}`
  ? C extends "("
    ? SplitTop<Rest, [...Depth, unknown], `${Current}${C}`, Out>
    : C extends ")"
      ? SplitTop<Rest, Depth extends [unknown, ...infer D] ? D : [], `${Current}${C}`, Out>
      : C extends ","
        ? Depth extends []
          ? SplitTop<Rest, Depth, "", [...Out, Trim<Current>]>
          : SplitTop<Rest, Depth, `${Current}${C}`, Out>
        : SplitTop<Rest, Depth, `${Current}${C}`, Out>
  : Trim<Current> extends ""
    ? Out
    : [...Out, Trim<Current>];

type StripCast<S extends string> = S extends `${infer Name}::${string}` ? Trim<Name> : S;

/** `alias:table!hint!inner(fields)` → parts. */
type EmbedParts<Token extends string> = Token extends `${infer Head}(${infer Body})`
  ? Head extends `${infer Alias}:${infer Ref}`
    ? { alias: Trim<Alias>; ref: Trim<Ref>; body: Body }
    : { alias: RefTable<Trim<Head>>; ref: Trim<Head>; body: Body }
  : never;
type RefTable<Ref extends string> = Ref extends `${infer T}!${string}` ? T : Ref;
type RefHints<Ref extends string> = Ref extends `${string}!${infer H}`
  ? H extends `${infer A}!${infer B}`
    ? A | RefHints<`x!${B}`>
    : H
  : never;

type Rel = { foreignKeyName: string; columns: readonly string[]; isOneToOne: boolean; referencedRelation: string };
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;

/** Parent → target FKs (parent holds the FK column). A hint picks one by FK name or column. */
type ForwardRel<Parent, Target extends string, Hints> = Extract<
  ElementOf<RelationshipsOf<Parent>>,
  Rel & { referencedRelation: Target }
> extends infer R
  ? [Hints] extends [never]
    ? R
    : Extract<R, { foreignKeyName: Hints } | { columns: readonly [Hints] }> extends infer H
      ? [H] extends [never] ? R : H
      : never
  : never;
/** Target → parent FKs (target holds the FK column). */
type ReverseRel<Parent extends string, Target> = Extract<
  ElementOf<RelationshipsOf<Target>>,
  Rel & { referencedRelation: Parent }
>;

type ForwardValue<Parent extends string, Rel, Child, Inner extends boolean> = Inner extends true
  ? Child
  : Rel extends { columns: readonly [infer Col extends keyof RowOf<Parent>] }
    ? null extends RowOf<Parent>[Col]
      ? Child | null
      : Child
    : Child | null;

type EmbedValue<Parent extends string, Token extends string> = EmbedParts<Token> extends {
  alias: infer Alias extends string;
  ref: infer Ref extends string;
  body: infer Body extends string;
}
  ? RefTable<Ref> extends infer Target extends RelationName
    ? {
        [K in Alias]: ParseFields<Target, Body> extends infer Child
          ? [ForwardRel<Parent, Target, Exclude<RefHints<Ref>, "inner" | "left">>] extends [never]
            ? [ReverseRel<Parent, Target>] extends [never]
              ? unknown
              : ReverseRel<Parent, Target> extends { isOneToOne: true }
                ? Child | null
                : Child[]
            : ForwardValue<
                Parent,
                ForwardRel<Parent, Target, Exclude<RefHints<Ref>, "inner" | "left">>,
                Child,
                "inner" extends RefHints<Ref> ? true : false
              >
          : never;
      }
    : { [K in Alias]: unknown }
  : never;

type ColumnValue<Base, Column extends string> = Column extends keyof Base ? Base[Column] : unknown;

type FieldValue<Parent extends string, Base, Token extends string> = Token extends "*"
  ? Base
  : Token extends `${string}(${string}`
    ? [Parent] extends [never]
      ? EmbedParts<Token> extends { alias: infer Alias extends string } ? { [K in Alias]: unknown } : never
      : EmbedValue<Parent, Token>
    : Token extends `${infer Alias}:${infer Column}`
      ? { [K in Trim<Alias>]: ColumnValue<Base, StripCast<Trim<Column>>> }
      : { [K in StripCast<Token>]: ColumnValue<Base, StripCast<Token>> };

type FieldsOf<Parent extends string, Base, Tokens extends string[]> = {
  [I in keyof Tokens]: Tokens[I] extends string ? FieldValue<Parent, Base, Tokens[I]> : never;
}[number];

/**
 * Row type for a select string. `Base` is the row being selected from: the
 * relation's row for `from()`, or the function's row for `rpc().select()`.
 */
export type ParseFields<Parent extends string, Columns extends string, Base = RowOf<Parent>> = string extends Columns
  ? Base
  : SplitTop<Columns> extends infer Tokens extends string[]
    ? Tokens extends []
      ? Base
      : Simplify<UnionToIntersection<FieldsOf<Parent, Base, Tokens>>>
    : never;

export type DbResponse<T> =
  | { data: T; error: null; count: number | null; status?: number; statusText?: string }
  | { data: null; error: QueryError; count: number | null; status?: number; statusText?: string };

type Mode = "many" | "single" | "maybe" | "none";
type Shape<Row, M extends Mode> = M extends "many"
  ? Row[]
  : M extends "single"
    ? Row
    : M extends "maybe"
      ? Row | null
      : null;

type RelationOptions = { referencedTable?: string; foreignTable?: string };

/**
 * Filter/transform chain. `Row` is one result row; `M` decides whether `data`
 * is an array, one row, an optional row, or null (a write without select()).
 */
export interface DbQuery<Parent extends string, Row, M extends Mode = "many">
  extends PromiseLike<DbResponse<Shape<Row, M>>> {
  select<Columns extends string = "*">(
    columns?: Columns,
    options?: { count?: "exact"; head?: boolean },
  ): DbQuery<
    Parent,
    ParseFields<Parent, Columns, [Parent] extends [never] ? Row : RowOf<Parent>>,
    M extends "none" ? "many" : M
  >;
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  like(column: string, value: unknown): this;
  ilike(column: string, value: unknown): this;
  is(column: string, value: unknown): this;
  in(column: string, values: readonly unknown[]): this;
  contains(column: string, value: unknown): this;
  // The executor rejects unknown operators at run time.
  not(column: string, op: FilterOp | (string & {}), value: unknown): this;
  filter(column: string, op: FilterOp | (string & {}), value: unknown): this;
  or(filters: string, options?: RelationOptions): this;
  order(column: string, options?: RelationOptions & { ascending?: boolean; nullsFirst?: boolean }): this;
  limit(count: number, options?: RelationOptions): this;
  range(from: number, to: number): this;
  abortSignal(signal: AbortSignal): this;
  single<T = Row>(): DbQuery<Parent, T, "single">;
  maybeSingle<T = Row>(): DbQuery<Parent, T, "maybe">;
  /** Name the row shape when the select string cannot express it. */
  returns<T>(): PromiseLike<DbResponse<T>>;
  /** Replace the inferred row type (array/single/maybe mode is kept). */
  // The second parameter mirrors call sites that pass `{ merge: false }`; it has no effect here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  overrideTypes<T, _Options = unknown>(): DbQuery<Parent, M extends "many" ? (T extends readonly (infer E)[] ? E : T) : T, M>;
}

type RpcReturns<F extends FunctionName> = Functions[F]["Returns"];
type RpcRow<F extends FunctionName> = RpcReturns<F> extends readonly (infer E)[] ? E : RpcReturns<F>;
type RpcMode<F extends FunctionName> = RpcReturns<F> extends readonly unknown[] ? "many" : "single";
type RpcArgs<F extends FunctionName> = Functions[F]["Args"];
/** Accepted for call-site compatibility; the plan executor always runs the function once. */
type RpcOptions = { count?: "exact"; head?: boolean; get?: boolean };
type RpcParams<F extends FunctionName> = [RpcArgs<F>] extends [never]
  ? [args?: Record<string, never>, options?: RpcOptions]
  : Record<string, never> extends RpcArgs<F>
    ? [args?: RpcArgs<F>, options?: RpcOptions]
    : [args: RpcArgs<F>, options?: RpcOptions];

export interface DbTable<R extends RelationName> {
  select<Columns extends string = "*">(
    columns?: Columns,
    options?: { count?: "exact"; head?: boolean },
  ): DbQuery<R, ParseFields<R, Columns>, "many">;
  insert(values: InsertOf<R> | readonly InsertOf<R>[]): DbQuery<R, RowOf<R>, "none">;
  update(values: UpdateOf<R>): DbQuery<R, RowOf<R>, "none">;
  upsert(
    values: InsertOf<R> | readonly InsertOf<R>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): DbQuery<R, RowOf<R>, "none">;
  delete(): DbQuery<R, RowOf<R>, "none">;
}

/** The query surface every server, browser, and admin client exposes. */
export interface DbClient {
  from<R extends RelationName>(relation: R): DbTable<R>;
  rpc<F extends FunctionName>(
    fn: F,
    ...args: RpcParams<F>
  ): DbQuery<never, RpcRow<F>, RpcMode<F>>;
}

export type DbAuthError = { message: string; status?: number; name?: string };
export type DbAuthUser = { id: string; email?: string | null; name?: string | null; is_anonymous?: boolean };
export type DbAuthResult<T> = Promise<{ data: T; error: DbAuthError | null }>;

/** Session lookup shared by the server and browser clients. */
export interface DbAuth {
  getUser(): DbAuthResult<{ user: DbAuthUser | null }>;
}

export type DbSessionClient = DbClient & { auth: DbAuth };
