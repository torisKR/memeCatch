//! `/api/mcp-operator/oauth/authorize` without a state key (see `mcp.rs`):
//! the checks of `GET` (the OAuth request, ChatGPT's client metadata, the
//! operator session) and of `POST` (origin, session, form) as the route file
//! makes them, then the 503 `stateKey()` gives. Route id `mcp-oauth-authorize`.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{CONTENT_TYPE, HeaderValue, ORIGIN};
use axum::response::{IntoResponse, Response};

use super::{Outbound, route_headers};
use crate::auth::is_operator;
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::js;
use crate::routes::request::{self, BodyError, Json};
use crate::AppState;

const CLIENT: &str = "https://chatgpt.com/oauth/client.json";
const REDIRECT: &str = "https://chatgpt.com/connector_platform_oauth_redirect";
const RESOURCE: &str = "https://catchmeme.com/api/mcp-operator";
const SCOPE: &str = "memecatch:monitor";
const UNAVAILABLE: &str = "지금은 연결을 준비할 수 없어요.";

/// `escape(value)`.
fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// `html(content, status)`, as it reaches the client.
fn html(content: &str, status: StatusCode) -> Response {
    let page = format!(
        "<!doctype html><html lang=\"ko\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>밈캐치 운영 이벤트 연결</title><style>body{{font:17px system-ui;line-height:1.7;max-width:650px;margin:10vh auto;padding:24px;color:#222}}button,a{{font:inherit}}button{{background:#ec6b22;border:0;color:white;padding:12px 20px;border-radius:10px;cursor:pointer}}small{{color:#666}}</style><main>{content}</main></html>"
    );
    let mut response = (status, page).into_response();
    route_headers(&mut response);
    // The route's own Content-Security-Policy (`default-src 'none'`, `frame-
    // ancestors 'none'`) never reaches the client: next.config's global one
    // replaces it, and `headers::apply` adds that one here (PLAN.md section 14, TypeScript behaviour 1).
    response.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_static("text/html; charset=utf-8"),
    );
    response
}

fn check_failed(message: &str) -> Response {
    let body = format!(
        "<h1>연결 요청을 확인해 주세요</h1><p>{}</p>",
        escape(message)
    );
    let status = if message == UNAVAILABLE {
        StatusCode::SERVICE_UNAVAILABLE
    } else {
        StatusCode::BAD_REQUEST
    };
    html(&body, status)
}

/// `authorization(searchParams)`: whether the OAuth request is the one ChatGPT sends.
fn valid_request(pairs: &[(String, String)]) -> bool {
    const KEYS: [&str; 8] = [
        "client_id",
        "redirect_uri",
        "resource",
        "response_type",
        "scope",
        "code_challenge",
        "code_challenge_method",
        "state",
    ];
    if KEYS
        .iter()
        .any(|key| pairs.iter().filter(|(name, _)| name == key).count() > 1)
    {
        return false;
    }
    // `Object.fromEntries(input)`: the last value of each name.
    let value = |key: &str| {
        pairs
            .iter()
            .rev()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    };
    let challenge = value("code_challenge").unwrap_or_default();
    let state = value("state").unwrap_or_default();
    value("client_id") == Some(CLIENT)
        && value("redirect_uri") == Some(REDIRECT)
        && value("resource") == Some(RESOURCE)
        && value("response_type") == Some("code")
        && value("scope") == Some(SCOPE)
        && value("code_challenge_method") == Some("S256")
        && challenge.len() == 43
        && challenge
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        && !state.is_empty()
        && js::utf16_len(state) <= 2000
}

/// `validateClient()`: ChatGPT's client metadata, checked once an hour per process.
pub struct ClientCheck {
    outbound: Outbound,
    valid_until: Mutex<i64>,
}

impl ClientCheck {
    pub fn new(outbound: Outbound) -> Self {
        Self {
            outbound,
            valid_until: Mutex::new(0),
        }
    }

    /// `Err(message)`: an `OAuthError` (400) with that message, or `UNAVAILABLE` (503).
    async fn check(&self) -> Result<(), &'static str> {
        if *self.valid_until.lock().expect("client lock") > now_ms() {
            return Ok(());
        }
        let fetched = self
            .outbound
            .get(
                CLIENT,
                "*/*",
                true,
                Duration::from_secs(8),
                64 * 1024 * 1024,
            )
            .await
            .map_err(|_| UNAVAILABLE)?;
        if !fetched.status.is_success() {
            return Err("ChatGPT client metadata unavailable.");
        }
        let text = request::decode_text(&fetched.body.map_err(|_| UNAVAILABLE)?);
        if text.len() > 16_384 {
            return Err("Invalid OAuth request.");
        }
        let data = Json::parse(&text).ok_or(UNAVAILABLE)?;
        supported(&data)?;
        *self.valid_until.lock().expect("client lock") = now_ms() + 3_600_000;
        Ok(())
    }
}

/// `value.includes(item)` for an array or a string; `None` where `includes` is not a function.
fn includes(value: Option<&Json>, item: &str) -> Option<bool> {
    match value? {
        Json::Array(items) => Some(items.iter().any(|entry| entry.as_str() == Some(item))),
        Json::String(text) => Some(text.contains(item)),
        _ => None,
    }
}

/// The checks on the metadata: `Err(UNAVAILABLE)` where the TypeScript throws a `TypeError`.
fn supported(data: &Json) -> Result<(), &'static str> {
    let unsupported = "Unsupported ChatGPT client metadata.";
    // `null.token_endpoint_auth_methods_supported` throws; other values have no properties.
    let entries = match data {
        Json::Null => return Err(UNAVAILABLE),
        Json::Object(entries) => entries.as_slice(),
        _ => return Err(unsupported),
    };
    let get = |key: &str| request::property(entries, key);
    if get("client_id").and_then(Json::as_str) != Some(CLIENT) {
        return Err(unsupported);
    }
    let redirects = get("redirect_uris").filter(|value| !matches!(value, Json::Null));
    match redirects {
        None => return Err(unsupported),
        Some(_) if !includes(redirects, REDIRECT).ok_or(UNAVAILABLE)? => return Err(unsupported),
        Some(_) => {}
    }
    let supported = get("token_endpoint_auth_methods_supported")
        .filter(|value| super::protocol::truthy(Some(value)));
    let wrapped;
    let methods = match supported {
        Some(methods) => methods,
        None => {
            wrapped = Json::Array(vec![
                get("token_endpoint_auth_method")
                    .cloned()
                    .unwrap_or(Json::Null),
            ]);
            &wrapped
        }
    };
    if !includes(Some(methods), "none").ok_or(UNAVAILABLE)? {
        return Err(unsupported);
    }
    Ok(())
}

/// `operator()`: the session user if they are an operator.
async fn operator(state: &AppState, parts: &mut axum::http::request::Parts) -> bool {
    match request::session_user(state, parts).await {
        Some(user) => is_operator(state, &user).await.unwrap_or(false),
        None => false,
    }
}

/// `GET`: the OAuth request, the client metadata, the session, then 503.
pub async fn get(
    State(state): State<AppState>,
    client: Arc<ClientCheck>,
    request: Request,
) -> Response {
    let target = request
        .uri()
        .path_and_query()
        .map(|target| target.as_str().to_owned())
        .unwrap_or_default();
    let (mut parts, _) = request.into_parts();
    if !valid_request(&request::query_pairs(&parts.uri)) {
        return check_failed("Invalid OAuth request.");
    }
    if let Err(message) = client.check().await {
        return check_failed(message);
    }
    if !operator(&state, &mut parts).await {
        let url = url::Url::parse(&format!("http://localhost{target}")).expect("a target");
        let search = url
            .query()
            .filter(|query| !query.is_empty())
            .map(|query| format!("?{query}"))
            .unwrap_or_default();
        let next = js::encode_uri_component(&format!("{}{search}", url.path()));
        let body = format!(
            "<h1>밈캐치 운영자로 로그인하세요</h1><p>운영 이벤트는 운영자 계정만 연결할 수 있어요.</p><a href=\"/login?next={}\">로그인</a>",
            escape(&next)
        );
        return html(&body, StatusCode::UNAUTHORIZED);
    }
    // `consentTicket(input, owner, stateKey())`: no key.
    check_failed(UNAVAILABLE)
}

/// `POST`: the origin, the session, the form, then 503.
pub async fn post(State(state): State<AppState>, request: Request) -> Response {
    let expired = || {
        html(
            "<h1>연결 요청이 만료됐어요.</h1><p>ChatGPT에서 다시 연결하세요.</p>",
            StatusCode::BAD_REQUEST,
        )
    };
    let unavailable = || {
        html(
            "<h1>연결 요청이 만료됐어요.</h1><p>ChatGPT에서 다시 연결하세요.</p>",
            StatusCode::SERVICE_UNAVAILABLE,
        )
    };
    if request::header_text(request.headers(), &ORIGIN, ", ").as_deref() != Some(super::ORIGIN) {
        return html("<h1>허용되지 않은 요청입니다.</h1>", StatusCode::FORBIDDEN);
    }
    let (mut parts, body) = request.into_parts();
    if !operator(&state, &mut parts).await {
        return html(
            "<h1>운영자로 다시 로그인하세요.</h1>",
            StatusCode::UNAUTHORIZED,
        );
    }
    let content_type =
        request::header_text(&parts.headers, &CONTENT_TYPE, ", ").unwrap_or_default();
    if !content_type.starts_with("application/x-www-form-urlencoded") {
        return expired();
    }
    let bytes = match request::read_at_most(body, 16_384).await {
        Ok(bytes) => bytes,
        Err(BodyError::TooLarge | BodyError::Unreadable) => return unavailable(),
    };
    let pairs: Vec<(String, String)> =
        url::form_urlencoded::parse(String::from_utf8_lossy(&bytes).as_bytes())
            .into_owned()
            .collect();
    if pairs
        .iter()
        .any(|(key, _)| pairs.iter().filter(|(name, _)| name == key).count() > 1)
    {
        return expired();
    }
    // `readConsent(..., stateKey())`: no key.
    unavailable()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pairs(extra: &[(&str, &str)]) -> Vec<(String, String)> {
        let mut base = vec![
            ("client_id", CLIENT),
            ("redirect_uri", REDIRECT),
            ("resource", RESOURCE),
            ("response_type", "code"),
            ("scope", SCOPE),
            (
                "code_challenge",
                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
            ),
            ("code_challenge_method", "S256"),
            ("state", "s"),
        ];
        base.extend_from_slice(extra);
        base.into_iter()
            .map(|(k, v)| (k.to_owned(), v.to_owned()))
            .collect()
    }

    #[test]
    fn only_chatgpts_exact_request_passes() {
        assert!(valid_request(&pairs(&[])));
        assert!(valid_request(&pairs(&[("other", "x")])));
        assert!(!valid_request(&pairs(&[("state", "t")])));
        let mut plain = pairs(&[]);
        plain[6].1 = "plain".to_owned();
        assert!(!valid_request(&plain));
        let mut short = pairs(&[]);
        short[5].1 = "abc".to_owned();
        assert!(!valid_request(&short));
    }

    #[test]
    fn client_metadata_checks_follow_the_typescript() {
        let check = |text: &str| supported(&Json::parse(text).unwrap());
        assert_eq!(
            check(&format!(
                r#"{{"client_id":"{CLIENT}","redirect_uris":["{REDIRECT}"],"token_endpoint_auth_method":"none"}}"#
            )),
            Ok(())
        );
        assert_eq!(
            check(&format!(
                r#"{{"client_id":"{CLIENT}","redirect_uris":"x{REDIRECT}","token_endpoint_auth_methods_supported":"nonesuch"}}"#
            )),
            Ok(())
        );
        assert_eq!(
            check(&format!(
                r#"{{"client_id":"{CLIENT}","redirect_uris":["x"],"token_endpoint_auth_method":"none"}}"#
            )),
            Err("Unsupported ChatGPT client metadata.")
        );
        assert_eq!(
            check(&format!(
                r#"{{"client_id":"{CLIENT}","redirect_uris":["{REDIRECT}"],"token_endpoint_auth_methods_supported":5}}"#
            )),
            Err(UNAVAILABLE)
        );
        assert_eq!(check("null"), Err(UNAVAILABLE));
        assert_eq!(check("[]"), Err("Unsupported ChatGPT client metadata."));
    }
}
