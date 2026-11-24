//! The user, account and verification queries of better-auth's internal
//! adapter (dist/db/internal-adapter.mjs) that sign-in, sign-up, email
//! verification and password reset run, and the app's `syncAuthUser`
//! (lib/auth/sync-user.ts). As in store.rs: the login role
//! (`DbIdentity::better_auth`), times as whole milliseconds.

use futures_util::future::BoxFuture;
use sqlx::PgConnection;

use super::store::{UserRow, ms};
use crate::db::{Db, DbIdentity, IdentityOptions};

type UserColumns = (String, String, String, bool, Option<String>, i64, i64);

/// `"user"` columns in `UserRow` order, from alias `u`.
fn user_columns() -> String {
    format!(
        r#"u.id::text, u.name, u.email, u."emailVerified", u.image, {}, {}"#,
        ms(r#"u."createdAt""#),
        ms(r#"u."updatedAt""#)
    )
}

fn user_row(columns: UserColumns) -> UserRow {
    let (id, name, email, email_verified, image, created_at_ms, updated_at_ms) = columns;
    UserRow {
        id,
        name,
        email,
        email_verified,
        image,
        created_at_ms,
        updated_at_ms,
    }
}

const AT: &str = "timestamptz 'epoch' + {} * interval '1 millisecond'";

fn at(parameter: &str) -> String {
    AT.replace("{}", parameter)
}

async fn as_better_auth<T, E, F>(db: &Db, run: F) -> Result<T, E>
where
    F: for<'c> FnOnce(&'c mut PgConnection) -> BoxFuture<'c, Result<T, E>> + Send,
    T: Send,
    E: From<sqlx::Error>,
{
    db.with_identity(&DbIdentity::better_auth(), IdentityOptions::default(), run)
        .await
}

/// `findUserByEmail(email, { includeAccounts: true })` as sign-in reads it:
/// the user, and the password of its credential account (`providerId`
/// `credential`, `accountId` the user's id) when it has one.
pub async fn find_for_sign_in(
    db: &Db,
    email: String,
) -> Result<Option<(UserRow, Option<String>)>, sqlx::Error> {
    let sql = format!(
        r#"select {}, (select a.password from public.account a
                          where a."userId" = u.id and a."providerId" = 'credential'
                            and a."accountId" = u.id::text
                          limit 1)
             from public."user" u where u.email = $1"#,
        user_columns()
    );
    type Row = (
        String,
        String,
        String,
        bool,
        Option<String>,
        i64,
        i64,
        Option<String>,
    );
    let row: Option<Row> = as_better_auth(db, |tx| {
        Box::pin(async move {
            sqlx::query_as(sqlx::AssertSqlSafe(sql))
                .bind(email)
                .fetch_optional(tx)
                .await
        })
    })
    .await?;
    Ok(row.map(|row| {
        let user = user_row((row.0, row.1, row.2, row.3, row.4, row.5, row.6));
        (user, row.7)
    }))
}

/// `findUserByEmail(email)`.
pub async fn find_user_by_email(db: &Db, email: String) -> Result<Option<UserRow>, sqlx::Error> {
    find_user(db, "email", email).await
}

/// `findUserById(id)`.
pub async fn find_user_by_id(db: &Db, id: String) -> Result<Option<UserRow>, sqlx::Error> {
    find_user(db, "id::text", id).await
}

async fn find_user(db: &Db, column: &str, value: String) -> Result<Option<UserRow>, sqlx::Error> {
    let sql = format!(
        r#"select {} from public."user" u where u.{column} = $1"#,
        user_columns()
    );
    let row: Option<UserColumns> = as_better_auth(db, |tx| {
        Box::pin(async move {
            sqlx::query_as(sqlx::AssertSqlSafe(sql))
                .bind(value)
                .fetch_optional(tx)
                .await
        })
    })
    .await?;
    Ok(row.map(user_row))
}

/// `createSession(userId, dontRememberMe)`: a row with a fresh 32-character
/// token. Returns the token.
pub struct NewSession {
    pub user_id: String,
    pub ip_address: String,
    pub user_agent: String,
    pub expires_at_ms: i64,
    pub now_ms: i64,
    pub token: String,
}

pub async fn create_session(db: &Db, session: NewSession) -> Result<(), sqlx::Error> {
    let sql = format!(
        r#"insert into public.session ("expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
           values ({}, $2, {}, {}, $4, $5, $6::uuid)"#,
        at("$1"),
        at("$3"),
        at("$3")
    );
    as_better_auth(db, |tx| {
        Box::pin(async move {
            sqlx::query(sqlx::AssertSqlSafe(sql))
                .bind(session.expires_at_ms)
                .bind(session.token)
                .bind(session.now_ms)
                .bind(session.ip_address)
                .bind(session.user_agent)
                .bind(session.user_id)
                .execute(tx)
                .await
                .map(drop)
        })
    })
    .await
}

/// Inside the sign-up transaction: is there a user with this address.
pub async fn email_taken(tx: &mut PgConnection, email: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(r#"select exists (select 1 from public."user" where email = $1)"#)
        .bind(email)
        .fetch_one(tx)
        .await
}

/// Inside the sign-up transaction: `createUser({ email, name, emailVerified:
/// false })`.
pub async fn insert_user(
    tx: &mut PgConnection,
    name: &str,
    email: &str,
    now_ms: i64,
) -> Result<UserRow, sqlx::Error> {
    let sql = format!(
        r#"insert into public."user" as u (name, email, "emailVerified", "createdAt", "updatedAt")
           values ($1, $2, false, {}, {})
           returning {}"#,
        at("$3"),
        at("$3"),
        user_columns()
    );
    let row: UserColumns = sqlx::query_as(sqlx::AssertSqlSafe(sql))
        .bind(name)
        .bind(email)
        .bind(now_ms)
        .fetch_one(tx)
        .await?;
    Ok(user_row(row))
}

/// Inside a transaction: `linkAccount` / `createAccount` of a credential
/// account for `user_id` with `password`.
pub async fn insert_credential(
    tx: &mut PgConnection,
    user_id: &str,
    password: &str,
    now_ms: i64,
) -> Result<(), sqlx::Error> {
    let sql = format!(
        r#"insert into public.account ("accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           values ($1, 'credential', $1::uuid, $2, {}, {})"#,
        at("$3"),
        at("$3")
    );
    sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(user_id)
        .bind(password)
        .bind(now_ms)
        .execute(tx)
        .await
        .map(drop)
}

/// `updateUserByEmail(email, { emailVerified: true })`, which also sets
/// `updatedAt`. The updated row, as `afterEmailVerification` gets it.
pub async fn mark_verified(
    db: &Db,
    email: String,
    now_ms: i64,
) -> Result<Option<UserRow>, sqlx::Error> {
    let sql = format!(
        r#"update public."user" as u set "emailVerified" = true, "updatedAt" = {}
            where u.email = $2 returning {}"#,
        at("$1"),
        user_columns()
    );
    let row: Option<UserColumns> = as_better_auth(db, |tx| {
        Box::pin(async move {
            sqlx::query_as(sqlx::AssertSqlSafe(sql))
                .bind(now_ms)
                .bind(email)
                .fetch_optional(tx)
                .await
        })
    })
    .await?;
    Ok(row.map(user_row))
}

/// `createVerificationValue({ value, identifier, expiresAt })`.
pub async fn create_verification(
    db: &Db,
    identifier: String,
    value: String,
    expires_at_ms: i64,
    now_ms: i64,
) -> Result<(), sqlx::Error> {
    let sql = format!(
        r#"insert into public.verification (identifier, value, "expiresAt", "createdAt", "updatedAt")
           values ($1, $2, {}, {}, {})"#,
        at("$3"),
        at("$4"),
        at("$4")
    );
    as_better_auth(db, |tx| {
        Box::pin(async move {
            sqlx::query(sqlx::AssertSqlSafe(sql))
                .bind(identifier)
                .bind(value)
                .bind(expires_at_ms)
                .bind(now_ms)
                .execute(tx)
                .await
                .map(drop)
        })
    })
    .await
}

/// A `verification` row: its value and when it expires.
pub struct Verification {
    pub value: String,
    pub expires_at_ms: i64,
}

/// `findVerificationValue(identifier)`: the newest row for it, then the
/// cleanup that deletes every expired row (any identifier).
pub async fn find_verification(
    db: &Db,
    identifier: String,
    now_ms: i64,
) -> Result<Option<Verification>, sqlx::Error> {
    let find = format!(
        r#"select value, {} from public.verification
            where identifier = $1 order by "createdAt" desc limit 1"#,
        ms(r#""expiresAt""#)
    );
    let row: Option<(String, i64)> = as_better_auth(db, |tx| {
        Box::pin(async move {
            sqlx::query_as(sqlx::AssertSqlSafe(find))
                .bind(identifier)
                .fetch_optional(tx)
                .await
        })
    })
    .await?;
    let cleanup = format!(
        r#"delete from public.verification where "expiresAt" < {}"#,
        at("$1")
    );
    as_better_auth(db, |tx| {
        Box::pin(async move {
            sqlx::query(sqlx::AssertSqlSafe(cleanup))
                .bind(now_ms)
                .execute(tx)
                .await
                .map(drop)
        })
    })
    .await?;
    Ok(row.map(|(value, expires_at_ms)| Verification {
        value,
        expires_at_ms,
    }))
}

/// What `resetPassword` does in its transaction.
pub enum Reset {
    Done,
    /// `consumeVerificationValue` found no row, or an expired one: the
    /// transaction is rolled back.
    TokenSpent,
}

/// `resetCredentialPassword(ctx, userId, hash, consume)`: in one
/// transaction, consume the token (the newest row for the identifier, then
/// every row for it), then set the credential password, creating the
/// credential account when there is none.
pub async fn reset_password(
    db: &Db,
    identifier: String,
    user_id: String,
    password: String,
    now_ms: i64,
) -> Result<Reset, sqlx::Error> {
    let outcome: Result<Reset, ResetFailure> = as_better_auth(db, |tx| {
        Box::pin(async move {
            let consumed: Option<i64> = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
                r#"with latest as (
                     select id from public.verification where identifier = $1
                      order by "createdAt" desc limit 1)
                   delete from public.verification v using latest
                    where v.id = latest.id returning {}"#,
                ms(r#"v."expiresAt""#)
            )))
            .bind(&identifier)
            .fetch_optional(&mut *tx)
            .await?;
            sqlx::query("delete from public.verification where identifier = $1")
                .bind(&identifier)
                .execute(&mut *tx)
                .await?;
            if consumed.is_none_or(|expires_at_ms| expires_at_ms < now_ms) {
                return Err(ResetFailure::TokenSpent);
            }
            let updated = sqlx::query(sqlx::AssertSqlSafe(format!(
                r#"update public.account set password = $1, "updatedAt" = {}
                    where "userId" = $3::uuid and "providerId" = 'credential' and "accountId" = $3"#,
                at("$2")
            )))
            .bind(&password)
            .bind(now_ms)
            .bind(&user_id)
            .execute(&mut *tx)
            .await?;
            if updated.rows_affected() == 0 {
                insert_credential(tx, &user_id, &password, now_ms).await?;
            }
            Ok(Reset::Done)
        })
    })
    .await;
    match outcome {
        Ok(done) => Ok(done),
        Err(ResetFailure::TokenSpent) => Ok(Reset::TokenSpent),
        Err(ResetFailure::Database(error)) => Err(error),
    }
}

enum ResetFailure {
    TokenSpent,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ResetFailure {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}

/// `nicknameFor(user, attempt)` (lib/auth/sync-user.ts): the name trimmed to
/// 20 UTF-16 units, a fallback below 2, a suffix after a collision.
fn nickname_for(id: &str, name: &str, attempt: u32) -> String {
    let compact: String = id.replace('-', "");
    let named = if name.is_empty() { "밈러" } else { name };
    let base = js_slice(js_trim(named), 20);
    let fallback = if base.encode_utf16().count() >= 2 {
        base
    } else {
        format!("밈러_{}", js_slice(&compact, 6))
    };
    if attempt == 0 {
        return js_slice(&fallback, 20);
    }
    let suffix = format!("_{attempt}{}", js_slice(&compact, 3));
    let keep = 20usize.saturating_sub(suffix.encode_utf16().count()).max(2);
    js_slice(&format!("{}{suffix}", js_slice(&fallback, keep)), 20)
}

/// `text.slice(0, units)`: whole UTF-16 units, a split pair written as the
/// replacement character, as node-pg sends a lone surrogate.
fn js_slice(text: &str, units: usize) -> String {
    let head: Vec<u16> = text.encode_utf16().take(units).collect();
    String::from_utf16_lossy(&head)
}

/// `String.prototype.trim`.
fn js_trim(text: &str) -> &str {
    // JavaScript's set: White_Space without U+0085, plus U+FEFF.
    text.trim_matches(|c: char| (c.is_whitespace() && c != '\u{85}') || c == '\u{feff}')
}

/// `syncAuthUser(user)`: mirror the user into `auth.users`, whose trigger
/// creates the profile; up to five nicknames before giving up.
pub async fn sync_auth_user(
    db: &Db,
    user: &UserRow,
    email_verified: bool,
) -> Result<(), SyncFailure> {
    for attempt in 0..5 {
        let nickname = nickname_for(&user.id, &user.name, attempt);
        let (id, email) = (user.id.clone(), user.email.clone());
        let written: Result<(), sqlx::Error> = as_better_auth(db, |tx| {
            Box::pin(async move {
                sqlx::query(
                    "insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
                     values ($1::uuid, $2, case when $4::boolean then now() else null end,
                             jsonb_build_object('nickname', $3::text))
                     on conflict (id) do update
                       set email = excluded.email,
                           email_confirmed_at = case
                             when auth.users.email_confirmed_at is not null then auth.users.email_confirmed_at
                             when $4::boolean then now()
                             else null
                           end,
                           updated_at = now()",
                )
                .bind(id)
                .bind(email)
                .bind(nickname)
                .bind(email_verified)
                .execute(tx)
                .await
                .map(drop)
            })
        })
        .await;
        match written {
            Ok(()) => return Ok(()),
            Err(sqlx::Error::Database(error)) if error.code().as_deref() == Some("23505") => {}
            Err(error) => return Err(SyncFailure::Database(error)),
        }
    }
    Err(SyncFailure::NicknameCollision)
}

pub enum SyncFailure {
    Database(sqlx::Error),
    /// `throw new Error("nickname collision")`.
    NicknameCollision,
}

impl std::fmt::Display for SyncFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Database(error) => error.fmt(f),
            Self::NicknameCollision => f.write_str("nickname collision"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "4f3bea5e-b55d-4bc2-b46a-b7feda6ac502";

    // Expected values: `nicknameFor` of lib/auth/sync-user.ts on the same input.
    #[test]
    fn nicknames_are_cut_and_suffixed_as_sync_user_does() {
        for (name, attempt, expected) in [
            ("probe", 0, "probe"),
            ("  probe  ", 0, "probe"),
            ("", 0, "밈러"),
            ("x", 0, "밈러_4f3bea"),
            ("   ", 0, "밈러_4f3bea"),
            ("abcdefghijklmnopqrstuvwxyz", 0, "abcdefghijklmnopqrst"),
            ("probe", 1, "probe_14f3"),
            ("abcdefghijklmnopqrstuvwxyz", 2, "abcdefghijklmno_24f3"),
            ("😀😀😀😀😀😀😀😀😀😀😀", 0, "😀😀😀😀😀😀😀😀😀😀"),
            // A pair cut in half: node-pg writes the lone half as U+FFFD.
            ("a😀😀😀😀😀😀😀😀😀😀", 0, "a😀😀😀😀😀😀😀😀😀\u{fffd}"),
            ("\u{85}x\u{85}", 0, "\u{85}x\u{85}"),
            ("\u{feff}ab\u{feff}", 0, "ab"),
        ] {
            assert_eq!(
                nickname_for(ID, name, attempt),
                expected,
                "{name:?} {attempt}"
            );
        }
    }
}
