//! `GET /admin/inquiries` (`app/(default)/admin/inquiries/page.tsx`): the
//! latest hundred support inquiries with `InquiryActions`
//! (`routes/admin/inquiries.rs`, `ui/admin.js`).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::format;
use super::shell::Root;
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;

struct Inquiry {
    id: String,
    user_id: String,
    category: String,
    subject: String,
    body: String,
    status: String,
    admin_reply: Option<String>,
    created_at: String,
}

type Row = (
    String,
    String,
    String,
    String,
    String,
    String,
    Option<String>,
    String,
);

/// The inquiries and their authors' nicknames; a failed read is `data ?? []`.
async fn load(state: &AppState, user: &SessionUser) -> (Vec<Inquiry>, Vec<(String, String)>) {
    let identity = user.db_identity();
    let rows: Vec<Row> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select id::text, user_id::text, category, subject, body, status, admin_reply, to_json(created_at) #>> '{}' \
                     from public.support_inquiries order by created_at desc limit 100",
                )
                .fetch_all(tx)
                .await
            })
        })
        .await
        .unwrap_or_default();
    let inquiries: Vec<Inquiry> = rows
        .into_iter()
        .map(
            |(id, user_id, category, subject, body, status, admin_reply, created_at)| Inquiry {
                id,
                user_id,
                category,
                subject,
                body,
                status,
                admin_reply,
                created_at,
            },
        )
        .collect();
    let mut ids: Vec<String> = inquiries
        .iter()
        .map(|inquiry| inquiry.user_id.clone())
        .collect();
    ids.sort();
    ids.dedup();
    if ids.is_empty() {
        return (inquiries, Vec::new());
    }
    let nicknames: Vec<(String, String)> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as("select id::text, nickname from public.profiles where id = any($1::uuid[]) and nickname is not null")
                    .bind(ids)
                    .fetch_all(tx)
                    .await
            })
        })
        .await
        .unwrap_or_default();
    (inquiries, nicknames)
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
    let (inquiries, nicknames) = load(&state, &user).await;
    super::screen(
        &state,
        Root::Site,
        "문의 관리",
        "/admin/inquiries",
        view(&inquiries, &nicknames),
    )
}

/// `INQUIRY_CATEGORY_LABEL` of lib/support.ts.
fn category(value: &str) -> &str {
    match value {
        "bug" => "오류/버그",
        "content" => "콘텐츠 문의(정정·삭제 요청)",
        "account" => "계정/로그인",
        "billing" => "결제/프리미엄",
        "suggestion" => "제안/아이디어",
        "other" => "기타",
        other => other,
    }
}

/// `INQUIRY_STATUS_LABEL` and `INQUIRY_STATUS_BADGE_CLASS`.
fn status(value: &str) -> (&'static str, &'static str) {
    match value {
        "open" => (
            "접수됨",
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-accent-soft text-accent",
        ),
        "answered" => (
            "답변 완료",
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-surface-2 text-foreground",
        ),
        "closed" => (
            "종료",
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-surface-2 text-muted",
        ),
        _ => (
            "",
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold undefined",
        ),
    }
}

fn view(inquiries: &[Inquiry], nicknames: &[(String, String)]) -> Markup {
    let open = inquiries
        .iter()
        .filter(|inquiry| inquiry.status == "open")
        .count();
    html! {
        div class="mx-auto max-w-3xl" {
            h1 class="text-xl font-bold text-foreground" { "문의 관리" }
            p class="mt-1 text-sm text-muted" { "미답변 " (open) "건 · 전체 " (inquiries.len()) "건 (최근 100건)" }
            @if inquiries.is_empty() {
                p class="mt-6 rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted" { "접수된 문의가 없어요." }
            } @else {
                ul class="mt-4 space-y-3" {
                    @for inquiry in inquiries {
                        @let (label, badge) = status(&inquiry.status);
                        @let created = format::parse_timestamp(&inquiry.created_at).map_or_else(|| "Invalid Date".to_owned(), format::kst_medium_short);
                        li class="rounded-2xl border border-border bg-surface p-4" {
                            div class="flex flex-wrap items-center gap-2" {
                                span class=(badge) { (label) }
                                span class="text-xs text-muted" { (category(&inquiry.category)) }
                                span class="text-xs font-medium text-foreground" {
                                    (nicknames.iter().find(|(id, _)| *id == inquiry.user_id).map_or("(탈퇴한 사용자)", |(_, name)| name.as_str()))
                                }
                                time datetime=(inquiry.created_at) class="ml-auto text-xs text-muted" { (created) }
                            }
                            h2 class="mt-2 text-sm font-semibold text-foreground" { (inquiry.subject) }
                            p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted" { (inquiry.body) }
                            (actions(inquiry))
                        }
                    }
                }
            }
        }
    }
}

/// `InquiryActions`: the reply is saved with "답변 저장" (off while it is
/// blank), the status toggled with "종료" or "다시 열기".
fn actions(inquiry: &Inquiry) -> Markup {
    let field = format!("reply-{}", inquiry.id);
    let reply = inquiry.admin_reply.as_deref().unwrap_or("");
    let toggle = if inquiry.status == "closed" {
        ("open", "다시 열기")
    } else {
        ("closed", "종료")
    };
    html! {
        div class="mt-3 border-t border-border pt-3" data-admin-controls="inquiry" data-admin-inquiry=(inquiry.id) {
            label for=(field) class="block text-xs font-semibold text-muted" { "답변 " (if inquiry.status == "answered" { "(수정 가능)" } else { "" }) }
            textarea id=(field) rows="3" maxlength="4000" placeholder="사용자에게 보낼 답변을 입력해 주세요" class="mt-1.5 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" { (reply) }
            div class="mt-2 flex flex-wrap gap-2" {
                button type="button" disabled[crate::routes::public::js::trim(reply).is_empty()] class="inline-flex h-10 items-center justify-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60" data-admin-answer { "답변 저장" }
                button type="button" class="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-60" data-admin-status=(toggle.0) { (toggle.1) }
            }
        }
    }
}
