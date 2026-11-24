//! `GET /api/media/{...path}` over HTTP on the local-directory backend, with
//! real session rows. `parity/mpe.mjs` compares the same cases with Next;
//! `tests/storage_s3.rs` has the R2 backend.
//!
//! Only public catalogue art (`meme-thumbs/`, `meme-card-art/`) found in
//! storage is cached publicly; everything else, a user's upload, a 404 or
//! another bucket's key (an MPE frame), is `private, no-store` (PLAN.md D5-5).
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;
use std::path::Path;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{
    Reply, UNUSED_DATABASE_URL, config, database_url, get, marker_upstream, send, spawn_app,
};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};

const SECRET: &str = "test-only-auth-secret";
const STATIC_ASSET_CACHE: &str = "public, max-age=2592000, stale-while-revalidate=86400";
const PRIVATE: &str = "private, no-store";

async fn app(
    upstream: SocketAddr,
    database_url: &str,
    objects: &Path,
    extra: &[(&str, &str)],
) -> SocketAddr {
    let base = [
        (
            "LOCAL_OBJECT_STORAGE_DIR",
            objects.to_str().expect("utf-8 path"),
        ),
        ("NODE_ENV", "development"),
    ];
    spawn_app(config(upstream, database_url, &[extra, &base[..]].concat())).await
}

fn store(objects: &Path, key: &str, bytes: &str) {
    let file = objects.join(key);
    std::fs::create_dir_all(file.parent().expect("a folder")).expect("create folder");
    std::fs::write(file, bytes).expect("write object");
}

async fn get_as(app: SocketAddr, path: &str, cookie: &str) -> Reply {
    send(app, "GET", path, &[("cookie", cookie)], Body::empty()).await
}

#[tokio::test]
async fn public_objects_are_streamed_with_the_type_of_their_extension() {
    let objects = tempfile::tempdir().expect("temp dir");
    store(objects.path(), "meme-thumbs/tiktok/a.gif", "gif bytes");
    store(objects.path(), "meme-card-art/b.JPG", "jpg bytes");
    store(objects.path(), "meme-thumbs/tiktok/c.html", "<script>");
    store(objects.path(), "other/d.png", "png bytes");
    let app = app(
        marker_upstream().await,
        UNUSED_DATABASE_URL,
        objects.path(),
        &[],
    )
    .await;

    let gif = get(app, "/api/media/meme-thumbs/tiktok/a.gif").await;
    let jpg = get(app, "/api/media/meme-card-art/b.JPG").await;
    let head = send(
        app,
        "HEAD",
        "/api/media/meme-thumbs/tiktok/a.gif",
        &[],
        Body::empty(),
    )
    .await;

    assert_eq!(gif.status, StatusCode::OK);
    assert_eq!(gif.body, "gif bytes");
    assert_eq!(gif.header("content-type"), Some("image/gif"));
    assert_eq!(
        gif.header("cache-control"),
        Some("public, max-age=60, s-maxage=300")
    );
    assert_eq!(gif.header("x-content-type-options"), Some("nosniff"));
    assert_eq!(gif.header("content-length"), None);
    assert_eq!(jpg.body, "jpg bytes");
    assert_eq!(jpg.header("content-type"), Some("image/jpeg"));
    // next.config.ts replaces the header on an image path.
    assert_eq!(jpg.header("cache-control"), Some(STATIC_ASSET_CACHE));
    assert_eq!((head.status, head.body.as_str()), (StatusCode::OK, ""));
    for refused in [
        "/api/media/meme-thumbs/tiktok/c.html",
        "/api/media/meme-thumbs/tiktok/a",
        "/api/media/other/d.png",
        "/api/media/meme-thumbs/tiktok/a..gif",
        "/api/media/mpe-temporary/job/frame-0001.png",
    ] {
        let reply = get(app, refused).await;

        assert_eq!(reply.status, StatusCode::NOT_FOUND, "{refused}");
        assert_eq!(reply.body, "Not found", "{refused}");
        assert_eq!(
            reply.header("content-type"),
            Some("text/plain;charset=UTF-8")
        );
        assert_eq!(reply.header("cache-control"), Some(PRIVATE), "{refused}");
    }
}

#[tokio::test]
async fn an_upload_db_is_read_by_its_owner_or_once_a_submission_with_it_is_approved() {
    let db = Db::connect_lazy(&database_url(), 2).expect("database url");
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("auth tables");
    let owner = create_user(db.pool()).await;
    let other = create_user(db.pool()).await;
    let cookie = |token: String| signed_cookie(PLAIN, &token, SECRET);
    let owner_cookie = cookie(create_session(db.pool(), &owner, 3_600.0).await);
    let other_cookie = cookie(create_session(db.pool(), &other, 3_600.0).await);
    let objects = tempfile::tempdir().expect("temp dir");
    let private = format!("meme-uploads/{}/private.mp4", owner.id);
    let approved = format!("meme-uploads/{}/approved.png", owner.id);
    let pending = format!("meme-uploads/{}/pending.png", owner.id);
    for key in [&private, &approved, &pending] {
        store(objects.path(), key, key);
    }
    let rows = [(approved.clone(), "approved"), (pending.clone(), "pending")];
    let owner_id = owner.id.clone();
    let inserted: Result<(), sqlx::Error> = db
        .with_identity(&DbIdentity::service_role(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                for (path, status) in rows {
                    sqlx::query(
                        "insert into public.meme_submissions (submitter_id, name, attachment_path, status)
                         values ($1::uuid, 'axum-r3-test', $2, $3::submission_status)",
                    )
                    .bind(&owner_id)
                    .bind(path)
                    .bind(status)
                    .execute(&mut *tx)
                    .await?;
                }
                Ok(())
            })
        })
        .await;
    inserted.expect("insert submissions");
    let app = app(
        marker_upstream().await,
        &database_url(),
        objects.path(),
        &[],
    )
    .await;
    let path = |key: &str| format!("/api/media/{key}");

    let own = get_as(app, &path(&private), &owner_cookie).await;
    let own_image = get_as(app, &path(&pending), &owner_cookie).await;
    let signed_out = get(app, &path(&private)).await;
    let another = get_as(app, &path(&private), &other_cookie).await;
    let pending_other = get_as(app, &path(&pending), &other_cookie).await;
    let approved_public = get(app, &path(&approved)).await;

    assert_eq!(own.status, StatusCode::OK);
    assert_eq!(own.body, private);
    assert_eq!(own.header("content-type"), Some("video/mp4"));
    assert_eq!(own.header("cache-control"), Some(PRIVATE));
    // An image path is private too: Next's static-asset rule made it public
    // for 30 days (D5-5).
    assert_eq!(own_image.status, StatusCode::OK);
    assert_eq!(own_image.header("cache-control"), Some(PRIVATE));
    for refused in [signed_out, another, pending_other] {
        assert_eq!(refused.status, StatusCode::NOT_FOUND);
        assert_eq!(refused.body, "Not found");
        assert_eq!(refused.header("cache-control"), Some(PRIVATE));
    }
    // Anyone may read an approved attachment, but it stays a user's upload.
    assert_eq!(approved_public.status, StatusCode::OK);
    assert_eq!(approved_public.body, approved);
    assert_eq!(approved_public.header("cache-control"), Some(PRIVATE));
}
