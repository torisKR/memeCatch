//! `POST /api/auth/sign-up/email`: better-auth's `signUpEmail`
//! (dist/api/routes/sign-up.mjs) with this app's options:
//! `requireEmailVerification`, `autoSignIn: false`, minimum 12 characters,
//! the verification mail on sign-up, and the user hooks of
//! lib/auth/server.ts (the blocked-domain check before the insert,
//! `syncAuthUser` after the commit).
//!
//! Answered here: a JSON object of `name`, `email` (an address as zod reads
//! one) and a non-empty `password`, all strings, and an optional boolean
//! `rememberMe`. `image`, `callbackURL`, other keys, and bodies zod would
//! refuse go to Next.
//!
//! In one transaction, as `runWithTransaction` runs it: an existing address
//! gets the same answer as a new one (a user that is never stored, so the
//! answer does not tell); an address in a reserved domain is refused (400);
//! otherwise the user and its credential account are inserted. Then the
//! verification mail is sent and `syncAuthUser` mirrors the user into
//! `auth.users`. No session: `{ token: null, user }`.
//!
//! better-auth sends the mail inside its transaction, as the last thing in
//! it: nothing is written after the mail before the commit. Here the commit
//! comes first, so a slow webhook (up to 30 s) holds no pool connection; the
//! effects keep their order (rows, mail, `syncAuthUser`). What changes is
//! that the rows are visible during the mail, and that a process that dies
//! during the mail keeps them (PLAN.md A2-12).

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use serde_json::{Map, Value};

use super::accounts;
use super::email_token;
use super::forms;
use super::mail::Mail;
use super::passwords;
use super::session::user_json;
use super::sign_in::{bad_request, failed};
use super::store::UserRow;
use super::{BetterAuth, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, answer, uuid_v4};
use crate::AppState;
use crate::auth::now_ms;

/// `blockedPublicEmail` (lib/auth/reserved-email.ts): identities only a
/// trusted provider makes. `internalSignupOpen()` is never true for an HTTP
/// request, and the Kakao exception is for its OAuth callback only.
const RESERVED_DOMAINS: [&str; 3] = [
    "@auth.memecatch.internal",
    "@wallet.memecatch.internal",
    "@kakao.memecatch.internal",
];

pub async fn sign_up(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    let request = match forms::json_or_next(&state, request, |_, body| answerable(body)).await {
        Ok(request) => request,
        Err(next) => return next,
    };
    let headers = &request.parts.headers;
    if let Some(limited) = auth.limit(headers, "/sign-up/email") {
        return limited;
    }
    if let Some(refused) =
        forms::validate_origin(&auth, headers, false).or_else(|| forms::form_csrf(&auth, headers))
    {
        return refused;
    }
    let field = |key: &str| {
        forms::string(&request.body, key)
            .unwrap_or_default()
            .to_owned()
    };
    let (name, email, password) = (
        field("name"),
        field("email").to_lowercase(),
        field("password"),
    );
    if forms::js_length(&password) < MIN_PASSWORD_LENGTH {
        return bad_request("Password too short", "PASSWORD_TOO_SHORT");
    }
    if forms::js_length(&password) > MAX_PASSWORD_LENGTH {
        return bad_request("Password too long", "PASSWORD_TOO_LONG");
    }
    // Hashed on both paths, as better-auth does, before the transaction.
    let Ok(hash) = passwords::hash(&password).await else {
        return super::rate_limit::overloaded();
    };
    let now = now_ms();
    let created = create(&state, name.clone(), email.clone(), hash, now).await;
    let user = match created {
        Ok(Created::User(user)) => {
            send_verification(&auth, &user, now).await;
            user
        }
        Ok(Created::Taken) => return duplicate(&name, &email, now),
        Err(Failure::Blocked) => {
            return answer(
                StatusCode::BAD_REQUEST,
                b"BAD_REQUEST",
                r#"{"message":"blocked email domain"}"#.to_owned(),
                Vec::new(),
                false,
            );
        }
        Err(Failure::CreateUser(error)) => {
            tracing::error!(%error, "Failed to create user");
            return super::api_error(
                StatusCode::UNPROCESSABLE_ENTITY,
                b"UNPROCESSABLE_ENTITY",
                "Failed to create user",
                "FAILED_TO_CREATE_USER",
                Vec::new(),
                false,
            );
        }
        Err(Failure::Database(error)) => return failed(&error),
    };
    // The `create.after` hook, queued until the commit; a failure there is
    // the endpoint's failure, with the user already stored.
    if let Err(error) = accounts::sync_auth_user(&state.db, &user, false).await {
        tracing::error!(%error, "syncAuthUser failed after sign-up");
        return super::sign_in::server_error();
    }
    let body = format!(r#"{{"token":null,"user":{}}}"#, user_json(&user));
    answer(StatusCode::OK, b"OK", body, Vec::new(), false)
}

/// The body schema, for the bodies answered here.
fn answerable(body: &Map<String, Value>) -> bool {
    forms::only_keys(body, &["name", "email", "password", "rememberMe"])
        && forms::string(body, "name").is_some()
        && forms::string(body, "email").is_some_and(forms::is_email)
        && forms::string(body, "password").is_some_and(|password| !password.is_empty())
        && forms::optional_bool(body, "rememberMe")
}

enum Created {
    User(UserRow),
    Taken,
}

enum Failure {
    Blocked,
    CreateUser(sqlx::Error),
    Database(sqlx::Error),
}

impl From<sqlx::Error> for Failure {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}

async fn create(
    state: &AppState,
    name: String,
    email: String,
    hash: String,
    now: i64,
) -> Result<Created, Failure> {
    state
        .db
        .with_identity(
            &crate::db::DbIdentity::better_auth(),
            crate::db::IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    if accounts::email_taken(tx, &email).await? {
                        return Ok(Created::Taken);
                    }
                    if RESERVED_DOMAINS
                        .iter()
                        .any(|domain| email.ends_with(domain))
                    {
                        return Err(Failure::Blocked);
                    }
                    let user = accounts::insert_user(tx, &name, &email, now)
                        .await
                        .map_err(Failure::CreateUser)?;
                    accounts::insert_credential(tx, &user.id, &hash, now).await?;
                    Ok(Created::User(user))
                })
            },
        )
        .await
}

/// The verification mail of a new user, after the commit.
async fn send_verification(auth: &BetterAuth, user: &UserRow, now: i64) {
    let token = email_token::sign(&auth.secret, &user.email, &user.id, now.div_euclid(1000));
    auth.mailer
        .send(Mail {
            to: user.email.clone(),
            subject: "Verify your MemeCatch email",
            url: format!(
                "{}/verify-email?token={token}&callbackURL=%2F",
                auth.api_base_url
            ),
            not_delivered: "verification_email_not_delivered",
        })
        .await;
}

/// `buildGenericDuplicateResponse()`: a user with a fresh id that is not
/// stored, shaped as a new one.
fn duplicate(name: &str, email: &str, now: i64) -> Response {
    let user = UserRow {
        id: uuid_v4(),
        name: name.to_owned(),
        email: email.to_owned(),
        email_verified: false,
        image: None,
        created_at_ms: now,
        updated_at_ms: now,
    };
    let body = format!(r#"{{"token":null,"user":{}}}"#, user_json(&user));
    answer(StatusCode::OK, b"OK", body, Vec::new(), false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn object(text: &str) -> Map<String, Value> {
        match serde_json::from_str(text) {
            Ok(Value::Object(object)) => object,
            _ => panic!("{text}"),
        }
    }

    #[test]
    fn only_bodies_zod_takes_as_they_are_answered_here() {
        assert!(answerable(&object(
            r#"{"name":"","email":"a@b.co","password":"x"}"#
        )));
        for body in [
            r#"{"name":"n","email":"nobody","password":"x"}"#,
            r#"{"name":"n","email":"a@b.co","password":""}"#,
            r#"{"email":"a@b.co","password":"x"}"#,
            r#"{"name":"n","email":"a@b.co","password":"x","image":"i"}"#,
            r#"{"name":"n","email":"a@b.co","password":"x","callbackURL":"/"}"#,
        ] {
            assert!(!answerable(&object(body)), "{body}");
        }
    }
}
