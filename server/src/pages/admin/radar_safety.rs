//! `GET /admin/radar-safety` (`app/(default)/admin/radar-safety/page.tsx`):
//! the pending safety level proposals of the radar, oldest first, each with
//! `RadarSafetyReviewForm`, which posts to `routes/admin/radar_safety.rs`.

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
    let reviews = load(&state, &user)
        .await
        .inspect_err(|error| tracing::warn!(%error, "radar safety queue failed"));
    super::screen(
        &state,
        Root::Site,
        TITLE,
        "/admin/radar-safety",
        view(reviews.as_deref().ok()),
    )
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
