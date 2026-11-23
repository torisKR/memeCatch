//! Signed URLs, key rules and R2 requests, compared with what
//! `lib/object-storage.ts` produces.
//!
//! `fixtures/object-storage-ts.json` is the output of
//! `node server/parity/storage-parity.mjs fixture`, which runs the real
//! TypeScript module with a fixed clock. `parity/storage-parity.sh` regenerates
//! it and fails if the committed copy is out of date.

mod common;

use std::collections::BTreeMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Bytes;
use axum::extract::Request;
use memecatch_server::config::Config;
use memecatch_server::storage::{Storage, StorageError, object_key};
use serde::Deserialize;
use tokio::io::AsyncReadExt;
use tokio::net::TcpListener;

type Env = BTreeMap<String, String>;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Fixture {
    now: u64,
    env: Env,
    urls: Vec<UrlRow>,
    r2: R2Fixture,
    signed_keys: Vec<SignedKey>,
    verify: Vec<VerifyCase>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UrlRow {
    note: String,
    bucket: String,
    name: String,
    /// `None`: the TypeScript throws "invalid object key".
    url: Option<String>,
    /// Path of the request `download(name)` sends to R2.
    r2_get: Option<String>,
    /// Path and query of the request `list(name)` sends to R2.
    r2_list: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct R2Fixture {
    env: Env,
    get: R2Request,
    put: R2Request,
    put_default_type: R2Request,
    delete: R2Request,
    list: R2Request,
    list_bucket: R2Request,
}

/// One request as the S3 endpoint sees it. The fixture also records the host,
/// which is the test server's here.
#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
struct R2Request {
    method: String,
    target: String,
    content_type: Option<String>,
    credential_scope: String,
    signed_headers: String,
    content_sha256: String,
}

#[derive(Deserialize)]
struct SignedKey {
    key: String,
    accepted: bool,
}

#[derive(Deserialize)]
struct VerifyCase {
    name: String,
    env: Env,
    key: String,
    exp: String,
    sig: String,
    accepted: bool,
}

fn fixture() -> Fixture {
    serde_json::from_str(include_str!("fixtures/object-storage-ts.json")).expect("fixture")
}

/// A config holding exactly the fixture's variables, as the TypeScript saw
/// them, plus the `DATABASE_URL` the server requires.
fn config(env: &Env, extra: &[(&str, &str)]) -> Config {
    Config::from_lookup(|name| {
        if name == "DATABASE_URL" {
            return Some(common::UNUSED_DATABASE_URL.to_owned());
        }
        extra
            .iter()
            .find(|(key, _)| *key == name)
            .map(|(_, value)| (*value).to_owned())
            .or_else(|| env.get(name).cloned())
    })
    .expect("valid config")
}

fn storage(env: &Env) -> Storage {
    Storage::new(&config(env, &[])).expect("storage")
}

#[test]
fn mints_the_urls_typescript_mints_and_refuses_the_names_it_refuses() {
    let fixture = fixture();
    let storage = storage(&fixture.env);
    assert!(fixture.urls.iter().any(|row| row.url.is_some()));
    assert!(fixture.urls.iter().any(|row| row.url.is_none()));

    for row in &fixture.urls {
        let minted = storage.signed_object_url_at(&row.bucket, &row.name, 60, fixture.now);

        match &row.url {
            Some(url) => assert_eq!(minted.as_ref().ok(), Some(url), "{}", row.note),
            None => assert!(
                matches!(minted, Err(StorageError::InvalidKey)),
                "{}: {minted:?}",
                row.note
            ),
        }
        assert_eq!(
            object_key(&row.bucket, &row.name).is_ok(),
            row.url.is_some(),
            "{}",
            row.note
        );
    }
}

#[test]
fn accepts_and_rejects_the_signed_urls_typescript_accepts_and_rejects() {
    let fixture = fixture();
    assert!(fixture.verify.iter().filter(|case| case.accepted).count() >= 20);
    assert!(fixture.verify.iter().filter(|case| !case.accepted).count() >= 20);

    for case in &fixture.verify {
        let accepted = storage(&case.env).verify_signed_object_at(
            &case.key,
            &case.exp,
            &case.sig,
            fixture.now,
        );

        assert_eq!(accepted, case.accepted, "{}", case.name);
    }
}

#[test]
fn a_signed_url_expires_with_the_real_clock() {
    let fixture = fixture();
    let storage = storage(&fixture.env);
    let parts = |url: &str| -> (String, String) {
        let query = url.split_once('?').expect("query").1;
        let value = |name: &str| {
            let pair = query.split('&').find(|pair| pair.starts_with(name));
            pair.expect(name)[name.len()..].to_owned()
        };
        (value("exp="), value("sig="))
    };

    let fresh = storage.signed_object_url("uploads", "a.png", 60).unwrap();
    // Minted in 2025 by the fixture: long expired by the real clock.
    let stale = fixture.urls[0].url.as_deref().unwrap();

    let (exp, sig) = parts(&fresh);
    assert!(storage.verify_signed_object("uploads/a.png", &exp, &sig));
    let (exp, sig) = parts(stale);
    assert!(!storage.verify_signed_object("uploads/a.png", &exp, &sig));
}

#[tokio::test]
async fn reads_only_the_signed_keys_typescript_lets_through() {
    let fixture = fixture();
    let empty = tempfile::tempdir().unwrap();
    let dir = empty.path().to_str().unwrap();
    let storage =
        Storage::new(&config(&fixture.env, &[("LOCAL_OBJECT_STORAGE_DIR", dir)])).unwrap();

    for SignedKey { key, accepted } in &fixture.signed_keys {
        let read = storage.read_signed_object(key).await;

        if *accepted {
            assert!(matches!(read, Ok(None)), "{key:?}: {read:?}");
        } else {
            assert!(
                matches!(read, Err(StorageError::InvalidKey)),
                "{key:?}: {read:?}"
            );
        }
    }
}

/// An S3 endpoint that records each request and answers 200.
async fn recording_s3() -> (SocketAddr, Arc<Mutex<Vec<R2Request>>>) {
    let recorded = Arc::new(Mutex::new(Vec::new()));
    let sink = recorded.clone();
    let app = Router::new().fallback(move |request: Request| {
        let sink = sink.clone();
        async move {
            let header = |name: &str| {
                let value = request.headers().get(name)?;
                Some(value.to_str().expect("header text").to_owned())
            };
            // AWS4-HMAC-SHA256 Credential=<key>/<date>/<scope>, SignedHeaders=<names>, Signature=<hex>
            let authorization = header("authorization").expect("authorization");
            let field = |name: &str| {
                let part = authorization
                    .split(", ")
                    .find_map(|part| part.split_once(name))
                    .expect(name);
                part.1.to_owned()
            };
            let credential = field("Credential=");
            sink.lock().unwrap().push(R2Request {
                method: request.method().to_string(),
                target: request.uri().path_and_query().expect("target").to_string(),
                content_type: header("content-type"),
                credential_scope: credential.splitn(3, '/').nth(2).expect("scope").to_owned(),
                signed_headers: field("SignedHeaders="),
                content_sha256: header("x-amz-content-sha256").expect("x-amz-content-sha256"),
            });
            "<ListBucketResult></ListBucketResult>"
        }
    });
    (common::spawn_router(app).await, recorded)
}

#[tokio::test]
async fn sends_r2_the_requests_typescript_sends() {
    let fixture = fixture();
    let (endpoint, recorded) = recording_s3().await;
    // The R2 part of the fixture has no signing secret; these requests need none.
    let signing = [("BETTER_AUTH_SECRET", "not-used-by-r2-requests")];
    let storage = Storage::with_r2_endpoint(
        &config(&fixture.r2.env, &signing),
        &format!("http://{endpoint}"),
    )
    .unwrap();
    let take = || std::mem::take(&mut *recorded.lock().unwrap());
    let targets = |requests: Vec<R2Request>| -> Vec<String> {
        requests.into_iter().map(|request| request.target).collect()
    };

    // The key table: the same object and list requests, and no request at all
    // for a name the TypeScript refuses.
    for row in &fixture.urls {
        let got = storage.get(&row.bucket, &row.name).await;
        assert_eq!(
            targets(take()),
            Vec::from_iter(row.r2_get.clone()),
            "{}",
            row.note
        );
        assert_eq!(got.is_ok(), row.r2_get.is_some(), "{}: {got:?}", row.note);

        let listed = storage.list(&row.bucket, &row.name).await;
        assert_eq!(
            targets(take()),
            Vec::from_iter(row.r2_list.clone()),
            "{}",
            row.note
        );
        assert_eq!(
            listed.is_ok(),
            row.r2_list.is_some(),
            "{}: {listed:?}",
            row.note
        );
    }

    // Method, target, content type and what is signed, for each operation.
    let bytes = Bytes::from_static(&[1, 2, 3]);
    storage.get("uploads", "a.png").await.unwrap();
    assert_eq!(take(), std::slice::from_ref(&fixture.r2.get));
    storage
        .put("uploads", "a.png", bytes.clone(), Some("image/png"))
        .await
        .unwrap();
    assert_eq!(take(), std::slice::from_ref(&fixture.r2.put));
    storage.put("uploads", "a.bin", bytes, None).await.unwrap();
    assert_eq!(take(), std::slice::from_ref(&fixture.r2.put_default_type));
    storage.delete("uploads", "a.png").await.unwrap();
    assert_eq!(take(), std::slice::from_ref(&fixture.r2.delete));
    storage.list("uploads", "2026").await.unwrap();
    assert_eq!(take(), std::slice::from_ref(&fixture.r2.list));
    storage.list("uploads", "").await.unwrap();
    assert_eq!(take(), std::slice::from_ref(&fixture.r2.list_bucket));
    assert_eq!(fixture.r2.get.credential_scope, "auto/s3/aws4_request");
}

/// The tests above and `storage_s3.rs` use plain HTTP on localhost. The real
/// endpoint is HTTPS, and no test may contact it.
#[tokio::test]
async fn an_https_endpoint_is_opened_with_tls_and_never_in_clear_text() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("https://{}", listener.local_addr().unwrap());
    let first_bytes = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut bytes = [0u8; 3];
        socket.read_exact(&mut bytes).await.unwrap();
        bytes
    });
    let signing = [("BETTER_AUTH_SECRET", "not-used-by-r2-requests")];
    let storage =
        Storage::with_r2_endpoint(&config(&fixture().r2.env, &signing), &endpoint).unwrap();

    let got = storage.get("uploads", "a.png").await;

    // A TLS handshake record (0x16) of protocol version 3.x, not "GET".
    assert_eq!(first_bytes.await.unwrap()[..2], [0x16, 0x03]);
    assert!(matches!(got, Err(StorageError::Transport(_))), "{got:?}");
}
