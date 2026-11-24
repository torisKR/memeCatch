//! Who is calling: reads the session the Next app created with better-auth,
//! checks operators, and guards cron routes.
//!
//! Sign-in, sign-up and OAuth stay in Next (`lib/auth/server.ts`,
//! `/api/auth/*`). This module only reads: it never writes to `user`,
//! `session`, `account` or `verification`, never sets a cookie, and never
//! extends a session. better-auth's `getSession` does extend sessions; that
//! keeps happening in Next, which the site header asks on page load
//! (`/api/auth/get-session`, from components/auth-menu.tsx).
//!
//! Route handlers take one of the extractors:
//!
//! ```ignore
//! async fn list(identity: RequestIdentity, State(state): State<AppState>) { // signed in or not
//!     state.db.with_identity(&identity.db_identity(), IdentityOptions::default(), ...)
//! }
//! async fn save(SignedInUser(user): SignedInUser) {}  // 401 when signed out
//! async fn review(Operator(user): Operator) {}        // 401 signed out, 403 not an operator
//! async fn nightly(_: CronAuthorized) {}              // 401 without the cron bearer
//! async fn reindex(_: CronAuthorizedTrimmed) {}       // the same, secret trimmed first
//! ```
//!
//! All of them answer 503 when the database cannot be asked. A handler that
//! needs another response body takes `Result<SignedInUser, AuthRejection>`.
//!
//! The cookie format comes from better-auth 1.7.20 and better-call 1.4.5 as
//! installed in `node_modules`; each step below names the file it mirrors.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::extract::FromRequestParts;
use axum::http::StatusCode;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, COOKIE, HeaderMap, HeaderValue};
use axum::http::request::Parts;
use axum::response::{IntoResponse, Response};
use base64::Engine;
use base64::engine::general_purpose::{GeneralPurpose, GeneralPurposeConfig};
use hmac::{Hmac, KeyInit, Mac};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::AppState;
use crate::config::Secret;
use crate::db::{DbIdentity, IdentityOptions};

// better-auth names the cookie `<prefix>.session_token` with the default
// prefix `better-auth`, and puts `__Secure-` in front when `useSecureCookies`
// is on (better-auth dist/cookies/index.mjs:23-32,49). The app turns that on
// in production (lib/auth/server.ts:120).
const SESSION_COOKIE: &str = "better-auth.session_token";
const SECURE_SESSION_COOKIE: &str = "__Secure-better-auth.session_token";

/// The one session cookie name this process reads, the same one the Next app
/// reads. Never both: a browser only accepts a `__Secure-` cookie over HTTPS
/// from the site itself, so reading the plain name in production would let a
/// planted cookie sign a visitor in to someone else's session.
pub(crate) fn session_cookie_name(use_secure_cookies: bool) -> &'static str {
    if use_secure_cookies {
        SECURE_SESSION_COOKIE
    } else {
        SESSION_COOKIE
    }
}

// node-pg fails at once when Postgres refuses the connection. sqlx retries
// until the pool's acquire timeout (5 s, `db.rs`), so a database outage would
// hold every signed-in request that long before its route runs. Same limit
// as the health check.
const AUTH_DB_TIMEOUT: Duration = Duration::from_secs(3);

// `atob`, which better-call decodes the signature with, ignores the unused
// low bits of the last character.
const ATOB: GeneralPurpose = GeneralPurpose::new(
    &base64::alphabet::STANDARD,
    GeneralPurposeConfig::new().with_decode_allow_trailing_bits(true),
);

/// The signed-in user of a valid session.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SessionUser {
    /// `"user".id`, a UUID.
    pub id: String,
    pub email: String,
}

impl SessionUser {
    /// `{ userId, role: "authenticated", anonymous: false }`, as
    /// `createRequestDb` builds it (lib/db/request-db.ts:25-26).
    pub fn db_identity(&self) -> DbIdentity {
        DbIdentity::authenticated(self.id.as_str())
    }
}

/// Why an extractor turned the request away.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AuthRejection {
    /// No valid session. 401.
    SignedOut,
    /// Signed in, but `is_operator()` is not true. 403.
    NotOperator,
    /// The cron bearer is missing or wrong, or `CRON_SECRET` is unset. 401.
    CronUnauthorized,
    /// The database could not answer, so nobody can be identified. 503.
    Unavailable,
}

impl AuthRejection {
    pub fn status(self) -> StatusCode {
        match self {
            Self::SignedOut | Self::CronUnauthorized => StatusCode::UNAUTHORIZED,
            Self::NotOperator => StatusCode::FORBIDDEN,
            Self::Unavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    // The bodies most Next routes send for these cases.
    fn body(self) -> &'static str {
        match self {
            Self::SignedOut => r#"{"ok":false,"error":"signed_out"}"#,
            Self::NotOperator => r#"{"ok":false,"error":"operator_required"}"#,
            Self::CronUnauthorized => r#"{"ok":false,"error":"UNAUTHORIZED"}"#,
            Self::Unavailable => r#"{"ok":false,"error":"auth_unavailable"}"#,
        }
    }
}

impl IntoResponse for AuthRejection {
    fn into_response(self) -> Response {
        (
            self.status(),
            [(CONTENT_TYPE, "application/json")],
            self.body(),
        )
            .into_response()
    }
}

/// The caller, signed in or not. Rejects only when the database is down.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RequestIdentity(pub Option<SessionUser>);

impl RequestIdentity {
    /// The identity `createRequestDb` runs queries as: `authenticated` with
    /// the user id for a valid session, `anon` for anything else.
    pub fn db_identity(&self) -> DbIdentity {
        self.0
            .as_ref()
            .map_or_else(DbIdentity::anon, SessionUser::db_identity)
    }
}

/// A signed-in user.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SignedInUser(pub SessionUser);

/// A signed-in user for whom `public.is_operator()` is true.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Operator(pub SessionUser);

/// A request that carries `Authorization: Bearer <CRON_SECRET>`, with the
/// secret exactly as the environment holds it. This is the check of
/// `app/api/cron/trend-pulse`, `source-refresh`, `growth-baseline` and
/// `saved-state-emails`, and what the scheduler sends.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CronAuthorized;

/// [`CronAuthorized`] with the secret trimmed first, the check of
/// `app/api/cron/meme-embeddings` (`hasExactBearer`). The two differ only
/// for a secret with whitespace around it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CronAuthorizedTrimmed;

impl FromRequestParts<AppState> for RequestIdentity {
    type Rejection = AuthRejection;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, AuthRejection> {
        match resolve_session(state, &parts.headers).await {
            Ok(user) => Ok(Self(user)),
            Err(error) => {
                tracing::warn!(%error, "session lookup failed");
                Err(AuthRejection::Unavailable)
            }
        }
    }
}

impl FromRequestParts<AppState> for SignedInUser {
    type Rejection = AuthRejection;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, AuthRejection> {
        let RequestIdentity(user) = RequestIdentity::from_request_parts(parts, state).await?;
        user.map(Self).ok_or(AuthRejection::SignedOut)
    }
}

impl FromRequestParts<AppState> for Operator {
    type Rejection = AuthRejection;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, AuthRejection> {
        let SignedInUser(user) = SignedInUser::from_request_parts(parts, state).await?;
        match is_operator(state, &user).await {
            Ok(true) => Ok(Self(user)),
            Ok(false) => Err(AuthRejection::NotOperator),
            Err(error) => {
                tracing::warn!(%error, "operator check failed");
                Err(AuthRejection::Unavailable)
            }
        }
    }
}

impl FromRequestParts<AppState> for CronAuthorized {
    type Rejection = AuthRejection;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, AuthRejection> {
        let secret = state.config.cron_secret.as_ref().map(Secret::expose);
        if cron_authorized(&parts.headers, secret) {
            Ok(Self)
        } else {
            Err(AuthRejection::CronUnauthorized)
        }
    }
}

impl FromRequestParts<AppState> for CronAuthorizedTrimmed {
    type Rejection = AuthRejection;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, AuthRejection> {
        let secret = state.config.cron_secret.as_ref();
        if cron_authorized(&parts.headers, secret.map(|secret| secret.expose().trim())) {
            Ok(Self)
        } else {
            Err(AuthRejection::CronUnauthorized)
        }
    }
}

/// The user of the session cookie in `headers`, or `None` for a signed-out
/// caller: no cookie, a bad signature, an unknown token, or an expired
/// session. `Err` means the database could not be asked; the caller must not
/// treat that as signed out.
pub async fn resolve_session(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Option<SessionUser>, sqlx::Error> {
    let config = &state.config;
    let cookie_name = session_cookie_name(config.use_secure_cookies);
    let Some(token) = session_token(headers, cookie_name, config.better_auth_secret.expose())
    else {
        return Ok(None);
    };
    let Some((user, expires_at_ms)) = within_timeout(find_session(state, token)).await? else {
        return Ok(None);
    };
    Ok((!is_expired(expires_at_ms, now_ms())).then_some(user))
}

/// `findSession` (better-auth dist/db/internal-adapter.mjs:371-385): the
/// session row for the token, joined to its user. `service_role` can read both
/// tables (`grantServiceRole`, lib/auth/server.ts:161-179).
async fn find_session(
    state: &AppState,
    token: String,
) -> Result<Option<(SessionUser, i64)>, sqlx::Error> {
    // node-pg hands better-auth a `Date`, which drops anything below a
    // millisecond; `floor` does the same.
    const SQL: &str = r#"select u.id::text, u.email,
            floor(extract(epoch from s."expiresAt") * 1000)::bigint
       from public.session s
       join public."user" u on u.id = s."userId"
      where s.token = $1"#;
    let row: Option<(String, String, i64)> = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query_as(SQL).bind(token).fetch_optional(tx).await }),
        )
        .await?;
    Ok(row.map(|(id, email, expires_at_ms)| (SessionUser { id, email }, expires_at_ms)))
}

/// `db.rpc("is_operator")` as the user, like the `/admin` gate in `proxy.ts`
/// (line 388): only `true` passes.
pub(crate) async fn is_operator(state: &AppState, user: &SessionUser) -> Result<bool, sqlx::Error> {
    let answer: Option<bool> = within_timeout(state.db.with_identity(
        &user.db_identity(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                sqlx::query_scalar("select public.is_operator()")
                    .fetch_one(tx)
                    .await
            })
        },
    ))
    .await?;
    Ok(answer == Some(true))
}

async fn within_timeout<T>(
    work: impl Future<Output = Result<T, sqlx::Error>>,
) -> Result<T, sqlx::Error> {
    tokio::time::timeout(AUTH_DB_TIMEOUT, work)
        .await
        .unwrap_or(Err(sqlx::Error::PoolTimedOut))
}

/// `session.session.expiresAt < new Date()` (better-auth
/// dist/api/routes/session.mjs:155): a session is still good at the exact
/// millisecond it expires.
fn is_expired(expires_at_ms: i64, now_ms: i64) -> bool {
    expires_at_ms < now_ms
}

pub(crate) fn now_ms() -> i64 {
    let since_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    i64::try_from(since_epoch.as_millis()).unwrap_or(i64::MAX)
}

/// The session token from the cookie named `cookie_name`, if its signature is
/// good.
fn session_token(headers: &HeaderMap, cookie_name: &str, secret: &str) -> Option<String> {
    let value = cookie_value(&cookie_header(headers)?, cookie_name)?;
    verify_signed_value(&value, secret).map(str::to_owned)
}

/// `request.headers.get("cookie")` as the Next app sees it: Node joins
/// repeated Cookie headers with "; ". `None` without a Cookie header.
pub(crate) fn cookie_header(headers: &HeaderMap) -> Option<String> {
    let values: Vec<String> = headers
        .get_all(COOKIE)
        .iter()
        .map(node_header_text)
        .collect();
    (!values.is_empty()).then(|| values.join("; "))
}

/// A header value as Node gives it to the Next app: each byte is one
/// character (Latin-1).
fn node_header_text(value: &HeaderValue) -> String {
    value
        .as_bytes()
        .iter()
        .map(|&byte| char::from(byte))
        .collect()
}

/// `String.prototype.trim` for text that came from a header.
fn js_trim(text: &str) -> &str {
    text.trim_matches(['\t', '\n', '\u{b}', '\u{c}', '\r', ' ', '\u{a0}'])
}

/// `parseCookies` (better-call dist/cookies.mjs:21-43) for one name: the first
/// cookie with that name wins, surrounding quotes are dropped and the value is
/// percent-decoded.
pub(crate) fn cookie_value(header: &str, name: &str) -> Option<String> {
    let mut index = 0;
    while index < header.len() {
        let eq = index + header[index..].find('=')?;
        let end = match header[index..].find(';') {
            None => header.len(),
            Some(offset) if index + offset < eq => {
                // A segment without `=`: skip to the one that holds this `=`.
                index = header[..eq].rfind(';').map_or(0, |at| at + 1);
                continue;
            }
            Some(offset) => index + offset,
        };
        if js_trim(&header[index..eq]) == name {
            let mut value = js_trim(&header[eq + 1..end]);
            if value.starts_with('"') {
                // `val.slice(1, -1)`
                let mut chars = value.chars();
                chars.next();
                chars.next_back();
                value = chars.as_str();
            }
            return Some(try_decode(value));
        }
        index = end + 1;
    }
    None
}

/// `tryDecode` (better-call dist/utils.mjs:56-62): `decodeURIComponent`, or
/// the text unchanged when it is not valid percent-encoded UTF-8.
pub(crate) fn try_decode(text: &str) -> String {
    fn decode(text: &str) -> Option<String> {
        let hex = |byte: Option<&u8>| char::from(*byte?).to_digit(16);
        let bytes = text.as_bytes();
        let mut decoded = Vec::with_capacity(bytes.len());
        let mut at = 0;
        while at < bytes.len() {
            if bytes[at] == b'%' {
                let (high, low) = (hex(bytes.get(at + 1))?, hex(bytes.get(at + 2))?);
                decoded.push(u8::try_from(high * 16 + low).ok()?);
                at += 3;
            } else {
                decoded.push(bytes[at]);
                at += 1;
            }
        }
        String::from_utf8(decoded).ok()
    }
    decode(text).unwrap_or_else(|| text.to_owned())
}

/// `getSignedCookie` (better-call dist/context.mjs:38-49). The value is
/// `<token>.<signature>`; the signature is standard padded base64 of
/// HMAC-SHA256 over the token, keyed with the secret's UTF-8 bytes
/// (better-call dist/crypto.mjs:7-31). Returns the token when the signature
/// matches. The comparison is constant-time.
pub(crate) fn verify_signed_value<'a>(value: &'a str, secret: &str) -> Option<&'a str> {
    let dot = value.rfind('.').filter(|&at| at >= 1)?;
    let (token, signature) = (&value[..dot], &value[dot + 1..]);
    if signature.len() != 44 || !signature.ends_with('=') {
        return None;
    }
    let signature = ATOB.decode(signature).ok()?;
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(token.as_bytes());
    mac.verify_slice(&signature).ok()?;
    Some(token)
}

/// The check the cron routes make: the Authorization header must be exactly
/// `Bearer <secret>`, and nothing passes while the secret is unset or empty
/// (app/api/cron/trend-pulse/route.ts:11-12, source-refresh:13-16,
/// growth-baseline:7-8, saved-state-emails:8-9, meme-embeddings:20-29).
/// The caller passes the secret as its route reads it, trimmed or not.
/// Both sides are hashed and the digests compared in constant time, as
/// `hasExactBearer` in the meme-embeddings route does.
pub(crate) fn cron_authorized(headers: &HeaderMap, secret: Option<&str>) -> bool {
    // Of a repeated Authorization header Node keeps the first, as `get` does.
    let (Some(secret), Some(value)) = (
        secret.filter(|secret| !secret.is_empty()),
        headers.get(AUTHORIZATION),
    ) else {
        return false;
    };
    // `Headers.get` strips the whitespace around a value.
    let actual = node_header_text(value);
    let actual = actual.trim_matches([' ', '\t']);
    let expected = format!("Bearer {secret}");
    Sha256::digest(actual)
        .ct_eq(&Sha256::digest(expected))
        .into()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Minted by tests/better_auth_cookie.mjs: better-auth 1.7.20 signed these
    // with this throwaway secret, and its own getSession accepted them.
    const SECRET: &str = "throwaway-test-secret-for-axum-auth-parity-0001";
    const PLAIN_TOKEN: &str = "OYqtkbH8Xejs7pyYmKAQPwlpiUQPLNy0";
    const PLAIN_COOKIE: &str = "better-auth.session_token=OYqtkbH8Xejs7pyYmKAQPwlpiUQPLNy0.fMKBYDsihLmknyaISS%2F2HUajEwwVkvfRUPtrAt%2F%2BqPE%3D";
    const SECURE_TOKEN: &str = "7ChBIriqsLzXEuuKKnktC2WtJuRc75AN";
    const SECURE_COOKIE: &str = "__Secure-better-auth.session_token=7ChBIriqsLzXEuuKKnktC2WtJuRc75AN.QLQ%2BkBOetUL4x4ZRUh9vDiFkyQPaCBoXJNMjHdYxRAs%3D";

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        pairs
            .iter()
            .map(|(name, value)| {
                (
                    name.parse().expect("header name"),
                    HeaderValue::from_bytes(value.as_bytes()).expect("header value"),
                )
            })
            .collect()
    }

    /// What a process that reads the plain name (`NODE_ENV` other than
    /// production) makes of a Cookie header.
    fn plain(cookie_header: &str) -> Option<String> {
        let headers = headers(&[("cookie", cookie_header)]);
        session_token(&headers, session_cookie_name(false), SECRET)
    }

    /// The same for a process that reads the `__Secure-` name (production).
    fn secure(cookie_header: &str) -> Option<String> {
        let headers = headers(&[("cookie", cookie_header)]);
        session_token(&headers, session_cookie_name(true), SECRET)
    }

    #[test]
    fn accepts_cookies_signed_by_better_auth_under_the_configured_name() {
        assert_eq!(session_cookie_name(false), "better-auth.session_token");
        assert_eq!(
            session_cookie_name(true),
            "__Secure-better-auth.session_token"
        );
        assert_eq!(plain(PLAIN_COOKIE).as_deref(), Some(PLAIN_TOKEN));
        assert_eq!(secure(SECURE_COOKIE).as_deref(), Some(SECURE_TOKEN));
    }

    #[test]
    fn a_validly_signed_cookie_under_the_other_name_is_signed_out() {
        // The same signed value under the name this process does not read.
        let planted = PLAIN_COOKIE.replacen("better-auth", "__Secure-better-auth", 1);
        let unprefixed = SECURE_COOKIE.replacen("__Secure-", "", 1);
        let both = format!("{PLAIN_COOKIE}; {SECURE_COOKIE}");

        assert_eq!(secure(PLAIN_COOKIE), None, "production, unprefixed cookie");
        assert_eq!(secure(&unprefixed), None);
        assert_eq!(plain(SECURE_COOKIE), None, "development, prefixed cookie");
        assert_eq!(plain(&planted), None);
        // With both sent, each mode reads its own and ignores the other.
        assert_eq!(secure(&both).as_deref(), Some(SECURE_TOKEN));
        assert_eq!(plain(&both).as_deref(), Some(PLAIN_TOKEN));
        assert_eq!(secure(&planted).as_deref(), Some(PLAIN_TOKEN), "control");
    }

    #[test]
    fn finds_the_session_cookie_among_other_cookies() {
        let header = format!("memecatch_locale=en; {PLAIN_COOKIE}; theme=dark");
        let quoted = PLAIN_COOKIE.replacen('=', "=\"", 1) + "\"";
        let split = headers(&[("cookie", "memecatch_locale=en"), ("cookie", PLAIN_COOKIE)]);

        // parseCookies keeps the first of two cookies with one name.
        let duplicate = format!("better-auth.session_token=nope; {PLAIN_COOKIE}");

        assert_eq!(plain(&header).as_deref(), Some(PLAIN_TOKEN));
        assert_eq!(plain(&quoted).as_deref(), Some(PLAIN_TOKEN));
        assert_eq!(
            session_token(&split, SESSION_COOKIE, SECRET).as_deref(),
            Some(PLAIN_TOKEN),
            "repeated Cookie headers"
        );
        assert_eq!(plain(&duplicate), None);
    }

    #[test]
    fn rejects_a_cookie_signed_with_another_secret_or_altered() {
        let other_secret = session_token(
            &headers(&[("cookie", PLAIN_COOKIE)]),
            SESSION_COOKIE,
            "another-secret",
        );
        let altered_token = PLAIN_COOKIE.replacen("OYqt", "OYqu", 1);
        let altered_signature = PLAIN_COOKIE.replacen("fMKB", "fMKC", 1);
        let swapped_signature = format!(
            "better-auth.session_token={PLAIN_TOKEN}.{}",
            SECURE_COOKIE.rsplit('.').next().unwrap()
        );

        assert_eq!(other_secret, None);
        assert_eq!(plain(&altered_token), None);
        assert_eq!(plain(&altered_signature), None);
        assert_eq!(plain(&swapped_signature), None);
    }

    #[test]
    fn malformed_cookie_values_are_signed_out_without_panicking() {
        let name = "better-auth.session_token";
        let long = "A".repeat(10_000);
        for value in [
            "",
            "=",
            ".",
            "\"",
            "\"\"",
            "no-dot",
            ".fMKBYDsihLmknyaISS%2F2HUajEwwVkvfRUPtrAt%2F%2BqPE%3D",
            "token.",
            "token.short=",
            "token.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "token.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "token.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            "token.!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!=",
            "token.%",
            "token.%2",
            "token.%zz%3D",
            "%FF%FE.%3D",
            "tok\u{e9}n.\u{e9}\u{e9}\u{e9}=",
            long.as_str(),
        ] {
            assert_eq!(plain(&format!("{name}={value}")), None, "{value:?}");
            assert_eq!(
                secure(&format!("__Secure-{name}={value}")),
                None,
                "{value:?}"
            );
        }
        for header in ["", ";", ";;;=", "=;", "better-auth.session_token", "a;b;c"] {
            assert_eq!(plain(header), None, "{header:?}");
            assert_eq!(secure(header), None, "{header:?}");
        }
        // Bytes that are not UTF-8 reach the parser as Latin-1 text.
        let mut raw = HeaderMap::new();
        raw.insert(
            COOKIE,
            HeaderValue::from_bytes(b"better-auth.session_token=\xff\xfe.\xc3=").unwrap(),
        );
        assert_eq!(session_token(&raw, SESSION_COOKIE, SECRET), None);
    }

    #[test]
    fn try_decode_matches_decode_uri_component_or_returns_the_input() {
        assert_eq!(try_decode("a%2Fb%2B%3D"), "a/b+=");
        assert_eq!(try_decode("%EB%B0%88"), "밈");
        assert_eq!(try_decode("plain+text"), "plain+text");
        // decodeURIComponent throws on these, so tryDecode returns the input.
        for malformed in ["%", "a%2", "%zz", "%+1", "%FF", "%C3", "a%20b%zz"] {
            assert_eq!(try_decode(malformed), malformed);
        }
    }

    #[test]
    fn signature_decoding_follows_atob() {
        // 43 characters and one `=` hold 258 bits for a 256-bit signature.
        // atob drops the last two, so `E` (000100) and `F` (000101) end the
        // same signature. `I` (001000) does not.
        let value = "OYqtkbH8Xejs7pyYmKAQPwlpiUQPLNy0.fMKBYDsihLmknyaISS/2HUajEwwVkvfRUPtrAt/+qPE=";
        let same_bytes = value.replace("qPE=", "qPF=");
        let other_bytes = value.replace("qPE=", "qPI=");

        assert_eq!(verify_signed_value(value, SECRET), Some(PLAIN_TOKEN));
        assert_eq!(verify_signed_value(&same_bytes, SECRET), Some(PLAIN_TOKEN));
        assert_eq!(verify_signed_value(&other_bytes, SECRET), None);
    }

    #[test]
    fn a_session_is_valid_until_the_millisecond_after_it_expires() {
        assert!(!is_expired(1_000, 999));
        assert!(!is_expired(1_000, 1_000));
        assert!(is_expired(1_000, 1_001));
    }

    #[test]
    fn identity_maps_like_create_request_db() {
        let user = SessionUser {
            id: "7b0d4a52-6a52-4a4e-9d0b-0c2f6f0f5a11".to_owned(),
            email: "user@example.com".to_owned(),
        };

        assert_eq!(RequestIdentity(None).db_identity(), DbIdentity::anon());
        assert_eq!(
            RequestIdentity(Some(user.clone())).db_identity(),
            DbIdentity::authenticated("7b0d4a52-6a52-4a4e-9d0b-0c2f6f0f5a11")
        );
    }

    fn cron(authorization: &[&str], secret: Option<&str>) -> bool {
        let pairs: Vec<_> = authorization
            .iter()
            .map(|value| ("authorization", *value))
            .collect();
        cron_authorized(&headers(&pairs), secret)
    }

    #[test]
    fn cron_bearer_must_match_the_secret_exactly() {
        let secret = Some("cron-secret-value");

        assert!(cron(&["Bearer cron-secret-value"], secret));
        assert!(cron(&["  Bearer cron-secret-value\t"], secret));
        for wrong in [
            "Bearer cron-secret-valu",
            "Bearer cron-secret-value1",
            "Bearer  cron-secret-value",
            "bearer cron-secret-value",
            "cron-secret-value",
            "Basic cron-secret-value",
            "Bearer",
            "",
        ] {
            assert!(!cron(&[wrong], secret), "{wrong:?}");
        }
        assert!(!cron(&[], secret), "no Authorization header");
        // Only the first of two Authorization headers counts.
        assert!(cron(&["Bearer cron-secret-value", "Bearer wrong"], secret));
        assert!(!cron(&["Bearer wrong", "Bearer cron-secret-value"], secret));
    }

    #[test]
    fn nothing_passes_the_cron_guard_while_the_secret_is_unset() {
        for sent in ["Bearer ", "Bearer", "Bearer undefined", "Bearer null", ""] {
            assert!(!cron(&[sent], None), "{sent:?}");
        }
        assert!(!cron(&[], None));
        // An empty secret is "not set" to every route (`!secret`).
        assert!(!cron(&["Bearer "], Some("")));
        assert!(!cron(&["Bearer"], Some("")));
    }

    #[test]
    fn rejections_carry_the_status_route_handlers_expect() {
        assert_eq!(AuthRejection::SignedOut.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(AuthRejection::NotOperator.status(), StatusCode::FORBIDDEN);
        assert_eq!(
            AuthRejection::CronUnauthorized.status(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            AuthRejection::Unavailable.status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
    }
}
