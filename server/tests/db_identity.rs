//! `with_identity` against the real schema. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::time::{Duration, Instant};

use common::{closed_addr, database_url};
use memecatch_server::db::{BoxFuture, Db, DbIdentity, IdentityOptions};
use sqlx::{PgConnection, Row};

const USER_ID: &str = "7b0d4a52-6a52-4a4e-9d0b-0c2f6f0f5a11";

/// What a statement sees about who is running it.
#[derive(Debug, PartialEq, Eq)]
struct Session {
    current_user: String,
    session_user: String,
    role_setting: String,
    app_user_id: String,
    app_db_role: String,
    app_is_anonymous: String,
    claims: String,
    statement_timeout: String,
    search_path: String,
    backend_pid: i32,
}

// A custom setting that was never set reads as NULL; after a transaction-local
// value ends it reads as ''. Both mean "not set".
const SESSION_SQL: &str = "select
    current_user::text as current_user,
    session_user::text as session_user,
    current_setting('role') as role_setting,
    coalesce(current_setting('app.user_id', true), '') as app_user_id,
    coalesce(current_setting('app.db_role', true), '') as app_db_role,
    coalesce(current_setting('app.is_anonymous', true), '') as app_is_anonymous,
    coalesce(current_setting('request.jwt.claims', true), '') as claims,
    current_setting('statement_timeout') as statement_timeout,
    current_setting('search_path') as search_path,
    pg_backend_pid() as backend_pid";

async fn session(connection: &mut PgConnection) -> Result<Session, sqlx::Error> {
    let row = sqlx::query(SESSION_SQL).fetch_one(connection).await?;
    Ok(Session {
        current_user: row.get("current_user"),
        session_user: row.get("session_user"),
        role_setting: row.get("role_setting"),
        app_user_id: row.get("app_user_id"),
        app_db_role: row.get("app_db_role"),
        app_is_anonymous: row.get("app_is_anonymous"),
        claims: row.get("claims"),
        statement_timeout: row.get("statement_timeout"),
        search_path: row.get("search_path"),
        backend_pid: row.get("backend_pid"),
    })
}

/// What the `auth.*` functions that RLS policies call return.
struct Auth {
    uid: Option<String>,
    role: String,
    jwt: serde_json::Value,
}

fn session_and_auth(
    connection: &mut PgConnection,
) -> BoxFuture<'_, Result<(Session, Auth), sqlx::Error>> {
    Box::pin(async move {
        let session = session(connection).await?;
        let auth = sqlx::query(
            "select auth.uid()::text as uid, auth.role() as role, auth.jwt()::text as jwt",
        )
        .fetch_one(connection)
        .await?;
        let jwt: String = auth.get("jwt");
        let auth = Auth {
            uid: auth.get("uid"),
            role: auth.get("role"),
            jwt: serde_json::from_str(&jwt).expect("auth.jwt() is JSON"),
        };
        Ok((session, auth))
    })
}

fn db(pool_max: u32) -> Db {
    Db::connect_lazy(&database_url(), pool_max).expect("database url")
}

#[tokio::test]
async fn each_role_sees_the_identity_with_identity_sets() {
    let anonymous_user = DbIdentity {
        anonymous: true,
        ..DbIdentity::authenticated(USER_ID)
    };
    let cases = [
        (
            DbIdentity::anon(),
            "anon",
            "",
            "false",
            r#"{"role":"anon","sub":null,"is_anonymous":"false"}"#.to_owned(),
        ),
        (
            DbIdentity::authenticated(USER_ID),
            "authenticated",
            USER_ID,
            "false",
            format!(r#"{{"role":"authenticated","sub":"{USER_ID}","is_anonymous":"false"}}"#),
        ),
        (
            anonymous_user,
            "authenticated",
            USER_ID,
            "true",
            format!(r#"{{"role":"authenticated","sub":"{USER_ID}","is_anonymous":"true"}}"#),
        ),
        (
            DbIdentity::service_role(),
            "service_role",
            "",
            "false",
            r#"{"role":"service_role","sub":null,"is_anonymous":"false"}"#.to_owned(),
        ),
    ];
    let db = db(2);

    for (identity, role, user_id, is_anonymous, claims) in cases {
        let (session, auth) = db
            .with_identity(&identity, IdentityOptions::default(), session_and_auth)
            .await
            .expect("query as identity");

        assert_eq!(
            session,
            Session {
                current_user: role.to_owned(),
                session_user: "memecatch".to_owned(),
                role_setting: role.to_owned(),
                app_user_id: user_id.to_owned(),
                app_db_role: role.to_owned(),
                app_is_anonymous: is_anonymous.to_owned(),
                claims: claims.clone(),
                statement_timeout: "15s".to_owned(),
                search_path: "public, extensions".to_owned(),
                backend_pid: session.backend_pid,
            },
            "{role}"
        );
        assert_eq!(
            auth.uid.as_deref(),
            Some(user_id).filter(|id| !id.is_empty()),
            "{role}"
        );
        assert_eq!(auth.role, role);
        assert_eq!(
            auth.jwt,
            serde_json::from_str::<serde_json::Value>(&claims).unwrap()
        );
    }
}

#[tokio::test]
async fn statement_timeout_option_is_applied_and_enforced() {
    let db = db(1);
    let options = IdentityOptions {
        statement_timeout_ms: 200,
    };

    let seen = db
        .with_identity(&DbIdentity::anon(), options, |tx| Box::pin(session(tx)))
        .await
        .expect("session");
    let started = Instant::now();
    let slow: Result<(), sqlx::Error> = db
        .with_identity(&DbIdentity::anon(), options, |tx| {
            Box::pin(async move {
                sqlx::query("select pg_sleep(5)").execute(tx).await?;
                Ok(())
            })
        })
        .await;

    assert_eq!(seen.statement_timeout, "200ms");
    let error = slow.expect_err("the statement outlives its timeout");
    let code = error
        .as_database_error()
        .and_then(|e| e.code())
        .map(|c| c.into_owned());
    assert_eq!(code.as_deref(), Some("57014"), "{error}"); // query_canceled
    assert!(
        started.elapsed() < Duration::from_secs(3),
        "{:?}",
        started.elapsed()
    );
}

#[tokio::test]
async fn role_and_settings_do_not_leak_into_the_next_use_of_the_connection() {
    // One connection, so every step below reuses it.
    let db = db(1);
    let baseline = session(&mut db.pool().acquire().await.unwrap())
        .await
        .unwrap();

    let as_user = db
        .with_identity(
            &DbIdentity::authenticated(USER_ID),
            IdentityOptions::default(),
            |tx| Box::pin(session(tx)),
        )
        .await
        .unwrap();
    let after_user = session(&mut db.pool().acquire().await.unwrap())
        .await
        .unwrap();
    let as_service = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(session(tx)),
        )
        .await
        .unwrap();
    let after_service = session(&mut db.pool().acquire().await.unwrap())
        .await
        .unwrap();
    let as_anon = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(session(tx))
        })
        .await
        .unwrap();

    assert_eq!(as_user.current_user, "authenticated");
    assert_eq!(as_user.app_user_id, USER_ID);
    assert_eq!(as_service.current_user, "service_role");
    // Outside a transaction the connection is the plain login role again.
    assert_eq!(
        baseline,
        Session {
            current_user: "memecatch".to_owned(),
            session_user: "memecatch".to_owned(),
            role_setting: "none".to_owned(),
            app_user_id: String::new(),
            app_db_role: String::new(),
            app_is_anonymous: String::new(),
            claims: String::new(),
            statement_timeout: "0".to_owned(),
            search_path: baseline.search_path.clone(),
            backend_pid: baseline.backend_pid,
        }
    );
    assert_ne!(baseline.search_path, "public, extensions");
    assert_eq!(
        after_user, baseline,
        "state left behind by the authenticated transaction"
    );
    assert_eq!(
        after_service, baseline,
        "state left behind by the service_role transaction"
    );
    // The anon transaction after a user transaction carries no user.
    assert_eq!(as_anon.current_user, "anon");
    assert_eq!(as_anon.app_user_id, "");
    assert_eq!(
        as_anon.claims,
        r#"{"role":"anon","sub":null,"is_anonymous":"false"}"#
    );
    for reused in [&as_user, &as_service, &as_anon] {
        assert_eq!(
            reused.backend_pid, baseline.backend_pid,
            "not the same connection"
        );
    }
}

async fn count_memes(db: &Db, identity: &DbIdentity, short_id: &str) -> i64 {
    let short_id = short_id.to_owned();
    db.with_identity(identity, IdentityOptions::default(), |tx| {
        Box::pin(async move {
            sqlx::query_scalar("select count(*) from memes where short_id = $1")
                .bind(short_id)
                .fetch_one(tx)
                .await
        })
    })
    .await
    .expect("count memes")
}

async fn insert_pending_meme(tx: &mut PgConnection, short_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "insert into memes (short_id, title, slug, moderation_status)
         values ($1, 'with_identity test', $1, 'pending')",
    )
    .bind(short_id)
    .execute(tx)
    .await?;
    Ok(())
}

#[tokio::test]
async fn row_level_security_hides_a_pending_meme_from_anon_but_not_service_role() {
    let db = db(2);
    let service = DbIdentity::service_role();
    let short_id = format!("axum{:08x}", std::process::id());

    db.with_identity(&service, IdentityOptions::default(), |tx| {
        let short_id = short_id.clone();
        Box::pin(async move { insert_pending_meme(tx, &short_id).await })
    })
    .await
    .expect("service_role inserts a pending meme");
    let seen_by_service = count_memes(&db, &service, &short_id).await;
    let seen_by_anon = count_memes(&db, &DbIdentity::anon(), &short_id).await;
    let seen_by_user = count_memes(&db, &DbIdentity::authenticated(USER_ID), &short_id).await;
    // anon has no INSERT policy on memes: the same statement is refused.
    let anon_insert: Result<(), sqlx::Error> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move { insert_pending_meme(tx, "axumanon").await })
        })
        .await;
    db.with_identity(&service, IdentityOptions::default(), |tx| {
        let short_id = short_id.clone();
        Box::pin(async move {
            sqlx::query("delete from memes where short_id = $1")
                .bind(short_id)
                .execute(tx)
                .await
                .map(|_| ())
        })
    })
    .await
    .expect("clean up");

    assert_eq!(
        seen_by_service, 1,
        "service_role bypasses row-level security"
    );
    assert_eq!(
        seen_by_anon, 0,
        "memes_public_read hides a pending meme from anon"
    );
    assert_eq!(
        seen_by_user, 0,
        "and from a signed-in user who did not submit it"
    );
    assert!(
        anon_insert.is_err(),
        "anon must not be able to insert a meme"
    );
}

#[tokio::test]
async fn an_error_from_the_closure_rolls_the_transaction_back() {
    let db = db(2);
    let service = DbIdentity::service_role();
    let short_id = format!("axrb{:08x}", std::process::id());

    let result: Result<(), sqlx::Error> = db
        .with_identity(&service, IdentityOptions::default(), |tx| {
            let short_id = short_id.clone();
            Box::pin(async move {
                insert_pending_meme(tx, &short_id).await?;
                Err(sqlx::Error::RowNotFound)
            })
        })
        .await;

    assert!(matches!(result, Err(sqlx::Error::RowNotFound)));
    assert_eq!(count_memes(&db, &service, &short_id).await, 0);
}

#[tokio::test]
async fn deadline_variant_uses_a_1500_ms_statement_timeout() {
    let seen = db(1)
        .with_identity_deadline(&DbIdentity::anon(), |tx| Box::pin(session(tx)))
        .await
        .expect("session");

    assert_eq!(seen.current_user, "anon");
    assert_eq!(seen.statement_timeout, "1500ms");
    assert_eq!(seen.search_path, "public, extensions");
}

#[tokio::test]
async fn deadline_variant_gives_up_after_1500_ms_when_the_database_is_unreachable() {
    let dead_database = format!(
        "postgresql://memecatch:unused@{}/memecatch",
        closed_addr().await
    );
    let db = Db::connect_lazy(&dead_database, 1).unwrap();
    let started = Instant::now();

    let result: Result<Session, sqlx::Error> = db
        .with_identity_deadline(&DbIdentity::anon(), |tx| Box::pin(session(tx)))
        .await;

    assert!(result.is_err());
    assert!(
        started.elapsed() < Duration::from_secs(3),
        "{:?}",
        started.elapsed()
    );
}

// Handlers must be `Send`; this fails to compile if the `with_identity`
// future is not.
#[tokio::test]
async fn with_identity_works_inside_an_axum_handler() {
    use axum::extract::State;
    use axum::routing::get;
    use http_body_util::BodyExt;

    async fn visible_memes(State(db): State<Db>) -> String {
        db.with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, i64>("select count(*) from memes")
                    .fetch_one(tx)
                    .await
            })
        })
        .await
        .map_or_else(
            |error: sqlx::Error| error.to_string(),
            |count| count.to_string(),
        )
    }
    let app = common::spawn_router(
        axum::Router::new()
            .route("/count", get(visible_memes))
            .with_state(db(1)),
    )
    .await;

    let response = common::client()
        .get(format!("http://{app}/count").parse().unwrap())
        .await
        .expect("response");

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let count = std::str::from_utf8(&body).unwrap().parse::<i64>();
    assert!(count.is_ok(), "expected a row count, got {body:?}");
}
