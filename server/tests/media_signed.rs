//! `GET /api/media/signed` on the local-directory backend. The contract is
//! `app/api/media/signed/route.ts`; `parity/storage-parity.sh` explains how to
//! compare the two servers live. `storage_s3.rs` has the R2 case.

mod common;

use std::net::SocketAddr;

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{Response, StatusCode};
use common::{client, closed_addr, config, spawn_app, spawn_router};
use hmac::{Hmac, KeyInit, Mac};
use http_body_util::BodyExt;
use memecatch_server::storage::Storage;
use sha2::Sha256;
use tempfile::TempDir;

const SECRET: &str = "media-route-signing-secret";
/// Far enough ahead for any test run, in milliseconds since the epoch.
const LATER: &str = "99999999999999";

struct Site {
    app: SocketAddr,
    storage: Storage,
    _root: TempDir,
}

/// The application over a fresh object directory holding `uploads/2026/a.bin`.
async fn site(upstream: SocketAddr, extra: &[(&str, &str)]) -> Site {
    let root = tempfile::tempdir().expect("temp dir");
    let vars = [
        ("LOCAL_OBJECT_STORAGE_DIR", root.path().to_str().unwrap()),
        ("OBJECT_SIGNING_SECRET", SECRET),
    ];
    let config = config(
        upstream,
        common::UNUSED_DATABASE_URL,
        &[&vars[..], extra].concat(),
    );
    let storage = Storage::new(&config).expect("storage");
    storage
        .put("uploads", "2026/a.bin", OBJECT.into(), Some("image/png"))
        .await
        .expect("put");
    Site {
        app: spawn_app(config).await,
        storage,
        _root: root,
    }
}

const OBJECT: &[u8] = b"\x00\x01object bytes\xff";

async fn send(app: SocketAddr, method: &str, target: &str) -> (Response<()>, Vec<u8>) {
    let request = Request::builder()
        .method(method)
        .uri(format!("http://{app}{target}"))
        .body(Body::empty())
        .unwrap();
    let response = client().request(request).await.expect("response");
    let (parts, body) = response.into_parts();
    let body = body.collect().await.expect("body").to_bytes();
    (Response::from_parts(parts, ()), body.to_vec())
}

/// The path and query of a signed URL.
fn target(url: &str) -> &str {
    &url[url.find("/api/media/signed").expect("signed path")..]
}

/// A signature the route accepts, over any key text and expiry.
fn sign(key: &str, exp: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(SECRET.as_bytes()).unwrap();
    mac.update(format!("{key}:{exp}").as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

fn assert_json(response: &(Response<()>, Vec<u8>), status: StatusCode, body: &str, case: &str) {
    assert_eq!(response.0.status(), status, "{case}");
    assert_eq!(String::from_utf8_lossy(&response.1), body, "{case}");
    let headers = response.0.headers();
    assert_eq!(
        headers.get("content-type").unwrap(),
        "application/json",
        "{case}"
    );
    assert!(!headers.contains_key("cache-control"), "{case}");
}

#[tokio::test]
async fn a_valid_signature_serves_the_object_with_a_private_one_minute_cache() {
    let site = site(closed_addr().await, &[("RELEASE_SHA", "abc123")]).await;
    let url = site
        .storage
        .signed_object_url("uploads", "2026/a.bin", 60)
        .unwrap();

    let (response, body) = send(site.app, "GET", target(&url)).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(body, OBJECT);
    let headers = response.headers();
    // The local backend keeps no content type, as in the TypeScript.
    assert_eq!(
        headers.get("content-type").unwrap(),
        "application/octet-stream"
    );
    assert_eq!(headers.get("cache-control").unwrap(), "private, max-age=60");
    assert_eq!(
        headers.get("content-length").unwrap(),
        &OBJECT.len().to_string()
    );
    // The headers Next adds to every route response.
    assert_eq!(headers.get("x-memecatch-release-sha").unwrap(), "abc123");
    assert_eq!(headers.get("x-content-type-options").unwrap(), "nosniff");
    assert!(headers.contains_key("content-security-policy"));
}

#[tokio::test]
async fn a_bad_signature_is_answered_401_expired() {
    let site = site(closed_addr().await, &[]).await;
    let url = site
        .storage
        .signed_object_url("uploads", "2026/a.bin", 60)
        .unwrap();
    let valid = target(&url);
    let (unsigned, sig) = valid.split_once("&sig=").unwrap();
    let last = if sig.ends_with('0') { '1' } else { '0' };

    for (case, target) in [
        (
            "last digit changed",
            format!("{unsigned}&sig={}{last}", &sig[..63]),
        ),
        (
            "upper case",
            format!("{unsigned}&sig={}", sig.to_uppercase()),
        ),
        ("one digit short", format!("{unsigned}&sig={}", &sig[..63])),
        ("another object", valid.replace("a.bin", "b.bin")),
        ("another secret", {
            let other = Storage::new(&config(
                closed_addr().await,
                common::UNUSED_DATABASE_URL,
                &[("OBJECT_SIGNING_SECRET", "another-secret")],
            ));
            let url = other
                .unwrap()
                .signed_object_url("uploads", "2026/a.bin", 60);
            target(&url.unwrap()).to_owned()
        }),
    ] {
        let response = send(site.app, "GET", &target).await;

        assert_json(
            &response,
            StatusCode::UNAUTHORIZED,
            r#"{"message":"expired"}"#,
            case,
        );
    }
}

#[tokio::test]
async fn an_expired_url_is_answered_401_expired() {
    let site = site(closed_addr().await, &[]).await;
    let an_hour_ago = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
        - 3_600_000;
    let url = site
        .storage
        .signed_object_url_at("uploads", "2026/a.bin", 60, an_hour_ago)
        .unwrap();

    let response = send(site.app, "GET", target(&url)).await;

    assert_json(
        &response,
        StatusCode::UNAUTHORIZED,
        r#"{"message":"expired"}"#,
        "expired",
    );
}

#[tokio::test]
async fn malformed_parameters_are_answered_401_expired() {
    let site = site(closed_addr().await, &[]).await;
    let key = "uploads%2F2026%2Fa.bin";
    let sig = sign("uploads/2026/a.bin", LATER);

    for target in [
        "/api/media/signed".to_owned(),
        "/api/media/signed?".to_owned(),
        format!("/api/media/signed?key={key}"),
        format!("/api/media/signed?key={key}&exp={LATER}"),
        format!("/api/media/signed?key={key}&sig={sig}"),
        format!("/api/media/signed?exp={LATER}&sig={sig}"),
        format!("/api/media/signed?key=&exp={LATER}&sig={sig}"),
        // An empty key is refused before its signature is looked at.
        format!("/api/media/signed?key=&exp={LATER}&sig={}", sign("", LATER)),
        format!("/api/media/signed?key={key}&exp=soon&sig={sig}"),
        format!("/api/media/signed?key={key}&exp=&sig={sig}"),
        format!("/api/media/signed?key={key}&exp={LATER}&sig="),
        format!("/api/media/signed?key={key}&exp={LATER}&sig=%ZZ"),
        format!("/api/media/signed?KEY={key}&EXP={LATER}&SIG={sig}"),
        "/api/media/signed?key=%FF%FE&exp=1&sig=%00".to_owned(),
    ] {
        let response = send(site.app, "GET", &target).await;

        assert_json(
            &response,
            StatusCode::UNAUTHORIZED,
            r#"{"message":"expired"}"#,
            &target,
        );
    }
}

#[tokio::test]
async fn a_signed_url_for_a_missing_object_is_answered_404_missing() {
    let site = site(closed_addr().await, &[]).await;

    for name in ["2026/no-such.bin", "2026", "2026/a.bin/below"] {
        let url = site.storage.signed_object_url("uploads", name, 60).unwrap();

        let response = send(site.app, "GET", target(&url)).await;

        assert_json(
            &response,
            StatusCode::NOT_FOUND,
            r#"{"message":"missing"}"#,
            name,
        );
    }
}

#[tokio::test]
async fn a_valid_signature_over_a_key_the_storage_refuses_is_answered_400_unreadable() {
    let site = site(closed_addr().await, &[]).await;

    for (key, encoded) in [
        ("uploads/한글.png", "uploads%2F%ED%95%9C%EA%B8%80.png"),
        ("uploads/a b.png", "uploads%2Fa+b.png"),
        ("..", ".."),
    ] {
        let target = format!(
            "/api/media/signed?key={encoded}&exp={LATER}&sig={}",
            sign(key, LATER)
        );

        let response = send(site.app, "GET", &target).await;

        assert_json(
            &response,
            StatusCode::BAD_REQUEST,
            r#"{"message":"unreadable"}"#,
            key,
        );
    }
}

#[tokio::test]
async fn the_query_is_read_as_urlsearchparams_reads_it() {
    let site = site(closed_addr().await, &[]).await;
    let sig = sign("uploads/2026/a.bin", LATER);

    for target in [
        // An unescaped slash, other parameters, any order.
        format!("/api/media/signed?sig={sig}&utm=x&exp={LATER}&key=uploads/2026/a.bin"),
        // Of a repeated name, the first value counts.
        format!(
            "/api/media/signed?key=uploads%2F2026%2Fa.bin&exp={LATER}&sig={sig}&key=other&sig=00&exp=1"
        ),
        // `exp` is read as a number: surrounding spaces do not change it.
        format!("/api/media/signed?key=uploads%2F2026%2Fa.bin&exp=+{LATER}%20&sig={sig}"),
    ] {
        let (response, body) = send(site.app, "GET", &target).await;

        assert_eq!(response.status(), StatusCode::OK, "{target}");
        assert_eq!(body, OBJECT, "{target}");
    }
}

/// An upstream that answers every request with 418 and names what it saw.
async fn marker_upstream() -> SocketAddr {
    spawn_router(Router::new().fallback(|request: Request| async move {
        (
            StatusCode::IM_A_TEAPOT,
            format!("upstream saw {} {}", request.method(), request.uri().path()),
        )
    }))
    .await
}

#[tokio::test]
async fn other_methods_and_the_disabled_route_id_go_to_the_upstream() {
    let upstream = marker_upstream().await;
    let enabled = site(upstream, &[]).await;
    let disabled = site(upstream, &[("AXUM_DISABLED_ROUTES", "media-signed")]).await;
    let url = enabled
        .storage
        .signed_object_url("uploads", "2026/a.bin", 60)
        .unwrap();

    // HEAD too: Next sends no Content-Length on it and axum would.
    for method in ["HEAD", "POST", "OPTIONS", "DELETE"] {
        let (direct, _) = send(upstream, method, target(&url)).await;
        let (response, body) = send(enabled.app, method, target(&url)).await;

        assert_eq!(response.status(), StatusCode::IM_A_TEAPOT, "{method}");
        if method != "HEAD" {
            let expected = format!("upstream saw {method} /api/media/signed");
            assert_eq!(String::from_utf8_lossy(&body), expected);
        }
        let length = |response: &Response<()>| response.headers().get("content-length").cloned();
        assert_eq!(length(&response), length(&direct), "{method}");
        assert!(!response.headers().contains_key("allow"), "{method}");
    }
    let (handed_back, handed_back_body) = send(disabled.app, "GET", target(&url)).await;
    assert_eq!(handed_back.status(), StatusCode::IM_A_TEAPOT);
    assert_eq!(handed_back_body, b"upstream saw GET /api/media/signed");
}
