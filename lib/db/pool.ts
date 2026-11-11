import { CompiledQuery, Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";

export type DbRole = "anon" | "authenticated" | "service_role";

export type DbIdentity = {
  userId: string | null;
  role: DbRole;
  anonymous: boolean;
};

type Database = Record<string, Record<string, unknown>>;

const ROLE_SQL: Record<DbRole, string> = {
  anon: "set local role anon",
  authenticated: "set local role authenticated",
  service_role: "set local role service_role",
};

const globalDb = globalThis as unknown as {
  __memecatchPool?: pg.Pool;
  __memecatchDb?: Kysely<Database>;
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

export function getDb(): Kysely<Database> {
  if (!globalDb.__memecatchDb) {
    globalDb.__memecatchDb = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: getPool() }),
    });
  }
  return globalDb.__memecatchDb;
}

export async function withIdentity<T>(
  identity: DbIdentity,
  run: (trx: Transaction<Database>, cancel: () => void) => Promise<T>,
): Promise<T> {
  const db = getDb();
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
    await sql`select set_config('statement_timeout', ${"15000"}, true)`.execute(trx);
    await trx.executeQuery(CompiledQuery.raw(ROLE_SQL[identity.role]));
    await trx.executeQuery(CompiledQuery.raw("set local search_path to public, extensions"));
    const pid = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx);
    const backendPid = Number(pid.rows[0]?.pid ?? 0);
    const cancel = () => {
      getPool().query("select pg_cancel_backend($1::int)", [backendPid]).catch(() => undefined);
    };
    return run(trx, cancel);
  });
}
