//! Running the statements lib/db/execute.ts compiles for the candidate
//! routes: each in a transaction of its own, under the identity the
//! TypeScript's client has, giving rows as `row_to_json` text and failures
//! as the Postgres message (`queryError`).

use sqlx::encode::IsNull;
use sqlx::error::BoxDynError;
use sqlx::postgres::types::Oid;
use sqlx::postgres::{PgArgumentBuffer, PgTypeInfo};
use sqlx::{Encode, Postgres, Type};

use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};

/// The `error.message` lib/db gives for `.single()` without exactly one row.
pub const NOT_ONE_ROW: &str = "JSON object requested, multiple (or no) rows returned";

/// A parameter Postgres types itself, as node-pg sends every value. Only
/// where the type shows: in the message of a function call that fails.
pub struct Untyped(pub String);

impl Type<Postgres> for Untyped {
    fn type_info() -> PgTypeInfo {
        PgTypeInfo::with_oid(Oid(0))
    }
}

impl Encode<'_, Postgres> for Untyped {
    fn encode_by_ref(&self, buf: &mut PgArgumentBuffer) -> Result<IsNull, BoxDynError> {
        <&str as Encode<Postgres>>::encode(self.0.as_str(), buf)
    }
}

/// One bound value.
pub enum Bind {
    Text(String),
    Texts(Vec<String>),
    Int(i32),
    Floats(Vec<f64>),
    NullInt,
    Untyped(String),
}

fn message(error: &sqlx::Error) -> String {
    match error.as_database_error() {
        Some(database) => database.message().to_owned(),
        None => error.to_string(),
    }
}

type Scalar<'q> = sqlx::query::QueryScalar<'q, Postgres, String, sqlx::postgres::PgArguments>;

fn bind(query: Scalar<'_>, value: Bind) -> Scalar<'_> {
    match value {
        Bind::Text(text) => query.bind(text),
        Bind::Texts(texts) => query.bind(texts),
        Bind::Int(number) => query.bind(number),
        Bind::Floats(numbers) => query.bind(numbers),
        Bind::NullInt => query.bind(None::<i64>),
        Bind::Untyped(text) => query.bind(Untyped(text)),
    }
}

/// The rows of `sql` (which selects one text column) as `identity`.
pub async fn rows(
    state: &AppState,
    identity: &DbIdentity,
    sql: &'static str,
    values: Vec<Bind>,
) -> Result<Vec<String>, String> {
    let result: Result<Vec<String>, sqlx::Error> = state
        .db
        .with_identity(identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let query = values
                    .into_iter()
                    .fold(sqlx::query_scalar(sql).persistent(false), bind);
                query.fetch_all(tx).await
            })
        })
        .await;
    result.map_err(|error| message(&error))
}

/// `.single()`: the one row, or why not.
pub async fn single(
    state: &AppState,
    identity: &DbIdentity,
    sql: &'static str,
    values: Vec<Bind>,
) -> Result<String, String> {
    let mut found = rows(state, identity, sql, values).await?;
    match (found.pop(), found.is_empty()) {
        (Some(row), true) => Ok(row),
        _ => Err(NOT_ONE_ROW.to_owned()),
    }
}

/// A statement without rows (`DELETE`, `INSERT` without `RETURNING`).
pub async fn execute(
    state: &AppState,
    identity: &DbIdentity,
    sql: &'static str,
    values: Vec<Bind>,
) -> Result<(), String> {
    let result: Result<(), sqlx::Error> =
        state
            .db
            .with_identity(identity, IdentityOptions::default(), |tx| {
                Box::pin(async move {
                    let query = values.into_iter().fold(
                        sqlx::query(sql).persistent(false),
                        |query, value| match value {
                            Bind::Text(text) => query.bind(text),
                            Bind::Texts(texts) => query.bind(texts),
                            Bind::Int(number) => query.bind(number),
                            Bind::Floats(numbers) => query.bind(numbers),
                            Bind::NullInt => query.bind(None::<i64>),
                            Bind::Untyped(text) => query.bind(Untyped(text)),
                        },
                    );
                    query.execute(tx).await.map(|_| ())
                })
            })
            .await;
    result.map_err(|error| message(&error))
}

/// The detail of a database error, for `classifyOpenRouterReservationError`.
pub fn detail(error: &sqlx::Error) -> Option<String> {
    error
        .as_database_error()?
        .try_downcast_ref::<sqlx::postgres::PgDatabaseError>()?
        .detail()
        .map(str::to_owned)
}
