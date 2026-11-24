//! The session queries of better-auth's internal adapter
//! (dist/db/internal-adapter.mjs:349-385 `findSession`, 442-480
//! `updateSession`, 481-511 `deleteSession`) for this app: no secondary
//! storage, so each is one statement on `session`. They run as the login
//! role, as better-auth's do (`DbIdentity::better_auth`).
//!
//! Times travel as whole milliseconds since the epoch: node-pg gives
//! better-auth a `Date`, which keeps milliseconds only, and better-auth writes
//! `Date`s. `epoch + n * 1 ms` is exact where a float division is not.

use crate::db::{Db, DbIdentity, IdentityOptions};

/// One session and its user, with the columns `get-session` returns.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SessionRow {
    pub id: String,
    pub expires_at_ms: i64,
    pub token: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub user_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserRow {
    pub id: String,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    pub image: Option<String>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

type SessionColumns = (
    String,
    i64,
    String,
    i64,
    i64,
    Option<String>,
    Option<String>,
    String,
);
type UserColumns = (String, String, String, bool, Option<String>, i64, i64);

pub(super) const MS: &str = "floor(extract(epoch from {}) * 1000)::bigint";

pub(super) fn ms(column: &str) -> String {
    MS.replace("{}", column)
}

fn session_columns(alias: &str) -> String {
    format!(
        r#"{a}.id::text, {}, {a}.token, {}, {}, {a}."ipAddress", {a}."userAgent", {a}."userId"::text"#,
        ms(&format!(r#"{alias}."expiresAt""#)),
        ms(&format!(r#"{alias}."createdAt""#)),
        ms(&format!(r#"{alias}."updatedAt""#)),
        a = alias
    )
}

fn session_row(columns: SessionColumns) -> SessionRow {
    let (id, expires_at_ms, token, created_at_ms, updated_at_ms, ip_address, user_agent, user_id) =
        columns;
    SessionRow {
        id,
        expires_at_ms,
        token,
        created_at_ms,
        updated_at_ms,
        ip_address,
        user_agent,
        user_id,
    }
}

/// `findSession(token)`: the session with that token joined to its user;
/// none when either is missing.
pub async fn find(db: &Db, token: String) -> Result<Option<(SessionRow, UserRow)>, sqlx::Error> {
    let sql = format!(
        r#"select {}, u.id::text, u.name, u.email, u."emailVerified", u.image, {}, {}
             from public.session s
             join public."user" u on u.id = s."userId"
            where s.token = $1"#,
        session_columns("s"),
        ms(r#"u."createdAt""#),
        ms(r#"u."updatedAt""#)
    );
    type Row = (
        String,
        i64,
        String,
        i64,
        i64,
        Option<String>,
        Option<String>,
        String,
        String,
        String,
        String,
        bool,
        Option<String>,
        i64,
        i64,
    );
    let row: Option<Row> = db
        .with_identity(
            &DbIdentity::better_auth(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_as(sqlx::AssertSqlSafe(sql))
                        .bind(token)
                        .fetch_optional(tx)
                        .await
                })
            },
        )
        .await?;
    Ok(row.map(|row| {
        let session = session_row((row.0, row.1, row.2, row.3, row.4, row.5, row.6, row.7));
        let user: UserColumns = (row.8, row.9, row.10, row.11, row.12, row.13, row.14);
        let (id, name, email, email_verified, image, created_at_ms, updated_at_ms) = user;
        (
            session,
            UserRow {
                id,
                name,
                email,
                email_verified,
                image,
                created_at_ms,
                updated_at_ms,
            },
        )
    }))
}

/// `updateSession(token, { expiresAt, updatedAt })`: the row as it is after
/// the update, none when no row had the token any more.
pub async fn extend(
    db: &Db,
    token: String,
    expires_at_ms: i64,
    updated_at_ms: i64,
) -> Result<Option<SessionRow>, sqlx::Error> {
    let sql = format!(
        r#"update public.session s
              set "expiresAt" = timestamptz 'epoch' + $1 * interval '1 millisecond',
                  "updatedAt" = timestamptz 'epoch' + $2 * interval '1 millisecond'
            where s.token = $3
        returning {}"#,
        session_columns("s")
    );
    let row: Option<SessionColumns> = db
        .with_identity(
            &DbIdentity::better_auth(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_as(sqlx::AssertSqlSafe(sql))
                        .bind(expires_at_ms)
                        .bind(updated_at_ms)
                        .bind(token)
                        .fetch_optional(tx)
                        .await
                })
            },
        )
        .await?;
    Ok(row.map(session_row))
}

/// `deleteSession(token)`.
pub async fn delete(db: &Db, token: String) -> Result<(), sqlx::Error> {
    db.with_identity(
        &DbIdentity::better_auth(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                sqlx::query("delete from public.session where token = $1")
                    .bind(token)
                    .execute(tx)
                    .await
                    .map(|_| ())
            })
        },
    )
    .await
}
