//! `GET /api/media/{...path}`: `app/api/media/[...path]/route.ts`. Serves
//! uploads (`meme-uploads/{user}/{file}`), rehosted thumbnails
//! (`meme-thumbs/...`) and card art (`meme-card-art/...`) from object storage.
//!
//! An upload is private: its owner may read it, and anyone may once a
//! submission that attaches it is approved. That is decided before storage is
//! asked for a byte. Being an operator changes nothing here, as in Next.
//!
//! Only public catalogue art found in storage is cached publicly; every
//! other answer (an upload, whoever may read it, a 404, a failure) is
//! `private, no-store` (PLAN.md D5-5).
//!
//! The object is streamed. On the local-directory backend an object that is
//! not in this server's directory is left to Next, whose directory is another
//! one when the two run in separate containers.

use axum::extract::{Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use percent_encoding::percent_decode_str;

use crate::auth::resolve_session;
use crate::db::{DbIdentity, IdentityOptions};
use crate::AppState;

const PREFIX: &str = "/api/media/";
const UPLOADS: &str = "meme-uploads/";
const PUBLIC_PREFIXES: [&str; 2] = ["meme-thumbs/", "meme-card-art/"];
const PRIVATE: &str = "private, no-store";
/// A public object whose path is not an image (a GIF, a video).
const PUBLIC: &str = "public, max-age=60, s-maxage=300";

// What lib/db/execute.ts compiles for the lookup, with the enum named:
// node-pg sends the status untyped, sqlx sends it as text.
const APPROVED_SQL: &str = r#"WITH __q AS (SELECT r1."id" FROM public."meme_submissions" r1 WHERE r1."attachment_path" = $1 AND r1."status" = $2::submission_status LIMIT $3::int) SELECT row_to_json(__q)::text FROM __q"#;

/// `safeMediaType`: the type for the key's extension, whatever the object's
/// own metadata says.
fn safe_media_type(key: &str) -> Option<&'static str> {
    let (_, extension) = key.rsplit_once('.')?;
    if extension.is_empty() || !extension.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
        return None;
    }
    Some(match extension.to_ascii_lowercase().as_str() {
        "gif" => "image/gif",
        "jpeg" | "jpg" => "image/jpeg",
        "mp4" => "video/mp4",
        "png" => "image/png",
        "webm" => "video/webm",
        "webp" => "image/webp",
        _ => return None,
    })
}

/// The path segments after `/api/media/`, each decoded as Next decodes a
/// catch-all parameter. `None` for a path Next may read differently (an
/// empty segment, bytes that are not UTF-8).
fn segments(path: &str) -> Option<Vec<String>> {
    path.strip_prefix(PREFIX)?
        .split('/')
        .map(|segment| {
            let decoded = percent_decode_str(segment).decode_utf8().ok()?;
            (!decoded.is_empty()).then(|| decoded.into_owned())
        })
        .collect()
}

/// `new NextResponse("Not found", { status: 404 })`, never stored.
fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        [
            (CONTENT_TYPE, "text/plain;charset=UTF-8"),
            (CACHE_CONTROL, PRIVATE),
        ],
        "Not found",
    )
        .into_response()
}

/// Whether an approved submission attaches `key` (read with `service_role`,
/// as `createAdminClient` does). A failed read counts as no.
async fn is_approved_attachment(state: &AppState, key: String) -> bool {
    let rows: Result<Vec<String>, sqlx::Error> = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_scalar(APPROVED_SQL)
                        .persistent(false)
                        .bind(key)
                        .bind("approved")
                        .bind(1_i32)
                        .fetch_all(tx)
                        .await
                })
            },
        )
        .await;
    rows.is_ok_and(|rows| !rows.is_empty())
}

/// Whether the caller may read the upload `key` of `owner_id`.
async fn may_read_upload(state: &AppState, headers: &HeaderMap, owner_id: &str, key: &str) -> bool {
    // `createClient()` treats a failed session lookup as signed out.
    let user = resolve_session(state, headers).await.ok().flatten();
    if user.is_some_and(|user| user.id == owner_id) {
        return true;
    }
    is_approved_attachment(state, key.to_owned()).await
}

/// The `next.config.ts` rule for static assets, `/:path*\.(svg|png|...)`:
/// Next sent its `Cache-Control` on every answer of an image path, a private
/// upload and a 404 included. Kept for public catalogue art only (D5-5). The
/// pattern ignores case.
fn static_asset_cache(path: &str) -> Option<&'static str> {
    const EXTENSIONS: [&str; 8] = ["svg", "png", "jpg", "jpeg", "webp", "avif", "ico", "woff2"];
    let (_, extension) = path.rsplit_once('.')?;
    EXTENSIONS
        .contains(&extension.to_ascii_lowercase().as_str())
        .then_some("public, max-age=2592000, stale-while-revalidate=86400")
}

pub async fn object(State(state): State<AppState>, request: Request) -> Response {
    // `/api/media/signed` is a route of its own; an encoded spelling of it
    // names no object either.
    let path = segments(request.uri().path()).filter(|path| path != &["signed"]);
    let Some(path) = path else {
        return not_found();
    };
    let key = path.join("/");
    let is_upload = key.starts_with(UPLOADS);
    let is_public = PUBLIC_PREFIXES.iter().any(|prefix| key.starts_with(prefix));
    let Some(content_type) = safe_media_type(&key).filter(|_| is_upload || is_public) else {
        return not_found();
    };
    if key.contains("..") {
        return not_found();
    }
    // The headers alone: a request is not shared across an await.
    let headers = request.headers().clone();
    if is_upload && !may_read_upload(&state, &headers, &path[1], &key).await {
        return not_found();
    }
    let cache = if is_public {
        static_asset_cache(request.uri().path()).unwrap_or(PUBLIC)
    } else {
        PRIVATE
    };
    let (bucket, name) = key.split_once('/').unwrap_or((&key, ""));
    match state.storage.open_media_object(bucket, name).await {
        Ok(Some(object)) => (
            [(CONTENT_TYPE, content_type), (CACHE_CONTROL, cache)],
            [("x-content-type-options", "nosniff")],
            object.body,
        )
            .into_response(),
        // Not in the local directory.
        Ok(None) | Err(_) if state.storage.is_local() => not_found(),
        // `!res.ok`: whatever R2 answered that is not a success.
        Ok(None) | Err(crate::storage::StorageError::Status(_)) => not_found(),
        Err(error) => {
            // `fetch` throws and Next answers 500.
            tracing::warn!(%error, "media object could not be read");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(CACHE_CONTROL, PRIVATE)],
            )
                .into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_type_comes_from_the_extension_of_the_key() {
        assert_eq!(safe_media_type("meme-thumbs/a/b.PNG"), Some("image/png"));
        assert_eq!(safe_media_type("a.b.jpeg"), Some("image/jpeg"));
        assert_eq!(safe_media_type("a/video.webm"), Some("video/webm"));
        for refused in [
            "a/b", "a/b.", "a/b.html", "a/b.svg", "a/b.png/", "a/b.p-g", "a.png/b",
        ] {
            assert_eq!(safe_media_type(refused), None, "{refused}");
        }
    }

    #[test]
    fn image_paths_get_the_static_asset_cache_header_of_next_config() {
        for matched in [
            "/api/media/meme-uploads/u/a.png",
            "/api/media/x/a.JPG",
            "/api/media/a..b.webp",
        ] {
            assert_eq!(
                static_asset_cache(matched),
                Some("public, max-age=2592000, stale-while-revalidate=86400"),
                "{matched}"
            );
        }
        for unmatched in [
            "/api/media/x/a.gif",
            "/api/media/x/a.mp4",
            "/api/media/x/a.webm",
            "/api/media/x/a",
        ] {
            assert_eq!(static_asset_cache(unmatched), None, "{unmatched}");
        }
    }

    #[test]
    fn segments_are_decoded_one_by_one_and_empty_ones_are_not_read_here() {
        assert_eq!(
            segments("/api/media/meme-thumbs/tiktok/a%20b.png"),
            Some(vec![
                "meme-thumbs".to_owned(),
                "tiktok".to_owned(),
                "a b.png".to_owned()
            ])
        );
        // An encoded slash stays inside its segment.
        assert_eq!(
            segments("/api/media/meme-uploads/a%2Fb/c.png").map(|path| path[1].clone()),
            Some("a/b".to_owned())
        );
        assert_eq!(segments("/api/media/meme-thumbs//a.png"), None);
        assert_eq!(segments("/api/media/meme-thumbs/a.png/"), None);
        assert_eq!(segments("/api/media/meme-thumbs/%ff.png"), None);
    }
}
