//! `POST /api/memes/{id}/view`: `app/api/memes/[id]/view/route.ts`.
//!
//! What production answers today: the only `Origin` accepted is Next's own
//! request URL (`http(s)://localhost:<its port>`), which no browser sends, so
//! every browser request is 403; and the function it calls,
//! `record_meme_view`, is in no migration, so a request that gets past the
//! checks is 400 `view_not_recorded`. Both are ported as they are.
//!
//! It shares the `meme-view:<ip>` counter with `/api/memes/view` (30 a
//! minute here, 120 there), as the two TypeScript routes share
//! `lib/rate-limit.ts`.

use std::sync::Arc;
use std::time::SystemTime;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{ORIGIN, USER_AGENT};
use axum::response::Response;

use super::{ACCEPTED, Client, Tracking, refused};
use crate::db::DbIdentity;
use crate::routes::public::quiz;
use crate::routes::{origin, request, sources};
use crate::{AppState, proxy};

const VIEWS_PER_MINUTE: usize = 30;
const RECORD: &str =
    "select public.record_meme_view(p_meme_id => $1::uuid, p_principal_hash => $2)";

pub async fn record(
    State(state): State<AppState>,
    tracking: Arc<Tracking>,
    request: Request,
) -> Response {
    let id = request
        .uri()
        .path()
        .strip_prefix("/api/memes/")
        .and_then(|rest| rest.strip_suffix("/view"))
        .and_then(request::decode_uri_component);
    let (true, Some(id)) = (request::has_ascii_target(request.uri()), id) else {
        return proxy::forward(State(state), request).await;
    };
    let (parts, _) = request.into_parts();
    let next_port = state.config.upstream.port_u16().unwrap_or(80);
    let own = origin::next_origin(&parts.headers, next_port);
    let sent = origin::header(&parts.headers, ORIGIN).filter(|sent| !sent.is_empty());
    if sent.as_deref() != Some(own.as_bytes()) {
        return refused(StatusCode::FORBIDDEN, "origin_not_allowed");
    }
    if !is_view_id(&id) {
        return refused(StatusCode::BAD_REQUEST, "invalid_id");
    }
    let client = Client::of(&parts);
    if let Some(limited) = tracking.limited("meme-view:", &client.limit_key, VIEWS_PER_MINUTE) {
        return limited;
    }
    let day = quiz::kst_day_key(SystemTime::now());
    let agent = request::header_text(&parts.headers, &USER_AGENT, ", ").unwrap_or_default();
    let principal = tracking
        .keys
        .keyed_hash(format!("{}\0{agent}\0{day}", client.address).as_bytes());
    let binds = vec![Some(id), Some(principal)];
    let recorded = sources::db::call_function(
        &state,
        &DbIdentity::service_role(),
        "record_meme_view",
        RECORD,
        binds,
    )
    .await;
    match recorded {
        Ok(()) => request::json(StatusCode::ACCEPTED, ACCEPTED),
        Err(_) => refused(StatusCode::BAD_REQUEST, "view_not_recorded"),
    }
}

/// `/^[0-9a-f-]{36}$/i`.
fn is_view_id(id: &str) -> bool {
    id.len() == 36
        && id
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_36_hex_digits_or_dashes() {
        assert!(is_view_id("11111111-1111-4111-8111-11111111111A"));
        assert!(is_view_id(&"-".repeat(36)));
        assert!(!is_view_id("11111111-1111-4111-8111-1111111111111"));
        assert!(!is_view_id("g1111111-1111-4111-8111-111111111111"));
    }
}
