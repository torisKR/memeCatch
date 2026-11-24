//! `GET /admin/radar-safety` (`app/(default)/admin/radar-safety/page.tsx`):
//! the pending safety level proposals of the radar, oldest first, each with
//! `RadarSafetyReviewForm`, which posts to `routes/admin/radar_safety.rs`.
//!
//! Below them, the signal matches the radar left `pending` (confidence under
//! 0.9, `routes/ops/radar.rs`), oldest first. The TypeScript had no screen
//! for them (its radar never stored a signal, PLAN.md R8-1). Each has
//! approve and reject buttons (`ui/admin.js`), which post to
//! `routes/admin/radar_safety.rs` (`decide_match`, D4-1).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::format;
use super::shell::Root;
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::routes::js_json;
use crate::routes::request::Json;

const TITLE: &str = "Radar 안전 검수";

/// `LEVEL_LABEL`.
fn level(level: &str) -> &'static str {
    match level {
        "green" => "안전",
        "yellow" => "주의",
        "gray" => "판단 보류",
        "red" => "위험",
        _ => "",
    }
}

struct Review {
    id: String,
    proposed_level: String,
    reason: String,
    evidence: Option<String>,
    requested_at: String,
    meme: Option<(String, String)>,
}

const SQL: &str = "select q.id::text, q.proposed_level::text, q.reason, q.evidence::text, to_json(q.requested_at) #>> '{}', \
    m.title, m.safety_level::text \
    from public.safety_review_queue q left join public.memes m on m.id = q.meme_id \
    where q.status = 'pending' order by q.requested_at asc limit 100";

type ReviewRow = (
    String,
    String,
    String,
    Option<String>,
    String,
    Option<String>,
    Option<String>,
);

async fn load(state: &AppState, user: &SessionUser) -> Result<Vec<Review>, sqlx::Error> {
    let rows: Vec<ReviewRow> = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query_as(SQL).fetch_all(tx).await })
        })
        .await?;
    Ok(rows
        .into_iter()
        .map(
            |(id, proposed_level, reason, evidence, requested_at, title, safety)| Review {
                id,
                proposed_level,
                reason,
                evidence,
                requested_at,
                meme: title.zip(safety),
            },
        )
        .collect())
}

/// A `pending` row of `meme_signal_links` with its signal and meme.
struct PendingMatch {
    meme_id: String,
    signal_id: String,
    title: Option<String>,
    platform: String,
    method: String,
    confidence: String,
    text: Option<String>,
    url: Option<String>,
    observed_at: String,
}

type PendingRow = (
    String,
    String,
    Option<String>,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    String,
);

const PENDING_SQL: &str = "select l.meme_id::text, l.signal_id::text, m.title, s.platform, l.match_method, l.match_confidence::text, \
    s.text, s.canonical_url, to_json(s.observed_at) #>> '{}' \
    from public.meme_signal_links l \
    join public.external_signals s on s.id = l.signal_id \
    left join public.memes m on m.id = l.meme_id \
    where l.review_state = 'pending' order by l.created_at asc, l.signal_id limit 100";

async fn load_pending(
    state: &AppState,
    user: &SessionUser,
) -> Result<Vec<PendingMatch>, sqlx::Error> {
    let rows: Vec<PendingRow> = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query_as(PENDING_SQL).fetch_all(tx).await })
        })
        .await?;
    Ok(rows
        .into_iter()
        .map(
            |(meme_id, signal_id, title, platform, method, confidence, text, url, observed_at)| {
                PendingMatch {
                    meme_id,
                    signal_id,
                    title,
                    platform,
                    method,
                    confidence,
                    text,
                    url,
                    observed_at,
                }
            },
        )
        .collect())
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let user = match super::require_operator(
        &state,
        request.headers(),
        request.uri().path(),
        request.uri().query(),
    )
    .await
    {
        Ok(user) => user,
        Err(redirect) => return redirect,
    };
    let (reviews, pending) = tokio::join!(load(&state, &user), load_pending(&state, &user));
    let reviews = reviews.inspect_err(|error| tracing::warn!(%error, "radar safety queue failed"));
    let pending =
        pending.inspect_err(|error| tracing::warn!(%error, "radar pending matches failed"));
    let body = html! {
        (view(reviews.as_deref().ok()))
        (pending_view(pending.as_deref().ok()))
    };
    super::screen(&state, Root::Site, TITLE, "/admin/radar-safety", body)
}

/// `formatEvidence`: a string as it is, anything else as indented JSON.
fn evidence(text: Option<&str>) -> String {
    let parsed = text.and_then(Json::parse).unwrap_or(Json::Null);
    match &parsed {
        Json::String(text) => text.clone(),
        other => js_json::stringify_parsed_pretty(other),
    }
}

fn view(reviews: Option<&[Review]>) -> Markup {
    html! {
        div class="mx-auto max-w-4xl space-y-6" {
            div {
                h1 class="text-2xl font-bold text-foreground" { (TITLE) }
                p class="mt-1 text-sm text-muted" { "외부 신호는 변경 제안만 등록합니다. 안전 등급은 운영자가 이 화면에서 검수한 경우에만 반영됩니다." }
            }
            @match reviews {
                None => p role="alert" class="rounded-xl border border-danger p-4 text-sm text-danger" { "대기 중인 안전 검수 요청을 불러오지 못했어요." },
                Some([]) => p class="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted" { "대기 중인 안전 검수 요청이 없어요." },
                Some(reviews) => ul class="space-y-4" { @for review in reviews { (item(review)) } },
            }
        }
    }
}

fn item(review: &Review) -> Markup {
    let requested = format::parse_timestamp(&review.requested_at)
        .map_or_else(|| "Invalid Date".to_owned(), format::kst_medium_short);
    html! {
        li class="rounded-2xl border border-border bg-surface p-5" {
            div class="flex flex-wrap items-start justify-between gap-2" {
                div {
                    h2 class="font-semibold text-foreground" {
                        (review.meme.as_ref().map_or("삭제되었거나 찾을 수 없는 밈", |(title, _)| title.as_str()))
                    }
                    p class="mt-1 text-sm text-muted" {
                        "현재 " strong { (review.meme.as_ref().map_or("확인 불가", |(_, safety)| level(safety))) }
                        " → "
                        "제안 " strong class="text-foreground" { (level(&review.proposed_level)) }
                    }
                }
                time datetime=(review.requested_at) class="text-xs text-muted" { (requested) }
            }
            section class="mt-4" {
                h3 class="text-xs font-semibold uppercase tracking-wide text-muted" { "제안 사유" }
                p class="mt-1 whitespace-pre-wrap text-sm text-foreground" { (review.reason) }
            }
            section class="mt-3" {
                h3 class="text-xs font-semibold uppercase tracking-wide text-muted" { "증거" }
                pre class="mt-1 overflow-x-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-xs text-muted" { (evidence(review.evidence.as_deref())) }
            }
            (form(&review.id))
        }
    }
}

/// `RadarSafetyReviewForm`: `ui/admin.js` sends it as JSON and shows the
/// answer under the buttons.
fn form(review_id: &str) -> Markup {
    html! {
        // React's placeholder for a form whose action is a client function.
        form class="mt-4 space-y-3 border-t border-border pt-4" action="javascript:throw new Error('React form unexpectedly submitted.')" data-admin-controls="radar-review" data-admin-review=(review_id) {
            label class="block text-sm font-medium text-foreground" {
                "검수 메모"
                textarea name="reviewNote" required maxlength="2000" rows="3" placeholder="판단 근거와 확인한 내용을 남겨 주세요." class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent" {}
            }
            div class="flex flex-wrap items-center gap-2" {
                button type="submit" name="decision" value="approved" class="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" { "등급 변경 승인" }
                button type="submit" name="decision" value="rejected" class="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50" { "제안 반려" }
            }
        }
    }
}

/// What a pending match's method means. Only the phrase methods fall under
/// the automatic confidence.
fn method_label(method: &str) -> &str {
    match method {
        "canonical_phrase" => "대표 이름이 글에 나옴",
        "alias_phrase" => "별칭이 글에 나옴",
        "canonical_hashtag" => "대표 이름 해시태그",
        "alias_hashtag" => "별칭 해시태그",
        other => other,
    }
}

/// `0.8700` as `0.87`.
fn confidence(value: &str) -> String {
    value
        .parse::<f64>()
        .map_or_else(|_| value.to_owned(), js_json::number)
}

fn pending_view(pending: Option<&[PendingMatch]>) -> Markup {
    html! {
        section class="mx-auto mt-10 max-w-4xl space-y-4" {
            div {
                h2 class="text-xl font-bold text-foreground" { "확인을 기다리는 신호 매칭" }
                p class="mt-1 text-sm text-muted" { "자동 매칭 기준(신뢰도 0.9)에 못 미친 외부 신호예요. 승인해도 이미 지난 레이더 실행의 밈 상태 계산은 다시 하지 않아요." }
            }
            @match pending {
                None => p role="alert" class="rounded-xl border border-danger p-4 text-sm text-danger" { "확인을 기다리는 신호 매칭을 불러오지 못했어요." },
                Some([]) => p class="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted" { "확인을 기다리는 신호 매칭이 없어요." },
                Some(pending) => ul class="space-y-3" { @for item in pending { (pending_item(item)) } },
            }
        }
    }
}

fn pending_item(item: &PendingMatch) -> Markup {
    let observed = format::parse_timestamp(&item.observed_at)
        .map_or_else(|| "Invalid Date".to_owned(), format::kst_medium_short);
    html! {
        li class="rounded-2xl border border-border bg-surface p-4" {
            div class="flex flex-wrap items-start justify-between gap-2" {
                div {
                    h3 class="font-semibold text-foreground" {
                        (item.title.as_deref().unwrap_or("삭제되었거나 찾을 수 없는 밈"))
                    }
                    p class="mt-1 text-sm text-muted" {
                        (item.platform) " · " (method_label(&item.method)) " · 신뢰도 " (confidence(&item.confidence))
                    }
                }
                time datetime=(item.observed_at) class="text-xs text-muted" { (observed) }
            }
            @if let Some(text) = &item.text {
                p class="mt-3 whitespace-pre-wrap text-sm text-foreground" { (text) }
            }
            @if let Some(url) = &item.url {
                a href=(super::safe_href(url)) target="_blank" rel="noopener noreferrer" class="mt-2 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline" { "원문 보기" span aria-hidden="true" { "↗" } }
            }
            (match_buttons(item))
        }
    }
}

/// Approve or reject the match: `ui/admin.js` posts the button's body and
/// reloads on success, or shows the error above the buttons.
fn match_buttons(item: &PendingMatch) -> Markup {
    let body = |decision: &str| {
        serde_json::json!({ "memeId": item.meme_id, "signalId": item.signal_id, "decision": decision })
            .to_string()
    };
    html! {
        div class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3" data-admin-controls="radar-match" {
            button type="button" data-admin-action="radar-match" data-admin-body=(body("approved")) class="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" { "매칭 승인" }
            button type="button" data-admin-action="radar-match" data-admin-body=(body("rejected")) class="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50" { "매칭 거절" }
        }
    }
}
