//! `POST /api/upload`: `app/api/upload/route.ts`, `lib/upload-shared.ts`,
//! `lib/r2.server.ts` (`r2Put`). Route id `upload`.
//!
//! A signed-in user's image (5 MiB) or video (20 MiB) for a submission or a
//! community post, stored as `meme-uploads/<user>/<uuid>.<ext>`. The order
//! of the checks is the TypeScript's: the origin, the session, the in-memory
//! limit, the database limit (`reserve_api_request`), the body, the type and
//! size, the magic bytes, the storage quota (`reserve_community_upload_storage`
//! as `service_role`), and only then the PUT.
//!
//! Registered when objects are kept in R2, or in the local directory
//! without an upstream. With an upstream on the local backend this server
//! and Next have a directory each, so a file written here would be
//! invisible to Next: the route stays with Next there.

use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::response::Response;
use axum::routing::post;

use super::Routes;
use super::media_type;
use super::mpe::{failure, json, rate_limited};
use super::multipart::{self, TooLarge, Value};
use super::public::csp_report::now_ms;
use super::public::rate_limit::RateLimiter;
use super::request::{self, SiteOrigin};
use super::tracking::growth::random_uuid;
use crate::auth::SessionUser;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::AppState;

/// `MAX_UPLOAD_BYTES`: images.
const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;
/// `MAX_VIDEO_UPLOAD_BYTES`.
const MAX_VIDEO_BYTES: usize = 20 * 1024 * 1024;
/// What `readBoundedFormData` may read: the largest file and its form.
const MAX_BODY_BYTES: usize = MAX_VIDEO_BYTES + 128 * 1024;
const RATE_LIMIT: usize = 10;
const BUCKET: &str = "meme-uploads";

// What lib/db/execute.ts sends for the two calls. node-pg sends the
// arguments untyped and Postgres takes the function's types; sqlx sends text,
// so the casts say what Postgres inferred.
const RESERVE_SQL: &str = r#"WITH __q AS (SELECT public."reserve_api_request"("p_action" => $1) AS result) SELECT row_to_json(__q)::text FROM __q"#;
const STORAGE_SQL: &str = r#"WITH __q AS (SELECT public."reserve_community_upload_storage"("p_user_id" => $1::uuid, "p_bytes" => $2::bigint) AS result) SELECT row_to_json(__q)::text FROM __q"#;

pub fn router(state: &AppState) -> Router<AppState> {
    let routes = Routes::new(state);
    let site = SiteOrigin::from_site_url(&state.config.site_url);
    let Some(site) = site else {
        // A site URL `new URL` refuses.
        return routes.build();
    };
    let limiter = Arc::new(RateLimiter::new(now_ms()));
    routes
        .add(
            "upload",
            "/api/upload",
            post(move |state: State<AppState>, request: Request| {
                upload(state, site.clone(), limiter.clone(), request)
            }),
        )
        .build()
}

/// Why `reserve_api_request` refused.
pub(crate) enum Refused {
    /// `api_rate_limited`: 429 `rate_limited`.
    Limited,
    /// Anything else, a database that cannot answer included: 503
    /// `rate_limit_unavailable`.
    Unavailable,
}

/// One call that returns nothing, with `args` bound as text in order.
async fn call(
    db: &Db,
    identity: &DbIdentity,
    sql: &'static str,
    args: Vec<String>,
) -> Result<(), sqlx::Error> {
    db.with_identity(identity, IdentityOptions::default(), |tx| {
        Box::pin(async move {
            let mut query = sqlx::query_scalar::<_, String>(sql).persistent(false);
            for arg in args {
                query = query.bind(arg);
            }
            query.fetch_all(tx).await.map(drop)
        })
    })
    .await
}

/// Whether a failed call's message names `code` (`error.message.includes`).
pub(crate) fn names(error: &sqlx::Error, code: &str) -> bool {
    error.to_string().contains(code)
}

/// `rpc("reserve_api_request", { p_action })` as the signed-in user.
pub(crate) async fn reserve_api_request(
    db: &Db,
    user: &SessionUser,
    action: &str,
) -> Result<(), Refused> {
    call(
        db,
        &user.db_identity(),
        RESERVE_SQL,
        vec![action.to_owned()],
    )
    .await
    .map_err(|error| {
        if names(&error, "api_rate_limited") {
            Refused::Limited
        } else {
            Refused::Unavailable
        }
    })
}

/// The 429 or 503 for a refused `reserve_api_request`.
pub(crate) fn refused(refused: Refused) -> Response {
    match refused {
        Refused::Limited => failure(StatusCode::TOO_MANY_REQUESTS, "rate_limited"),
        Refused::Unavailable => failure(StatusCode::SERVICE_UNAVAILABLE, "rate_limit_unavailable"),
    }
}

/// `ALLOWED_IMAGE_TYPES[type] ?? ALLOWED_VIDEO_TYPES[type]`, and whether it
/// is a video.
fn extension(content_type: &str) -> Option<(&'static str, bool)> {
    Some(match content_type {
        "image/jpeg" => ("jpg", false),
        "image/png" => ("png", false),
        "image/webp" => ("webp", false),
        "image/gif" => ("gif", false),
        "video/mp4" => ("mp4", true),
        "video/webm" => ("webm", true),
        _ => return None,
    })
}

/// What tells the two upload routes' admission apart.
pub(crate) struct Admission {
    /// The `error` of the 401.
    pub signed_out: &'static str,
    /// The in-memory limiter's key is `<limit_key>:<user id>`.
    pub limit_key: &'static str,
    /// Requests per user and minute in memory.
    pub limit: usize,
    /// `reserve_api_request(p_action)`.
    pub action: &'static str,
}

/// The outcome of [`admit`].
pub(crate) enum Admitted {
    /// The user, and the request, its body not read yet.
    Yes(SessionUser, Parts, Body),
    /// The answer, the body drained as Next drains it (or Next's own answer
    /// for an origin only Next can judge).
    No(Response),
}

/// What both upload routes check before they read the body, in their order:
/// the request target, the origin, the session, the in-memory limit and the
/// database limit.
pub(crate) async fn admit(
    state: &AppState,
    site: &SiteOrigin,
    limiter: &RateLimiter,
    request: Request,
    rules: Admission,
) -> Admitted {
    let trusted = request::trusted_origin(request.headers(), site);
    let (mut parts, body) = request.into_parts();
    let refuse = |body, response| {
        multipart::drain_body(body);
        Admitted::No(response)
    };
    if !trusted {
        return refuse(body, failure(StatusCode::FORBIDDEN, "invalid_origin"));
    }
    let Some(user) = request::session_user(state, &mut parts).await else {
        return refuse(body, failure(StatusCode::UNAUTHORIZED, rules.signed_out));
    };
    let key = format!("{}:{}", rules.limit_key, user.id);
    if let Some(limited) = rate_limited(limiter, key, rules.limit) {
        return refuse(body, limited);
    }
    if let Err(error) = reserve_api_request(&state.db, &user, rules.action).await {
        return refuse(body, refused(error));
    }
    Admitted::Yes(user, parts, body)
}

async fn upload(
    State(state): State<AppState>,
    site: SiteOrigin,
    limiter: Arc<RateLimiter>,
    request: Request,
) -> Response {
    let rules = Admission {
        signed_out: "login_required",
        limit_key: "upload",
        limit: RATE_LIMIT,
        action: "upload",
    };
    let (user, parts, body) = match admit(&state, &site, &limiter, request, rules).await {
        Admitted::Yes(user, parts, body) => (user, parts, body),
        Admitted::No(response) => return response,
    };
    let form = match multipart::read_bounded_form(&parts.headers, body, MAX_BODY_BYTES).await {
        Ok(form) => form,
        Err(TooLarge) => return failure(StatusCode::PAYLOAD_TOO_LARGE, "too_large"),
    };
    let Some(Value::File {
        content_type,
        bytes,
    }) = form.as_ref().and_then(|form| form.get("file"))
    else {
        return failure(StatusCode::BAD_REQUEST, "no_file");
    };
    let Some((ext, is_video)) = extension(content_type) else {
        return failure(StatusCode::BAD_REQUEST, "invalid_type");
    };
    let max_bytes = if is_video {
        MAX_VIDEO_BYTES
    } else {
        MAX_IMAGE_BYTES
    };
    if bytes.len() > max_bytes {
        return failure(StatusCode::BAD_REQUEST, "too_large");
    }
    if media_type::validate(bytes, content_type).is_err() {
        return failure(StatusCode::BAD_REQUEST, "invalid_type");
    }
    store(&state, &user, ext, content_type, bytes.clone()).await
}

/// Reserves the storage quota, then puts the object.
async fn store(
    state: &AppState,
    user: &SessionUser,
    ext: &str,
    content_type: &str,
    bytes: axum::body::Bytes,
) -> Response {
    let args = vec![user.id.clone(), bytes.len().to_string()];
    if let Err(error) = call(&state.db, &DbIdentity::service_role(), STORAGE_SQL, args).await {
        return if names(&error, "upload_storage_quota_exceeded") {
            failure(StatusCode::TOO_MANY_REQUESTS, "storage_quota_exceeded")
        } else {
            failure(StatusCode::SERVICE_UNAVAILABLE, "storage_quota_unavailable")
        };
    }
    let name = format!("{}/{}.{ext}", user.id, random_uuid());
    // `r2Put(fullPath, bytes.buffer, file.type)`: any failure is a 502.
    if let Err(error) = state
        .storage
        .put(BUCKET, &name, bytes, Some(content_type))
        .await
    {
        tracing::warn!(%error, "upload could not be stored");
        return failure(StatusCode::BAD_GATEWAY, "upload_failed");
    }
    let path = serde_json::to_string(&format!("{BUCKET}/{name}")).expect("a string serializes");
    json(StatusCode::OK, format!(r#"{{"ok":true,"path":{path}}}"#))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_listed_types_have_an_extension() {
        assert_eq!(extension("image/jpeg"), Some(("jpg", false)));
        assert_eq!(extension("image/gif"), Some(("gif", false)));
        assert_eq!(extension("video/webm"), Some(("webm", true)));
        for refused in [
            "",
            "image/jpg",
            "IMAGE/PNG",
            "image/png; x=1",
            "video/quicktime",
        ] {
            assert_eq!(extension(refused), None, "{refused}");
        }
    }
}
