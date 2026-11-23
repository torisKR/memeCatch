//! `/api/memes/view` and `/api/analytics/events`.

use super::*;

const ACCEPTED: &str = r#"{"ok":true}"#;
const RATE_LIMITED: &str = r#"{"ok":false,"error":"rate_limited"}"#;
const SITE: (&str, &str) = ("origin", SITE_URL);

fn meme_id(number: u32) -> String {
    format!("00000000-0000-4000-b000-{number:012}")
}

async fn seed_memes(db: &Db) {
    remove_memes(db).await;
    execute(
        db,
        "insert into public.memes (id, short_id, slug, title, moderation_status)
         select ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid,
                'r2v' || lpad(n::text, 5, '0'), 'axum-r2-view-' || n, '조회 밈 ' || n, 'approved'
           from generate_series(1, 2) n;"
            .to_owned(),
    )
    .await;
}

/// Deleting a meme deletes its views.
async fn remove_memes(db: &Db) {
    execute(
        db,
        "delete from public.memes where slug like 'axum-r2-view-%';".to_owned(),
    )
    .await;
}

fn hex_hmac(message: &str) -> String {
    hex::encode(hmac_sha256(SIGNING_SECRET.as_bytes(), message.as_bytes()))
}

/// The session hashes of a meme's views, and the day each was counted on.
async fn views(db: &Db, meme: &str) -> Vec<(String, bool)> {
    rows(
        db,
        format!(
            "select session_hash, viewed_on = (now() at time zone 'Asia/Seoul')::date
               from public.view_events where meme_id = '{meme}' order by id"
        ),
    )
    .await
}

/// Today's date in Korea, from the database.
async fn korean_day(db: &Db) -> String {
    let day: Vec<(String,)> = rows(
        db,
        "select (now() at time zone 'Asia/Seoul')::date::text".to_owned(),
    )
    .await;
    day[0].0.clone()
}

#[tokio::test]
async fn view_db_counts_one_view_per_viewer_and_day_under_a_keyed_hash() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    seed_memes(&db).await;
    let (meme, other) = (meme_id(1), meme_id(2));
    let (ip, second_ip) = (unique_ip(), unique_ip());
    let session = "d5e11666-1ae9-4084-96f6-4c37f5e577b5";
    let cookie = growth_cookie(session);
    let body = format!(r#"{{"memeId":"{meme}"}}"#);
    let view = |headers: Vec<(&'static str, String)>, body: String| async move {
        let headers: Vec<(&str, &str)> = headers
            .iter()
            .map(|(name, value)| (*name, value.as_str()))
            .collect();
        post(app, "/api/memes/view", &headers, &body).await
    };

    let day = korean_day(&db).await;
    let by_address = view(vec![("x-forwarded-for", ip.clone())], body.clone()).await;
    let again = view(
        vec![
            ("x-forwarded-for", format!("{ip}, 10.0.0.1")),
            ("origin", SITE_URL.to_owned()),
        ],
        body.to_uppercase().replace("MEMEID", "memeId"),
    )
    .await;
    let by_text = view(
        vec![("x-forwarded-for", " not an address ".to_owned())],
        body.clone(),
    )
    .await;
    let by_session = view(
        vec![("x-forwarded-for", ip.clone()), ("cookie", cookie.clone())],
        body.clone(),
    )
    .await;
    let session_elsewhere = view(
        vec![
            ("x-forwarded-for", second_ip.clone()),
            ("cookie", format!("a=1; {cookie}")),
        ],
        body.clone(),
    )
    .await;
    let forged = view(
        vec![
            ("x-forwarded-for", second_ip.clone()),
            ("cookie", format!("{cookie}x")),
        ],
        body.clone(),
    )
    .await;
    let other_meme = view(
        vec![("x-forwarded-for", ip.clone())],
        format!(r#"{{"x":1,"memeId":"{other}"}}"#),
    )
    .await;
    let unknown_meme = view(
        vec![("x-forwarded-for", ip.clone())],
        format!(r#"{{"memeId":"{}"}}"#, meme_id(999)),
    )
    .await;
    let recorded = views(&db, &meme).await;
    let recorded_other = views(&db, &other).await;
    let same_day = korean_day(&db).await == day;
    remove_memes(&db).await;

    for reply in [
        &by_address,
        &again,
        &by_text,
        &by_session,
        &session_elsewhere,
        &forged,
        &other_meme,
    ] {
        assert_eq!(reply.status, StatusCode::ACCEPTED, "{}", reply.body);
        assert_eq!(reply.body, ACCEPTED);
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(reply.header("cache-control"), None);
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
    }
    assert_eq!(unknown_meme.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(
        unknown_meme.body,
        r#"{"ok":false,"error":"view_unavailable"}"#
    );
    if !same_day {
        return; // The run crossed midnight in Korea: the keys span two days.
    }
    // HMAC-SHA256 of "<day>\0<viewer>" under the signing secret: one row per
    // viewer, whatever the request looked like.
    let key = |viewer: &str| (hex_hmac(&format!("{day}\0{viewer}")), true);
    assert_eq!(
        recorded,
        vec![
            key(&format!("network:{ip}")),
            key("network:not an address"),
            key(&format!("session:{session}")),
            key(&format!("network:{second_ip}")),
        ]
    );
    assert_eq!(recorded_other, vec![key(&format!("network:{ip}"))]);
}

#[tokio::test]
async fn view_refuses_oversized_bodies_and_the_121st_request_of_a_minute() {
    // No database: a view that got as far as the function would wait on it.
    let app = app_without_db(closed_addr().await, &[]).await;
    let ip = unique_ip();
    let from = [("x-forwarded-for", ip.as_str())];
    let padded = |bytes: usize| {
        let base = r#"{"memeId":1,"p":""}"#.len();
        format!(r#"{{"memeId":1,"p":"{}"}}"#, "x".repeat(bytes - base))
    };
    let chunked = |text: String| {
        Body::from_stream(futures_util::stream::iter([Ok::<
            _,
            std::convert::Infallible,
        >(text)]))
    };

    let at_limit = post(app, "/api/memes/view", &from, &padded(128)).await;
    let declared = post(app, "/api/memes/view", &from, &padded(129)).await;
    let streamed = send(app, "POST", "/api/memes/view", &from, chunked(padded(129))).await;
    let marked = send(
        app,
        "POST",
        "/api/memes/view",
        &from,
        chunked(format!("\u{feff}{}", padded(128))),
    )
    .await;
    let grows = send(
        app,
        "POST",
        "/api/memes/view",
        &from,
        Body::from([&br#"{"p":""#[..], &[0xff; 54], br#""}"#].concat()),
    )
    .await;
    for request in 6..=120 {
        let reply = post(app, "/api/memes/view", &from, "{}").await;
        assert_eq!(reply.status, StatusCode::BAD_REQUEST, "request {request}");
    }
    let over_limit = post(app, "/api/memes/view", &from, "{}").await;
    let via_proxy = post(
        app,
        "/api/memes/view",
        &[("x-forwarded-for", format!("{ip}, 10.0.0.1").as_str())],
        "{}",
    )
    .await;
    let another = post(
        app,
        "/api/memes/view",
        &[("x-forwarded-for", unique_ip().as_str())],
        "{}",
    )
    .await;

    // 128 bytes pass the size checks (and fail on the meme id); a byte order
    // mark does not count when no length was declared.
    for reply in [&at_limit, &marked] {
        assert_eq!(reply.status, StatusCode::BAD_REQUEST);
        assert_eq!(reply.body, r#"{"ok":false,"error":"invalid_meme"}"#);
    }
    for reply in [&declared, &streamed, &grows] {
        assert_eq!(reply.status, StatusCode::PAYLOAD_TOO_LARGE);
        assert_eq!(reply.body, r#"{"ok":false,"error":"payload_too_large"}"#);
    }
    for reply in [&over_limit, &via_proxy] {
        assert_eq!(reply.status, StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(reply.body, RATE_LIMITED);
        assert!(about_a_minute(reply), "{:?}", reply.header("retry-after"));
    }
    assert_eq!(another.status, StatusCode::BAD_REQUEST);
}

/// `Retry-After` of a request refused right after the window began: 60 s,
/// or 59 when the requests before it took more than a second.
fn about_a_minute(reply: &Reply) -> bool {
    matches!(reply.header("retry-after"), Some("59" | "60"))
}

type EventRow = (
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    String,
    String,
    i64,
);

/// The events of a session: name, source, session, user, meme, surface,
/// format, locale, path, dedupe key, metadata, and the minute it happened in.
async fn events_of(db: &Db, session: &str) -> Vec<EventRow> {
    rows(
        db,
        format!(
            "select event_name, source, session_id::text, user_id::text, meme_id::text, surface,
                    format, locale, path, dedupe_key, metadata::text,
                    floor(extract(epoch from occurred_at) / 60)::bigint
               from public.growth_events where session_id = '{session}' order by created_at, id"
        ),
    )
    .await
}

/// The limiter rows of the sessions stay: only the function may touch that
/// table, and it prunes them itself after a day.
async fn remove_events(db: &Db, sessions: &[&str]) {
    let list = sessions
        .iter()
        .map(|session| format!("'{session}'"))
        .collect::<Vec<_>>()
        .join(", ");
    execute(
        db,
        format!("delete from public.growth_events where session_id in ({list});"),
    )
    .await;
}

#[tokio::test]
async fn events_db_records_the_event_with_the_fields_and_key_of_the_typescript() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    seed_memes(&db).await;
    let user = sign_in(&db).await;
    let session = new_uuid(&db).await;
    let session = session.as_str();
    let ip = unique_ip();
    let meme = meme_id(1);
    let cookies = format!("{}; {}", growth_cookie(session), user.cookie);
    let headers = [
        SITE,
        ("x-forwarded-for", ip.as_str()),
        ("cookie", cookies.as_str()),
    ];
    let rich = format!(
        r#"{{"eventName":"share_click","path":"  /memes/x  ","params":{{"meme_id":" {meme} ","surface":" detail ","format":"card","locale":"ko-KR-x-very-long","channel":"kakao","score":-0,"item_count":1e21,"position":2,"mode":true,"unknown":"x","channel":" last wins "}}}}"#
    );
    // The path is the identity of this one: its key is cut at 220 units,
    // through the pair. The surface of the next is cut at 80, likewise.
    let long_path = format!(
        r#"{{"eventName":"copy","path":"{}😀-tail"}}"#,
        "k".repeat(170)
    );
    let cut_surface = format!(
        r#"{{"eventName":"paywall_view","params":{{"surface":"{}😀"}}}}"#,
        "s".repeat(79)
    );

    let first = post(app, "/api/analytics/events", &headers, &rich).await;
    let repeat = post(app, "/api/analytics/events", &headers, &rich).await;
    let truncated = post(app, "/api/analytics/events", &headers, &long_path).await;
    let surface = post(app, "/api/analytics/events", &headers, &cut_surface).await;
    let recorded = events_of(&db, session).await;
    remove_events(&db, &[session]).await;
    remove_memes(&db).await;

    for reply in [&first, &repeat, &truncated, &surface] {
        assert_eq!(reply.status, StatusCode::ACCEPTED, "{}", reply.body);
        assert_eq!(reply.body, ACCEPTED);
        // The request carried a valid session cookie: none is set.
        assert_eq!(reply.header("set-cookie"), None);
    }
    // The repeat had the same dedupe key and wrote no second row.
    assert_eq!(recorded.len(), 3, "{recorded:?}");
    let minute = recorded[0].11;
    assert_eq!(
        recorded[0],
        (
            "share_click".to_owned(),
            "client".to_owned(),
            session.to_owned(),
            Some(user.id.clone()),
            Some(meme.clone()),
            Some("detail".to_owned()),
            Some("card".to_owned()),
            Some("ko-KR-x-very".to_owned()),
            Some("/memes/x".to_owned()),
            format!("client:{session}:share_click:{meme}:{minute}"),
            format!(
                r#"{{"score": 0, "channel": "last wins", "meme_id": "{meme}", "position": 2, "item_count": 1000000000000000000000}}"#
            ),
            minute,
        )
    );
    // Cuts count UTF-16 units; half a surrogate pair reaches Postgres as U+FFFD.
    assert_eq!(recorded[1].8, Some(format!("{}😀-tail", "k".repeat(170))));
    assert_eq!(
        recorded[1].9,
        format!("client:{session}:copy:{}\u{fffd}", "k".repeat(170))
    );
    assert_eq!(recorded[1].9.encode_utf16().count(), 220);
    assert_eq!(recorded[1].10, "{}");
    assert_eq!(recorded[2].5, Some(format!("{}\u{fffd}", "s".repeat(79))));
    assert_eq!(
        recorded[2].9,
        format!(
            "client:{session}:paywall_view:{}\u{fffd}:{}",
            "s".repeat(79),
            recorded[2].11
        )
    );
}

#[tokio::test]
async fn events_db_start_a_session_for_a_request_without_one() {
    let db = test_db();
    let app = app_with_db().await;
    let ip = unique_ip();
    let from = ("x-forwarded-for", ip.as_str());
    let body = r#"{"eventName":"quiz_start","path":"/quiz"}"#;

    let plain = post(app, "/api/analytics/events", &[SITE, from], body).await;
    let https = post(
        app,
        "/api/analytics/events",
        &[SITE, from, ("x-forwarded-proto", "https")],
        body,
    )
    .await;
    let issued = |reply: &Reply| {
        let cookie = reply.header("set-cookie").expect("a session cookie");
        let (token, attributes) = cookie.split_once(';').expect("attributes");
        (token.to_owned(), attributes.to_owned())
    };
    let (token, attributes) = issued(&plain);
    let (secure_token, secure_attributes) = issued(&https);
    let session = token["mc_growth_session=".len()..][..36].to_owned();
    let reused = post(
        app,
        "/api/analytics/events",
        &[SITE, from, ("cookie", token.as_str())],
        r#"{"eventName":"quiz_complete"}"#,
    )
    .await;
    let recorded = events_of(&db, &session).await;
    let secure_session = secure_token["mc_growth_session=".len()..][..36].to_owned();
    remove_events(&db, &[&session, &secure_session]).await;

    assert_eq!(plain.status, StatusCode::ACCEPTED);
    assert_eq!(https.status, StatusCode::ACCEPTED);
    // The cookie is the one lib/growth/events.server.ts would issue for the
    // session, so Next accepts it.
    assert_eq!(token, growth_cookie(&session));
    assert_eq!(
        attributes,
        " Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax"
    );
    assert_eq!(
        secure_attributes,
        " Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure"
    );
    assert_ne!(token, secure_token);
    assert_eq!(reused.status, StatusCode::ACCEPTED);
    assert_eq!(reused.header("set-cookie"), None);
    let names: Vec<&str> = recorded.iter().map(|row| row.0.as_str()).collect();
    assert_eq!(names, ["quiz_start", "quiz_complete"]);
    // Signed out: no user on the row.
    assert_eq!(recorded[0].3, None);
}

/// The current minute, from the database: its limits are per minute.
async fn database_minute(db: &Db) -> String {
    let minute: Vec<(String,)> = rows(
        db,
        "select date_trunc('minute', statement_timestamp())::text".to_owned(),
    )
    .await;
    minute[0].0.clone()
}

#[tokio::test]
async fn events_db_answer_429_at_the_database_limit_and_500_when_the_function_fails() {
    let db = test_db();
    // Two servers, as Next and Axum are: each counts a session's events on
    // its own, and the database counts them together.
    let (app, other_app) = (app_with_db().await, app_with_db().await);
    let session = new_uuid(&db).await;
    let cookie = growth_cookie(&session);
    let ip = unique_ip();
    let headers = [
        SITE,
        ("x-forwarded-for", ip.as_str()),
        ("cookie", cookie.as_str()),
    ];
    let event = |n: usize| format!(r#"{{"eventName":"copy","path":"/limit-{n}"}}"#);

    let minute = database_minute(&db).await;
    for n in 0..60 {
        let server = if n % 2 == 0 { app } else { other_app };
        let reply = post(server, "/api/analytics/events", &headers, &event(n)).await;
        assert_eq!(
            reply.status,
            StatusCode::ACCEPTED,
            "event {n}: {}",
            reply.body
        );
    }
    // This server has seen 30 of the 60: only the database can refuse.
    let limited = post(app, "/api/analytics/events", &headers, &event(60)).await;
    let same_minute = database_minute(&db).await == minute;
    let recorded = events_of(&db, &session).await.len();
    remove_events(&db, &[&session]).await;

    // A meme that does not exist: the insert fails on its foreign key.
    let failing_session = new_uuid(&db).await;
    let failing_cookie = growth_cookie(&failing_session);
    let failing_headers = [
        SITE,
        ("x-forwarded-for", ip.as_str()),
        ("cookie", failing_cookie.as_str()),
    ];
    let unknown_meme = post(
        app,
        "/api/analytics/events",
        &failing_headers,
        &format!(
            r#"{{"eventName":"copy","params":{{"meme_id":"{}"}}}}"#,
            meme_id(999)
        ),
    )
    .await;
    // Half a surrogate pair in the metadata is an escape Postgres refuses.
    let half_pair = post(
        app,
        "/api/analytics/events",
        &failing_headers,
        &format!(
            r#"{{"eventName":"copy","params":{{"result":"{}😀"}}}}"#,
            "x".repeat(99)
        ),
    )
    .await;
    let after_failures = events_of(&db, &failing_session).await;

    if same_minute {
        assert_eq!(limited.status, StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(limited.body, RATE_LIMITED);
        // The fixed value of the route, not a time computed by this server.
        assert_eq!(limited.header("retry-after"), Some("60"));
        assert_eq!(limited.header("set-cookie"), None);
        assert_eq!(recorded, 60);
    }
    for reply in [unknown_meme, half_pair] {
        assert_eq!(reply.status, StatusCode::INTERNAL_SERVER_ERROR);
        // As Next answers a route that threw: no body and no content type.
        assert_eq!(reply.body, "");
        assert_eq!(reply.header("content-type"), None);
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
    }
    assert_eq!(after_failures, Vec::new());
}

#[tokio::test]
async fn events_limit_an_address_to_120_and_a_session_to_60_a_minute() {
    // No database: every request here is refused before the function call.
    let app = app_without_db(closed_addr().await, &[]).await;
    let ip = unique_ip();
    let from = ("x-forwarded-for", ip.as_str());
    let cookie = growth_cookie("2c3d4e5f-6071-4c8d-ae9f-23456789abcd");

    for request in 1..=120 {
        let reply = post(app, "/api/analytics/events", &[SITE, from], "{").await;
        assert_eq!(reply.status, StatusCode::BAD_REQUEST, "request {request}");
    }
    let address_limited = post(app, "/api/analytics/events", &[SITE, from], "{").await;
    // The same session from sixty other addresses, then once more.
    for request in 1..=60 {
        let other = unique_ip();
        let headers = [
            SITE,
            ("x-forwarded-for", other.as_str()),
            ("cookie", cookie.as_str()),
        ];
        let reply = post(app, "/api/analytics/events", &headers, "{").await;
        assert_eq!(reply.status, StatusCode::BAD_REQUEST, "request {request}");
    }
    let other = unique_ip();
    let session_limited = post(
        app,
        "/api/analytics/events",
        &[
            SITE,
            ("x-forwarded-for", other.as_str()),
            ("cookie", cookie.as_str()),
        ],
        "{",
    )
    .await;

    for reply in [address_limited, session_limited] {
        assert_eq!(reply.status, StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(reply.body, RATE_LIMITED);
        assert!(about_a_minute(&reply), "{:?}", reply.header("retry-after"));
        assert_eq!(reply.header("set-cookie"), None);
    }
}
