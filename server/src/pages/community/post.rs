//! `GET /community/{id}` (`app/(default)/community/[id]/page.tsx`): one
//! visible post, read as the anonymous visitor, its Markdown body
//! (`crate::markdown`), the like button and the comments, oldest first.
//!
//! A key that is not a UUID, or no visible post, is the not-found document
//! with the page's own title. Next streams it with status 200 (its soft-404
//! defect, noted in `app/(default)/not-found.tsx`); here it is a 404
//! (PLAN.md B6-22).
//!
//! The like button (`ui/community-post.js`) reads and toggles through the
//! planner as `CommunityLikeButton` does; the comment form posts to
//! `POST /api/community/post-comment` (`routes/community.rs`), whose answer
//! carries the list rendered again (`comments_list`), where Next's action
//! calls `router.refresh()`.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, PreEscaped, html};
use percent_encoding::percent_decode_str;

use super::{
    POST_COLUMNS, POST_FROM, Post, PostRow, grouped, heart_icon, meme_chip, post_from_row,
    strip_markdown, time_ago,
};
use crate::AppState;
use crate::auth::now_ms;
use crate::db::{DbIdentity, IdentityOptions};
use crate::fallback;
use crate::markdown::markdown_body;
use crate::pages::document::{self, Head, ShareImage};
use crate::pages::{DYNAMIC_PAGE_CACHE, html_cached, json_ld, not_found, path_and_query};
use crate::routes::public::js;

/// `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
pub fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => *byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        })
}

/// `getPost`: the visible post with this id, or none (also on a failed read).
async fn read_post(state: &AppState, id: &str) -> Option<Post> {
    let sql = format!(
        "select {POST_COLUMNS} from {POST_FROM} where p.id = $1::uuid and p.status = 'visible'"
    );
    let id = id.to_owned();
    let row: Result<Option<PostRow>, sqlx::Error> = state
        .db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(sqlx::AssertSqlSafe(sql))
                    .bind(id)
                    .fetch_optional(tx)
                    .await
            })
        })
        .await;
    match row {
        Ok(row) => row.map(post_from_row),
        Err(error) => {
            tracing::warn!(%error, "community post read failed");
            None
        }
    }
}

/// A comment as the page reads it: body, `created_at` as the planner
/// returns it and in milliseconds, the author's nickname.
pub struct Comment {
    body: String,
    created_at: (String, i64),
    nickname: Option<String>,
}

const COMMENTS_SQL: &str = r#"select c.body,
       (to_json(c.created_at at time zone 'UTC') #>> '{}') || '+00:00',
       floor(extract(epoch from c.created_at) * 1000)::bigint,
       pr.nickname
  from public.community_comments c
  left join public.profiles pr on pr.id = c.user_id
 where c.post_id = $1::uuid
 order by c.created_at"#;

/// The post's comments, oldest first, as the anonymous visitor (row-level
/// security); none when they cannot be read (`data ?? []`).
pub async fn read_comments(state: &AppState, post_id: &str) -> Vec<Comment> {
    type Row = (String, String, i64, Option<String>);
    let post_id = post_id.to_owned();
    let rows: Result<Vec<Row>, sqlx::Error> = state
        .db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(COMMENTS_SQL)
                    .bind(post_id)
                    .fetch_all(tx)
                    .await
            })
        })
        .await;
    match rows {
        Ok(rows) => rows
            .into_iter()
            .map(|(body, created, created_ms, nickname)| Comment {
                body,
                created_at: (created, created_ms),
                nickname,
            })
            .collect(),
        Err(error) => {
            tracing::warn!(%error, "community comments read failed");
            Vec::new()
        }
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let target = path_and_query(&request).to_owned();
    // Next decodes the segment before testing it.
    let segment = request
        .uri()
        .path()
        .strip_prefix("/community/")
        .unwrap_or_default();
    // `/community/new` is a route of its own (`new.rs`); it reaches this
    // handler only while that route is switched off.
    if segment == "new" {
        return fallback::answer(State(state), request).await;
    }
    let id = percent_decode_str(segment).decode_utf8().ok();
    let post = match id.as_deref().filter(|id| is_uuid(id)) {
        Some(id) => read_post(&state, id).await,
        None => None,
    };
    let Some(post) = post else {
        return not_found::response_titled(
            &state.pages.site,
            &target,
            "글을 찾을 수 없어요",
            "noindex",
        );
    };
    let comments = read_comments(&state, &post.id).await;
    let site = &state.pages.site;
    let path = format!("/community/{}", post.id);
    // `.slice(0, 120)`; a surrogate left alone is written as U+FFFD.
    let excerpt = strip_markdown(&post.body);
    let description = match js::utf16_slice(&excerpt, 120) {
        (head, None) => head.to_owned(),
        (head, Some(_)) => format!("{head}\u{FFFD}"),
    };
    let head = Head {
        title: post.title.clone(),
        description: Some(description),
        canonical: Some(path.clone()),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    let main = main(&state, &post, &comments, now_ms());
    html_cached(
        StatusCode::OK,
        DYNAMIC_PAGE_CACHE,
        document::page(site, &head, &target, main),
    )
}

const BACK: &str = r#"<path d="m15 6-6 6 6 6"></path>"#;

fn main(state: &AppState, post: &Post, comments: &[Comment], now: i64) -> Markup {
    let nickname = post.nickname.as_deref().unwrap_or("익명");
    html! {
        main class="mx-auto max-w-site space-y-6 px-4 pb-14 pt-6" {
            (json_ld::forum_posting(&state.pages.site, &json_ld::ForumPosting {
                id: &post.id,
                title: &post.title,
                body: &post.body,
                author: nickname,
                created_at: &post.created_at.0,
                likes: post.like_count,
                comments: comments.len(),
            }))
            nav aria-label="뒤로 가기" {
                a class="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-muted transition-colors hover:text-foreground" href="/community" {
                    svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" { (PreEscaped(BACK)) }
                    "커뮤니티"
                }
            }
            article class="hover-glow-flame rounded-2xl border border-border bg-surface p-5" {
                header {
                    h1 class="text-3xl font-extrabold leading-snug tracking-[-0.02em] [word-break:keep-all] sm:text-4xl" { (post.title) }
                    p class="mt-2 flex items-center gap-2 text-sm text-muted" {
                        span id="author" class="font-semibold text-foreground" { (nickname) }
                        time datetime=(post.created_at.0) { (time_ago(post.created_at.1, now)) }
                    }
                }
                (PreEscaped(markdown_body(&post.body, "mt-4")))
                @if let Some(meme) = &post.meme {
                    (meme_chip(meme, "mt-5"))
                }
                div class="mt-5 border-t border-border pt-4" {
                    button type="button" aria-pressed="false" class="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-base font-semibold transition-colors active:scale-[0.97] border-border bg-surface text-foreground" data-post-like=(post.id) data-count=(post.like_count) {
                        (heart_icon("h-5 w-5"))
                        "좋아요 "
                        span class="stat-mono text-signal-cyan" { (grouped(post.like_count)) }
                    }
                }
            }
            section aria-label="댓글" class="space-y-4" data-post-comments=(post.id) {
                h2 class="text-lg font-bold" {
                    "댓글 "
                    span class="stat-mono text-(--signal-cyan)" { (grouped(i64::try_from(comments.len()).unwrap_or(i64::MAX))) }
                }
                form class="space-y-2" data-post-comment-form {
                    label class="sr-only" for=(format!("community-comment-{}", post.id)) { "댓글 내용" }
                    textarea id=(format!("community-comment-{}", post.id)) placeholder="이 글에 하고 싶은 말을 남겨 주세요." maxlength="1000" rows="3" class="w-full resize-y rounded-xl border border-border bg-surface p-3 text-base placeholder:text-muted focus:outline-none" {}
                    div class="flex flex-wrap items-center justify-between gap-2" {
                        p class="text-sm text-muted" { "0/1,000자 · 10분에 최대 10개까지 쓸 수 있어요" }
                        button type="submit" disabled class="hover-glow-flame inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50" { "댓글 남기기" }
                    }
                }
                (comments_list(comments, now))
            }
        }
    }
}

/// The list under the form: the empty state, or each comment.
pub fn comments_list(comments: &[Comment], now: i64) -> Markup {
    html! {
        @if comments.is_empty() {
            p class="rounded-xl bg-surface-2 p-6 text-center text-base text-muted" data-post-comment-list { "아직 댓글이 없어요. 첫 댓글을 남겨보세요!" }
        } @else {
            ul class="space-y-3" data-post-comment-list {
                @for comment in comments {
                    li {
                        article class="rounded-xl bg-surface-2 p-4" {
                            header class="flex items-center gap-2 text-sm text-muted" {
                                span class="font-semibold text-foreground" { (comment.nickname.as_deref().unwrap_or("익명")) }
                                time datetime=(comment.created_at.0) { (time_ago(comment.created_at.1, now)) }
                            }
                            p class="mt-1 whitespace-pre-wrap text-base" { (comment.body) }
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

    #[test]
    fn a_key_is_a_uuid_as_the_page_tests_it() {
        assert!(is_uuid("b6000000-0000-4000-8000-000000000001"));
        assert!(is_uuid("B6000000-0000-4000-8000-00000000000A"));
        // Any version and variant digits.
        assert!(is_uuid("b6000000-0000-0000-0000-000000000001"));
        assert!(!is_uuid("b6000000-0000-4000-8000-00000000000"));
        assert!(!is_uuid("b6000000x0000-4000-8000-000000000001"));
        assert!(!is_uuid("nope"));
    }
}
