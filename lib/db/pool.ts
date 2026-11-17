import { CompiledQuery, Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";

export type DbRole = "anon" | "authenticated" | "service_role";

export type DbIdentity = {
  userId: string | null;
  role: DbRole;
  anonymous: boolean;
};

type Database = Record<string, Record<string, unknown>>;

export type IdentityExecutionOptions = {
  allowBackendCancel?: boolean;
  statementTimeoutMs?: number;
};

const ROLE_SQL: Record<DbRole, string> = {
  anon: "set local role anon",
  authenticated: "set local role authenticated",
  service_role: "set local role service_role",
};

const globalDb = globalThis as unknown as {
  __memecatchPool?: pg.Pool;
  __memecatchDeadlinePool?: pg.Pool;
  __memecatchDb?: Kysely<Database>;
  __memecatchDeadlineDb?: Kysely<Database>;
};

export function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!globalDb.__memecatchPool) {
    globalDb.__memecatchPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      application_name: "memecatch",
    });
  }
  return globalDb.__memecatchPool;
}

export function getDeadlinePool(): pg.Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!globalDb.__memecatchDeadlinePool) {
    globalDb.__memecatchDeadlinePool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 1_500,
      statement_timeout: 1_500,
      idleTimeoutMillis: 5_000,
      allowExitOnIdle: true,
      application_name: "memecatch-deadline",
    });
  }
  return globalDb.__memecatchDeadlinePool;
}

export function getDb(): Kysely<Database> {
  if (!globalDb.__memecatchDb) {
    globalDb.__memecatchDb = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: getPool() }),
    });
  }
  return globalDb.__memecatchDb;
}

export function getDeadlineDb(): Kysely<Database> {
  if (!globalDb.__memecatchDeadlineDb) {
    globalDb.__memecatchDeadlineDb = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: getDeadlinePool() }),
    });
  }
  return globalDb.__memecatchDeadlineDb;
}

export async function withIdentity<T>(
  identity: DbIdentity,
  run: (trx: Transaction<Database>, cancel: () => void) => Promise<T>,
  db = getDb(),
  options: IdentityExecutionOptions = {},
): Promise<T> {
  const claims = JSON.stringify({
    role: identity.role,
    sub: identity.userId,
    is_anonymous: identity.anonymous ? "true" : "false",
  });
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.user_id', ${identity.userId ?? ""}, true)`.execute(trx);
    await sql`select set_config('app.db_role', ${identity.role}, true)`.execute(trx);
    await sql`select set_config('app.is_anonymous', ${identity.anonymous ? "true" : "false"}, true)`.execute(trx);
    await sql`select set_config('request.jwt.claims', ${claims}, true)`.execute(trx);
    await sql`select set_config('statement_timeout', ${String(options.statementTimeoutMs ?? 15_000)}, true)`.execute(trx);
    await trx.executeQuery(CompiledQuery.raw(ROLE_SQL[identity.role]));
    await trx.executeQuery(CompiledQuery.raw("set local search_path to public, extensions"));
    let cancel = () => undefined;
    if (options.allowBackendCancel !== false) {
      const pid = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx);
      const backendPid = Number(pid.rows[0]?.pid ?? 0);
      cancel = () => {
        getPool().query("select pg_cancel_backend($1::int)", [backendPid]).catch(() => undefined);
      };
    }
    return run(trx, cancel);
  });
}
