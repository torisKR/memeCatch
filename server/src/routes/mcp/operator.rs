//! The operator side without a state key (see `mcp.rs`): the challenge of
//! `/api/mcp-operator`, its `POST`, the token endpoint, the two metadata
//! documents, the GitHub webhook and the retry cron. Each answers as its
//! route file does once `stateKey()` throws.

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{AUTHORIZATION, CONTENT_LANGUAGE, HeaderName, ORIGIN, WWW_AUTHENTICATE};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;
use url::Url;

use super::json;
use super::protocol::{get, truthy};
use crate::AppState;
use crate::routes::js_json;
use crate::routes::request::{self, BodyError, Json};

const REPOSITORY: &str = "torisKR/memeCatch";
const METADATA: &str = r#"{"issuer":"https://catchmeme.com","authorization_response_iss_parameter_supported":true,"authorization_endpoint":"https://catchmeme.com/api/mcp-operator/oauth/authorize","token_endpoint":"https://catchmeme.com/api/mcp-operator/oauth/token","client_id_metadata_document_supported":true,"token_endpoint_auth_methods_supported":["none"],"code_challenge_methods_supported":["S256"],"response_types_supported":["code"],"grant_types_supported":["authorization_code","refresh_token"],"scopes_supported":["memecatch:monitor"]}"#;
const RESOURCE_METADATA: &str = r#"{"resource":"https://catchmeme.com/api/mcp-operator","authorization_servers":["https://catchmeme.com"],"scopes_supported":["memecatch:monitor"],"resource_name":"밈캐치 운영 이벤트"}"#;
const NOT_ACCEPTED: &str = r#"{"error":"Event could not be accepted."}"#;

/// `proxy.ts` runs for `/.well-known` and adds `Content-Language: ko`.
fn localized(mut response: Response) -> Response {
    response
        .headers_mut()
        .insert(CONTENT_LANGUAGE, HeaderValue::from_static("ko"));
    response
}

pub fn metadata() -> Response {
    localized(json(StatusCode::OK, METADATA))
}

pub fn resource_metadata() -> Response {
    localized(json(StatusCode::OK, RESOURCE_METADATA))
}

/// `challenge()`: 401 with the protected-resource metadata.
pub fn challenge() -> Response {
    let mut response = json(
        StatusCode::UNAUTHORIZED,
        r#"{"error":"Operator authorization required."}"#,
    );
    let value = r#"Bearer resource_metadata="https://catchmeme.com/.well-known/oauth-protected-resource/api/mcp-operator", scope="memecatch:monitor""#;
    response
        .headers_mut()
        .insert(WWW_AUTHENTICATE, HeaderValue::from_static(value));
    response
}

/// `POST /api/mcp-operator`: past the origin check, `databaseStore()` throws.
pub async fn post(request: Request) -> Response {
    let origin =
        request::header_text(request.headers(), &ORIGIN, ", ").filter(|origin| !origin.is_empty());
    if origin.is_some_and(|origin| origin != "https://chatgpt.com" && origin != super::ORIGIN) {
        return json(StatusCode::FORBIDDEN, r#"{"error":"Origin not allowed."}"#);
    }
    json(
        StatusCode::OK,
        r#"{"jsonrpc":"2.0","error":{"code":-32603,"message":"Event service is unavailable."}}"#,
    )
}

/// `exchange(databaseStore(...), await form(request))`: the store throws
/// before the form is read.
pub fn token() -> Response {
    json(
        StatusCode::SERVICE_UNAVAILABLE,
        r#"{"error":"server_error"}"#,
    )
}

/// `same(a, b)`: equal UTF-8 bytes, compared in constant time.
fn same(left: &str, right: &str) -> bool {
    let (left, right) = (left.as_bytes(), right.as_bytes());
    left.len() == right.len() && bool::from(left.ct_eq(right))
}

/// `GET /api/cron/mcp-events`: the retry token or `CRON_SECRET`, then 503.
pub async fn cron(State(state): State<AppState>, request: Request) -> Response {
    let header = request::header_text(request.headers(), &AUTHORIZATION, ", ").unwrap_or_default();
    let secrets = [
        state.config.mcp.retry_token.as_deref(),
        state
            .config
            .cron_secret
            .as_ref()
            .map(|secret| secret.expose()),
    ];
    let allowed = secrets
        .iter()
        .flatten()
        .filter(|secret| !secret.is_empty())
        .any(|secret| same(&header, &format!("Bearer {secret}")));
    if !allowed {
        return json(StatusCode::UNAUTHORIZED, r#"{"error":"Unauthorized."}"#);
    }
    json(
        StatusCode::SERVICE_UNAVAILABLE,
        r#"{"error":"Event retry is unavailable."}"#,
    )
}

/// `verifyGithub(raw, signature, secret)`.
fn verify(raw: &[u8], signature: Option<&str>, secret: &str) -> bool {
    let Some(hex) = signature.and_then(|s| s.strip_prefix("sha256=")) else {
        return false;
    };
    if hex.len() != 64
        || !hex
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return false;
    }
    let mut mac =
        <Hmac<Sha256> as KeyInit>::new_from_slice(secret.as_bytes()).expect("any key length");
    mac.update(raw);
    let expected = format!("sha256={}", hex::encode(mac.finalize().into_bytes()));
    same(&expected, signature.unwrap_or_default())
}

/// `String(value)` of a JSON value, as `RegExp.prototype.test` reads it.
fn js_string(value: &Json) -> String {
    match value {
        Json::String(text) => text.clone(),
        Json::Null => "null".to_owned(),
        Json::Bool(flag) => flag.to_string(),
        Json::Number(_) => js_json::stringify_parsed(value),
        Json::Array(items) => items
            .iter()
            .map(|item| {
                if matches!(item, Json::Null) {
                    String::new()
                } else {
                    js_string(item)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Json::Object(_) => "[object Object]".to_owned(),
    }
}

/// `githubUrl(value)`.
fn github_url(value: Option<&Json>) -> bool {
    let Some(Json::String(value)) = value else {
        return false;
    };
    Url::parse(value).is_ok_and(|url| {
        let empty = |part: Option<&str>| part.is_none_or(str::is_empty);
        url.origin().ascii_serialization() == "https://github.com"
            && url.path().starts_with(&format!("/{REPOSITORY}/"))
            && url.username().is_empty()
            && url.password().is_none()
            && empty(url.query())
            && empty(url.fragment())
    })
}

fn positive_safe_integer(value: Option<&Json>) -> bool {
    matches!(value, Some(Json::Number(n)) if n.fract() == 0.0 && *n >= 1.0 && *n <= 9_007_199_254_740_991.0)
}

/// What `normalizeGithub(type, payload)` does: `Err` for an `EventError`,
/// `Ok(false)` for an event it ignores, `Ok(true)` for one it keeps.
fn normalize(kind: Option<&str>, payload: &Json) -> Result<bool, ()> {
    let full_name = get(get(Some(payload), "repository"), "full_name");
    if full_name.and_then(Json::as_str) != Some(REPOSITORY) {
        return Err(());
    }
    let action = get(Some(payload), "action").and_then(Json::as_str);
    let run = get(Some(payload), "workflow_run");
    let conclusion = get(run, "conclusion").and_then(Json::as_str);
    let failed = [
        "failure",
        "timed_out",
        "cancelled",
        "action_required",
        "startup_failure",
    ];
    if kind == Some("workflow_run")
        && action == Some("completed")
        && conclusion.is_some_and(|c| failed.contains(&c))
    {
        return (github_url(get(run, "html_url")) && positive_safe_integer(get(run, "id")))
            .then_some(true)
            .ok_or(());
    }
    if kind == Some("push")
        && get(Some(payload), "ref").and_then(Json::as_str) == Some("refs/heads/main")
        && !truthy(get(Some(payload), "deleted"))
    {
        let after = get(Some(payload), "after")
            .filter(|after| truthy(Some(after)))
            .map(js_string)
            .unwrap_or_default();
        let commit = (40..=64).contains(&after.len())
            && after
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
        return commit.then_some(true).ok_or(());
    }
    if kind == Some("issues")
        && action.is_some_and(|a| ["opened", "closed", "reopened"].contains(&a))
    {
        let issue = get(Some(payload), "issue");
        return (github_url(get(issue, "html_url")) && positive_safe_integer(get(issue, "number")))
            .then_some(true)
            .ok_or(());
    }
    Ok(false)
}

fn header(headers: &HeaderMap, name: &'static str) -> Option<String> {
    request::header_text(headers, &HeaderName::from_static(name), ", ")
}

/// `POST /api/mcp-operator/github`.
pub async fn github(State(state): State<AppState>, request: Request) -> Response {
    let Some(secret) = state
        .config
        .mcp
        .github_secret
        .clone()
        .filter(|secret| !secret.is_empty())
    else {
        return json(
            StatusCode::SERVICE_UNAVAILABLE,
            r#"{"error":"Event webhook is not configured."}"#,
        );
    };
    let (parts, body): (_, Body) = request.into_parts();
    let raw = match request::read_at_most(body, 2_097_152).await {
        Ok(raw) => raw,
        Err(BodyError::TooLarge) => return json(StatusCode::PAYLOAD_TOO_LARGE, NOT_ACCEPTED),
        Err(BodyError::Unreadable) => return json(StatusCode::SERVICE_UNAVAILABLE, NOT_ACCEPTED),
    };
    if !verify(
        &raw,
        header(&parts.headers, "x-hub-signature-256").as_deref(),
        &secret,
    ) {
        return json(
            StatusCode::UNAUTHORIZED,
            r#"{"error":"Invalid signature."}"#,
        );
    }
    // `raw.toString("utf8")` keeps a byte-order mark, which JSON.parse refuses.
    let Some(payload) = Json::parse(&String::from_utf8_lossy(&raw)) else {
        return json(StatusCode::BAD_REQUEST, NOT_ACCEPTED);
    };
    if payload.as_object().is_none() {
        return json(
            StatusCode::BAD_REQUEST,
            r#"{"error":"Invalid event payload."}"#,
        );
    }
    match normalize(
        header(&parts.headers, "x-github-event").as_deref(),
        &payload,
    ) {
        Err(()) => json(StatusCode::BAD_REQUEST, NOT_ACCEPTED),
        Ok(false) => json(StatusCode::ACCEPTED, r#"{"ignored":true}"#),
        // `databaseStore(createAdminClient())` throws without a state key.
        Ok(true) => json(StatusCode::SERVICE_UNAVAILABLE, NOT_ACCEPTED),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_signature_is_checked_as_github_signs() {
        let body = br#"{"zen":"x"}"#;
        let mut mac = <Hmac<Sha256> as KeyInit>::new_from_slice(b"secret").unwrap();
        mac.update(body);
        let good = format!("sha256={}", hex::encode(mac.finalize().into_bytes()));
        assert!(verify(body, Some(&good), "secret"));
        assert!(!verify(body, Some(&good.to_uppercase()), "secret"));
        assert!(!verify(body, Some(&good), "other"));
        assert!(!verify(b"{}", Some(&good), "secret"));
        assert!(!verify(body, None, "secret"));
    }

    #[test]
    fn a_push_commit_is_read_as_javascript_coerces_it() {
        let push = |after: &str| {
            Json::parse(&format!(r#"{{"repository":{{"full_name":"{REPOSITORY}"}},"ref":"refs/heads/main","after":{after}}}"#)).unwrap()
        };
        let hex = format!("\"{}\"", "a".repeat(40));
        assert_eq!(normalize(Some("push"), &push(&hex)), Ok(true));
        assert_eq!(
            normalize(Some("push"), &push(&format!("[{hex}]"))),
            Ok(true)
        );
        assert_eq!(normalize(Some("push"), &push("12")), Err(()));
        assert_eq!(normalize(Some("star"), &push(&hex)), Ok(false));
    }
}
