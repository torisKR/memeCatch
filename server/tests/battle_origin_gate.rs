//! End-to-end DB + HTTP contract tests for the meme battle original-source gate:
//! - `community_meme_battle()` and `promote_community_top_memes()` only include
//!   posts backed by a live primary origin URL or a live-origin catalog meme.
//! - `POST /api/community/post` validates and stores `originSourceUrl`.
//! - `GET /api/cron/dead-link-sweep` automatically demotes community posts whose
//!   original YouTube/Instagram link went missing.
//! - `GET /` tops up thin boards only with live-origin dictionary memes.

mod common;

use std::collections::HashMap;
use std::net::SocketAddr;

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{config, database_url, send, spawn_app, spawn_router};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sqlx::AssertSqlSafe;

static DB: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const SECRET: &str = "test-only-auth-secret";
const SITE: &str = "https://memes.example";
const BEARER: &str = "Bearer test-only-cron-secret";

fn test_db() -> Db {
    Db::connect_lazy(&database_url(), 2).expect("database url")
}

async fn as_service(statements: &str) {
    let sql = statements.to_owned();
    let done: Result<(), sqlx::Error> = test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::raw_sql(AssertSqlSafe(sql))
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            },
        )
        .await;
    done.expect("service statements");
}

async fn query_strings(sql: &str) -> Vec<String> {
    let sql = sql.to_owned();
    test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move { sqlx::query_scalar(AssertSqlSafe(sql)).fetch_all(tx).await })
            },
        )
        .await
        .expect("query strings")
}

async fn reset_fixtures() {
    as_service(
        "delete from public.community_meme_promotions where post_id::text like 'b9000000-%';
         delete from public.community_posts where id::text like 'b9000000-%' or title like '[battle-gate]%';
         delete from public.meme_submissions where name like '[battle-gate]%';
         delete from public.memes where id::text like 'b9100000-%';
         delete from public.job_runs where job_name = 'dead_link_sweep';",
    )
    .await;
}

async fn signed_in_user() -> (String, String) {
    let db = test_db();
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("better-auth tables");
    let user = create_user(db.pool()).await;
    let token = create_session(db.pool(), &user, 3_600.0).await;
    (user.id, signed_cookie(PLAIN, &token, SECRET))
}

async fn stub_provider() -> SocketAddr {
    spawn_router(Router::new().fallback(|request: Request| async move {
        let uri = request.uri().clone();
        let pairs: HashMap<String, String> =
            url::form_urlencoded::parse(uri.query().unwrap_or("").as_bytes())
                .into_owned()
                .collect();
        let asked = pairs
            .get("url")
            .or_else(|| pairs.get("id"))
            .map_or("", String::as_str);
        match uri.path() {
            "/www.googleapis.com/youtube/v3/videos" => {
                let items: Vec<_> = asked
                    .split(',')
                    .filter(|id| !id.is_empty() && !id.starts_with("bgd"))
                    .map(|id| {
                        serde_json::json!({
                            "id": id,
                            "status": { "privacyStatus": "public", "embeddable": true }
                        })
                    })
                    .collect();
                (
                    StatusCode::OK,
                    serde_json::json!({ "items": items }).to_string(),
                )
            }
            "/graph.facebook.com/v25.0/instagram_oembed" => {
                if asked.contains("bgGone") {
                    (
                        StatusCode::BAD_REQUEST,
                        r#"{"error":{"message":"gone","code":24,"error_subcode":2207045}}"#
                            .to_owned(),
                    )
                } else {
                    (StatusCode::OK, r#"{"title":"live"}"#.to_owned())
                }
            }
            _ => (StatusCode::NOT_FOUND, String::new()),
        }
    }))
    .await
}

async fn spawn_test_app(provider: SocketAddr) -> SocketAddr {
    let origin = format!("http://{provider}");
    let env = [
        ("NEXT_PUBLIC_SITE_URL", SITE),
        ("CRON_SECRET", "test-only-cron-secret"),
        ("YOUTUBE_API_KEY", "test-key"),
        ("AXUM_TEST_OEMBED_ORIGIN", origin.as_str()),
        ("NODE_ENV", "development"),
    ];
    spawn_app(config(&database_url(), &env)).await
}

#[tokio::test]
async fn battle_rpc_excludes_posts_without_live_origin_and_dead_link_sweep_demotes_them() {
    let _guard = DB.lock().await;
    reset_fixtures().await;

    let long_desc = "원본 출처 게이트 검증을 위한 충분히 긴 한국어 밈 해설입니다. ".repeat(14);
    let (seed_user_id, _) = signed_in_user().await;
    let (_poster_user_id, cookie) = signed_in_user().await;

    as_service(&format!(
        "insert into public.memes (id, short_id, slug, title, summary, description, origin, usage_note, usage_examples, category, origin_year, year_precision, safety_level, lifecycle_status, moderation_status, doc_class, trend_score, published_at)
         values
           ('b9100000-0000-4000-8000-000000000001', 'bgnews01', 'bg-news-only', '[battle-gate] 뉴스만 있는 밈', '요약', '{long_desc}', '뉴스 기사에서만 소개된 표현입니다. 충분히 긴 유래 설명을 적습니다.', '가까운 사이에서 가볍게 활용할 수 있는 표현이에요. 문맥에 맞춰 사용하세요.', '[{{\"situation\":\"대화\",\"text\":\"예문 하나\"}},{{\"situation\":\"단톡\",\"text\":\"예문 둘\"}}]'::jsonb, 'phrase', 2026, 'year', 'green', 'active', 'approved', 'meme', 999.0, now()),
           ('b9100000-0000-4000-8000-000000000002', 'bglive02', 'bg-live-yt', '[battle-gate] 원본 유튜브 밈', '요약', '{long_desc}', '유튜브 원본 영상에서 시작된 챌린지 밈입니다. 충분히 긴 유래 설명을 적습니다.', '가까운 사이에서 가볍게 활용할 수 있는 표현이에요. 문맥에 맞춰 사용하세요.', '[{{\"situation\":\"대화\",\"text\":\"예문 하나\"}},{{\"situation\":\"단톡\",\"text\":\"예문 둘\"}}]'::jsonb, 'challenge', 2026, 'year', 'green', 'active', 'approved', 'meme', 998.0, now()),
           ('b9100000-0000-4000-8000-000000000003', 'bgdead03', 'bg-dead-yt', '[battle-gate] 삭제된 유튜브 밈', '요약', '{long_desc}', '삭제된 유튜브 영상만 연결된 밈입니다. 충분히 긴 유래 설명을 적습니다.', '가까운 사이에서 가볍게 활용할 수 있는 표현이에요. 문맥에 맞춰 사용하세요.', '[{{\"situation\":\"대화\",\"text\":\"예문 하나\"}},{{\"situation\":\"단톡\",\"text\":\"예문 둘\"}}]'::jsonb, 'challenge', 2026, 'year', 'green', 'active', 'approved', 'meme', 997.0, now());

         insert into public.meme_sources (meme_id, platform, source_url, title)
         values
           ('b9100000-0000-4000-8000-000000000001', 'web', 'https://www.yna.co.kr/view/AKR20260604132000011', '기사 1'),
           ('b9100000-0000-4000-8000-000000000001', 'web', 'https://view.asiae.co.kr/article/2025103021491964835', '기사 2'),
           ('b9100000-0000-4000-8000-000000000002', 'youtube', 'https://www.youtube.com/watch?v=bgl00000002', '원본 영상'),
           ('b9100000-0000-4000-8000-000000000003', 'youtube', 'https://www.youtube.com/watch?v=bgd00000003', '삭제 영상');

         insert into public.meme_contents (meme_id, type, platform, content_id, url, is_representative, availability, moderation_status)
         values
           ('b9100000-0000-4000-8000-000000000002', 'video', 'YouTube', 'bgl00000002', 'https://www.youtube.com/watch?v=bgl00000002', true, 'live', 'approved'),
           ('b9100000-0000-4000-8000-000000000003', 'video', 'YouTube', 'bgd00000003', 'https://www.youtube.com/watch?v=bgd00000003', true, 'dead', 'approved');

         insert into public.community_posts (id, user_id, title, body, meme_id, like_count, status, created_at, origin_source_url, origin_source_platform, origin_source_availability)
         values
           ('b9000000-0000-4000-8000-000000000001', '{seed_user_id}', '[battle-gate] 2차 블로그만', 'https://blog.hsad.co.kr/3788', null, 50, 'visible', now() - interval '2 minutes', null, null, 'unchecked'),
           ('b9000000-0000-4000-8000-000000000002', '{seed_user_id}', '[battle-gate] 뉴스 밈 첨부', '뉴스만 있는 밈 첨부', 'b9100000-0000-4000-8000-000000000001', 40, 'visible', now() - interval '2 minutes', null, null, 'unchecked'),
           ('b9000000-0000-4000-8000-000000000003', '{seed_user_id}', '[battle-gate] 삭제 밈 첨부', '삭제 영상 밈 첨부', 'b9100000-0000-4000-8000-000000000003', 35, 'visible', now() - interval '2 minutes', null, null, 'unchecked'),
           ('b9000000-0000-4000-8000-000000000004', '{seed_user_id}', '[battle-gate] 살아있는 밈 첨부', '원본 있는 밈 첨부', 'b9100000-0000-4000-8000-000000000002', 10, 'visible', now() - interval '2 minutes', null, null, 'unchecked'),
           ('b9000000-0000-4000-8000-000000000005', '{seed_user_id}', '[battle-gate] 유튜브 원본 생존', '생존 영상', null, 20, 'visible', now() - interval '2 minutes', 'https://www.youtube.com/watch?v=bgl00000005', 'youtube', 'unchecked'),
           ('b9000000-0000-4000-8000-000000000006', '{seed_user_id}', '[battle-gate] 유튜브 원본 곧 삭제', '곧 삭제될 영상', null, 30, 'visible', now() - interval '2 minutes', 'https://www.youtube.com/watch?v=bgd00000006', 'youtube', 'unchecked'),
           ('b9000000-0000-4000-8000-000000000007', '{seed_user_id}', '[battle-gate] 이미 죽은 원본', '이미 죽은 영상', null, 99, 'visible', now() - interval '2 minutes', 'https://www.youtube.com/watch?v=bgd00000007', 'youtube', 'dead'),
           ('b9000000-0000-4000-8000-000000000008', '{seed_user_id}', '[battle-gate] 어제 블로그만 1위', 'https://blog.hsad.co.kr/3788', null, 99, 'visible', now() - interval '1 day', null, null, 'unchecked'),
           ('b9000000-0000-4000-8000-000000000009', '{seed_user_id}', '[battle-gate] 어제 원본 1위', '원본 영상', null, 15, 'visible', now() - interval '1 day', 'https://www.youtube.com/watch?v=bgl00000009', 'youtube', 'live');"
    ))
    .await;

    // 1. Only posts 4, 5, 6 qualify for the battle (1, 2, 3, 7 are excluded).
    let before = query_strings(
        "select title from public.community_meme_battle('day', 50)
         where title like '[battle-gate]%' order by rank",
    )
    .await;
    assert_eq!(
        before,
        [
            "[battle-gate] 유튜브 원본 곧 삭제",
            "[battle-gate] 유튜브 원본 생존",
            "[battle-gate] 살아있는 밈 첨부",
        ]
    );

    // 2. HTTP API validates originSourceUrl and persists normalized values.
    let provider = stub_provider().await;
    let app = spawn_test_app(provider).await;

    let rejected = send(
        app,
        "POST",
        "/api/community/post",
        &[("cookie", cookie.as_str()), ("origin", SITE)],
        r#"{"title":"[battle-gate] 블로그 링크 거부","body":"설명","originSourceUrl":"https://blog.hsad.co.kr/3788"}"#
            .to_owned(),
    )
    .await;
    assert_eq!(rejected.status, StatusCode::OK);
    assert!(rejected.body.contains(r#""ok":false"#), "{}", rejected.body);
    assert!(
        rejected.body.contains(r#""error":"invalid_input""#),
        "{}",
        rejected.body
    );

    let accepted = send(
        app,
        "POST",
        "/api/community/post",
        &[("cookie", cookie.as_str()), ("origin", SITE)],
        r#"{"title":"[battle-gate] X 원본 참가","body":"원본 트윗","originSourceUrl":"https://twitter.com/googleespanol/status/2108271216616145112"}"#
            .to_owned(),
    )
    .await;
    assert_eq!(accepted.status, StatusCode::OK, "{}", accepted.body);
    assert!(accepted.body.contains(r#""ok":true"#), "{}", accepted.body);

    let after_post = query_strings(
        "select title from public.community_meme_battle('day', 50)
         where title like '[battle-gate]%' order by rank",
    )
    .await;
    assert!(
        after_post.contains(&"[battle-gate] X 원본 참가".to_owned()),
        "{after_post:?}"
    );

    // 3. Dead-link sweep marks b9...006 dead and removes it from the battle.
    let sweep = send(
        app,
        "GET",
        "/api/cron/dead-link-sweep",
        &[("authorization", BEARER)],
        Body::empty(),
    )
    .await;
    assert_eq!(sweep.status, StatusCode::OK, "{}", sweep.body);
    let detail: serde_json::Value = serde_json::from_str(&sweep.body).unwrap();
    assert_eq!(detail["community_posts"]["dead"], 1, "{detail}");
    assert_eq!(detail["community_posts"]["live"], 2, "{detail}");

    // 3b. Promotion uses the exact same gate and copies origin_source_url.
    let promoted = query_strings(
        "select public.promote_community_top_memes('day', now() - interval '1 day')::text",
    )
    .await;
    assert_eq!(promoted, ["1"]);
    let promoted_submissions = query_strings(
        "select name || ' | ' || coalesce(source_url, '<null>')
         from public.meme_submissions
         where name like '[battle-gate]%'",
    )
    .await;
    assert_eq!(
        promoted_submissions,
        ["[battle-gate] 어제 원본 1위 | https://www.youtube.com/watch?v=bgl00000009"]
    );

    let after_sweep = query_strings(
        "select title from public.community_meme_battle('day', 50)
         where title like '[battle-gate]%' order by rank",
    )
    .await;
    assert_eq!(
        after_sweep,
        [
            "[battle-gate] 유튜브 원본 생존",
            "[battle-gate] 살아있는 밈 첨부",
            "[battle-gate] X 원본 참가",
        ]
    );

    // 4. Home page battle recommendations exclude news-only & dead-video memes
    //    and include the live YouTube meme.
    let home = send(app, "GET", "/", &[], Body::empty()).await;
    assert_eq!(home.status, StatusCode::OK);
    let battle_idx = home.body.find("data-battle").expect("battle section");
    let battle_html = &home.body[battle_idx..];
    assert!(
        battle_html.contains("[battle-gate] 원본 유튜브 밈"),
        "expected live-origin dictionary meme in battle recommendations"
    );
    assert!(
        !battle_html.contains("[battle-gate] 뉴스만 있는 밈"),
        "news-only meme must not appear in battle recommendations"
    );
    assert!(
        !battle_html.contains("[battle-gate] 삭제된 유튜브 밈"),
        "dead-video meme must not appear in battle recommendations"
    );

    reset_fixtures().await;
}
