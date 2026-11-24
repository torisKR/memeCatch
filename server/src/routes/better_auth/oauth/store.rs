//! The account and user queries of better-auth's internal adapter
//! (dist/db/internal-adapter.mjs) that an OAuth callback runs:
//! `findAccountOwnerByKey`, `linkAccount`/`createAccount`, `updateAccount`,
//! `updateUser({ emailVerified: true })`, and `createUser` with its account
//! in one transaction. As accounts.rs: the login role, times as whole
//! milliseconds, `updatedAt` set by every update.

use sqlx::PgConnection;

use super::super::store::{UserRow, ms};
use super::providers::{Field, Tokens};
use crate::db::{Db, DbIdentity, IdentityOptions};

const AT: &str = "timestamptz 'epoch' + {} * interval '1 millisecond'";

fn at(parameter: &str) -> String {
    AT.replace("{}", parameter)
}

fn user_columns() -> String {
    format!(
        r#"u.id::text, u.name, u.email, u."emailVerified", u.image, {}, {}"#,
        ms(r#"u."createdAt""#),
        ms(r#"u."updatedAt""#)
    )
}

type UserColumns = (String, String, String, bool, Option<String>, i64, i64);

fn user_row(
    (id, name, email, email_verified, image, created_at_ms, updated_at_ms): UserColumns,
) -> UserRow {
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

/// Who an account key belongs to.
pub enum Owner {
    /// The account's id and its user.
    Owned { account_id: String, user: UserRow },
    /// The account's user is gone.
    Orphaned,
}

/// `findAccountOwnerByKey({ providerId, accountId })`: the account with
/// its user. Two accounts with the key is better-auth's error, `Err(None)`.
pub async fn find_account_owner(
    db: &Db,
    provider_id: &str,
    account_id: &str,
) -> Result<Option<Owner>, Option<sqlx::Error>> {
    let sql = format!(
        r#"select a.id::text, {}
             from public.account a left join public."user" u on u.id = a."userId"
            where a."providerId" = $1 and a."accountId" = $2
            limit 2"#,
        user_columns().replace(r#"u.id::text, "#, r#"u.id::text as user_id, "#)
    );
    type Row = (
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<bool>,
        Option<String>,
        Option<i64>,
        Option<i64>,
    );
    let (provider_id, account_id) = (provider_id.to_owned(), account_id.to_owned());
    let rows: Vec<Row> = db
        .with_identity(
            &DbIdentity::better_auth(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_as(sqlx::AssertSqlSafe(sql))
                        .bind(provider_id)
                        .bind(account_id)
                        .fetch_all(tx)
                        .await
                })
            },
        )
        .await
        .map_err(Some)?;
    if rows.len() > 1 {
        return Err(None);
    }
    Ok(rows
        .into_iter()
        .next()
        .map(|row| match (row.1, row.2, row.3, row.4, row.6, row.7) {
            (Some(id), Some(name), Some(email), Some(verified), Some(created), Some(updated)) => {
                Owner::Owned {
                    account_id: row.0,
                    user: user_row((id, name, email, verified, row.5, created, updated)),
                }
            }
            _ => Owner::Orphaned,
        }))
}

/// A new account of a provider for `user_id`, with the callback's tokens.
#[derive(Clone)]
pub struct NewAccount {
    pub provider_id: &'static str,
    pub account_id: String,
    pub tokens: Tokens,
}

async fn insert_account(
    tx: &mut PgConnection,
    user_id: &str,
    account: &NewAccount,
    now_ms: i64,
) -> Result<(), sqlx::Error> {
    let sql = format!(
        r#"insert into public.account ("accountId", "providerId", "userId", "accessToken",
               "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt",
               scope, "createdAt", "updatedAt")
           values ($1, $2, $3::uuid, $4, $5, $6, {}, {}, $9, {}, {})"#,
        at("$7"),
        at("$8"),
        at("$10"),
        at("$10")
    );
    let tokens = &account.tokens;
    sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(&account.account_id)
        .bind(account.provider_id)
        .bind(user_id)
        .bind(tokens.access_token.as_deref())
        .bind(tokens.refresh_token.as_deref())
        .bind(tokens.id_token.as_deref())
        .bind(tokens.access_token_expires_at_ms)
        .bind(tokens.refresh_token_expires_at_ms)
        .bind(&tokens.scope)
        .bind(now_ms)
        .execute(tx)
        .await
        .map(drop)
}

/// `linkAccount({...})` for an existing user.
pub async fn link_account(
    db: &Db,
    user_id: &str,
    account: &NewAccount,
    now_ms: i64,
) -> Result<(), sqlx::Error> {
    let (user_id, account) = (user_id.to_owned(), account.clone());
    db.with_identity(
        &DbIdentity::better_auth(),
        IdentityOptions::default(),
        |tx| Box::pin(async move { insert_account(tx, &user_id, &account, now_ms).await }),
    )
    .await
}

/// `updateAccount(id, freshTokens)`: `providerId` and each token the answer
/// had (`null` included; a missing one is kept), and `updatedAt`. `false`
/// when the row is gone.
pub async fn update_tokens(
    db: &Db,
    id: &str,
    provider_id: &str,
    tokens: &Tokens,
    now_ms: i64,
) -> Result<bool, sqlx::Error> {
    let mut sets = vec![r#""providerId" = $3"#.to_owned()];
    let mut texts: Vec<Option<String>> = Vec::new();
    for (column, field) in [
        ("idToken", &tokens.id_token),
        ("accessToken", &tokens.access_token),
        ("refreshToken", &tokens.refresh_token),
    ] {
        if *field != Field::Absent {
            texts.push(field.as_deref().map(str::to_owned));
            sets.push(format!(r#""{column}" = ${}"#, 3 + texts.len()));
        }
    }
    let mut times: Vec<i64> = Vec::new();
    for (column, at_ms) in [
        ("accessTokenExpiresAt", tokens.access_token_expires_at_ms),
        ("refreshTokenExpiresAt", tokens.refresh_token_expires_at_ms),
    ] {
        if let Some(at_ms) = at_ms {
            times.push(at_ms);
            sets.push(format!(
                r#""{column}" = {}"#,
                at(&format!("${}", 3 + texts.len() + times.len()))
            ));
        }
    }
    sets.push(format!(r#""updatedAt" = {}"#, at("$2")));
    let sql = format!(
        r#"update public.account set {} where id = $1::uuid"#,
        sets.join(", ")
    );
    let (id, provider_id) = (id.to_owned(), provider_id.to_owned());
    let updated = db
        .with_identity(
            &DbIdentity::better_auth(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    let mut query = sqlx::query(sqlx::AssertSqlSafe(sql))
                        .bind(id)
                        .bind(now_ms)
                        .bind(provider_id);
                    for text in texts {
                        query = query.bind(text);
                    }
                    for time in times {
                        query = query.bind(time);
                    }
                    query.execute(tx).await
                })
            },
        )
        .await?;
    Ok(updated.rows_affected() > 0)
}

/// `updateUser(id, { emailVerified: true })`.
pub async fn mark_verified(db: &Db, user_id: &str, now_ms: i64) -> Result<(), sqlx::Error> {
    let sql = format!(
        r#"update public."user" set "emailVerified" = true, "updatedAt" = {} where id = $2::uuid"#,
        at("$1")
    );
    let user_id = user_id.to_owned();
    db.with_identity(
        &DbIdentity::better_auth(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                sqlx::query(sqlx::AssertSqlSafe(sql))
                    .bind(now_ms)
                    .bind(user_id)
                    .execute(tx)
                    .await
                    .map(drop)
            })
        },
    )
    .await
}

/// The new user of a sign-up through a provider.
pub struct NewUser {
    pub name: String,
    /// Lowercased.
    pub email: String,
    pub email_verified: bool,
    pub image: Option<String>,
}

pub enum Created {
    User(UserRow),
    /// The `create.before` hook refused the address.
    Blocked,
}

/// `runWithTransaction(adapter, () => createUser(...) then createAccount(...))`
/// with the app's `create.before` hook (`blocked`).
pub async fn create_user(
    db: &Db,
    user: NewUser,
    account: &NewAccount,
    blocked: bool,
    now_ms: i64,
) -> Result<Created, sqlx::Error> {
    if blocked {
        return Ok(Created::Blocked);
    }
    let sql = format!(
        r#"insert into public."user" as u (name, email, "emailVerified", image, "createdAt", "updatedAt")
           values ($1, $2, $3, $4, {}, {})
           returning {}"#,
        at("$5"),
        at("$5"),
        user_columns()
    );
    let account = account.clone();
    db.with_identity(
        &DbIdentity::better_auth(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                let row: UserColumns = sqlx::query_as(sqlx::AssertSqlSafe(sql))
                    .bind(user.name)
                    .bind(user.email)
                    .bind(user.email_verified)
                    .bind(user.image)
                    .bind(now_ms)
                    .fetch_one(&mut *tx)
                    .await?;
                let created = user_row(row);
                insert_account(tx, &created.id, &account, now_ms).await?;
                Ok(Created::User(created))
            })
        },
    )
    .await
}
