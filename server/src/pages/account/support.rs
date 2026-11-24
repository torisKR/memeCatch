//! `GET /support` (`app/(default)/support/page.tsx`): the help desk. A
//! signed-in user sends an inquiry and reads their inquiries with the
//! operator's replies; anyone else is asked to sign in. Rendered on
//! request.
//!
//! The form (`components/support/inquiry-form.tsx`) posts to
//! `POST /api/support/inquiry` (`routes/account.rs`, `createInquiry`), whose
//! answer carries the list rendered again (`inquiries_section`), so the new
//! inquiry appears below the form while the form keeps its notice
//! (`ui/support.js`).

use axum::extract::{Request, State};
use axum::response::{IntoResponse, Response};
use maud::{Markup, html};

use super::respond;
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::pages::DYNAMIC_PAGE_CACHE;
use crate::pages::document::{Head, ShareImage};
use crate::routes::better_auth::page_user;

const TITLE: &str = "고객센터";
const DESCRIPTION: &str = "밈캐치에 버그 신고, 콘텐츠 정정·삭제 요청, 건의사항을 보내 주세요.";
const LIST_LIMIT: i64 = 50;

/// `INQUIRY_CATEGORIES` and `INQUIRY_CATEGORY_LABEL` of lib/support.ts.
pub const CATEGORIES: [(&str, &str); 6] = [
    ("bug", "오류/버그"),
    ("content", "콘텐츠 문의(정정·삭제 요청)"),
    ("account", "계정/로그인"),
    ("billing", "결제/프리미엄"),
    ("suggestion", "제안/아이디어"),
    ("other", "기타"),
];

/// One row of `support_inquiries`, its times as the planner returns them
/// (`datetime`) and in milliseconds (shown).
pub struct Inquiry {
    category: String,
    subject: String,
    body: String,
    status: String,
    admin_reply: Option<String>,
    replied_at: Option<(String, i64)>,
    created_at: (String, i64),
}

const LIST_SQL: &str = r#"select category, subject, body, status, admin_reply,
       (to_json(replied_at at time zone 'UTC') #>> '{}') || '+00:00',
       floor(extract(epoch from replied_at) * 1000)::bigint,
       (to_json(created_at at time zone 'UTC') #>> '{}') || '+00:00',
       floor(extract(epoch from created_at) * 1000)::bigint
  from public.support_inquiries
 order by created_at desc
 limit $1"#;

/// The user's inquiries, as the user (row-level security). `None` when they
/// cannot be read: the page then shows the empty list.
pub async fn inquiries(state: &AppState, user_id: &str) -> Option<Vec<Inquiry>> {
    type Row = (
        String,
        String,
        String,
        String,
        Option<String>,
        Option<String>,
        Option<i64>,
        String,
        i64,
    );
    let rows: Result<Vec<Row>, sqlx::Error> = state
        .db
        .with_identity(
            &DbIdentity::authenticated(user_id),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_as(LIST_SQL)
                        .bind(LIST_LIMIT)
                        .fetch_all(tx)
                        .await
                })
            },
        )
        .await;
    match rows {
        Ok(rows) => Some(
            rows.into_iter()
                .map(
                    |(
                        category,
                        subject,
                        body,
                        status,
                        admin_reply,
                        replied,
                        replied_ms,
                        created,
                        created_ms,
                    )| Inquiry {
                        category,
                        subject,
                        body,
                        status,
                        admin_reply,
                        replied_at: replied.zip(replied_ms),
                        created_at: (created, created_ms),
                    },
                )
                .collect(),
        ),
        Err(error) => {
            tracing::warn!(%error, "support inquiries read failed");
            None
        }
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let user = page_user(&state, request.headers()).await;
    let list = match &user {
        Some(user) => Some(inquiries(&state, &user.id).await.unwrap_or_default()),
        None => None,
    };
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        robots: Some("noindex"),
        canonical: Some("/support".to_owned()),
        image: Some(ShareImage::site_default(&state.pages.site)),
        alternate_locales: true,
        ..Head::default()
    };
    let main = html! {
        main class="mx-auto w-full max-w-2xl px-4 py-8" {
            h1 class="page-title" { "고객센터" }
            p class="page-lede" { "버그 신고, 콘텐츠 정정·삭제 요청, 건의사항을 보내 주세요. 답변이 등록되면 이 페이지에서 확인할 수 있어요." }
            section aria-labelledby="inquiry-form-heading" class="mt-6 rounded-2xl border border-border bg-surface p-5" {
                h2 id="inquiry-form-heading" class="text-lg font-bold text-foreground" { "문의하기" }
                @if user.is_some() {
                    div class="mt-4" { (form()) }
                } @else {
                    div class="mt-4 rounded-xl bg-surface-2 px-4 py-5 text-center" {
                        p class="text-sm text-muted" { "문의를 보내려면 로그인이 필요해요." }
                        a href="/login?next=/support" class="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-accent-strong px-6 text-sm font-bold text-white transition-transform active:scale-[0.98]" { "로그인하고 문의하기" }
                    }
                }
            }
            @if let Some(list) = &list {
                (inquiries_section(list))
            }
        }
    };
    let head = Head {
        script: Some("support"),
        ..head
    };
    respond(&state, &request, DYNAMIC_PAGE_CACHE, head, main).into_response()
}

fn form() -> Markup {
    html! {
        form class="space-y-4" data-support-form {
            div {
                label for="inquiry-category" class="block text-sm font-semibold text-foreground" { "문의 유형" }
                select id="inquiry-category" class="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" {
                    @for (value, label) in CATEGORIES {
                        option value=(value) selected[value == "bug"] { (label) }
                    }
                }
            }
            div {
                label for="inquiry-subject" class="block text-sm font-semibold text-foreground" { "제목" }
                input id="inquiry-subject" type="text" required maxlength="120" value="" placeholder="문의 내용을 한 줄로 요약해 주세요" class="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
            }
            div {
                label for="inquiry-body" class="block text-sm font-semibold text-foreground" { "내용" }
                textarea id="inquiry-body" required minlength="10" maxlength="2000" rows="6" placeholder="자세히 적어 주실수록 빠르고 정확하게 도와드릴 수 있어요. (10자 이상)" class="mt-1.5 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" {}
                p class="mt-1 text-right text-xs text-muted" data-support-count { "0/2,000" }
            }
            button type="submit" class="inline-flex h-11 w-full items-center justify-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:min-w-40" { "문의 보내기" }
        }
    }
}

/// `Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short",
/// timeZone: "Asia/Seoul" })`: `2026. 11. 20. 오후 3:05`.
fn medium_short(ms: i64) -> String {
    let at = time::OffsetDateTime::from_unix_timestamp_nanos(i128::from(ms) * 1_000_000)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH)
        .to_offset(time::UtcOffset::from_hms(9, 0, 0).unwrap_or(time::UtcOffset::UTC));
    let (half, hour) = match at.hour() {
        0 => ("오전", 12),
        h @ 1..=11 => ("오전", h),
        12 => ("오후", 12),
        h => ("오후", h - 12),
    };
    format!(
        "{}. {}. {}. {half} {hour}:{:02}",
        at.year(),
        u8::from(at.month()),
        at.day(),
        at.minute()
    )
}

/// "내 문의 내역".
pub fn inquiries_section(list: &[Inquiry]) -> Markup {
    let status_label = |status: &str| match status {
        "answered" => "답변 완료",
        "closed" => "종료",
        "open" => "접수됨",
        _ => "",
    };
    let status_class = |status: &str| match status {
        "open" => "bg-accent-soft text-accent",
        "answered" => "bg-surface-2 text-foreground",
        "closed" => "bg-surface-2 text-muted",
        _ => "",
    };
    html! {
        section aria-labelledby="my-inquiries-heading" class="mt-8" data-support-list {
            h2 id="my-inquiries-heading" class="text-lg font-bold text-foreground" { "내 문의 내역" }
            @if list.is_empty() {
                p class="mt-3 rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted" { "아직 보낸 문의가 없어요." }
            } @else {
                ul class="mt-3 space-y-3" {
                    @for inquiry in list {
                        li class={"rounded-2xl border border-border bg-surface p-4" @if inquiry.admin_reply.as_deref().is_some_and(|reply| !reply.is_empty()) { " hover-glow-flame" }} {
                            div class="flex flex-wrap items-center gap-2" {
                                span class=(format!("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold {}", status_class(&inquiry.status))) { (status_label(&inquiry.status)) }
                                span class="text-xs text-muted" {
                                    (CATEGORIES.iter().find(|(value, _)| *value == inquiry.category).map_or(inquiry.category.as_str(), |(_, label)| label))
                                }
                                time datetime=(inquiry.created_at.0) class="ml-auto text-xs text-muted" { (medium_short(inquiry.created_at.1)) }
                            }
                            h3 class="mt-2 text-sm font-semibold text-foreground" { (inquiry.subject) }
                            p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted" { (inquiry.body) }
                            @if let Some(reply) = inquiry.admin_reply.as_deref().filter(|reply| !reply.is_empty()) {
                                div class="mt-3 rounded-xl bg-surface-2 p-3" {
                                    p class="text-xs font-bold text-accent" { "운영자 답변" }
                                    p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground" { (reply) }
                                    @if let Some((iso, ms)) = &inquiry.replied_at {
                                        time datetime=(iso) class="mt-1.5 block text-right text-xs text-muted" { (medium_short(*ms)) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values: the Intl.DateTimeFormat above under Node.
    #[test]
    fn times_are_written_as_intl_writes_them() {
        assert_eq!(medium_short(1_795_154_700_000), "2026. 11. 20. 오후 3:05");
        assert_eq!(medium_short(1_795_014_000_000), "2026. 11. 19. 오전 12:00");
        assert_eq!(medium_short(1_795_190_400_000), "2026. 11. 21. 오전 1:00");
    }
}
