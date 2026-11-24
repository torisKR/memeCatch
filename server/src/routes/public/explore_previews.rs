//! `POST /api/explore/previews`: `app/api/explore/previews/route.ts`,
//! `lib/explore-preview-deadline.server.ts`, `lib/origin.ts` and
//! `qualifySearchPreviews` of `lib/search-preview.server.ts`.
//!
//! The explore grid sends the ids of the cards on screen and gets back, per
//! meme, the one content it may embed as a preview: read again from the
//! database (the anonymous role), then checked against the reviewed media
//! ledger (`service_role`, which is the only role that can read it). Both
//! reads use the deadline pool, as in the TypeScript.
//!
//! Next answers only `POST` here; its other methods stay with Next.

use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use axum::body::to_bytes;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::meme_delivery::{self, PreviewContent, ReviewedMediaSource};
use super::publication_export::{PUBLIC_STATUSES, parse_rows};
use super::rate_limit::{self, RateLimit, RateLimiter};
use super::{csp_report, labels};
use crate::AppState;
use crate::db::{Db, DbIdentity};
use crate::routes::origin::has_trusted_origin;

const MAX_BODY_BYTES: usize = 2_048;
const MAX_IDS: usize = 24;
/// `MAX_ACTIVE` and `DEADLINE_MS` of the deadline helper.
const MAX_ACTIVE: usize = 4;
const DEADLINE: Duration = Duration::from_millis(4_000);
const WINDOW_MS: i64 = 60_000;
const GLOBAL_LIMIT: usize = 1_200;
const CLIENT_LIMIT: usize = 120;

// What lib/db/execute.ts compiles for the two reads, sent unprepared.
const CARDS_SQL: &str = r#"WITH __q AS (SELECT r1."id", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r2."type", r2."thumbnail_url", r2."is_representative", r2."platform", r2."url", r2."content_id", r2."availability", r2."moderation_status", r2."manual_video_verified" FROM public."meme_contents" r2 WHERE r2."meme_id" = r1."id" AND TRUE) e) AS "meme_contents" FROM public."memes" r1 WHERE r1."id" = ANY($1::uuid[]) AND r1."moderation_status"::text = ANY($2::text[])) SELECT row_to_json(__q)::text FROM __q"#;
const LEDGER_SQL: &str = r#"WITH __q AS (SELECT r1."meme_id", r1."review_state", r1."rights_basis", (SELECT row_to_json(e) FROM (SELECT r2."platform", r2."external_id", r2."canonical_url", r2."embeddable", r2."public_status", r2."removed_at", r2."last_checked_at" FROM public."media_sources" r2 WHERE r2."id" = r1."source_id" AND TRUE) e) AS "media_sources" FROM public."meme_media" r1 WHERE r1."meme_id" = ANY($1::uuid[]) AND EXISTS (SELECT 1 FROM public."media_sources" r3 WHERE r3."id" = r1."source_id" AND TRUE)) SELECT row_to_json(__q)::text FROM __q"#;

/// What the route keeps between requests: its two rate limits and how many
/// requests are reading. One per server, as the module variables are in Next.
pub struct Previews {
    limiter: RateLimiter,
    active: AtomicUsize,
}

impl Previews {
    pub fn new(now_ms: i64) -> Self {
        Self {
            limiter: RateLimiter::new(now_ms),
            active: AtomicUsize::new(0),
        }
    }

    /// A place among the `MAX_ACTIVE` requests that may read at once.
    pub(crate) fn slot(self: &Arc<Self>) -> Option<Slot> {
        if self.active.fetch_add(1, Ordering::SeqCst) >= MAX_ACTIVE {
            self.active.fetch_sub(1, Ordering::SeqCst);
            return None;
        }
        Some(Slot(self.clone()))
    }
}

pub(crate) struct Slot(Arc<Previews>);

impl Drop for Slot {
    fn drop(&mut self) {
        self.0.active.fetch_sub(1, Ordering::SeqCst);
    }
}

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
}

fn error(status: StatusCode, error: &'static str) -> Response {
    json(status, &ErrorBody { error })
}

/// `Response.json(body, { status })`.
fn json(status: StatusCode, body: &impl Serialize) -> Response {
    let body = serde_json::to_vec(body).expect("strings, booleans and nulls serialize");
    (status, [(CONTENT_TYPE, "application/json")], body).into_response()
}

fn unavailable() -> Response {
    let mut response = error(StatusCode::SERVICE_UNAVAILABLE, "previews unavailable");
    no_store(&mut response);
    response
}

fn no_store(response: &mut Response) {
    response
        .headers_mut()
        .insert(CACHE_CONTROL, "no-store".parse().expect("a header value"));
}

/// `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
pub(crate) fn is_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        })
}

/// A request this route refuses: the status and the `error` of the answer.
type Refusal = (StatusCode, &'static str);

/// The `ids` of a request body, each once, in the order given.
fn requested_ids(body: &[u8]) -> Result<Vec<String>, Refusal> {
    // TextDecoder: invalid bytes become U+FFFD and a leading BOM is dropped.
    let text = String::from_utf8_lossy(body);
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);
    let Ok(body) = serde_json::from_str::<Value>(text) else {
        return Err((StatusCode::BAD_REQUEST, "invalid request"));
    };
    let ids = match body.get("ids") {
        // An array is an object to JavaScript, but `[...].ids` is undefined.
        Some(Value::Array(ids)) if body.is_object() => ids,
        _ => return Err((StatusCode::BAD_REQUEST, "invalid ids")),
    };
    let all_uuids = ids.iter().all(|id| id.as_str().is_some_and(is_uuid));
    if ids.is_empty() || ids.len() > MAX_IDS || !all_uuids {
        return Err((StatusCode::BAD_REQUEST, "invalid ids"));
    }
    let mut seen = HashSet::new();
    Ok(ids
        .iter()
        .filter_map(Value::as_str)
        .filter(|id| seen.insert(*id))
        .map(str::to_owned)
        .collect())
}

/// `readBoundedJson(request, 2048)` and the checks of the `ids` in it.
async fn read_ids(request: Request) -> Result<Vec<String>, Refusal> {
    const TOO_LARGE: Refusal = (StatusCode::PAYLOAD_TOO_LARGE, "invalid request");
    if csp_report::declares_too_large(request.headers(), MAX_BODY_BYTES) {
        return Err(TOO_LARGE);
    }
    let body = to_bytes(request.into_body(), MAX_BODY_BYTES)
        .await
        .map_err(|_| TOO_LARGE)?;
    requested_ids(&body)
}

#[derive(Deserialize)]
struct Card {
    id: String,
    meme_contents: Vec<PreviewContent>,
}

#[derive(Deserialize)]
struct LedgerRow {
    meme_id: String,
    review_state: String,
    rights_basis: String,
    media_sources: Option<LedgerSource>,
}

#[derive(Deserialize)]
struct LedgerSource {
    platform: String,
    external_id: Option<String>,
    canonical_url: String,
    embeddable: Option<bool>,
    public_status: Option<String>,
    removed_at: Option<String>,
    last_checked_at: Option<String>,
}

impl LedgerRow {
    /// `parseRow`: the row as a reviewed source, `None` when it is malformed.
    fn into_source(self) -> (String, Option<ReviewedMediaSource>) {
        let source = self.media_sources.map(|source| ReviewedMediaSource {
            review_state: self.review_state,
            rights_basis: self.rights_basis,
            platform: source.platform,
            external_id: source.external_id,
            canonical_url: source.canonical_url,
            embeddable: source.embeddable,
            public_status: source.public_status,
            removed_at: source.removed_at,
            last_checked_at: source.last_checked_at,
        });
        (self.meme_id, source.filter(ReviewedMediaSource::is_valid))
    }
}

/// One element of the answer: `{ id, contents }`.
#[derive(Debug, PartialEq, Serialize)]
struct CardPreview {
    id: String,
    contents: Vec<PreviewContent>,
}

#[derive(Serialize)]
struct PreviewsBody {
    previews: Vec<CardPreview>,
}

/// One read on the deadline pool, as `role`.
async fn read<T: serde::de::DeserializeOwned + Send>(
    db: &Db,
    role: DbIdentity,
    sql: &'static str,
    ids: Vec<String>,
    statuses: Option<Vec<String>>,
) -> Result<Vec<T>, sqlx::Error> {
    db.with_identity_deadline(&role, |tx| {
        Box::pin(async move {
            let mut query = sqlx::query_scalar(sql).persistent(false).bind(ids);
            if let Some(statuses) = statuses {
                query = query.bind(statuses);
            }
            parse_rows(query.fetch_all(tx).await?)
        })
    })
    .await
}

/// `getReviewedMemeMediaSources(memeId)` of lib/meme-delivery.server.ts:
/// the meme's reviewed media, read as `service_role`. `None` is a lookup
/// that is not `ok` (the read failed, or a row is malformed); the meme page
/// then shows no source at all, as `resolveMemeDelivery` does.
pub(crate) async fn reviewed_media_sources(
    db: &Db,
    meme_id: &str,
) -> Option<Vec<ReviewedMediaSource>> {
    let rows: Vec<LedgerRow> = read(
        db,
        DbIdentity::service_role(),
        LEDGER_SQL,
        vec![meme_id.to_owned()],
        None,
    )
    .await
    .inspect_err(|error| tracing::warn!(%error, "reviewed media read failed"))
    .ok()?;
    rows.into_iter().map(|row| row.into_source().1).collect()
}

/// `qualifySearchPreviews` for the cards read: the ledger rows of their
/// memes, then the preview each one allows.
fn qualify(cards: Vec<Card>, ledger: Vec<LedgerRow>, now_ms: i64) -> Vec<CardPreview> {
    let mut sources: HashMap<String, Vec<ReviewedMediaSource>> = HashMap::new();
    // A meme with a malformed ledger row shows nothing.
    let mut failed = HashSet::new();
    for row in ledger {
        match row.into_source() {
            (meme_id, Some(source)) => sources.entry(meme_id).or_default().push(source),
            (meme_id, None) => {
                failed.insert(meme_id);
            }
        }
    }
    cards
        .into_iter()
        .map(|mut card| {
            let reviewed = sources.get(&card.id).map_or(&[][..], Vec::as_slice);
            let preview = (!failed.contains(&card.id))
                .then(|| meme_delivery::preview_index(&card.meme_contents, reviewed, now_ms))
                .flatten();
            CardPreview {
                contents: preview
                    .map(|index| vec![card.meme_contents.swap_remove(index)])
                    .unwrap_or_default(),
                id: card.id,
            }
        })
        .collect()
}

/// `qualifySearchPreviews` as the explore page calls it, inside
/// `withPreviewDeadline`: the ledger of these cards' memes, read as
/// `service_role` on the deadline pool, and the preview each card allows
/// (one content or none), in the order given. `None` when there is no free
/// slot, the read fails or the deadline passes: the page then shows every
/// card without a preview and offers to try again.
pub(crate) async fn qualify_cards(
    db: &Db,
    shared: &Arc<Previews>,
    cards: Vec<(String, Vec<PreviewContent>)>,
) -> Option<Vec<Vec<PreviewContent>>> {
    let _slot = shared.slot()?;
    match tokio::time::timeout(DEADLINE, ledger_previews(db, cards)).await {
        Ok(Ok(previews)) => Some(previews),
        Ok(Err(error)) => {
            tracing::warn!(%error, "explore page previews not read");
            None
        }
        Err(_) => None,
    }
}

/// The ledger read and the choice of `qualify_cards`, without its slot and
/// deadline.
pub(crate) async fn ledger_previews(
    db: &Db,
    cards: Vec<(String, Vec<PreviewContent>)>,
) -> Result<Vec<Vec<PreviewContent>>, sqlx::Error> {
    let ids: Vec<String> = cards
        .iter()
        .map(|(id, _)| id.clone())
        .filter(|id| is_uuid(id))
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let ledger = if ids.is_empty() {
        Vec::new()
    } else {
        read::<LedgerRow>(db, DbIdentity::service_role(), LEDGER_SQL, ids, None).await?
    };
    let cards = cards
        .into_iter()
        .map(|(id, meme_contents)| Card { id, meme_contents })
        .collect();
    Ok(qualify(cards, ledger, csp_report::now_ms())
        .into_iter()
        .map(|preview| preview.contents)
        .collect())
}

/// The work `withPreviewDeadline` wraps. Any error is "unavailable".
async fn load_previews(db: &Db, ids: Vec<String>) -> Result<Vec<CardPreview>, sqlx::Error> {
    let statuses = PUBLIC_STATUSES.map(str::to_owned).to_vec();
    let cards: Vec<Card> = read(db, DbIdentity::anon(), CARDS_SQL, ids, Some(statuses)).await?;
    let ledger = if cards.is_empty() {
        Vec::new()
    } else {
        let card_ids = cards.iter().map(|card| card.id.clone()).collect();
        read(db, DbIdentity::service_role(), LEDGER_SQL, card_ids, None).await?
    };
    Ok(qualify(cards, ledger, csp_report::now_ms()))
}

pub async fn previews(
    State(state): State<AppState>,
    shared: Arc<Previews>,
    request: Request,
) -> Response {
    let headers = request.headers();
    let site_url = labels::site_url(&state.config.site_url);
    let next_port = state.config.upstream.port_u16().unwrap_or(80);
    if !has_trusted_origin(headers, site_url, next_port) {
        return error(StatusCode::FORBIDDEN, "untrusted origin");
    }
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let client = [
        b"explore-previews:",
        rate_limit::client_ip(headers, peer).as_slice(),
    ]
    .concat();
    let now_ms = csp_report::now_ms();
    for (key, limit) in [
        (b"explore-previews:all".to_vec(), GLOBAL_LIMIT),
        (client, CLIENT_LIMIT),
    ] {
        if shared.limiter.check(key, limit, WINDOW_MS, now_ms) != RateLimit::Ok {
            return error(StatusCode::TOO_MANY_REQUESTS, "rate_limited");
        }
    }
    let ids = match read_ids(request).await {
        Ok(ids) => ids,
        Err((status, message)) => return error(status, message),
    };
    let Some(_slot) = shared.slot() else {
        return unavailable();
    };
    match tokio::time::timeout(DEADLINE, load_previews(&state.db, ids)).await {
        Ok(Ok(previews)) => {
            let mut response = json(StatusCode::OK, &PreviewsBody { previews });
            no_store(&mut response);
            response
        }
        Ok(Err(error)) => {
            tracing::warn!(%error, "explore previews not read");
            unavailable()
        }
        Err(_) => unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(body: &str) -> Result<Vec<String>, StatusCode> {
        requested_ids(body.as_bytes()).map_err(|(status, _)| status)
    }

    #[test]
    fn ids_must_be_one_to_twenty_four_uuids() {
        let id = "a1000000-0000-4000-8000-000000000001";
        let upper = "A1000000-0000-4000-8000-00000000000F";
        let many = |count: usize| {
            let list: Vec<String> = (0..count)
                .map(|n| format!("\"a1000000-0000-4000-8000-{n:012}\""))
                .collect();
            format!("{{\"ids\":[{}]}}", list.join(","))
        };

        assert_eq!(
            ids(&format!(
                "\u{feff}{{\"ids\":[\"{id}\",\"{upper}\",\"{id}\"]}}"
            )),
            Ok(vec![id.to_owned(), upper.to_owned()])
        );
        assert_eq!(ids(&many(24)).map(|ids| ids.len()), Ok(24));
        for invalid in [
            many(25),
            "{\"ids\":[]}".to_owned(),
            "{\"ids\":\"x\"}".to_owned(),
            format!("{{\"ids\":[\"{id}\",1]}}"),
            format!("{{\"ids\":[\"{id} \"]}}"),
            format!("{{\"ids\":[\"{}\"]}}", id.replace('-', "")),
            "{}".to_owned(),
            "[]".to_owned(),
            "null".to_owned(),
            "\"ids\"".to_owned(),
        ] {
            assert_eq!(ids(&invalid), Err(StatusCode::BAD_REQUEST), "{invalid}");
        }
    }

    fn content(json: Value) -> PreviewContent {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn a_card_shows_its_preview_unless_the_ledger_refuses_or_is_malformed() {
        let video = || {
            content(serde_json::json!({
                "type": "video", "thumbnail_url": null, "is_representative": true,
                "platform": "youtube", "url": "https://youtu.be/dQw4w9WgXcQ",
                "content_id": "dQw4w9WgXcQ", "availability": "live",
                "moderation_status": "approved", "manual_video_verified": false,
            }))
        };
        let card = |id: &str| Card {
            id: id.to_owned(),
            meme_contents: vec![video()],
        };
        let row = |meme_id: &str, rights: &str, platform: &str| -> LedgerRow {
            serde_json::from_value(serde_json::json!({
                "meme_id": meme_id, "review_state": "approved", "rights_basis": rights,
                "media_sources": {
                    "platform": platform, "external_id": "dQw4w9WgXcQ",
                    "canonical_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "embeddable": true, "public_status": "public",
                    "removed_at": null, "last_checked_at": null,
                },
            }))
            .unwrap()
        };

        let previews = qualify(
            vec![
                card("free"),
                card("allowed"),
                card("blocked"),
                card("malformed"),
            ],
            vec![
                row("allowed", "official_embed", "youtube"),
                row("blocked", "blocked", "youtube"),
                row("malformed", "official_embed", "vimeo"),
            ],
            0,
        );

        let shown: Vec<(&str, usize)> = previews
            .iter()
            .map(|preview| (preview.id.as_str(), preview.contents.len()))
            .collect();
        assert_eq!(
            shown,
            [
                ("free", 1),
                ("allowed", 1),
                ("blocked", 0),
                ("malformed", 0)
            ]
        );
        assert_eq!(previews[0].contents[0], video());
    }

    #[test]
    fn a_fifth_request_at_once_gets_no_slot_until_one_is_given_back() {
        let shared = Arc::new(Previews::new(0));

        let mut slots: Vec<Slot> = (0..MAX_ACTIVE).map(|_| shared.slot().unwrap()).collect();
        assert!(shared.slot().is_none());
        assert!(shared.slot().is_none());

        slots.pop();
        assert!(shared.slot().is_some());
    }

    #[test]
    fn the_answer_keeps_the_key_order_of_the_typescript() {
        let body = PreviewsBody {
            previews: vec![CardPreview {
                id: "a".to_owned(),
                contents: vec![content(serde_json::json!({
                    "type": "video", "thumbnail_url": null, "is_representative": false,
                    "platform": null, "url": "https://a.example/\"x\"", "content_id": null,
                    "availability": "unchecked", "moderation_status": "approved",
                    "manual_video_verified": false,
                }))],
            }],
        };

        assert_eq!(
            serde_json::to_string(&body).unwrap(),
            r#"{"previews":[{"id":"a","contents":[{"type":"video","thumbnail_url":null,"is_representative":false,"platform":null,"url":"https://a.example/\"x\"","content_id":null,"availability":"unchecked","moderation_status":"approved","manual_video_verified":false}]}]}"#
        );
    }
}
