//! The statements of the source modules, as `createAdminClient()` runs them:
//! `service_role`, one transaction per statement, rows as `row_to_json`
//! writes them (timestamps as text in the session's time zone).
//!
//! The plan executor sends every function argument without a type (node-pg)
//! and lets Postgres take the parameter's; the SQL here casts each text value
//! to that type, which reads it with the same input function. A failure is
//! the server's message, as `error.message` of the executor; a connection
//! failure is worded by sqlx here and by node-pg there.

use serde_json::Value;
use sqlx::AssertSqlSafe;

use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};

/// A text parameter, `None` for `null`.
pub type Bind = Option<String>;

fn message(error: sqlx::Error) -> String {
    match error.as_database_error() {
        Some(database) => database.message().to_owned(),
        None => error.to_string(),
    }
}

/// The rows `sql` returns, each read from `row_to_json(...)::text`. `sql`
/// must select one text column holding that JSON.
pub async fn rows(
    state: &AppState,
    sql: &'static str,
    binds: Vec<Bind>,
    statement_timeout_ms: Option<u32>,
) -> Result<Vec<Value>, String> {
    let options = statement_timeout_ms
        .map(|statement_timeout_ms| IdentityOptions {
            statement_timeout_ms,
        })
        .unwrap_or_default();
    let texts: Vec<String> = state
        .db
        .with_identity(&DbIdentity::service_role(), options, |tx| {
            Box::pin(async move {
                let mut query = sqlx::query_scalar(AssertSqlSafe(sql));
                for bind in binds {
                    query = query.bind(bind);
                }
                query.fetch_all(tx).await
            })
        })
        .await
        .map_err(message)?;
    texts
        .iter()
        .map(|text| serde_json::from_str(text).map_err(|error| error.to_string()))
        .collect()
}

/// Runs `sql` for its effect.
pub async fn execute(state: &AppState, sql: &'static str, binds: Vec<Bind>) -> Result<(), String> {
    state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    let mut query = sqlx::query(AssertSqlSafe(sql));
                    for bind in binds {
                        query = query.bind(bind);
                    }
                    query.execute(tx).await.map(|_| ())
                })
            },
        )
        .await
        .map_err(message)
}

/// `value.key` of a row.
pub fn text<'a>(row: &'a Value, key: &str) -> Option<&'a str> {
    row.get(key).and_then(Value::as_str)
}

pub fn bind(value: &str) -> Bind {
    Some(value.to_owned())
}

const FUNCTION_EXISTS: &str = "select exists (select 1 from pg_catalog.pg_proc p \
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace \
    where n.nspname = 'public' and p.proname = $1)";

/// The first step of the plan executor's `rpc`: the function is looked up by
/// name, and without one the call fails (`function not found`) before any
/// statement. `reserve_oembed_request` and `record_meme_view` are in no
/// migration, so in production their callers always take this failure.
pub async fn function_exists(state: &AppState, name: &'static str) -> Result<bool, String> {
    state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_scalar(FUNCTION_EXISTS)
                        .bind(name)
                        .fetch_one(tx)
                        .await
                })
            },
        )
        .await
        .map_err(message)
}

/// `db.rpc(name, ...)` as `identity`: `Err` for a missing function or a
/// failing call. `sql` calls the function.
pub async fn call_function(
    state: &AppState,
    identity: &DbIdentity,
    name: &'static str,
    sql: &'static str,
    binds: Vec<Bind>,
) -> Result<(), String> {
    if !function_exists(state, name).await? {
        return Err("function not found".to_owned());
    }
    state
        .db
        .with_identity(identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let mut query = sqlx::query(sql);
                for bind in binds {
                    query = query.bind(bind);
                }
                query.execute(tx).await.map(|_| ())
            })
        })
        .await
        .map_err(message)
}
