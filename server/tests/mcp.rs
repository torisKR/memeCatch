//! The ChatGPT connector routes over HTTP (`src/routes/mcp.rs`): the public
//! MCP server, the OAuth metadata and the operator routes without a state
//! key. The corpus and the client metadata come from a local stub through
//! `AXUM_TEST_MCP_ORIGIN`.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{UNUSED_DATABASE_URL, config, database_url, send, spawn_app, spawn_router};
use hmac::{Hmac, KeyInit, Mac};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sha2::Sha256;

/// `BETTER_AUTH_SECRET` in `common::config`.
const SECRET: &str = "test-only-auth-secret";
const HOOK_SECRET: &str = "test-hook";
const CORPUS: &str = "# 밈캐치\n\n### 중꺾마\n- URL: https://catchmeme.com/memes/abc12345-jungkkeokma\n- 사용 안전도: ● 써도 됨\n- 시기: 2022\n- 한 줄 뜻: 포기하지 않는 마음\n\n### 위험한 밈\n- URL: https://catchmeme.com/memes/def67890-risky\n- 사용 안전도: ✕ 쓰면 위험\n\n### 다른 곳\n- URL: https://evil.example/memes/xyz12345-x\n";
const CLIENT: &str = r#"{"client_id":"https://chatgpt.com/oauth/client.json","redirect_uris":["https://chatgpt.com/connector_platform_oauth_redirect"],"token_endpoint_auth_method":"none"}"#;
const AUTHORIZE: &str = "/api/mcp-operator/oauth/authorize?client_id=https%3A%2F%2Fchatgpt.com%2Foauth%2Fclient.json&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fconnector_platform_oauth_redirect&resource=https%3A%2F%2Fcatchmeme.com%2Fapi%2Fmcp-operator&response_type=code&scope=memecatch%3Amonitor&code_challenge=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ&code_challenge_method=S256&state=s";

/// What the stub answers and what it was asked.
#[derive(Clone)]
struct Stub {
    corpus: Arc<Mutex<(u16, &'static str)>>,
    client: Arc<Mutex<(u16, &'static str)>>,
    seen: Arc<Mutex<Vec<String>>>,
}

impl Stub {
    fn seen(&self) -> Vec<String> {
        self.seen.lock().unwrap().clone()
    }
}

async fn answer(State(stub): State<Stub>, request: Request) -> Response {
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .map(|v| v.to_str().unwrap().to_owned())
            .unwrap_or_default()
    };
    let line = format!(
        "{} accept={} ua={} cache={}",
        request.uri().path(),
        header("accept"),
        header("user-agent"),
        header("cache-control")
    );
    stub.seen.lock().unwrap().push(line);
    let (status, body) = match request.uri().path() {
        "/llms-full.txt" => *stub.corpus.lock().unwrap(),
        "/oauth/client.json" => *stub.client.lock().unwrap(),
        _ => (404, ""),
    };
    let mut response = (StatusCode::from_u16(status).unwrap(), body).into_response();
    if status == 302 {
        response
            .headers_mut()
            .insert("location", "/elsewhere".parse().unwrap());
    }
    response
}

async fn app(database_url: &str, extra: &[(&str, &str)]) -> (SocketAddr, Stub) {
    let stub = Stub {
        corpus: Arc::new(Mutex::new((200, CORPUS))),
        client: Arc::new(Mutex::new((200, CLIENT))),
        seen: Arc::default(),
    };
    let origin = spawn_router(Router::new().fallback(answer).with_state(stub.clone())).await;
    let origin = format!("http://{origin}");
    let base = [
        ("AXUM_TEST_MCP_ORIGIN", origin.as_str()),
        ("MCP_GITHUB_WEBHOOK_SECRET", HOOK_SECRET),
        ("MCP_EVENT_RETRY_TOKEN", "test-retry"),
        ("CRON_SECRET", "test-cron"),
    ];
    let app = spawn_app(config(database_url, &[extra, &base[..]].concat())).await;
    (app, stub)
}

async fn rpc(app: SocketAddr, body: &str, extra: &[(&str, &str)]) -> common::Reply {
    let headers = [
        &[
            ("content-type", "application/json"),
            ("x-forwarded-for", "10.1.0.1"),
        ][..],
        extra,
    ]
    .concat();
    send(app, "POST", "/api/mcp", &headers, body.to_owned()).await
}

fn call(name: &str, arguments: &str) -> String {
    format!(
        r#"{{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{{"name":"{name}","arguments":{arguments}}}}}"#
    )
}

#[tokio::test]
async fn the_public_server_refuses_bad_requests() {
    let (app, _) = app(UNUSED_DATABASE_URL, &[]).await;
    let ping = r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#;

    let foreign = rpc(app, ping, &[("origin", "https://evil.example")]).await;
    let chatgpt = rpc(app, ping, &[("origin", "https://chatgpt.com")]).await;
    let plain = send(
        app,
        "POST",
        "/api/mcp",
        &[("content-type", "text/plain")],
        ping,
    )
    .await;
    let large = rpc(
        app,
        &format!(
            r#"{{"jsonrpc":"2.0","id":1,"method":"ping","pad":"{}"}}"#,
            "x".repeat(270_000)
        ),
        &[],
    )
    .await;
    let malformed = rpc(app, "{", &[]).await;
    let notification = rpc(
        app,
        r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#,
        &[],
    )
    .await;
    let events = rpc(
        app,
        r#"{"jsonrpc":"2.0","id":1,"method":"events/list"}"#,
        &[],
    )
    .await;
    let header = rpc(app, ping, &[("mcp-protocol-version", "2030-01-01")]).await;
    let get = send(app, "GET", "/api/mcp", &[], Body::empty()).await;

    assert_eq!(
        (foreign.status, foreign.body.as_str()),
        (StatusCode::FORBIDDEN, r#"{"error":"Origin not allowed."}"#)
    );
    assert_eq!(
        (chatgpt.status, chatgpt.body.as_str()),
        (StatusCode::OK, r#"{"jsonrpc":"2.0","id":1,"result":{}}"#)
    );
    assert_eq!(
        (plain.status, plain.body.as_str()),
        (
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            r#"{"error":"Use application/json."}"#
        )
    );
    assert_eq!(large.status, StatusCode::PAYLOAD_TOO_LARGE);
    assert!(large.body.contains(r#""code":-32600"#), "{}", large.body);
    assert_eq!(
        (malformed.status, malformed.body.as_str()),
        (
            StatusCode::BAD_REQUEST,
            r#"{"jsonrpc":"2.0","error":{"code":-32700,"message":"Invalid JSON."}}"#
        )
    );
    assert_eq!(
        (notification.status, notification.body.as_str()),
        (StatusCode::ACCEPTED, "")
    );
    assert_eq!(events.status, StatusCode::NOT_FOUND);
    assert!(events.body.contains(r#""code":-32601"#), "{}", events.body);
    assert_eq!(header.status, StatusCode::BAD_REQUEST);
    for reply in [&foreign, &chatgpt, &malformed, &notification] {
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(reply.header("x-content-type-options"), Some("nosniff"));
    }
    assert_eq!(
        (get.status, get.header("allow")),
        (StatusCode::METHOD_NOT_ALLOWED, Some("POST"))
    );
}

#[tokio::test]
async fn tools_read_the_corpus_once_with_the_headers_fetch_sends() {
    let (app, stub) = app(UNUSED_DATABASE_URL, &[]).await;

    let found = rpc(app, &call("search_memes", r#"{"query":"중꺾마"}"#), &[]).await;
    let get = rpc(app, &call("get_meme", r#"{"id":"abc12345"}"#), &[]).await;
    let hidden = rpc(app, &call("search_memes", "{}"), &[]).await;
    let invalid = rpc(app, &call("search_memes", r#"{"limit":13}"#), &[]).await;
    let unknown = rpc(app, &call("nope", "{}"), &[]).await;

    assert!(
        found.body.contains(r#""id":"abc12345""#) && found.body.contains(r#""corpusSize":2"#),
        "{}",
        found.body
    );
    assert!(
        get.body.contains(r#""summary":"포기하지 않는 마음""#),
        "{}",
        get.body
    );
    // The risky meme is left out unless asked for, the foreign URL always.
    assert!(hidden.body.contains(r#""matched":1"#), "{}", hidden.body);
    assert_eq!(
        invalid.body,
        r#"{"jsonrpc":"2.0","id":3,"error":{"code":-32602,"message":"검색어는 160자 이내, 결과 수는 1~12여야 합니다."}}"#
    );
    assert_eq!(
        unknown.body,
        r#"{"jsonrpc":"2.0","id":3,"error":{"code":-32602,"message":"Unknown tool."}}"#
    );
    assert_eq!(
        stub.seen(),
        ["/llms-full.txt accept=text/plain ua=node cache="]
    );
}

#[tokio::test]
async fn a_corpus_that_cannot_be_read_is_reported_as_fetch_rejects_and_not_cached() {
    let (app, stub) = app(UNUSED_DATABASE_URL, &[]).await;
    let search = call("search_memes", r#"{"query":"밈"}"#);

    *stub.corpus.lock().unwrap() = (302, "");
    let redirected = rpc(app, &search, &[]).await;
    *stub.corpus.lock().unwrap() = (500, "down");
    let failed = rpc(app, &search, &[]).await;
    *stub.corpus.lock().unwrap() = (
        200,
        "### 아무것도\n- URL: https://evil.example/memes/abc-x\n",
    );
    let empty = rpc(app, &search, &[]).await;

    // `redirect: "error"` rejects with `TypeError: fetch failed`: -32602.
    assert_eq!(
        redirected.body,
        r#"{"jsonrpc":"2.0","id":3,"error":{"code":-32602,"message":"fetch failed"}}"#
    );
    let unavailable = r#"{"jsonrpc":"2.0","id":3,"result":{"isError":true,"content":[{"type":"text","text":"밈캐치 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요."}]}}"#;
    assert_eq!(failed.body, unavailable);
    assert_eq!(empty.body, unavailable);
    assert_eq!(stub.seen().len(), 3);
}

#[tokio::test]
async fn tool_calls_are_limited_per_address_and_other_methods_are_not() {
    let (app, _) = app(UNUSED_DATABASE_URL, &[]).await;
    let address = [("x-forwarded-for", "10.2.0.9")];

    for index in 0..120 {
        let reply = rpc(app, &call("nope", "{}"), &address).await;
        assert_eq!(reply.status, StatusCode::OK, "call {index}");
    }
    let limited = rpc(app, &call("nope", "{}"), &address).await;
    let ping = rpc(app, r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#, &address).await;

    assert_eq!(limited.status, StatusCode::TOO_MANY_REQUESTS);
    assert!(
        limited
            .header("retry-after")
            .is_some_and(|s| s.parse::<u32>().is_ok_and(|s| s <= 60))
    );
    assert_eq!(ping.status, StatusCode::OK);
}

#[tokio::test]
async fn the_operator_routes_give_the_answers_of_a_missing_state_key() {
    let (app, _) = app(UNUSED_DATABASE_URL, &[]).await;

    let challenge = send(app, "GET", "/api/mcp-operator", &[], Body::empty()).await;
    let post = send(
        app,
        "POST",
        "/api/mcp-operator",
        &[("authorization", "Bearer x")],
        "{}",
    )
    .await;
    let foreign = send(
        app,
        "POST",
        "/api/mcp-operator",
        &[("origin", "https://evil.example")],
        "{}",
    )
    .await;
    let token = send(
        app,
        "POST",
        "/api/mcp-operator/oauth/token",
        &[],
        "grant_type=authorization_code",
    )
    .await;
    let metadata = send(
        app,
        "GET",
        "/.well-known/oauth-authorization-server",
        &[],
        Body::empty(),
    )
    .await;
    let resource = send(
        app,
        "GET",
        "/.well-known/oauth-protected-resource/api/mcp-operator",
        &[],
        Body::empty(),
    )
    .await;

    assert_eq!(
        (challenge.status, challenge.body.as_str()),
        (
            StatusCode::UNAUTHORIZED,
            r#"{"error":"Operator authorization required."}"#
        )
    );
    assert_eq!(
        challenge.header("www-authenticate"),
        Some(
            r#"Bearer resource_metadata="https://catchmeme.com/.well-known/oauth-protected-resource/api/mcp-operator", scope="memecatch:monitor""#
        )
    );
    assert_eq!(
        (post.status, post.body.as_str()),
        (
            StatusCode::OK,
            r#"{"jsonrpc":"2.0","error":{"code":-32603,"message":"Event service is unavailable."}}"#
        )
    );
    assert_eq!(foreign.status, StatusCode::FORBIDDEN);
    assert_eq!(
        (token.status, token.body.as_str()),
        (
            StatusCode::SERVICE_UNAVAILABLE,
            r#"{"error":"server_error"}"#
        )
    );
    assert!(
        metadata
            .body
            .starts_with(r#"{"issuer":"https://catchmeme.com","#),
        "{}",
        metadata.body
    );
    assert_eq!(
        resource.body,
        r#"{"resource":"https://catchmeme.com/api/mcp-operator","authorization_servers":["https://catchmeme.com"],"scopes_supported":["memecatch:monitor"],"resource_name":"밈캐치 운영 이벤트"}"#
    );
    for reply in [&metadata, &resource] {
        assert_eq!(
            (
                reply.header("content-language"),
                reply.header("cache-control")
            ),
            (Some("ko"), Some("no-store"))
        );
    }
}

/// Production has no `MCP_EVENT_STATE_KEY`; setting one changes no answer
/// (PLAN.md L2-3): the stateful routes are not ported.
#[tokio::test]
async fn a_state_key_changes_no_operator_answer() {
    let (without, _) = app(UNUSED_DATABASE_URL, &[]).await;
    let (with, _) = app(
        UNUSED_DATABASE_URL,
        &[("MCP_EVENT_STATE_KEY", "a-test-key")],
    )
    .await;
    type Request<'a> = (&'a str, &'a str, &'a [(&'a str, &'a str)], &'a str);
    let requests: [Request; 5] = [
        (
            "POST",
            "/api/mcp-operator",
            &[("authorization", "Bearer x")],
            "{}",
        ),
        (
            "POST",
            "/api/mcp-operator/oauth/token",
            &[],
            "grant_type=authorization_code",
        ),
        ("GET", "/api/mcp-operator/oauth/authorize", &[], ""),
        (
            "GET",
            "/api/cron/mcp-events",
            &[("authorization", "Bearer test-cron")],
            "",
        ),
        ("POST", "/api/mcp-operator/github", &[], "{}"),
    ];
    for (method, path, headers, body) in requests {
        let expected = send(without, method, path, headers, body.to_owned()).await;
        let reply = send(with, method, path, headers, body.to_owned()).await;
        assert_ne!(reply.status, StatusCode::NOT_IMPLEMENTED, "{method} {path}");
        assert_eq!(
            (reply.status, reply.body.as_str()),
            (expected.status, expected.body.as_str()),
            "{method} {path}"
        );
    }
}

#[tokio::test]
async fn the_cron_takes_either_bearer_compared_whole() {
    let (app, _) = app(UNUSED_DATABASE_URL, &[]).await;
    let cron = |value: &'static str| async move {
        let headers: Vec<(&str, &str)> = if value.is_empty() {
            vec![]
        } else {
            vec![("authorization", value)]
        };
        let reply = send(app, "GET", "/api/cron/mcp-events", &headers, Body::empty()).await;
        (reply.status, reply.body)
    };
    let refused = (
        StatusCode::UNAUTHORIZED,
        r#"{"error":"Unauthorized."}"#.to_owned(),
    );
    let unavailable = (
        StatusCode::SERVICE_UNAVAILABLE,
        r#"{"error":"Event retry is unavailable."}"#.to_owned(),
    );

    assert_eq!(cron("").await, refused);
    assert_eq!(cron("Bearer nope").await, refused);
    assert_eq!(cron("Bearer test-cro").await, refused);
    assert_eq!(cron("Bearer  test-cron").await, refused);
    assert_eq!(cron("test-cron").await, refused);
    assert_eq!(cron("Bearer test-cron").await, unavailable);
    assert_eq!(cron("Bearer test-retry").await, unavailable);
}

fn signed(body: &str, secret: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(body.as_bytes());
    let hex: String = mac
        .finalize()
        .into_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("sha256={hex}")
}

async fn hook(
    app: SocketAddr,
    event: &str,
    body: &str,
    signature: Option<String>,
) -> (StatusCode, String) {
    let mut headers = vec![
        ("content-type", "application/json"),
        ("x-github-event", event),
    ];
    let signature = signature.unwrap_or_else(|| signed(body, HOOK_SECRET));
    if !signature.is_empty() {
        headers.push(("x-hub-signature-256", signature.as_str()));
    }
    let reply = send(
        app,
        "POST",
        "/api/mcp-operator/github",
        &headers,
        body.to_owned(),
    )
    .await;
    (reply.status, reply.body)
}

#[tokio::test]
async fn the_webhook_checks_the_signature_of_the_raw_body_before_reading_it() {
    let (app, _) = app(UNUSED_DATABASE_URL, &[]).await;
    let repo = r#""repository":{"full_name":"torisKR/memeCatch"}"#;
    let push = format!(
        r#"{{{repo},"ref":"refs/heads/main","after":"{}"}}"#,
        "a".repeat(40)
    );
    let refused = |text: &str| (StatusCode::UNAUTHORIZED, format!(r#"{{"error":"{text}"}}"#));

    assert_eq!(
        hook(app, "push", &push, Some(String::new())).await,
        refused("Invalid signature.")
    );
    assert_eq!(
        hook(app, "push", &push, Some(signed(&push, "other"))).await,
        refused("Invalid signature.")
    );
    assert_eq!(
        hook(
            app,
            "push",
            &push,
            Some(signed(&push, HOOK_SECRET).to_uppercase())
        )
        .await,
        refused("Invalid signature.")
    );
    // Signed over other bytes than those sent (a space added after signing).
    assert_eq!(
        hook(
            app,
            "push",
            &format!("{push} "),
            Some(signed(&push, HOOK_SECRET))
        )
        .await,
        refused("Invalid signature.")
    );
    assert_eq!(
        hook(app, "push", "{", None).await.0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        hook(app, "push", r#"{"repository":{"full_name":"x/y"}}"#, None)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        hook(app, "star", &format!("{{{repo}}}"), None).await,
        (StatusCode::ACCEPTED, r#"{"ignored":true}"#.to_owned())
    );
    assert_eq!(
        hook(app, "push", &push, None).await,
        (
            StatusCode::SERVICE_UNAVAILABLE,
            r#"{"error":"Event could not be accepted."}"#.to_owned()
        )
    );
    let large = format!(r#"{{"pad":"{}"}}"#, "x".repeat(2_200_000));
    assert_eq!(
        hook(app, "push", &large, None).await.0,
        StatusCode::PAYLOAD_TOO_LARGE
    );

    let (unset, _) = self::app(UNUSED_DATABASE_URL, &[("MCP_GITHUB_WEBHOOK_SECRET", "")]).await;
    assert_eq!(
        hook(unset, "push", &push, None).await,
        (
            StatusCode::SERVICE_UNAVAILABLE,
            r#"{"error":"Event webhook is not configured."}"#.to_owned()
        )
    );
}

#[tokio::test]
async fn authorize_checks_the_request_then_the_client_then_the_session() {
    let (app, stub) = app(UNUSED_DATABASE_URL, &[]).await;
    let get = |path: String| async move { send(app, "GET", &path, &[], Body::empty()).await };

    let invalid = get(AUTHORIZE.replace("S256", "plain")).await;
    let repeated = get(format!("{AUTHORIZE}&state=t")).await;
    *stub.client.lock().unwrap() = (404, "{}");
    let missing = get(AUTHORIZE.to_owned()).await;
    *stub.client.lock().unwrap() = (200, "null");
    let null = get(AUTHORIZE.to_owned()).await;
    *stub.client.lock().unwrap() = (200, CLIENT);
    let signed_out = get(AUTHORIZE.to_owned()).await;
    let cached = get(AUTHORIZE.to_owned()).await;
    let post = send(
        app,
        "POST",
        "/api/mcp-operator/oauth/authorize",
        &[("content-type", "application/x-www-form-urlencoded")],
        "ticket=x",
    )
    .await;

    assert_eq!(invalid.status, StatusCode::BAD_REQUEST);
    assert!(
        invalid.body.contains("<p>Invalid OAuth request.</p>"),
        "{}",
        invalid.body
    );
    assert_eq!(repeated.status, StatusCode::BAD_REQUEST);
    assert_eq!(missing.status, StatusCode::BAD_REQUEST);
    assert!(
        missing
            .body
            .contains("ChatGPT client metadata unavailable."),
        "{}",
        missing.body
    );
    assert_eq!(null.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(signed_out.status, StatusCode::UNAUTHORIZED);
    assert!(
        signed_out.body.contains(
            r#"<a href="/login?next=%2Fapi%2Fmcp-operator%2Foauth%2Fauthorize%3Fclient_id%3D"#
        ),
        "{}",
        signed_out.body
    );
    assert_eq!(
        signed_out.header("content-type"),
        Some("text/html; charset=utf-8")
    );
    assert_eq!(cached.status, StatusCode::UNAUTHORIZED);
    // Three fetches, `cache: "no-store"`: the valid metadata is kept for an hour.
    let client = "/oauth/client.json accept=*/* ua=node cache=no-cache";
    assert_eq!(stub.seen(), [client, client, client]);
    assert_eq!(post.status, StatusCode::FORBIDDEN);
}

async fn promote(db: &Db, id: String) {
    let promoted: Result<Option<String>, sqlx::Error> = db
        .with_identity(&DbIdentity::service_role(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar("update public.profiles set role = 'operator' where id = $1::uuid returning id::text").bind(id).fetch_optional(tx).await
            })
        })
        .await;
    assert!(promoted.expect("the profile").is_some());
}

#[tokio::test]
async fn authorize_gives_an_operator_the_missing_key_answer_and_others_the_login_db() {
    let db = Db::connect_lazy(&database_url(), 2).expect("database url");
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("the better-auth tables");
    let (operator, user) = (create_user(db.pool()).await, create_user(db.pool()).await);
    let operator_cookie = signed_cookie(
        PLAIN,
        &create_session(db.pool(), &operator, 3_600.0).await,
        SECRET,
    );
    let user_cookie = signed_cookie(
        PLAIN,
        &create_session(db.pool(), &user, 3_600.0).await,
        SECRET,
    );
    promote(&db, operator.id.clone()).await;
    // The plain cookie name: outside production.
    let (app, _) = app(&database_url(), &[("NODE_ENV", "development")]).await;
    let post = |cookie: String, body: &'static str| async move {
        let headers = [
            ("cookie", cookie.as_str()),
            ("origin", "https://catchmeme.com"),
            ("content-type", "application/x-www-form-urlencoded"),
        ];
        send(
            app,
            "POST",
            "/api/mcp-operator/oauth/authorize",
            &headers,
            body,
        )
        .await
    };

    let as_operator = send(
        app,
        "GET",
        AUTHORIZE,
        &[("cookie", &operator_cookie)],
        Body::empty(),
    )
    .await;
    let as_user = send(
        app,
        "GET",
        AUTHORIZE,
        &[("cookie", &user_cookie)],
        Body::empty(),
    )
    .await;
    let allow = post(operator_cookie.clone(), "ticket=x&decision=allow").await;
    let repeated = post(operator_cookie.clone(), "ticket=a&ticket=b").await;
    let not_operator = post(user_cookie.clone(), "ticket=x").await;

    assert_eq!(as_operator.status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(
        as_operator.body.contains("지금은 연결을 준비할 수 없어요."),
        "{}",
        as_operator.body
    );
    assert_eq!(as_user.status, StatusCode::UNAUTHORIZED);
    assert_eq!(allow.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(repeated.status, StatusCode::BAD_REQUEST);
    assert_eq!(not_operator.status, StatusCode::UNAUTHORIZED);
}
