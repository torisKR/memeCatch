//! `GET /admin/users` and `GET /admin/users/{id}`
//! (`app/(default)/admin/users/**`): the accounts, from `listUsers` and
//! `getUserDetail` of `lib/actions/admin-users.ts`, which read better-auth's
//! tables and `profiles` as `service_role` (`createAdminClient`).
//!
//! The detail page carries `UserControls`; its buttons call the endpoints of
//! `routes/admin/users.rs` (`ui/admin.js`).

use axum::extract::{Path, Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use time::{OffsetDateTime, UtcOffset};

use super::format;
use super::shell::{self, Root};
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::public::js;

/// `USER_SQL` of lib/db/admin.ts.
const USER_SQL: &str = r#"SELECT u.id::text AS id,
                         u.email,
                         u."createdAt"::text AS created_at,
                         (SELECT max(s."updatedAt") FROM session s WHERE s."userId" = u.id)::text AS last_sign_in_at,
                         (SELECT a."providerId" FROM account a WHERE a."userId" = u.id ORDER BY a."createdAt" LIMIT 1) AS provider
                    FROM "user" u"#;
/// `listUsers({ query })` asks for the default 200.
const LIST_LIMIT: i64 = 200;

/// `AdminUserRow`.
pub struct UserRow {
    pub id: String,
    pub email: Option<String>,
    pub nickname: Option<String>,
    pub role: Option<String>,
    pub provider: Option<String>,
    pub created_at: Option<OffsetDateTime>,
    pub last_sign_in_at: Option<OffsetDateTime>,
}

type AuthRow = (
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

fn timestamp(value: Option<String>) -> Option<OffsetDateTime> {
    value.as_deref().and_then(format::parse_timestamp)
}

fn service() -> (DbIdentity, IdentityOptions) {
    (DbIdentity::service_role(), IdentityOptions::default())
}

/// `listUsers`: the newest accounts, their profiles, then the search.
pub async fn list_users(state: &AppState, query: &str) -> Result<Vec<UserRow>, String> {
    let (identity, options) = service();
    let sql = format!(r#"{USER_SQL} ORDER BY u."createdAt" DESC LIMIT $1"#);
    let accounts: Vec<AuthRow> = state
        .db
        .with_identity(&identity, options, |tx| {
            Box::pin(async move {
                sqlx::query_as(sqlx::AssertSqlSafe(sql))
                    .bind(LIST_LIMIT)
                    .fetch_all(tx)
                    .await
            })
        })
        .await
        .map_err(|error| error.to_string())?;
    if accounts.is_empty() {
        return Ok(Vec::new());
    }
    let ids: Vec<String> = accounts.iter().map(|row| row.0.clone()).collect();
    // `const { data: profiles } = …`: a failed read leaves every profile empty.
    let profiles: Vec<(String, Option<String>, Option<String>)> = state
        .db
        .with_identity(&identity, options, |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select id::text, nickname, role::text from public.profiles where id = any($1::uuid[])",
                )
                .bind(ids)
                .fetch_all(tx)
                .await
            })
        })
        .await
        .unwrap_or_default();
    let needle = js::trim(query).to_lowercase();
    let rows = accounts
        .into_iter()
        .map(|(id, email, created_at, last_sign_in_at, provider)| {
            let profile = profiles.iter().find(|profile| profile.0 == id);
            UserRow {
                nickname: profile.and_then(|profile| profile.1.clone()),
                role: profile.and_then(|profile| profile.2.clone()),
                id,
                email,
                provider,
                created_at: timestamp(created_at),
                last_sign_in_at: timestamp(last_sign_in_at),
            }
        })
        .filter(|row| {
            needle.is_empty()
                || row
                    .email
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&needle)
                || row
                    .nickname
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&needle)
        })
        .collect();
    // The rows are already newest first, the order the screen wants
    // (PLAN B7-1).
    Ok(rows)
}

/// `AdminUserDetail`.
pub struct UserDetail {
    pub row: UserRow,
    pub age_group: Option<String>,
    pub interests: Option<Vec<String>>,
    pub trust_score: Option<i32>,
}

/// `getUserDetail`: `None` for "사용자를 찾을 수 없어요." (no such account, or an
/// id Postgres cannot compare).
pub async fn user_detail(state: &AppState, user_id: &str) -> Option<UserDetail> {
    let (identity, options) = service();
    let sql = format!("{USER_SQL} WHERE u.id = $1::uuid");
    let id = user_id.to_owned();
    let account: Option<AuthRow> = state
        .db
        .with_identity(&identity, options, |tx| {
            Box::pin(async move {
                sqlx::query_as(sqlx::AssertSqlSafe(sql))
                    .bind(id)
                    .fetch_optional(tx)
                    .await
            })
        })
        .await
        .ok()
        .flatten();
    let (id, email, created_at, last_sign_in_at, provider) = account?;
    let profile_id = id.clone();
    type Profile = (
        Option<String>,
        Option<String>,
        Option<String>,
        Option<Vec<String>>,
        Option<i32>,
    );
    let profile: Option<Profile> = state
        .db
        .with_identity(&identity, options, |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select nickname, role::text, age_group, interests, trust_score from public.profiles where id = $1::uuid",
                )
                .bind(profile_id)
                .fetch_optional(tx)
                .await
            })
        })
        .await
        .ok()
        .flatten();
    let (nickname, role, age_group, interests, trust_score) = profile.unwrap_or_default();
    Some(UserDetail {
        row: UserRow {
            id,
            email,
            nickname,
            role,
            provider,
            created_at: timestamp(created_at),
            last_sign_in_at: timestamp(last_sign_in_at),
        },
        age_group,
        interests,
        trust_score,
    })
}

fn query_value(query: Option<&str>) -> Option<String> {
    url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
        .find(|(key, _)| key == "q")
        .map(|(_, value)| value.into_owned())
}

pub async fn list(State(state): State<AppState>, request: Request) -> Response {
    let query = request.uri().query();
    if let Err(redirect) =
        super::require_operator(&state, request.headers(), request.uri().path(), query).await
    {
        return redirect;
    }
    let q = query_value(query);
    let users = list_users(&state, q.as_deref().unwrap_or("")).await;
    super::screen(
        &state,
        Root::Site,
        "사용자 관리",
        "/admin/users",
        list_view(q.as_deref(), &users),
    )
}

fn short_date(value: Option<OffsetDateTime>) -> String {
    value.map_or_else(|| "—".to_owned(), format::utc_short_date)
}

fn list_view(q: Option<&str>, users: &Result<Vec<UserRow>, String>) -> Markup {
    html! {
        div {
            h1 class="text-2xl font-bold tracking-tight" { "사용자 관리" }
            p class="mt-1.5 text-sm text-muted" { "계정 정보·비밀번호·권한을 사용자별로 관리해요." }
            form method="get" class="mt-5 flex gap-2" {
                label for="user-q" class="sr-only" { "이메일 또는 닉네임 검색" }
                input id="user-q" placeholder="이메일 또는 닉네임 검색" class="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20" name="q" value=(q.unwrap_or(""));
                button type="submit" class="inline-flex h-11 shrink-0 items-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white active:scale-[0.97]" { "검색" }
            }
            @match users {
                Err(error) => p role="alert" class="mt-5 rounded-xl bg-safety-red-bg px-4 py-3 text-sm font-semibold text-safety-red" { (error) },
                Ok(users) => {
                    p class="mt-4 text-sm text-muted" {
                        (users.len()) "명"
                        @if let Some(q) = q.filter(|q| !q.is_empty()) { " · \"" (q) "\" 검색 결과" }
                    }
                    div class="mt-3 overflow-x-auto" {
                        table class="w-full min-w-[640px] border-collapse text-sm" {
                            thead {
                                tr class="border-b border-border text-left text-muted" {
                                    th class="py-2 pr-3 font-semibold" { "이메일" }
                                    th class="py-2 pr-3 font-semibold" { "닉네임" }
                                    th class="py-2 pr-3 font-semibold" { "권한" }
                                    th class="py-2 pr-3 font-semibold" { "가입" }
                                    th class="py-2 font-semibold" { "최근 로그인" }
                                }
                            }
                            tbody {
                                @for user in users {
                                    tr class="border-b border-border" {
                                        td class="py-2.5 pr-3" {
                                            a href=(format!("/admin/users/{}", user.id)) class="font-semibold text-accent-text hover:text-accent" { (user.email.as_deref().unwrap_or("(이메일 없음)")) }
                                        }
                                        td class="py-2.5 pr-3" { (user.nickname.as_deref().unwrap_or("—")) }
                                        td class="py-2.5 pr-3" {
                                            @if user.role.as_deref() == Some("operator") {
                                                span class="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-text" { "운영자" }
                                            } @else {
                                                span class="text-muted" { "일반" }
                                            }
                                        }
                                        td class="py-2.5 pr-3 tabular-nums text-muted" { (short_date(user.created_at)) }
                                        td class="py-2.5 tabular-nums text-muted" { (short_date(user.last_sign_in_at)) }
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

pub async fn detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Response {
    // `requireOperatorPage("/admin/users")` comes after the proxy's gate,
    // which returns to the page that was asked for.
    if let Err(redirect) = super::require_operator(
        &state,
        request.headers(),
        request.uri().path(),
        request.uri().query(),
    )
    .await
    {
        return redirect;
    }
    let Some(user) = user_detail(&state, &id).await else {
        // `notFound()` (PLAN B7-2).
        return super::super::html(
            StatusCode::NOT_FOUND,
            shell::not_found(&state.pages.site, "사용자 상세"),
        );
    };
    super::screen(
        &state,
        Root::Site,
        "사용자 상세",
        "/admin/users",
        detail_view(&user),
    )
}

fn long_date(value: Option<OffsetDateTime>) -> String {
    value.map_or_else(
        || "—".to_owned(),
        |value| format::date_time_12h(value, UtcOffset::UTC),
    )
}

fn detail_view(user: &UserDetail) -> Markup {
    let row = &user.row;
    let interests = user
        .interests
        .as_ref()
        .filter(|interests| !interests.is_empty())
        .map_or_else(|| "—".to_owned(), |interests| interests.join(", "));
    html! {
        div class="mx-auto max-w-3xl" {
            a href="/admin/users" class="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-accent" { "← 사용자 목록" }
            div class="mt-2 flex flex-wrap items-center justify-between gap-3" {
                div class="min-w-0" {
                    h1 class="truncate text-2xl font-bold tracking-tight" { (row.email.as_deref().unwrap_or("(이메일 없음)")) }
                    p class="mt-1 font-mono text-xs text-muted" { (row.id) }
                }
                div class="flex shrink-0 gap-2" {
                    @if row.role.as_deref() == Some("operator") {
                        span class="rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent-text" { "운영자" }
                    }
                }
            }
            section class="mt-6 rounded-2xl border border-border bg-surface p-5" {
                h2 class="text-base font-bold" { "계정 정보" }
                dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm" {
                    dt class="text-muted" { "닉네임" }
                    dd class="text-right font-semibold" { (row.nickname.as_deref().unwrap_or("—")) }
                    dt class="text-muted" { "로그인 방식" }
                    dd class="text-right font-semibold" { (row.provider.as_deref().unwrap_or("—")) }
                    dt class="text-muted" { "가입일" }
                    dd class="text-right font-semibold tabular-nums" { (long_date(row.created_at)) }
                    dt class="text-muted" { "최근 로그인" }
                    dd class="text-right font-semibold tabular-nums" { (long_date(row.last_sign_in_at)) }
                    dt class="text-muted" { "연령대" }
                    dd class="text-right font-semibold" { (user.age_group.as_deref().unwrap_or("—")) }
                    dt class="text-muted" { "신뢰도" }
                    dd class="text-right font-semibold tabular-nums" {
                        @match user.trust_score { Some(score) => (score), None => "—" }
                    }
                    dt class="text-muted" { "관심 카테고리" }
                    dd class="text-right font-semibold" { (interests) }
                }
            }
            div class="mt-6" { (controls(row)) }
        }
    }
}

const BUTTON: &str = "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition-transform active:scale-[0.97] disabled:opacity-60";

/// `UserControls`. `ui/admin.js` runs the buttons: `data-admin-action` names the
/// endpoint, `data-admin-done` the message on success, `data-admin-body` the
/// JSON it sends (the password comes from the field).
fn controls(row: &UserRow) -> Markup {
    let primary = format!("{BUTTON} bg-accent-strong text-white");
    let ghost = format!("{BUTTON} border border-border bg-surface font-semibold");
    let id = &row.id;
    let role_body = |role: &str| serde_json::json!({ "userId": id, "role": role }).to_string();
    html! {
        div class="space-y-6" data-admin-controls="user" {
            section class="rounded-2xl border border-border bg-surface p-5" {
                h2 class="text-base font-bold" { "비밀번호" }
                p class="mt-1 text-sm text-muted" { "재설정 메일을 보내면 사용자가 직접 정합니다(권장). 직접 설정하면 즉시 적용돼요." }
                div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center" {
                    input type="password" placeholder="새 비밀번호 (8자 이상)" autocomplete="new-password" class="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20" value="" data-admin-password;
                    button type="button" disabled class=(format!("{primary} shrink-0")) data-admin-action="user-password" data-admin-done="비밀번호를 변경했어요." data-admin-body=(serde_json::json!({ "userId": id }).to_string()) data-admin-needs-password { "직접 설정" }
                }
                button type="button" disabled[row.email.is_none()] class=(format!("{ghost} mt-3 w-full sm:w-auto")) data-admin-action="user-reset" data-admin-done="재설정 메일을 보냈어요." data-admin-body=(serde_json::to_string(&row.email).unwrap_or_default()) { "재설정 메일 보내기" }
            }
            section class="rounded-2xl border border-border bg-surface p-5" {
                h2 class="text-base font-bold" { "권한" }
                p class="mt-1 text-sm text-muted" { "운영자는 관리자 콘솔 전체에 접근할 수 있어요. 신중히 부여하세요." }
                div class="mt-4 flex flex-wrap gap-3" {
                    @if row.role.as_deref() == Some("operator") {
                        button type="button" class=(format!("{ghost} text-safety-red")) data-admin-action="user-role" data-admin-done="일반 사용자로 변경했어요." data-admin-body=(role_body("user")) data-admin-refresh { "운영자 권한 해제" }
                    } @else {
                        button type="button" class=(primary) data-admin-action="user-role" data-admin-done="운영자로 지정했어요." data-admin-body=(role_body("operator")) data-admin-refresh { "운영자로 지정" }
                    }
                }
            }
        }
    }
}
