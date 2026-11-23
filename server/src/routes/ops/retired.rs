//! `retiredProductJson()` of `lib/retired-products.ts`: the product APIs are
//! gone, for every method their route files export.

use axum::http::StatusCode;
use axum::http::header::{CONTENT_TYPE, HeaderName};
use axum::response::{IntoResponse, Response};

const X_ROBOTS_TAG: HeaderName = HeaderName::from_static("x-robots-tag");

/// `NextResponse.json({ error: "gone" }, { status: 410, headers: { "X-Robots-Tag": "noindex" } })`.
pub async fn gone() -> Response {
    (
        StatusCode::GONE,
        [
            (CONTENT_TYPE, "application/json"),
            (X_ROBOTS_TAG, "noindex"),
        ],
        r#"{"error":"gone"}"#,
    )
        .into_response()
}
