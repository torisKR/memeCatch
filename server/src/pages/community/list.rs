//! `GET /community` (`app/(default)/community/page.tsx`): visible posts,
//! newest first, twenty a page (`?page=`, one more read to know whether
//! another page follows). Read as the anonymous visitor (`createStaticClient`).
//! A failed read shows the error panel; no posts, the empty state.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};

use super::{
    POST_COLUMNS, POST_FROM, POSTS_PAGE_SIZE, Post, PostRow, catch_mascot_help, error_panel,
    post_card, post_from_row,
};
use crate::AppState;
use crate::auth::now_ms;
use crate::db::{DbIdentity, IdentityOptions};
use crate::pages::document::{self, Head, ShareImage};
use crate::pages::{DYNAMIC_PAGE_CACHE, html_cached, path_and_query};

const DESCRIPTION: &str = "밈 추천·추억·토론 — 밈캐치 사람들과 자유롭게 이야기해요.";
const BUTTON: &str = "inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PRIMARY: &str = "inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";
const PAGER: &str = "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold";

/// `Math.max(1, Number.parseInt(raw ?? "1", 10) || 1)` of the first `page`.
pub fn page_number(query: Option<&str>) -> i64 {
    let raw = url::form_urlencoded::parse(query.unwrap_or("").as_bytes())
        .find(|(key, _)| key == "page")
        .map(|(_, value)| value.into_owned());
    // parseInt: leading white space, a sign, then digits; anything after is ignored.
    let parsed = raw.as_deref().and_then(|raw| {
        let text = crate::routes::public::js::trim(raw);
        let (sign, digits) = match text.strip_prefix('-') {
            Some(rest) => (-1, rest),
            None => (1, text.strip_prefix('+').unwrap_or(text)),
        };
        let digits: String = digits.chars().take_while(char::is_ascii_digit).collect();
        digits.parse::<i64>().ok().map(|value| sign * value)
    });
    parsed.filter(|page| *page != 0).unwrap_or(1).max(1)
}

async fn read(state: &AppState, page: i64) -> Option<Vec<Post>> {
    let from = (page - 1).saturating_mul(POSTS_PAGE_SIZE);
    let sql = format!(
        "select {POST_COLUMNS} from {POST_FROM} where p.status = 'visible' order by p.created_at desc offset $1 limit $2"
    );
    let rows: Result<Vec<PostRow>, sqlx::Error> = state
        .db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(sqlx::AssertSqlSafe(sql))
                    .bind(from)
                    .bind(POSTS_PAGE_SIZE + 1)
                    .fetch_all(tx)
                    .await
            })
        })
        .await;
    match rows {
        Ok(rows) => Some(rows.into_iter().map(post_from_row).collect()),
        Err(error) => {
            tracing::warn!(%error, "community list read failed");
            None
        }
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let page = page_number(request.uri().query());
    let posts = read(&state, page).await;
    let head = Head {
        title: "커뮤니티".to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        canonical: Some("/community".to_owned()),
        image: Some(ShareImage::site_default(&state.pages.site)),
        ..Head::default()
    };
    let main = main(page, posts.as_deref(), now_ms());
    let document = document::page(&state.pages.site, &head, path_and_query(&request), main);
    html_cached(StatusCode::OK, DYNAMIC_PAGE_CACHE, document)
}

/// `CommunityPageIntro`.
fn intro() -> Markup {
    html! {
        section aria-labelledby="community-title" class="relative isolate overflow-hidden rounded-3xl border border-border bg-surface-2 px-5 py-6 sm:px-8 sm:py-8" {
            div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0 opacity-40" {}
            div class="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-5" {
                div class="min-w-0 flex-1" {
                    div class="flex items-center gap-2" {
                        h1 id="community-title" class="text-3xl font-black tracking-tight sm:text-4xl" { "커뮤니티" }
                        span class="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-xs font-bold text-accent-text" {
                            span aria-hidden="true" class="signal-live size-1.5 rounded-full bg-(--signal-cyan)" {}
                            "베타"
                        }
                    }
                    p class="mt-2 max-w-2xl text-base leading-relaxed text-muted sm:text-lg" { "밈을 추천하고, 처음 본 맥락을 함께 남겨요." }
                    div class="mt-4 flex flex-wrap items-center gap-2" {
                        a href="/community/new" class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none" {
                            "글쓰기 "
                            svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right size-4" aria-hidden="true" {
                                path d="M5 12h14" {}
                                path d="m12 5 7 7-7 7" {}
                            }
                        }
                        a href="/explore?sort=recent" class="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" { "최신 밈 보기" }
                    }
                }
                div aria-hidden="true" class="hidden h-32 w-40 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ink sm:grid lg:h-36 lg:w-44" {
                    (catch_mascot_help())
                }
            }
        }
    }
}

fn main(page: i64, posts: Option<&[Post]>, now: i64) -> Markup {
    let failed = posts.is_none();
    let posts = posts.unwrap_or_default();
    let size = POSTS_PAGE_SIZE as usize;
    let has_next = posts.len() > size;
    let visible = &posts[..posts.len().min(size)];
    html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-6" {
            (intro())
            @if failed {
                (error_panel("연결 신호 확인 중", "글을 불러오지 못했어요", "연결이 잠시 끊겼어요. 다시 시도하거나 먼저 글을 남겨 주세요.", "mt-6", html! {
                    a href="/community" class=(BUTTON) { "다시 불러오기" }
                    a href="/community/new" class=(PRIMARY) { "글쓰기" }
                    a href="/explore?sort=recent" class=(BUTTON) { "최신 밈 보기" }
                }))
            }
            @if !failed && visible.is_empty() {
                section role="status" aria-labelledby="community-empty-title" class="relative mt-5 grid overflow-hidden rounded-3xl border border-border bg-surface sm:grid-cols-[minmax(0,1fr)_13rem]" {
                    div class="px-5 py-7 sm:px-8 sm:py-9" {
                        p class="text-sm font-bold text-accent-text" { "첫 이야기를 기다리고 있어요" }
                        h2 id="community-empty-title" class="mt-2 text-2xl font-black tracking-tight sm:text-3xl" { "아직 글이 없어요" }
                        p class="mt-2 max-w-xl text-base leading-relaxed text-muted" { "요즘 눈에 띈 밈이나 기억나는 장면을 남기고 대화를 시작해 보세요." }
                        div class="mt-5 flex flex-wrap gap-2" {
                            a href="/community/new" class="inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none" { "첫 글 쓰기" }
                            a href="/explore?sort=recent" class=(BUTTON) { "최신 밈 둘러보기" }
                        }
                    }
                    div aria-hidden="true" class="hidden place-items-center bg-ink sm:grid" { (catch_mascot_help()) }
                }
            }
            ul class="instrument-grid mt-5 space-y-3" {
                @for post in visible {
                    li { (post_card(post, now)) }
                }
            }
            @if page > 1 || has_next {
                nav aria-label="페이지 이동" class="mt-6 flex items-center justify-between" {
                    @if page > 1 {
                        a href=(if page == 2 { "/community".to_owned() } else { format!("/community?page={}", page - 1) }) class=(PAGER) { "이전" }
                    } @else {
                        span {}
                    }
                    @if has_next {
                        a href=(format!("/community?page={}", page + 1)) class=(PAGER) { "더 보기" }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values: Math.max(1, Number.parseInt(raw ?? "1", 10) || 1).
    #[test]
    fn the_page_is_read_as_parse_int_reads_it() {
        for (query, page) in [
            (None, 1),
            (Some("page=2"), 2),
            (Some("page=2abc"), 2),
            (Some("page=-3"), 1),
            (Some("page=x"), 1),
            (Some("page=0"), 1),
            (Some("page=%203"), 3),
        ] {
            assert_eq!(page_number(query), page, "{query:?}");
        }
    }
}
