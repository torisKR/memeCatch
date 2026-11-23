//! The R2 backend against a real S3 server.
//!
//! Each test starts Versity S3 Gateway in Docker with keys made up for that
//! run, bound to localhost, and removes it afterwards. The gateway checks the
//! SigV4 signature of every request (`a_wrong_secret_is_refused`), so these
//! tests fail if the signing is wrong. Needs Docker. Nothing here contacts
//! Cloudflare. (MinIO no longer publishes images.)

mod common;

use axum::body::{Body, Bytes};
use axum::extract::Request;
use axum::http::StatusCode;
use common::s3::S3Server;
use http_body_util::BodyExt;
use memecatch_server::storage::{ListEntry, Storage, StorageError};
use memecatch_server::{AppState, build_app};

fn folder(name: &str) -> ListEntry {
    ListEntry {
        name: name.to_owned(),
        id: None,
        created_at: None,
    }
}

/// Checks the file entries by name and the shape of their timestamps, which
/// the server assigns.
fn assert_entries(listed: &[ListEntry], folders: &[&str], files: &[&str]) {
    let expected_folders: Vec<ListEntry> = folders.iter().map(|name| folder(name)).collect();
    assert_eq!(&listed[..folders.len()], expected_folders, "{listed:?}");
    let listed_files = &listed[folders.len()..];
    let names: Vec<&str> = listed_files
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();
    assert_eq!(names, files, "{listed:?}");
    for entry in listed_files {
        assert_eq!(entry.id.as_ref(), Some(&entry.name));
        let created_at = entry.created_at.as_deref().expect("created_at");
        // 2026-11-23T08:02:11.123Z
        assert!(
            created_at.len() >= 20 && created_at.ends_with('Z') && created_at.contains('T'),
            "{created_at}"
        );
    }
}

#[tokio::test]
async fn put_then_get_returns_the_same_bytes_and_content_type() {
    let server = S3Server::start().await;
    let storage = server.storage();
    let image = Bytes::from((0..=255u8).cycle().take(70_000).collect::<Vec<u8>>());

    storage
        .put("uploads", "2026/11/a.png", image.clone(), Some("image/png"))
        .await
        .unwrap();
    storage
        .put(
            "uploads",
            "plain.bin",
            Bytes::from_static(b"\x00\x01"),
            None,
        )
        .await
        .unwrap();
    storage
        .put(
            "uploads",
            "empty.txt",
            Bytes::new(),
            Some("text/plain; charset=utf-8"),
        )
        .await
        .unwrap();

    let stored = storage
        .get("uploads", "2026/11/a.png")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(stored.bytes, image);
    assert_eq!(stored.content_type, "image/png");
    let stored = storage.get("uploads", "plain.bin").await.unwrap().unwrap();
    assert_eq!(stored.bytes, &b"\x00\x01"[..]);
    assert_eq!(stored.content_type, "application/octet-stream");
    let stored = storage.get("uploads", "empty.txt").await.unwrap().unwrap();
    assert_eq!(stored.bytes, "");
    assert_eq!(stored.content_type, "text/plain; charset=utf-8");
}

#[tokio::test]
async fn put_replaces_an_existing_object_and_its_content_type() {
    let server = S3Server::start().await;
    let storage = server.storage();
    storage
        .put(
            "uploads",
            "a",
            Bytes::from_static(b"first, longer"),
            Some("text/plain"),
        )
        .await
        .unwrap();

    storage
        .put(
            "uploads",
            "a",
            Bytes::from_static(b"{}"),
            Some("application/json"),
        )
        .await
        .unwrap();

    let stored = storage.get("uploads", "a").await.unwrap().unwrap();
    assert_eq!(stored.bytes, "{}");
    assert_eq!(stored.content_type, "application/json");
}

#[tokio::test]
async fn list_returns_objects_and_folders_including_a_nested_prefix() {
    let server = S3Server::start().await;
    let storage = server.storage();
    for name in [
        "b.txt",
        "a.txt",
        "2026/11/clip.mp4",
        "2026/11/thumb.png",
        "2026/12/deeper/still/c.txt",
        "2026/top.txt",
    ] {
        storage
            .put("uploads", name, Bytes::from_static(b"x"), None)
            .await
            .unwrap();
    }
    storage
        .put("other", "elsewhere.txt", Bytes::from_static(b"x"), None)
        .await
        .unwrap();

    // Folders first, then objects, each in key order; names without the path.
    assert_entries(
        &storage.list("uploads", "").await.unwrap(),
        &["2026"],
        &["a.txt", "b.txt"],
    );
    assert_entries(
        &storage.list("uploads", "2026").await.unwrap(),
        &["11", "12"],
        &["top.txt"],
    );
    assert_entries(
        &storage.list("uploads", "2026/11").await.unwrap(),
        &[],
        &["clip.mp4", "thumb.png"],
    );
    assert_entries(
        &storage.list("uploads", "/2026//12/deeper/").await.unwrap(),
        &["still"],
        &[],
    );
    assert_entries(
        &storage.list("other", "").await.unwrap(),
        &[],
        &["elsewhere.txt"],
    );
    assert_eq!(storage.list("uploads", "missing").await.unwrap(), []);
    assert_eq!(storage.list("no-such-bucket", "").await.unwrap(), []);
    // A prefix is a folder, not the start of a name.
    assert_eq!(storage.list("uploads", "2026/1").await.unwrap(), []);
}

#[tokio::test]
async fn delete_removes_the_object_and_accepts_a_missing_one() {
    let server = S3Server::start().await;
    let storage = server.storage();
    for name in ["dir/a.txt", "dir/b.txt"] {
        storage
            .put("uploads", name, Bytes::from_static(b"x"), None)
            .await
            .unwrap();
    }

    storage.delete("uploads", "dir/a.txt").await.unwrap();

    assert_eq!(storage.get("uploads", "dir/a.txt").await.unwrap(), None);
    assert_entries(
        &storage.list("uploads", "dir").await.unwrap(),
        &[],
        &["b.txt"],
    );
    storage.delete("uploads", "dir/a.txt").await.unwrap();
    storage.delete("uploads", "never/was.txt").await.unwrap();
}

#[tokio::test]
async fn get_of_a_missing_key_is_none() {
    let server = S3Server::start().await;
    let storage = server.storage();
    storage
        .put("uploads", "dir/a.txt", Bytes::from_static(b"x"), None)
        .await
        .unwrap();

    assert_eq!(storage.get("uploads", "missing.txt").await.unwrap(), None);
    assert_eq!(storage.get("uploads", "dir/a").await.unwrap(), None);
    assert_eq!(
        storage.get("no-such-bucket", "dir/a.txt").await.unwrap(),
        None
    );
    assert_eq!(
        storage
            .read_signed_object("uploads/missing.txt")
            .await
            .unwrap(),
        None
    );
}

#[tokio::test]
async fn a_wrong_secret_is_refused() {
    let server = S3Server::start().await;
    server
        .storage()
        .put("uploads", "a.txt", Bytes::from_static(b"x"), None)
        .await
        .unwrap();
    let wrong = Storage::with_r2_endpoint(&server.config("not-the-secret"), &server.endpoint)
        .expect("storage");
    let forbidden = |error: &StorageError| matches!(error, StorageError::Status(status) if *status == StatusCode::FORBIDDEN);

    let got = wrong.get("uploads", "a.txt").await.unwrap_err();
    assert!(forbidden(&got), "{got:?}");
    let put = wrong
        .put("uploads", "b.txt", Bytes::from_static(b"x"), None)
        .await
        .unwrap_err();
    assert!(forbidden(&put), "{put:?}");
    let listed = wrong.list("uploads", "").await.unwrap_err();
    assert!(forbidden(&listed), "{listed:?}");
    // The TypeScript ignores the status of a DELETE; the object must survive.
    wrong.delete("uploads", "a.txt").await.unwrap();
    assert!(
        server
            .storage()
            .get("uploads", "a.txt")
            .await
            .unwrap()
            .is_some()
    );
    assert_eq!(
        server.storage().get("uploads", "b.txt").await.unwrap(),
        None
    );
}

#[tokio::test]
async fn the_signed_route_serves_an_object_from_r2_with_its_content_type() {
    let server = S3Server::start().await;
    let storage = server.storage();
    storage
        .put(
            "uploads",
            "2026/a.png",
            Bytes::from_static(b"png bytes"),
            Some("image/png"),
        )
        .await
        .unwrap();
    let mut state = AppState::new(server.config(&server.secret_key)).expect("app state");
    state.storage = storage.clone();
    let app = common::spawn_router(build_app(state)).await;
    let get = async |url: String| {
        let path = url.split_once("/api/").expect("path").1.to_owned();
        let request = Request::builder()
            .uri(format!("http://{app}/api/{path}"))
            .body(Body::empty())
            .unwrap();
        let response = common::client().request(request).await.expect("response");
        let (parts, body) = response.into_parts();
        (parts, body.collect().await.expect("body").to_bytes())
    };

    let (head, body) = get(storage
        .signed_object_url("uploads", "2026/a.png", 60)
        .unwrap())
    .await;
    assert_eq!(head.status, StatusCode::OK);
    assert_eq!(head.headers.get("content-type").unwrap(), "image/png");
    assert_eq!(
        head.headers.get("cache-control").unwrap(),
        "private, max-age=60"
    );
    assert_eq!(body, "png bytes");

    let (head, body) = get(storage
        .signed_object_url("uploads", "2026/no.png", 60)
        .unwrap())
    .await;
    assert_eq!(head.status, StatusCode::NOT_FOUND);
    assert_eq!(body, r#"{"message":"missing"}"#);
}

#[tokio::test]
async fn the_media_route_streams_an_object_from_r2_and_answers_404_itself() {
    let server = S3Server::start().await;
    let storage = server.storage();
    // The stored type is HTML; the route answers with the type of the extension.
    storage
        .put(
            "meme-thumbs",
            "tiktok/a.gif",
            Bytes::from_static(b"gif bytes"),
            Some("text/html"),
        )
        .await
        .unwrap();
    let mut state = AppState::new(server.config(&server.secret_key)).expect("app state");
    state.storage = storage;
    let app = common::spawn_router(build_app(state)).await;

    let stored = common::get(app, "/api/media/meme-thumbs/tiktok/a.gif").await;
    let missing = common::get(app, "/api/media/meme-thumbs/tiktok/no.gif").await;
    let image = common::get(app, "/api/media/meme-card-art/no.png").await;

    assert_eq!(stored.status, StatusCode::OK);
    assert_eq!(stored.body, "gif bytes");
    assert_eq!(stored.header("content-type"), Some("image/gif"));
    assert_eq!(
        stored.header("cache-control"),
        Some("public, max-age=60, s-maxage=300")
    );
    assert_eq!(stored.header("x-content-type-options"), Some("nosniff"));
    // With R2 both servers read one bucket, so a missing object is a 404 here.
    assert_eq!(missing.status, StatusCode::NOT_FOUND);
    assert_eq!(missing.body, "Not found");
    assert_eq!(missing.header("cache-control"), None);
    // next.config.ts gives an image path its static-asset cache header.
    assert_eq!(
        image.header("cache-control"),
        Some("public, max-age=2592000, stale-while-revalidate=86400")
    );
}
