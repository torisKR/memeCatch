//! The OAuth state as better-auth keeps it with a database
//! (`storeStateStrategy: "database"`, dist/state.mjs and
//! dist/oauth2/state.mjs): a random `state` (32 characters of
//! `a-z0-9A-Z-_`), a `verification` row `auth-state:<state>` holding the
//! flow as JSON for 10 minutes, and the `state` cookie, signed, for 5
//! minutes. Either server reads the other's: the row and the cookie are the
//! same bytes.

use axum::http::HeaderMap;
use serde_json::{Map, Value};

use super::super::{BetterAuth, accounts};
use super::callback::{append_query_params, location_on_site};
use crate::auth::{cookie_header, cookie_value, verify_signed_value};
use crate::db::Db;

/// `expiresAt: Date.now() + 6e5`, in the row and in its JSON.
const STATE_TTL_MS: i64 = 600_000;
/// `createAuthCookie("state", { maxAge: 300 })`.
const STATE_COOKIE_SECS: i64 = 300;
/// `generateRandomString(128)` for the PKCE verifier.
const CODE_VERIFIER_LEN: usize = 128;
const STATE_LEN: usize = 32;

/// `createRandomStringGenerator("a-z", "0-9", "A-Z", "-_")`: 64 characters,
/// uniform.
fn random_string(length: usize) -> String {
    use rand::RngExt;
    const ALPHABET: &[u8; 64] = b"abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
    let mut rng = rand::rng();
    (0..length)
        .map(|_| char::from(ALPHABET[rng.random_range(0..ALPHABET.len())]))
        .collect()
}

fn identifier(state: &str) -> String {
    format!("auth-state:{state}")
}

/// The flow a sign-in starts with: the body's URLs.
pub struct Flow<'a> {
    pub callback_url: &'a str,
    pub error_url: Option<&'a str>,
    pub new_user_url: Option<&'a str>,
}

pub struct Started {
    pub state: String,
    pub code_verifier: String,
    pub cookie_line: String,
}

/// `generateState(c)` then `generateGenericState`: the JSON keys in the
/// order better-auth spreads them, `undefined` ones left out.
fn state_json(flow: &Flow, code_verifier: &str, expires_at_ms: i64, state: &str) -> String {
    let text = |value: &str| Value::from(value).to_string();
    let mut json = format!(
        r#"{{"callbackURL":{},"codeVerifier":{}"#,
        text(flow.callback_url),
        text(code_verifier)
    );
    if let Some(url) = flow.error_url {
        json.push_str(&format!(r#","errorURL":{}"#, text(url)));
    }
    if let Some(url) = flow.new_user_url {
        json.push_str(&format!(r#","newUserURL":{}"#, text(url)));
    }
    json.push_str(&format!(
        r#","expiresAt":{expires_at_ms},"oauthState":{}}}"#,
        text(state)
    ));
    json
}

/// The signed cookie is set before the row is written; a row that cannot be
/// written throws out of the endpoint (`generateState` returns the promise
/// without awaiting it, so its `catch` never sees the error).
pub async fn start(
    db: &Db,
    auth: &BetterAuth,
    flow: &Flow<'_>,
    now_ms: i64,
) -> Result<Started, sqlx::Error> {
    let code_verifier = random_string(CODE_VERIFIER_LEN);
    let state = random_string(STATE_LEN);
    let expires_at_ms = now_ms + STATE_TTL_MS;
    let names = &auth.cookies;
    let cookie_line = names.signed(&names.state, &state, &auth.secret, Some(STATE_COOKIE_SECS));
    let value = state_json(flow, &code_verifier, expires_at_ms, &state);
    accounts::create_verification(db, identifier(&state), value, expires_at_ms, now_ms).await?;
    Ok(Started {
        state,
        code_verifier,
        cookie_line,
    })
}

/// The flow as the callback reads it back.
#[derive(Debug, PartialEq)]
pub struct Stored {
    pub callback_url: String,
    pub code_verifier: String,
    /// `parsedData.errorURL`, the default error page when it was not given.
    pub error_url: Option<String>,
    pub new_user_url: Option<String>,
}

/// How `parseState(c)` ends when it does not return the flow.
#[derive(Debug, PartialEq)]
pub enum Refused {
    /// `redirectOnError(c, url, code)`: the flow's error URL when the row
    /// was read, otherwise the default one.
    Redirect {
        code: &'static str,
        error_url: Option<String>,
        /// The `state` cookie was expired before the refusal.
        expired_cookie: bool,
    },
    /// A flow this server does not finish (an account link, an ID-token
    /// nonce, server context, extra data): Next reads the row instead.
    ToNext,
}

/// `parseGenericState(c, state)` and `parseState(c)` for the database
/// strategy, in their order: the row (none: `state_mismatch`), its JSON
/// (unreadable: `internal_server_error`), the `oauthState`, the signed
/// cookie, then the cookie expired and the row deleted, then the expiry.
pub async fn take(
    db: &Db,
    auth: &BetterAuth,
    headers: &HeaderMap,
    state: &str,
    now_ms: i64,
) -> Result<Result<Stored, Refused>, sqlx::Error> {
    let refused = |code, error_url, expired_cookie| {
        Ok(Err(Refused::Redirect {
            code,
            error_url,
            expired_cookie,
        }))
    };
    let Some(row) = accounts::find_verification(db, identifier(state), now_ms).await? else {
        return refused("state_mismatch", None, false);
    };
    let Some(data) = read_json(&row.value) else {
        return refused("internal_server_error", None, false);
    };
    // Unlike better-auth, before anything else and before Next sees the
    // row: a URL of the flow that would send the browser off this site
    // (PLAN.md A3-12).
    if !lands_on_site(&data.stored, auth) {
        tracing::warn!("OAuth state holds a URL off this site");
        return refused("state_mismatch", None, false);
    }
    if data.for_next {
        return Ok(Err(Refused::ToNext));
    }
    if data
        .oauth_state
        .as_deref()
        .is_some_and(|stored| stored != state)
    {
        return refused("state_mismatch", data.stored.error_url, false);
    }
    let names = &auth.cookies;
    let cookie = cookie_header(headers).and_then(|header| cookie_value(&header, &names.state));
    let signed = cookie
        .as_deref()
        .and_then(|value| verify_signed_value(value, &auth.secret));
    if signed != Some(state) {
        return refused("state_mismatch", data.stored.error_url, false);
    }
    // better-auth deletes after reading (`deleteVerificationByIdentifier`),
    // so two callbacks racing with one state could both pass. Here the
    // delete decides: the one that deleted nothing is refused (PLAN.md A3).
    // An expired row was deleted by the read's cleanup, so its expiry is
    // answered first, toward the flow's page as better-auth answers it.
    let deleted = accounts::delete_verifications(db, identifier(state)).await?;
    if data.expires_at < now_ms as f64 {
        return refused("state_mismatch", data.stored.error_url, true);
    }
    if !deleted {
        return refused("state_mismatch", None, true);
    }
    Ok(Ok(data.stored))
}

/// Whether every redirect the flow can end with lands on this site: the
/// error URL with `error` appended, the callback URL and the new-user URL,
/// each as the browser reads the `Location`.
fn lands_on_site(stored: &Stored, auth: &BetterAuth) -> bool {
    let error = stored.error_url.as_deref().is_none_or(|url| {
        append_query_params(url, "error=state_mismatch")
            .is_some_and(|location| location_on_site(&location, auth))
    });
    let new_user = stored
        .new_user_url
        .as_deref()
        .is_none_or(|url| location_on_site(url, auth));
    error && new_user && location_on_site(&stored.callback_url, auth)
}

struct Data {
    stored: Stored,
    oauth_state: Option<String>,
    expires_at: f64,
    /// A flow this server does not finish: Next reads the row.
    for_next: bool,
}

/// The keys of `stateDataSchema` this server finishes; `requestSignUp` only
/// matters with `disableImplicitSignUp`, which this app does not set.
const KNOWN: [&str; 7] = [
    "callbackURL",
    "codeVerifier",
    "errorURL",
    "newUserURL",
    "expiresAt",
    "oauthState",
    "requestSignUp",
];

/// `None` where `JSON.parse` or `stateDataSchema.parse` throws.
fn read_json(value: &str) -> Option<Data> {
    let Ok(Value::Object(object)) = serde_json::from_str::<Value>(value) else {
        return None;
    };
    let string = |key: &str| match object.get(key) {
        Some(Value::String(text)) => Some(Some(text.clone())),
        None => Some(None),
        Some(_) => None,
    };
    let required = |key: &str| string(key).flatten();
    let expires_at = object.get("expiresAt").and_then(Value::as_f64)?;
    if object
        .get("requestSignUp")
        .is_some_and(|value| !value.is_boolean())
    {
        return None;
    }
    Some(Data {
        stored: Stored {
            callback_url: required("callbackURL")?,
            code_verifier: required("codeVerifier")?,
            error_url: string("errorURL")?.filter(|url| !url.is_empty()),
            new_user_url: string("newUserURL")?,
        },
        oauth_state: string("oauthState")?,
        expires_at,
        for_next: !only_known(&object),
    })
}

fn only_known(object: &Map<String, Value>) -> bool {
    object.keys().all(|key| KNOWN.contains(&key.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_row_holds_what_better_auth_stores() {
        let flow = Flow {
            callback_url: "http://localhost:3000/auth/callback?next=%2F",
            error_url: None,
            new_user_url: Some("/welcome"),
        };
        assert_eq!(
            state_json(&flow, "v", 1_700_000_600_000, "s"),
            r#"{"callbackURL":"http://localhost:3000/auth/callback?next=%2F","codeVerifier":"v","newUserURL":"/welcome","expiresAt":1700000600000,"oauthState":"s"}"#
        );
        let state = random_string(STATE_LEN);
        assert_eq!(state.len(), 32);
        assert!(
            state
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        );
    }

    #[test]
    fn a_row_is_read_back_or_left_to_next() {
        let read = read_json(
            r#"{"callbackURL":"/","codeVerifier":"v","errorURL":"","expiresAt":5,"oauthState":"s","requestSignUp":false}"#,
        )
        .expect("read");
        assert_eq!(read.stored.error_url, None);
        assert!(!read.for_next);
        assert_eq!(read.expires_at, 5.0);
        for next in [
            r#"{"callbackURL":"/","codeVerifier":"v","expiresAt":5,"link":{"email":"a","userId":"b"}}"#,
            r#"{"callbackURL":"/","codeVerifier":"v","expiresAt":5,"idTokenNonce":"n"}"#,
            r#"{"theme":"dark","callbackURL":"/","codeVerifier":"v","expiresAt":5}"#,
        ] {
            assert!(read_json(next).expect("read").for_next, "{next}");
        }
        for broken in [
            "not json",
            r#"{"codeVerifier":"v","expiresAt":5}"#,
            r#"{"callbackURL":"/","codeVerifier":"v","expiresAt":"5"}"#,
            r#"{"callbackURL":"/","codeVerifier":"v","expiresAt":5,"errorURL":null}"#,
        ] {
            assert!(read_json(broken).is_none(), "{broken}");
        }
    }
}
