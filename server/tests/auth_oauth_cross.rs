//! Google and Kakao sign-in in Rust against the app's own better-auth on one
//! test database, with the providers stood in for by a local stub (Rust:
//! `AXUM_TEST_OAUTH_ORIGIN`; Node: tests/oauth_fetch_stub.mjs). Nothing
//! reaches Google or Kakao.
//!
//! Every case runs three ways, under each `NODE_ENV`: started and finished on
//! better-auth (the reference), started on better-auth and finished on Rust,
//! started on Rust and finished on better-auth. The callback's answer
//! (status, `Location`, `Set-Cookie`, body), the rows the address has after
//! it (`user`, `account`, sessions, `auth.users`), the mail sent and the
//! token request the provider saw must be the reference's, with the random
//! parts masked; a session the callback made must be read by the other
//! server; a replay on the other server must be refused as the reference's
//! is.
//!
//! ```sh
//! export DATABASE_URL="$(scripts/test-db.sh up)"
//! cargo test --test auth_oauth_cross -- --ignored --nocapture
//! ```

mod common;

use std::net::SocketAddr;
use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use common::{config, database_url, marker_upstream, send, spawn_app, spawn_router};
use serde_json::{Value, json};
use sqlx::PgPool;

const SECRET: &str = "test-only-auth-secret";
const BASE: &str = "http://localhost:3000";
const CALLBACK: &str = "http://localhost:3000/auth/callback?next=%2F";
const MODES: [&str; 2] = ["development", "production"];
const CLIENTS: [(&str, &str); 4] = [
    ("GOOGLE_CLIENT_ID", "a3-google-client"),
    ("GOOGLE_CLIENT_SECRET", "a3-google-secret"),
    ("KAKAO_CLIENT_ID", "a3-kakao-client"),
    ("KAKAO_CLIENT_SECRET", "a3-kakao-secret"),
];

/// One Node process at a time: each runs `ensureAuthSchema`.
static NODE: Mutex<()> = Mutex::new(());

fn encode(spec: &Value) -> String {
    URL_SAFE_NO_PAD.encode(spec.to_string())
}

/// The stub's protocol (parity/oauth-provider-stub.mjs): the code names the
/// token answer, the access token the Kakao profile answer.
fn code_for(spec: Value) -> String {
    format!("code.{}", encode(&spec))
}

fn token_for(spec: Value) -> String {
    format!("at.{}", encode(&spec))
}

fn id_token(claims: Value) -> String {
    let header = json!({"alg": "RS256", "kid": "stub", "typ": "JWT"});
    format!("{}.{}.c2lnbmF0dXJl", encode(&header), encode(&claims))
}

/// The providers' stand-in, which keeps the token requests it saw.
#[derive(Clone, Default)]
struct Stub(Arc<Mutex<Vec<String>>>);

fn decode(text: &str, prefix: &str) -> Option<Value> {
    let bytes = URL_SAFE_NO_PAD.decode(text.strip_prefix(prefix)?).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn answer(spec: Option<Value>) -> Response {
    let Some(spec) = spec else {
        return (StatusCode::BAD_REQUEST, r#"{"error":"invalid_grant"}"#).into_response();
    };
    let status =
        StatusCode::from_u16(spec["status"].as_u64().unwrap_or(200) as u16).expect("status");
    let body = match &spec["body"] {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    };
    let mut response = (status, body).into_response();
    response
        .headers_mut()
        .insert("content-type", "application/json".parse().expect("type"));
    response
}

impl Stub {
    async fn serve(&self) -> String {
        async fn token(State(stub): State<Stub>, body: Bytes) -> Response {
            let form: Vec<(String, String)> = url::form_urlencoded::parse(&body)
                .map(|(key, value)| (key.into_owned(), value.into_owned()))
                .collect();
            // What the token request carried, the per-flow values masked.
            let seen = form
                .iter()
                .map(|(key, value)| match key.as_str() {
                    "code" | "code_verifier" => format!("{key}=<{}>", value.len()),
                    _ => format!("{key}={value}"),
                })
                .collect::<Vec<_>>()
                .join("&");
            stub.0.lock().expect("stub").push(seen);
            let code = form
                .iter()
                .find(|(key, _)| key == "code")
                .map(|(_, v)| v.as_str());
            answer(code.and_then(|code| decode(code, "code.")))
        }
        async fn profile(headers: HeaderMap) -> Response {
            let bearer = headers
                .get("authorization")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.strip_prefix("Bearer "))
                .unwrap_or_default();
            answer(decode(bearer, "at.").or(Some(json!({"status": 401, "body": {"code": -401}}))))
        }
        let router = Router::new()
            .route("/token", post(token))
            .route("/oauth/token", post(token))
            .route("/v2/user/me", get(profile))
            .with_state(self.clone());
        format!("http://{}", spawn_router(router).await)
    }

    fn last(&self) -> String {
        self.0
            .lock()
            .expect("stub")
            .last()
            .cloned()
            .unwrap_or_default()
    }
}

/// The mail webhook of both servers.
#[derive(Clone, Default)]
struct Mailbox(Arc<Mutex<Vec<Value>>>);

impl Mailbox {
    async fn serve(&self) -> String {
        let router = Router::new()
            .route(
                "/hook",
                post(|State(mailbox): State<Mailbox>, body: Bytes| async move {
                    let mail = serde_json::from_slice(&body).expect("a JSON mail");
                    mailbox.0.lock().expect("mailbox").push(mail);
                    StatusCode::NO_CONTENT
                }),
            )
            .with_state(self.clone());
        format!("http://{}/hook", spawn_router(router).await)
    }

    fn to(&self, email: &str) -> Vec<Value> {
        self.0
            .lock()
            .expect("mailbox")
            .iter()
            .filter(|mail| mail["to"] == email)
            .cloned()
            .collect()
    }
}

/// An answer of either server: `{ status, location, setCookie, body }`.
type Answer = Value;

#[derive(Clone, Copy, PartialEq, Debug)]
enum Server {
    Node,
    Rust,
}

struct Side {
    mode: &'static str,
    app: SocketAddr,
    stub_origin: String,
    stub: Stub,
    webhook: String,
    mailbox: Mailbox,
    pool: PgPool,
}

impl Side {
    async fn new(mode: &'static str) -> Self {
        let stub = Stub::default();
        let stub_origin = stub.serve().await;
        let mailbox = Mailbox::default();
        let webhook = mailbox.serve().await;
        let mut vars = vec![
            ("NODE_ENV", mode),
            ("BETTER_AUTH_URL", BASE),
            ("AUTH_EMAIL_WEBHOOK", webhook.as_str()),
            ("AXUM_TEST_OAUTH_ORIGIN", stub_origin.as_str()),
        ];
        vars.extend(CLIENTS);
        let app = spawn_app(config(marker_upstream().await, &database_url(), &vars)).await;
        let pool = PgPool::connect(&database_url()).await.expect("connect");
        let side = Self {
            mode,
            app,
            stub_origin,
            stub,
            webhook,
            mailbox,
            pool,
        };
        // better-auth creates its tables on its first request.
        side.node(&["get-session", ""]);
        side
    }

    /// One request through the app's better-auth (tests/better_auth_oauth.mjs).
    fn node(&self, args: &[&str]) -> Answer {
        let _one_at_a_time = NODE.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("root");
        let output = Command::new("node")
            .args([
                "--import",
                "./scripts/register-ts-paths.mjs",
                "--import",
                "./server/tests/oauth_fetch_stub.mjs",
                "server/tests/better_auth_oauth.mjs",
            ])
            .args(args)
            .current_dir(repository)
            .envs(CLIENTS)
            .env("DATABASE_URL", database_url())
            .env("BETTER_AUTH_SECRET", SECRET)
            .env("BETTER_AUTH_URL", BASE)
            .env("NODE_ENV", self.mode)
            .env("AUTH_EMAIL_WEBHOOK", &self.webhook)
            .env("OAUTH_STUB_ORIGIN", &self.stub_origin)
            .output()
            .expect("run node");
        assert!(
            output.status.success(),
            "{args:?} failed:\n{}",
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).expect("one JSON line")
    }

    /// The same request to Rust, as the Node script sends it.
    async fn rust(&self, method: &str, path: &str, cookie: &str, body: &str) -> Answer {
        // Each request its own client: the limiter (3 per 10 s on
        // `/sign-in/social` in production) counts per address. Node's runs
        // once per process and never counts.
        let address = format!("198.51.{}.{}", rand::random::<u8>(), rand::random::<u8>());
        let mut headers = vec![
            ("origin", BASE),
            ("x-forwarded-for", address.as_str()),
            ("user-agent", "a3-cross"),
        ];
        if method == "POST" {
            headers.push(("content-type", "application/json"));
        }
        if !cookie.is_empty() {
            headers.push(("cookie", cookie));
        }
        let reply = send(
            self.app,
            method,
            &format!("/api/auth{path}"),
            &headers,
            Body::from(body.to_owned()),
        )
        .await;
        let set_cookie: Vec<Value> = reply
            .headers
            .get_all("set-cookie")
            .iter()
            .map(|line| Value::from(line.to_str().expect("ascii")))
            .collect();
        json!({
            "status": reply.status.as_u16(),
            "location": reply.header("location"),
            "setCookie": set_cookie,
            "body": serde_json::from_str::<Value>(&reply.body).unwrap_or(Value::from(reply.body.clone())),
        })
    }

    async fn start(&self, on: Server, body: &Value) -> Answer {
        match on {
            Server::Node => self.node(&["start", &body.to_string()]),
            Server::Rust => {
                self.rust("POST", "/sign-in/social", "", &body.to_string())
                    .await
            }
        }
    }

    async fn callback(&self, on: Server, path: &str, cookie: &str) -> Answer {
        match on {
            Server::Node => self.node(&["callback", path, cookie]),
            Server::Rust => self.rust("GET", path, cookie, "").await,
        }
    }

    async fn session_email(&self, on: Server, cookie: &str) -> Value {
        let answer = match on {
            Server::Node => self.node(&["get-session", cookie]),
            Server::Rust => self.rust("GET", "/get-session", cookie, "").await,
        };
        answer["body"]["user"]["email"].clone()
    }

    /// What the app keeps about one address.
    async fn rows(&self, email: &str) -> String {
        sqlx::query_scalar(
            r#"select json_build_object(
                 'user', (select row_to_json(u) from public."user" u where u.email = $1),
                 'account', (select json_agg(a order by a."createdAt") from public.account a
                              join public."user" u on u.id = a."userId" where u.email = $1),
                 'sessions', (select count(*) from public.session s
                               join public."user" u on u.id = s."userId" where u.email = $1),
                 'auth_users', (select json_agg(json_build_object('email', au.email,
                                  'confirmed', au.email_confirmed_at is not null,
                                  'nickname', replace(replace(au.raw_user_meta_data->>'nickname',
                                      substr(replace(au.id::text, '-', ''), 1, 6), '<id6>'),
                                      substr(replace(au.id::text, '-', ''), 1, 3), '<id3>')))
                                from auth.users au where au.email = $1)
               )::text"#,
        )
        .bind(email)
        .fetch_one(&self.pool)
        .await
        .expect("rows")
    }
}

fn unique() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("after 1970")
        .as_nanos() as u64;
    // `ax` and 12 hex digits: the name database tests leave profiles under.
    format!(
        "ax{:012x}",
        (nanos ^ (COUNTER.fetch_add(1, Ordering::Relaxed) << 40)) & 0xffff_ffff_ffff
    )
}

/// The random parts of answers and rows: the flow's unique part, ids,
/// tokens, signatures, times. One Node call masks them all with
/// JavaScript's regular expressions.
fn mask(texts: &[String], u: &str) -> Vec<String> {
    const MASKS: &str = r#"
      const [u, ...texts] = JSON.parse(process.argv[1]);
      const masks = [
        [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>"],
        [/(session_token=)[^;"]+/g, "$1<cookie>"],
        [/(state=)[A-Za-z0-9_%.-]+/g, "$1<state>"],
        [/(code_challenge=)[A-Za-z0-9_-]+/g, "$1<challenge>"],
        [/at\.[A-Za-z0-9_-]+/g, "<access-token>"],
        [/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/g, "<jwt>"],
        [/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:?\d\d)/g, "<time>"],
        [/"token":"[A-Za-z0-9]{32}"/g, '"token":"<token>"'],
        [/\d{9,}/g, "<digits>"],
        // syncAuthUser's suffix after a nickname collision: which run of a
        // case collides depends on the order, not on the server.
        [/_\d<id3>/g, ""],
      ];
      process.stdout.write(JSON.stringify(texts.map((text) =>
        masks.reduce((out, [re, to]) => out.replace(re, to), text.replaceAll(u, "<u>")))));
    "#;
    let input = Value::from(
        std::iter::once(u.to_owned())
            .chain(texts.iter().cloned())
            .collect::<Vec<_>>(),
    );
    let output = Command::new("node")
        .args(["-e", MASKS, &input.to_string()])
        .output()
        .expect("node");
    serde_json::from_slice(&output.stdout).expect("masked texts")
}

/// The state and the cookie pair of a start answer.
fn state_of(started: &Answer) -> (String, String) {
    let url = url::Url::parse(
        started["body"]["url"]
            .as_str()
            .expect("an authorization URL"),
    )
    .expect("url");
    let state = url
        .query_pairs()
        .find(|(key, _)| key == "state")
        .map(|(_, value)| value.into_owned())
        .expect("a state");
    let cookie = started["setCookie"][0].as_str().expect("the state cookie");
    (state, cookie.split(';').next().expect("pair").to_owned())
}

fn session_pair(answer: &Answer) -> Option<String> {
    answer["setCookie"]
        .as_array()?
        .iter()
        .filter_map(Value::as_str)
        .find(|line| line.contains("session_token=") && !line.contains("Max-Age=0"))
        .map(|line| line.split(';').next().expect("pair").to_owned())
}

/// What a case does before the callback.
#[derive(Clone, Copy, PartialEq)]
enum Before {
    Nothing,
    /// A local user with the address, verified or not.
    LocalUser {
        verified: bool,
    },
    /// The same provider account signed in once already (on better-auth).
    SignedIn,
    /// The state row's JSON expired.
    Expired,
    /// The row expired too, as it does past its 10 minutes: the read's
    /// cleanup deletes it, with a client that kept the cookie.
    ExpiredRow,
    /// The callback arrives without the state cookie.
    NoCookie,
}

struct Case {
    name: &'static str,
    provider: &'static str,
    start: Value,
    before: Before,
    /// The token answer for this flow's unique part.
    token: fn(&str) -> Value,
    /// Appended to `code=…&state=…`.
    query: &'static str,
}

fn google(u: &str, claims: Value) -> Value {
    let mut all = json!({"sub": format!("g-{u}"), "email": format!("{u}@example.com"),
                         "email_verified": true, "name": "구글 사용자", "picture": "https://p.example/a.png"});
    if let (Some(all), Value::Object(claims)) = (all.as_object_mut(), claims) {
        all.extend(claims);
    }
    json!({"body": {"access_token": format!("ya29-{u}"), "expires_in": 3599,
                    "scope": "openid https://www.googleapis.com/auth/userinfo.email", "token_type": "Bearer",
                    "id_token": id_token(all)}})
}

/// A Kakao id of this flow: its first six digits, which the app's nickname
/// fallback takes, are the same for every flow.
fn kakao_id(u: &str) -> u64 {
    40_000_000_000_000 + u64::from_str_radix(&u[2..], 16).expect("hex") % 100_000_000
}

fn kakao(u: &str, account: Value) -> Value {
    let id = kakao_id(u);
    json!({"body": {"access_token": token_for(json!({"body": {"id": id, "kakao_account": account}})),
                    "token_type": "bearer", "refresh_token": format!("rt-{u}"), "expires_in": 21599,
                    "refresh_token_expires_in": 5183999, "scope": "account_email profile_nickname"}})
}

fn cases() -> Vec<Case> {
    let base = json!({"callbackURL": CALLBACK, "disableRedirect": true});
    let with = |extra: Value| {
        let mut body = base.clone();
        body.as_object_mut()
            .expect("object")
            .extend(extra.as_object().expect("object").clone());
        body
    };
    vec![
        Case {
            name: "google new verified user",
            provider: "google",
            start: base.clone(),
            before: Before::Nothing,
            token: |u| google(u, json!({})),
            query: "",
        },
        Case {
            name: "google new unverified user gets the mail",
            provider: "google",
            start: with(json!({"newUserCallbackURL": "/welcome"})),
            before: Before::Nothing,
            token: |u| {
                google(
                    u,
                    json!({"email_verified": false, "name": null, "picture": null}),
                )
            },
            query: "",
        },
        Case {
            name: "kakao without an address: the internal one",
            provider: "kakao",
            start: base.clone(),
            before: Before::Nothing,
            token: |u| kakao(u, json!({})),
            query: "",
        },
        Case {
            name: "kakao with a verified address and a nickname",
            provider: "kakao",
            start: base.clone(),
            before: Before::Nothing,
            token: |u| {
                kakao(
                    u,
                    json!({"email": format!("{u}@example.com"), "is_email_verified": true,
                                          "profile": {"nickname": "카카오닉"}}),
                )
            },
            query: "",
        },
        Case {
            name: "google links a verified local user",
            provider: "google",
            start: base.clone(),
            before: Before::LocalUser { verified: true },
            token: |u| google(u, json!({})),
            query: "",
        },
        Case {
            name: "google does not link an unverified local user",
            provider: "google",
            start: base.clone(),
            before: Before::LocalUser { verified: false },
            token: |u| google(u, json!({})),
            query: "",
        },
        Case {
            name: "google does not link with an unverified provider address",
            provider: "google",
            start: base.clone(),
            before: Before::LocalUser { verified: true },
            token: |u| google(u, json!({"email_verified": false})),
            query: "",
        },
        Case {
            name: "kakao signs in again: tokens updated",
            provider: "kakao",
            start: base.clone(),
            before: Before::SignedIn,
            token: |u| {
                let mut spec = kakao(u, json!({}));
                spec["body"]
                    .as_object_mut()
                    .expect("body")
                    .remove("refresh_token");
                spec
            },
            query: "",
        },
        Case {
            name: "the provider's error to errorCallbackURL",
            provider: "kakao",
            start: with(json!({"errorCallbackURL": "/login"})),
            before: Before::Nothing,
            token: |u| kakao(u, json!({})),
            query: "&error=access_denied&error_description=User%20denied",
        },
        Case {
            name: "a failed token exchange",
            provider: "google",
            start: with(json!({"errorCallbackURL": "http://localhost:3000/login?from=oauth"})),
            before: Before::Nothing,
            token: |_| json!({"status": 400, "body": {"error": "invalid_grant"}}),
            query: "",
        },
        Case {
            name: "a failed profile request",
            provider: "kakao",
            start: base.clone(),
            before: Before::Nothing,
            token: |_| json!({"body": {"access_token": "not-a-stub-token", "token_type": "bearer"}}),
            query: "",
        },
        Case {
            name: "no address from google",
            provider: "google",
            start: base.clone(),
            before: Before::Nothing,
            token: |u| google(u, json!({"email": null})),
            query: "",
        },
        Case {
            name: "a reserved domain from google",
            provider: "google",
            start: base.clone(),
            before: Before::Nothing,
            token: |u| google(u, json!({"email": format!("{u}@kakao.memecatch.internal")})),
            query: "",
        },
        Case {
            name: "an id_token that is not a JWT",
            provider: "google",
            start: base.clone(),
            before: Before::Nothing,
            token: |u| json!({"body": {"access_token": format!("ya29-{u}"), "id_token": "nope"}}),
            query: "",
        },
        Case {
            name: "no code",
            provider: "google",
            start: with(json!({"errorCallbackURL": "/login"})),
            before: Before::Nothing,
            token: |_| json!({}),
            query: "&code=",
        },
        Case {
            name: "an expired state",
            provider: "kakao",
            start: with(json!({"errorCallbackURL": "/login"})),
            before: Before::Expired,
            token: |u| kakao(u, json!({})),
            query: "",
        },
        Case {
            name: "an expired state row, the cookie kept",
            provider: "google",
            start: with(json!({"errorCallbackURL": "/login"})),
            before: Before::ExpiredRow,
            token: |u| google(u, json!({})),
            query: "",
        },
        Case {
            name: "a callback without the state cookie",
            provider: "google",
            start: with(json!({"errorCallbackURL": "/login"})),
            before: Before::NoCookie,
            token: |u| google(u, json!({})),
            query: "",
        },
    ]
}

/// The address a case's flow ends with.
fn email_of(case: &Case, u: &str) -> String {
    match (case.provider, case.name.contains("verified address")) {
        ("kakao", false) => format!("{}@kakao.memecatch.internal", kakao_id(u)),
        _ if case.name.contains("reserved") => format!("{u}@kakao.memecatch.internal"),
        _ => format!("{u}@example.com"),
    }
}

/// Everything compared of one run, masked.
struct Seen {
    started: String,
    answer: String,
    rows: String,
    mail: String,
    token_request: String,
    session_elsewhere: Value,
    replay: String,
    /// Whether the state's `verification` row is still there.
    state_row_left: bool,
}

async fn run(side: &Side, case: &Case, start_on: Server, finish_on: Server) -> Seen {
    let u = unique();
    let email = email_of(case, &u);
    if let Before::LocalUser { verified } = case.before {
        sqlx::query(r#"insert into public."user" (name, email, "emailVerified", "updatedAt") values ($1, $2, $3, now())"#)
            .bind(&u)
            .bind(&email)
            .bind(verified)
            .execute(&side.pool)
            .await
            .expect("a local user");
    }
    let mut body = case.start.clone();
    body["provider"] = Value::from(case.provider);
    if case.before == Before::SignedIn {
        // The first sign-in, on better-auth, with a refresh token.
        let first = side.node(&["start", &body.to_string()]);
        let (state, cookie) = state_of(&first);
        let code = code_for(kakao(&u, json!({})));
        let path = format!(
            "/callback/{}?code={}&state={state}",
            case.provider,
            urlencode(&code)
        );
        let done = side.node(&["callback", &path, &cookie]);
        assert_eq!(done["status"], 302, "{done}");
    }
    side.stub.0.lock().expect("stub").clear();
    let started = side.start(start_on, &body).await;
    assert_eq!(started["status"], 200, "{} start: {started}", case.name);
    let (state, mut cookie) = state_of(&started);
    match case.before {
        Before::Expired => {
            sqlx::query(r#"update public.verification set value = jsonb_set(value::jsonb, '{expiresAt}', '1')::text where identifier = $1"#)
                .bind(format!("auth-state:{state}"))
                .execute(&side.pool)
                .await
                .expect("expire");
        }
        Before::ExpiredRow => {
            sqlx::query(r#"update public.verification set value = jsonb_set(value::jsonb, '{expiresAt}', '1')::text, "expiresAt" = now() - interval '1 second' where identifier = $1"#)
                .bind(format!("auth-state:{state}"))
                .execute(&side.pool)
                .await
                .expect("expire the row");
        }
        Before::NoCookie => cookie.clear(),
        _ => {}
    }
    let code = code_for((case.token)(&u));
    let code = if case.query.contains("&code=") {
        String::new()
    } else {
        format!("code={}&", urlencode(&code))
    };
    let path = format!(
        "/callback/{}?{code}state={state}{}",
        case.provider, case.query
    );
    let answer = side.callback(finish_on, &path, &cookie).await;
    let other = if finish_on == Server::Node {
        Server::Rust
    } else {
        Server::Node
    };
    let session_elsewhere = match session_pair(&answer) {
        Some(pair) => side.session_email(other, &pair).await,
        None => Value::Null,
    };
    // The same callback again, on the other server.
    let replay = side.callback(other, &path, &cookie).await;
    let token_request = side.stub.last();
    let mail = Value::from(side.mailbox.to(&email.to_lowercase())).to_string();
    let rows = side.rows(&email.to_lowercase()).await;
    let state_row_left: bool = sqlx::query_scalar(
        "select exists (select 1 from public.verification where identifier = $1)",
    )
    .bind(format!("auth-state:{state}"))
    .fetch_one(&side.pool)
    .await
    .expect("state row");
    let masked = mask(
        &[
            started.to_string(),
            answer.to_string(),
            rows,
            mail,
            replay.to_string(),
            token_request,
        ],
        &u,
    );
    let [started, answer, rows, mail, replay, token_request]: [String; 6] =
        masked.try_into().expect("six");
    Seen {
        started,
        answer,
        rows,
        mail,
        token_request,
        session_elsewhere: if session_elsewhere == email.to_lowercase() {
            Value::from("<email>")
        } else {
            session_elsewhere
        },
        replay,
        state_row_left,
    }
}

fn urlencode(text: &str) -> String {
    url::form_urlencoded::byte_serialize(text.as_bytes()).collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "needs Node, node_modules and the test database"]
async fn every_case_ends_alike_whichever_server_starts_and_which_finishes() {
    let mut failures = Vec::new();
    for mode in MODES {
        let side = Side::new(mode).await;
        for case in cases() {
            let reference = run(&side, &case, Server::Node, Server::Node).await;
            for (start_on, finish_on) in
                [(Server::Node, Server::Rust), (Server::Rust, Server::Node)]
            {
                let seen = run(&side, &case, start_on, finish_on).await;
                let label = format!("{mode}: {} ({start_on:?} → {finish_on:?})", case.name);
                for (part, ours, theirs) in [
                    ("start", &seen.started, &reference.started),
                    ("answer", &seen.answer, &reference.answer),
                    ("rows", &seen.rows, &reference.rows),
                    ("mail", &seen.mail, &reference.mail),
                    (
                        "token request",
                        &seen.token_request,
                        &reference.token_request,
                    ),
                    ("replay", &seen.replay, &reference.replay),
                ] {
                    if ours != theirs {
                        failures.push(format!(
                            "{label}: {part}\n  reference: {theirs}\n  this run:  {ours}"
                        ));
                    }
                }
                if seen.state_row_left != reference.state_row_left {
                    failures.push(format!(
                        "{label}: state row left {} (reference {})",
                        seen.state_row_left, reference.state_row_left
                    ));
                }
                if seen.session_elsewhere != reference.session_elsewhere {
                    failures.push(format!(
                        "{label}: the other server read {} (reference {})",
                        seen.session_elsewhere, reference.session_elsewhere
                    ));
                }
            }
            println!("{mode}: {}: {}", case.name, reference.answer);
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}

/// PLAN.md A3-12, on purpose unlike better-auth: a state row holding a URL
/// that would send the browser off the site is refused toward the default
/// error page, whichever URL it is, with or without the state cookie, and
/// for a row Rust would otherwise leave to Next. Nothing is exchanged and
/// the row stays.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "needs Node, node_modules and the test database"]
async fn a_state_with_a_url_off_the_site_is_refused_toward_the_default_error_page() {
    let side = Side::new("production").await;
    let default = format!("{BASE}/api/auth/error?error=state_mismatch");
    let error_urls = [
        "/a/..//evil.example",
        "/..//evil.example",
        "/x/%2e%2e//evil.example",
        "//evil.example",
        "/\\evil.example",
        "/\t/evil.example",
        "%2F%2Fevil.example",
        "https://evil.example/login",
        "HtTpS://EVIL.example/login",
        "https://localhost:3000@evil.example/",
        "http://user@localhost:3000/login",
        "javascript:alert(1)",
    ];
    let page_urls = [
        "//evil.example",
        "/\\evil.example",
        "https://evil.example/",
        "HTTP://user:pw@localhost:3000/",
        "http://localhost:3000.evil.example/",
    ];
    let cases = error_urls
        .iter()
        .map(|url| ("errorURL", *url))
        .chain(page_urls.iter().map(|url| ("callbackURL", *url)))
        .chain(page_urls.iter().map(|url| ("newUserURL", *url)));
    let mut failures = Vec::new();
    for (field, url) in cases {
        for for_next in [false, true] {
            for with_cookie in [false, true] {
                let body =
                    json!({"provider": "google", "callbackURL": "/", "errorCallbackURL": "/login"});
                let started = side.start(Server::Rust, &body).await;
                assert_eq!(started["status"], 200, "{started}");
                let (state, cookie) = state_of(&started);
                let extra = if for_next { r#"{"x":1}"# } else { "{}" };
                sqlx::query(r#"update public.verification set value = (jsonb_set(value::jsonb, array[$2], to_jsonb($3::text)) || $4::jsonb)::text where identifier = $1"#)
                    .bind(format!("auth-state:{state}"))
                    .bind(field)
                    .bind(url)
                    .bind(extra)
                    .execute(&side.pool)
                    .await
                    .expect("rewrite the row");
                side.stub.0.lock().expect("stub").clear();
                let cookie = if with_cookie { cookie.as_str() } else { "" };
                let path = format!("/callback/google?code=c&state={state}");
                let answer = side.rust("GET", &path, cookie, "").await;
                let left: bool = sqlx::query_scalar(
                    "select exists (select 1 from public.verification where identifier = $1)",
                )
                .bind(format!("auth-state:{state}"))
                .fetch_one(&side.pool)
                .await
                .expect("state row");
                let label = format!("{field}={url:?} next={for_next} cookie={with_cookie}");
                if answer["status"] != 302 || answer["location"] != default.as_str() {
                    failures.push(format!("{label}: {answer}"));
                }
                if !left || !side.stub.last().is_empty() {
                    failures.push(format!(
                        "{label}: row left {left}, token request {:?}",
                        side.stub.last()
                    ));
                }
            }
        }
    }
    // better-auth on Next, given the review's row, leaves the site; dot
    // segments that stay on it are answered alike.
    let body = json!({"provider": "google", "callbackURL": "/", "errorCallbackURL": "/a/..//evil.example"});
    let started = side.start(Server::Node, &body).await;
    assert_eq!(started["status"], 200, "{started}");
    let (state, _) = state_of(&started);
    let path = format!("/callback/google?code=c&state={state}");
    assert_eq!(
        side.callback(Server::Node, &path, "").await["location"],
        "//evil.example?error=state_mismatch"
    );
    let body = json!({"provider": "google", "callbackURL": "/", "errorCallbackURL": "/a/../login"});
    for on in [Server::Node, Server::Rust] {
        let started = side.start(Server::Node, &body).await;
        assert_eq!(started["status"], 200, "{started}");
        let (state, _) = state_of(&started);
        let path = format!("/callback/google?code=c&state={state}");
        let answer = side.callback(on, &path, "").await;
        assert_eq!(
            answer["location"], "/login?error=state_mismatch",
            "{on:?}: {answer}"
        );
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
