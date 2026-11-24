//! The two providers of lib/auth/server.ts as better-auth 1.7.20 builds
//! them: Google (`socialProviders.google`, @better-auth/core
//! dist/social-providers/google.mjs) and Kakao (the `genericOAuth` config,
//! dist/plugins/generic-oauth/index.mjs, with the app's `getUserInfo`).
//!
//! Both are plain authorization-code flows with PKCE (S256) and the client
//! secret in the token request body (`client_secret_post`). Neither is OIDC
//! for better-auth: Google's `id_token` is decoded, not verified, and no
//! nonce is sent.

use axum::body::Body;
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use axum::http::{Method, Request};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};

use super::http::{Fetched, HttpClient};
use crate::config::{Config, OAuthClient};
use crate::routes::js_json;
use crate::routes::public::js;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Id {
    Google,
    Kakao,
}

impl Id {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Google => "google",
            Self::Kakao => "kakao",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "google" => Some(Self::Google),
            "kakao" => Some(Self::Kakao),
            _ => None,
        }
    }
}

/// Fixed in the code, as in lib/auth/server.ts and google.mjs.
const GOOGLE_AUTHORIZE: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN: &str = "https://oauth2.googleapis.com/token";
const KAKAO_AUTHORIZE: &str = "https://kauth.kakao.com/oauth/authorize";
const KAKAO_TOKEN: &str = "https://kauth.kakao.com/oauth/token";
const KAKAO_PROFILE: &str = "https://kapi.kakao.com/v2/user/me";

pub struct Provider {
    pub id: Id,
    client_id: String,
    client_secret: String,
    token_url: String,
    profile_url: String,
}

/// The providers that are set, and the client their requests use.
pub struct Providers {
    google: Option<Provider>,
    kakao: Option<Provider>,
    client: HttpClient,
}

/// `AXUM_TEST_OAUTH_ORIGIN` in place of the URL's origin, the path kept.
fn at_origin(url: &str, test_origin: Option<&str>) -> String {
    match test_origin {
        None => url.to_owned(),
        Some(origin) => {
            let path = url.splitn(4, '/').nth(3).unwrap_or_default();
            format!("{}/{path}", origin.trim_end_matches('/'))
        }
    }
}

impl Providers {
    pub fn new(config: &Config) -> Self {
        let origin = config.test_oauth_origin.as_deref();
        let provider = |id, client: &OAuthClient, token: &str, profile: &str| Provider {
            id,
            client_id: client.client_id.clone(),
            client_secret: client.client_secret.expose().to_owned(),
            token_url: at_origin(token, origin),
            profile_url: at_origin(profile, origin),
        };
        Self {
            google: config
                .google
                .as_ref()
                .map(|client| provider(Id::Google, client, GOOGLE_TOKEN, "")),
            kakao: config
                .kakao
                .as_ref()
                .map(|client| provider(Id::Kakao, client, KAKAO_TOKEN, KAKAO_PROFILE)),
            client: HttpClient::new(),
        }
    }

    /// `ctx.context.socialProviders.find(p => p.id === id)`.
    pub fn get(&self, id: &str) -> Option<&Provider> {
        match Id::parse(id)? {
            Id::Google => self.google.as_ref(),
            Id::Kakao => self.kakao.as_ref(),
        }
    }

    pub fn client(&self) -> &HttpClient {
        &self.client
    }
}

/// `generateCodeChallenge(codeVerifier)`: base64url of its SHA-256, no
/// padding.
pub fn code_challenge(code_verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(code_verifier.as_bytes()))
}

impl Provider {
    /// `provider.createAuthorizationURL(...)` through `createAuthorizationURL`
    /// (@better-auth/core dist/oauth2/create-authorization-url.mjs): the
    /// parameters in the order it sets them, form-encoded as `URL` writes a
    /// query it built with `searchParams.set`.
    pub fn authorization_url(
        &self,
        state: &str,
        code_verifier: &str,
        redirect_uri: &str,
    ) -> String {
        let (endpoint, scope) = match self.id {
            // `["email", "profile", "openid"]`, no option adds to it.
            Id::Google => (GOOGLE_AUTHORIZE, "email profile openid"),
            // The config's `scopes`; Kakao is not OIDC, so no `openid`.
            Id::Kakao => (KAKAO_AUTHORIZE, "account_email profile_nickname"),
        };
        let mut query = url::form_urlencoded::Serializer::new(String::new());
        query
            .append_pair("response_type", "code")
            .append_pair("client_id", &self.client_id)
            .append_pair("state", state)
            .append_pair("scope", scope)
            .append_pair("redirect_uri", redirect_uri)
            .append_pair("code_challenge_method", "S256")
            .append_pair("code_challenge", &code_challenge(code_verifier));
        if self.id == Id::Google {
            // `includeGrantedScopes` is not `false`.
            query.append_pair("include_granted_scopes", "true");
        }
        format!("{endpoint}?{}", query.finish())
    }

    /// `validateAuthorizationCode` (dist/oauth2/validate-authorization-code.mjs)
    /// and `getOAuth2Tokens`. `Err` is every failure better-auth turns into
    /// `invalid_code`: no answer, a redirect, a status that is not 2xx, a
    /// `null` body; and, here only, fields of a type neither provider sends
    /// (PLAN.md A3).
    pub async fn exchange(
        &self,
        client: &HttpClient,
        code: &str,
        code_verifier: &str,
        redirect_uri: &str,
        now_ms: i64,
    ) -> Result<Tokens, ()> {
        let form = url::form_urlencoded::Serializer::new(String::new())
            .append_pair("grant_type", "authorization_code")
            .append_pair("code", code)
            .append_pair("code_verifier", code_verifier)
            .append_pair("redirect_uri", redirect_uri)
            .append_pair("client_id", &self.client_id)
            .append_pair("client_secret", &self.client_secret)
            .finish();
        let request = Request::builder()
            .method(Method::POST)
            .uri(&self.token_url)
            .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
            .header(ACCEPT, "application/json")
            .body(Body::from(form))
            .map_err(drop)?;
        let fetched = client.fetch(request).await.map_err(|error| {
            tracing::error!(provider = self.id.as_str(), %error, "Failed to validate authorization code");
        })?;
        if !fetched.ok() {
            tracing::error!(
                provider = self.id.as_str(),
                status = fetched.status.as_u16(),
                "Failed to validate authorization code"
            );
            return Err(());
        }
        Tokens::read(&fetched, now_ms)
    }

    /// `provider.getUserInfo(tokens)` and the account key. `Ok(None)` is
    /// `unable_to_get_user_info`; `Err(Thrown)` is where better-auth throws
    /// out of the endpoint (an empty 500).
    pub async fn user_info(
        &self,
        client: &HttpClient,
        tokens: &Tokens,
    ) -> Result<Option<UserInfo>, Thrown> {
        match self.id {
            Id::Google => google_user_info(tokens),
            Id::Kakao => self.kakao_user_info(client, tokens).await,
        }
    }

    /// The app's `getUserInfo` for Kakao (lib/auth/server.ts:34-55), then
    /// generic-oauth's `resolveUserInfo` and `accountSubject` (`profile.id`).
    async fn kakao_user_info(
        &self,
        client: &HttpClient,
        tokens: &Tokens,
    ) -> Result<Option<UserInfo>, Thrown> {
        // `Bearer ${tokens.accessToken}`: "undefined" when there is none.
        let bearer = format!(
            "Bearer {}",
            tokens.access_token.as_deref().unwrap_or("undefined")
        );
        // `fetch` sends `accept: */*` when none is given.
        let Ok(request) = Request::builder()
            .uri(&self.profile_url)
            .header(AUTHORIZATION, bearer)
            .header(ACCEPT, "*/*")
            .body(Body::empty())
        else {
            return Ok(None);
        };
        let fetched = match client.fetch(request).await {
            Ok(fetched) => fetched,
            // `fetch` rejects: thrown out of `getUserInfo`.
            Err(error) => {
                tracing::error!(%error, "the Kakao profile request failed");
                return Err(Thrown);
            }
        };
        if !fetched.ok() {
            return Ok(None);
        }
        // `response.json()`: a body that is not JSON throws.
        let profile: Value = serde_json::from_slice(&fetched.body).map_err(|_| Thrown)?;
        kakao_profile(&profile)
    }
}

/// `{ ...tokens }` of `getOAuth2Tokens(data)`.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Tokens {
    pub access_token: Field,
    pub refresh_token: Field,
    pub id_token: Field,
    pub access_token_expires_at_ms: Option<i64>,
    pub refresh_token_expires_at_ms: Option<i64>,
    /// `tokens.scopes?.join(",")`: `""` when the answer had none.
    pub scope: String,
}

/// A token field: missing from the answer, `null`, or a string. The update
/// of a linked account skips a missing one and writes a `null`.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum Field {
    #[default]
    Absent,
    Null,
    Text(String),
}

impl Field {
    pub fn as_deref(&self) -> Option<&str> {
        match self {
            Self::Text(text) => Some(text),
            _ => None,
        }
    }
}

/// The largest time a `Date` holds.
const MAX_DATE_MS: f64 = 8.64e15;

impl Tokens {
    /// `getOAuth2Tokens(data)` of what betterFetch made of a 2xx answer: a
    /// JSON object for a JSON (or untyped, or text) body that parses; the
    /// text, or a blob, otherwise, which reads as no fields at all.
    fn read(fetched: &Fetched, now_ms: i64) -> Result<Self, ()> {
        if !fetched.is_json_or_text() {
            return Ok(Self::default());
        }
        match serde_json::from_slice::<Value>(&fetched.body) {
            // `null.token_type` throws inside `validateAuthorizationCode`.
            Ok(Value::Null) => Err(()),
            Ok(Value::Object(data)) => Self::from_object(&data, now_ms),
            _ => Ok(Self::default()),
        }
    }

    fn from_object(data: &Map<String, Value>, now_ms: i64) -> Result<Self, ()> {
        let field = |key: &str| match data.get(key) {
            None => Ok(Field::Absent),
            Some(Value::Null) => Ok(Field::Null),
            Some(Value::String(text)) => Ok(Field::Text(text.clone())),
            Some(_) => Err(()),
        };
        // `data.expires_in ? new Date(Date.now() + seconds * 1e3) : undefined`.
        let expiry = |key: &str| match data.get(key) {
            None | Some(Value::Null) => Ok(None),
            Some(Value::Number(seconds)) => {
                let seconds = seconds.as_f64().ok_or(())?;
                if seconds == 0.0 {
                    return Ok(None);
                }
                let at = (now_ms as f64 + seconds * 1e3).trunc();
                if at.abs() > MAX_DATE_MS {
                    return Err(());
                }
                Ok(Some(at as i64))
            }
            Some(_) => Err(()),
        };
        // `parseScopeField(data.scope)`.
        let scopes: Vec<String> = match data.get("scope") {
            Some(Value::String(scope)) => js::trim(scope)
                .split(js::is_space)
                .filter(|scope| !scope.is_empty())
                .map(str::to_owned)
                .collect(),
            Some(Value::Array(scopes)) => scopes
                .iter()
                .filter_map(|scope| scope.as_str().map(js::trim))
                .filter(|scope| !scope.is_empty())
                .map(str::to_owned)
                .collect(),
            _ => Vec::new(),
        };
        Ok(Self {
            access_token: field("access_token")?,
            refresh_token: field("refresh_token")?,
            id_token: field("id_token")?,
            access_token_expires_at_ms: expiry("expires_in")?,
            refresh_token_expires_at_ms: expiry("refresh_token_expires_in")?,
            scope: scopes.join(","),
        })
    }
}

/// Where better-auth throws out of the callback instead of redirecting: the
/// router answers an empty 500.
#[derive(Debug)]
pub struct Thrown;

/// What `getUserInfo` returns, mapped as the callback uses it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserInfo {
    /// The account key (`accountSubject`).
    pub account_id: String,
    /// `None` and `""` alike end in `email_not_found`.
    pub email: Option<String>,
    /// `userInfo.name || ""`.
    pub name: String,
    pub image: Option<String>,
    /// `toBoolean(emailVerified)`.
    pub email_verified: bool,
}

/// `String(value)` of an account subject, refused as `resolveOAuthAccountKey`
/// refuses one: blank after `trim`, `"undefined"` or `"null"`.
fn account_id(value: Option<&Value>) -> Result<Option<String>, ()> {
    let text = match value {
        None => "undefined".to_owned(),
        Some(Value::Null) => "null".to_owned(),
        Some(Value::String(text)) => text.clone(),
        Some(number @ Value::Number(_)) => js_json::stringify(number),
        // `String(true)`, `String({})`: neither provider sends one.
        Some(_) => return Err(()),
    };
    let refused = js::trim(&text).is_empty() || text == "undefined" || text == "null";
    Ok((!refused).then_some(text))
}

/// A claim or profile field that is a string, missing or `null`; `Err` for
/// any other type, which neither provider sends.
fn text(value: Option<&Value>) -> Result<Option<String>, ()> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) => Ok(Some(text.clone())),
        Some(_) => Err(()),
    }
}

/// Google's `getUserInfo` (google.mjs): no `id_token`, no user; otherwise
/// its claims, decoded and not verified, with `sub` as the account key.
fn google_user_info(tokens: &Tokens) -> Result<Option<UserInfo>, Thrown> {
    let Some(id_token) = tokens.id_token.as_deref().filter(|token| !token.is_empty()) else {
        return Ok(None);
    };
    let claims = decode_jwt(id_token).ok_or(Thrown)?;
    let read = || -> Result<Option<UserInfo>, ()> {
        let Some(account_id) = account_id(claims.get("sub"))? else {
            return Ok(None);
        };
        Ok(Some(UserInfo {
            account_id,
            email: text(claims.get("email"))?,
            name: text(claims.get("name"))?.unwrap_or_default(),
            image: text(claims.get("picture"))?,
            email_verified: to_boolean(claims.get("email_verified")),
        }))
    };
    // A claim of an unexpected type: treated as no user (PLAN.md A3).
    Ok(read().unwrap_or(None))
}

/// The app's Kakao `getUserInfo` over the parsed profile: `null` throws
/// (`profile.id` of `null`), anything without a truthy `id` is no user.
fn kakao_profile(profile: &Value) -> Result<Option<UserInfo>, Thrown> {
    let Value::Object(profile) = profile else {
        return if profile.is_null() {
            Err(Thrown)
        } else {
            Ok(None)
        };
    };
    let read = || -> Result<Option<UserInfo>, ()> {
        let id = profile.get("id");
        let truthy = match id {
            None | Some(Value::Null) | Some(Value::Bool(false)) => false,
            Some(Value::String(text)) => !text.is_empty(),
            Some(Value::Number(number)) => number.as_f64().is_some_and(|n| n != 0.0),
            Some(_) => true,
        };
        if !truthy {
            return Ok(None);
        }
        let Some(id) = account_id(id)? else {
            return Ok(None);
        };
        let account = profile.get("kakao_account").and_then(Value::as_object);
        let field = |key: &str| account.and_then(|account| account.get(key));
        let email =
            text(field("email"))?.unwrap_or_else(|| format!("{id}@kakao.memecatch.internal"));
        let nickname = text(
            field("profile")
                .and_then(Value::as_object)
                .and_then(|profile| profile.get("nickname")),
        )?;
        let name = nickname.unwrap_or_else(|| format!("카카오_{}", utf16_prefix(&id, 6)));
        Ok(Some(UserInfo {
            account_id: id,
            email: Some(email),
            name,
            image: None,
            email_verified: field("is_email_verified") == Some(&Value::Bool(true)),
        }))
    };
    Ok(read().unwrap_or(None))
}

/// `text.slice(0, units)`.
fn utf16_prefix(text: &str, units: usize) -> String {
    let head: Vec<u16> = text.encode_utf16().take(units).collect();
    String::from_utf16_lossy(&head)
}

/// `toBoolean(value)`: `true` or `"true"`.
fn to_boolean(value: Option<&Value>) -> bool {
    matches!(value, Some(Value::Bool(true))) || value.and_then(Value::as_str) == Some("true")
}

/// jose's `decodeJwt`: three dot-separated parts, the second base64url JSON
/// of an object. `None` where it throws.
fn decode_jwt(token: &str) -> Option<Map<String, Value>> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 || parts[1].is_empty() {
        return None;
    }
    let bytes = URL_SAFE_NO_PAD
        .decode(parts[1].trim_end_matches('='))
        .ok()?;
    match serde_json::from_slice(&bytes).ok()? {
        Value::Object(claims) => Some(claims),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider(id: Id) -> Provider {
        Provider {
            id,
            client_id: "client id".to_owned(),
            client_secret: "s".to_owned(),
            token_url: String::new(),
            profile_url: String::new(),
        }
    }

    // Expected values: what better-auth built for the same inputs (a probe
    // of lib/auth/server.ts through tests/better_auth_oauth.mjs).
    #[test]
    fn authorization_urls_are_written_as_better_auth_writes_them() {
        let verifier = "YkAOjL4jGnjnuc4ZlDd52MiwIUOl_oVgz9Fz14S4eVFHIO253nQCsIhZLRFXv2_p2fDnv1N6BptrRL3srKdAmZDW0QpiBgJ00deZZ_jnnQozvOncnwTpgytQWL6KWpzy";
        assert_eq!(
            provider(Id::Google).authorization_url(
                "16z1AZXq_LUjq-BM4gnxkBcFStv8w4Gr",
                verifier,
                "http://localhost:3000/api/auth/callback/google"
            ),
            format!(
                "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=client+id&state=16z1AZXq_LUjq-BM4gnxkBcFStv8w4Gr&scope=email+profile+openid&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fgoogle&code_challenge_method=S256&code_challenge={}&include_granted_scopes=true",
                code_challenge(verifier)
            )
        );
        assert!(
            provider(Id::Kakao)
                .authorization_url("s", "v", "r")
                .starts_with("https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=client+id&state=s&scope=account_email+profile_nickname&redirect_uri=r&code_challenge_method=S256&code_challenge=")
        );
    }

    #[test]
    fn the_challenge_is_base64url_sha256() {
        // RFC 7636 appendix B.
        assert_eq!(
            code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn kakao_profiles_are_read_as_the_app_reads_them() {
        let read = |profile: Value| kakao_profile(&profile).expect("not thrown");
        let user = read(serde_json::json!({"id": 4_012_345_678_u64})).expect("a user");
        assert_eq!(
            user.email.as_deref(),
            Some("4012345678@kakao.memecatch.internal")
        );
        assert_eq!(user.name, "카카오_401234");
        assert!(!user.email_verified);
        let user = read(serde_json::json!({"id": "77", "kakao_account": {
            "email": "A@Example.com", "is_email_verified": true, "profile": {"nickname": "밈"}}}))
        .expect("a user");
        assert_eq!(
            (
                user.email.as_deref(),
                user.name.as_str(),
                user.email_verified
            ),
            (Some("A@Example.com"), "밈", true)
        );
        // `is_email_verified === true` only.
        let user =
            read(serde_json::json!({"id": 1, "kakao_account": {"is_email_verified": "true"}}))
                .expect("a user");
        assert!(!user.email_verified);
        for none in [
            serde_json::json!({"id": 0}),
            serde_json::json!({"id": ""}),
            serde_json::json!({}),
            serde_json::json!([1]),
            serde_json::json!("x"),
            serde_json::json!({"id": "null"}),
        ] {
            assert_eq!(read(none.clone()), None, "{none}");
        }
        assert!(kakao_profile(&Value::Null).is_err());
    }

    #[test]
    fn google_claims_are_decoded_not_verified() {
        let claims = URL_SAFE_NO_PAD
            .encode(r#"{"sub":"g1","email":"a@b.co","email_verified":"true","name":"N"}"#);
        let tokens = Tokens {
            id_token: Field::Text(format!("e30.{claims}.sig")),
            ..Tokens::default()
        };
        let user = google_user_info(&tokens).expect("decoded").expect("a user");
        assert_eq!(user.account_id, "g1");
        assert!(user.email_verified);
        assert_eq!(user.image, None);
        assert_eq!(
            google_user_info(&Tokens::default()).expect("no token"),
            None
        );
        let bad = Tokens {
            id_token: Field::Text("nope".to_owned()),
            ..Tokens::default()
        };
        assert!(google_user_info(&bad).is_err());
    }

    #[test]
    fn token_answers_are_read_as_get_oauth2_tokens_reads_them() {
        let data = serde_json::json!({
            "access_token": "a", "expires_in": 3599, "scope": " openid  email ",
            "refresh_token": null, "token_type": "Bearer"
        });
        let tokens = Tokens::from_object(data.as_object().expect("object"), 1_000).expect("read");
        assert_eq!(tokens.access_token, Field::Text("a".to_owned()));
        assert_eq!(tokens.refresh_token, Field::Null);
        assert_eq!(tokens.id_token, Field::Absent);
        assert_eq!(tokens.access_token_expires_at_ms, Some(3_600_000));
        assert_eq!(tokens.scope, "openid,email");
        let none = serde_json::json!({"expires_in": 0});
        let tokens = Tokens::from_object(none.as_object().expect("object"), 1_000).expect("read");
        assert_eq!(
            (tokens.access_token_expires_at_ms, tokens.scope.as_str()),
            (None, "")
        );
    }
}
