//! Port of `lib/db/pool.ts`: every query runs in a transaction that first
//! tells Postgres who the caller is. Row-level security and the `auth.uid()`,
//! `auth.role()` and `auth.jwt()` functions read these settings, so the
//! statements, their order and their values match `withIdentity` exactly.
//!
//! Cancelled requests. The TS code keeps a `pg_cancel_backend` hook for an
//! aborted request. There is no equivalent here. When a request future is
//! dropped mid-query, sqlx queues a rollback and takes the connection out of
//! the pool until the server has finished the running statement. That
//! statement is bounded by `statement_timeout` (15 s by default, 1.5 s for the
//! deadline variant), which is transaction-local and so applies to everything
//! the closure runs. Worst case a cancelled request holds one pooled
//! connection for one statement timeout. `/api/db/query` runs its statements
//! in a task of their own instead, which keeps its active-query slot until
//! they end (routes/db_query/mod.rs).

use std::future::Future;
use std::pin::Pin;
use std::str::FromStr;
use std::time::Duration;

use serde::Serialize;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{PgConnection, PgPool};

const DEFAULT_STATEMENT_TIMEOUT_MS: u32 = 15_000;
// How long a query waits for a connection from the main pool. sqlx's default
// is 30 s, and sqlx keeps retrying a refused connection until this limit, so
// with Postgres down every query held its request for 30 s. node-pg fails at
// once on a refused connection and Next answers in under a second.
// The trade-off: a request that waits more than 5 s for a free connection
// (all `AXUM_DB_POOL_MAX` busy) now fails with `PoolTimedOut`, where the
// node-pg pool would keep waiting without a limit.
const MAIN_POOL_ACQUIRE_TIMEOUT: Duration = Duration::from_secs(5);
// `getDeadlinePool` in lib/db/pool.ts: 2 connections, 1.5 s to get one
// (connecting included), 1.5 s per statement, idle connections closed after 5 s.
const DEADLINE_POOL_MAX: u32 = 2;
const DEADLINE_MS: u32 = 1_500;
const DEADLINE_IDLE_TIMEOUT: Duration = Duration::from_secs(5);
/// The plan pool of `/api/db/query`: one connection for each of the route's
/// six active queries, so a query that has its slot never waits for one.
pub const PLAN_POOL_MAX: u32 = 6;
// A plan backend keeps the memory of its largest plan (about 110 MB after a
// ~1 MB plan) until it closes, and sqlx's default keeps an idle connection
// 10 minutes. Closed after 5 s idle, as the deadline pool, the six give it
// back soon after a burst (docs/axum-migration/PLAN.md section 2 has the
// memory and connection budget).
const PLAN_IDLE_TIMEOUT: Duration = Duration::from_secs(5);

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DbRole {
    Anon,
    Authenticated,
    ServiceRole,
    /// The pooled login role itself, as better-auth's own queries run: it
    /// holds the `getPool()` pool and issues plain statements, with no role
    /// switch and none of the request settings (lib/auth/server.ts:149-151).
    /// See [`DbIdentity::better_auth`].
    Login,
}

impl DbRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Anon => "anon",
            Self::Authenticated => "authenticated",
            Self::ServiceRole => "service_role",
            Self::Login => "login",
        }
    }

    // Fixed strings: a role name is never interpolated into SQL.
    fn set_role_sql(self) -> &'static str {
        match self {
            Self::Anon => "set local role anon",
            Self::Authenticated => "set local role authenticated",
            Self::ServiceRole => "set local role service_role",
            Self::Login => "",
        }
    }
}

/// `DbIdentity` in lib/db/pool.ts.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DbIdentity {
    pub user_id: Option<String>,
    pub role: DbRole,
    pub anonymous: bool,
}

impl DbIdentity {
    /// A signed-out visitor: `{ userId: null, role: "anon", anonymous: false }`,
    /// as lib/db/request-db.ts builds it.
    pub fn anon() -> Self {
        Self {
            user_id: None,
            role: DbRole::Anon,
            anonymous: false,
        }
    }

    /// A signed-in user: `{ userId, role: "authenticated", anonymous: false }`.
    pub fn authenticated(user_id: impl Into<String>) -> Self {
        Self {
            user_id: Some(user_id.into()),
            role: DbRole::Authenticated,
            anonymous: false,
        }
    }

    /// `SERVICE` in lib/db/admin.ts. Bypasses row-level security; use it only
    /// after an operator or cron check.
    pub fn service_role() -> Self {
        Self {
            user_id: None,
            role: DbRole::ServiceRole,
            anonymous: false,
        }
    }

    /// What better-auth's own queries run as: the login role that owns its
    /// tables (`user`, `session`, `account`, `verification`), the only role
    /// that may write them. `service_role` may only read `user` and `session`
    /// (`grantServiceRole`, lib/auth/server.ts:161-179). Only the auth routes
    /// that do what better-auth does use it.
    pub fn better_auth() -> Self {
        Self {
            user_id: None,
            role: DbRole::Login,
            anonymous: false,
        }
    }

    /// The `request.jwt.claims` value: `JSON.stringify({ role, sub, is_anonymous })`
    /// with the same key order, `sub` as string or null, `is_anonymous` as the
    /// string "true" or "false".
    fn claims_json(&self) -> String {
        #[derive(Serialize)]
        struct Claims<'a> {
            role: &'a str,
            sub: Option<&'a str>,
            is_anonymous: &'a str,
        }
        serde_json::to_string(&Claims {
            role: self.role.as_str(),
            sub: self.user_id.as_deref(),
            is_anonymous: bool_text(self.anonymous),
        })
        .expect("claims hold only strings")
    }
}

fn bool_text(value: bool) -> &'static str {
    if value { "true" } else { "false" }
}

/// `IdentityExecutionOptions` in lib/db/pool.ts, without `allowBackendCancel`
/// (see the module comment).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct IdentityOptions {
    pub statement_timeout_ms: u32,
}

impl Default for IdentityOptions {
    fn default() -> Self {
        Self {
            statement_timeout_ms: DEFAULT_STATEMENT_TIMEOUT_MS,
        }
    }
}

#[derive(Clone)]
pub struct Db {
    pool: PgPool,
    deadline_pool: PgPool,
    /// Connections without sqlx's statement cache, for SQL built from a
    /// client's plan. sqlx keeps every distinct text it prepares as a named
    /// statement (100 per connection), and Postgres keeps its plan until the
    /// connection closes, so client-chosen texts would grow the backends
    /// without a limit. Without the cache every statement is unnamed, as
    /// node-pg sends them, and Postgres frees it at the next one.
    plans: PgPool,
}

impl Db {
    /// Builds both pools without connecting; connections open on first use, as
    /// in the Next app. `pool_max` is `AXUM_DB_POOL_MAX`.
    pub fn connect_lazy(database_url: &str, pool_max: u32) -> Result<Self, sqlx::Error> {
        let options = PgConnectOptions::from_str(database_url)?;
        let pool = PgPoolOptions::new()
            .max_connections(pool_max)
            .acquire_timeout(MAIN_POOL_ACQUIRE_TIMEOUT)
            .connect_lazy_with(options.clone().application_name("memecatch-axum"));
        let plans = PgPoolOptions::new()
            .max_connections(PLAN_POOL_MAX)
            .min_connections(0)
            .idle_timeout(PLAN_IDLE_TIMEOUT)
            .acquire_timeout(MAIN_POOL_ACQUIRE_TIMEOUT)
            .connect_lazy_with(
                options
                    .clone()
                    .application_name("memecatch-axum")
                    .statement_cache_capacity(0),
            );
        let deadline_pool = PgPoolOptions::new()
            .max_connections(DEADLINE_POOL_MAX)
            .acquire_timeout(Duration::from_millis(DEADLINE_MS.into()))
            .idle_timeout(DEADLINE_IDLE_TIMEOUT)
            .connect_lazy_with(
                options
                    .application_name("memecatch-axum-deadline")
                    .options([("statement_timeout", DEADLINE_MS)]),
            );
        Ok(Self {
            pool,
            deadline_pool,
            plans,
        })
    }

    /// The main pool, for queries that need no identity (the health check).
    /// Connections are the login role `memecatch` with no `set role`.
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Every pool this server holds, for checks over all its connections.
    pub fn pools(&self) -> Vec<&PgPool> {
        vec![&self.pool, &self.deadline_pool, &self.plans]
    }

    /// `withIdentity(identity, run, getDb(), options)`. Commits when `run`
    /// returns `Ok`, rolls back when it returns `Err`.
    ///
    /// ```ignore
    /// let count: i64 = state.db
    ///     .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
    ///         Box::pin(async move {
    ///             sqlx::query_scalar("select count(*) from public.memes")
    ///                 .fetch_one(&mut *tx)
    ///                 .await
    ///         })
    ///     })
    ///     .await?;
    /// ```
    pub async fn with_identity<T, E, F>(
        &self,
        identity: &DbIdentity,
        options: IdentityOptions,
        run: F,
    ) -> Result<T, E>
    where
        F: for<'c> FnOnce(&'c mut PgConnection) -> BoxFuture<'c, Result<T, E>> + Send,
        T: Send,
        E: From<sqlx::Error>,
    {
        run_with_identity(&self.pool, identity, options.statement_timeout_ms, run).await
    }

    /// [`Db::with_identity`] on the plan pool: every statement `run` sends
    /// is unnamed and leaves nothing on the connection.
    pub async fn with_identity_uncached<T, E, F>(
        &self,
        identity: &DbIdentity,
        options: IdentityOptions,
        run: F,
    ) -> Result<T, E>
    where
        F: for<'c> FnOnce(&'c mut PgConnection) -> BoxFuture<'c, Result<T, E>> + Send,
        T: Send,
        E: From<sqlx::Error>,
    {
        run_with_identity(&self.plans, identity, options.statement_timeout_ms, run).await
    }

    /// The deadline path of lib/db/execute.ts: the deadline pool with a 1.5 s
    /// statement timeout. Fails with `sqlx::Error::PoolTimedOut` when no
    /// connection is available within 1.5 s.
    pub async fn with_identity_deadline<T, E, F>(
        &self,
        identity: &DbIdentity,
        run: F,
    ) -> Result<T, E>
    where
        F: for<'c> FnOnce(&'c mut PgConnection) -> BoxFuture<'c, Result<T, E>> + Send,
        T: Send,
        E: From<sqlx::Error>,
    {
        run_with_identity(&self.deadline_pool, identity, DEADLINE_MS, run).await
    }
}

async fn run_with_identity<T, E, F>(
    pool: &PgPool,
    identity: &DbIdentity,
    statement_timeout_ms: u32,
    run: F,
) -> Result<T, E>
where
    F: for<'c> FnOnce(&'c mut PgConnection) -> BoxFuture<'c, Result<T, E>> + Send,
    T: Send,
    E: From<sqlx::Error>,
{
    let mut tx = pool.begin().await?;
    if identity.role == DbRole::Login {
        // better-auth sets nothing. The statement limit is this server's own
        // guard; it is local to the transaction.
        sqlx::query("select set_config('statement_timeout', $1, true)")
            .bind(statement_timeout_ms.to_string())
            .execute(&mut *tx)
            .await?;
        let value = run(&mut tx).await?;
        tx.commit().await?;
        return Ok(value);
    }
    // Same statements, order and values as `withIdentity`.
    for (sql, value) in [
        (
            "select set_config('app.user_id', $1, true)",
            identity.user_id.clone().unwrap_or_default(),
        ),
        (
            "select set_config('app.db_role', $1, true)",
            identity.role.as_str().to_owned(),
        ),
        (
            "select set_config('app.is_anonymous', $1, true)",
            bool_text(identity.anonymous).to_owned(),
        ),
        (
            "select set_config('request.jwt.claims', $1, true)",
            identity.claims_json(),
        ),
        (
            "select set_config('statement_timeout', $1, true)",
            statement_timeout_ms.to_string(),
        ),
    ] {
        sqlx::query(sql).bind(value).execute(&mut *tx).await?;
    }
    sqlx::raw_sql(identity.role.set_role_sql())
        .execute(&mut *tx)
        .await?;
    sqlx::raw_sql("set local search_path to public, extensions")
        .execute(&mut *tx)
        .await?;

    // On `Err` the transaction is dropped, which rolls it back.
    let value = run(&mut tx).await?;
    tx.commit().await?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claims_json_matches_json_stringify_of_the_ts_object() {
        let anon = DbIdentity::anon();
        let user = DbIdentity::authenticated("7b0d4a52-6a52-4a4e-9d0b-0c2f6f0f5a11");
        let anonymous_user = DbIdentity {
            anonymous: true,
            ..user.clone()
        };

        assert_eq!(
            anon.claims_json(),
            r#"{"role":"anon","sub":null,"is_anonymous":"false"}"#
        );
        assert_eq!(
            user.claims_json(),
            r#"{"role":"authenticated","sub":"7b0d4a52-6a52-4a4e-9d0b-0c2f6f0f5a11","is_anonymous":"false"}"#
        );
        assert_eq!(
            anonymous_user.claims_json(),
            r#"{"role":"authenticated","sub":"7b0d4a52-6a52-4a4e-9d0b-0c2f6f0f5a11","is_anonymous":"true"}"#
        );
        assert_eq!(
            DbIdentity::service_role().claims_json(),
            r#"{"role":"service_role","sub":null,"is_anonymous":"false"}"#
        );
    }
}
