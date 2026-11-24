//! The document's community parts while `flags.communityEnabled` is on
//! (batch B6): `components/reaction-bar.tsx` and `components/comments.tsx`
//! as the server renders them. `ui/meme-community.js` brings them to life:
//! the toggle is `toggle_reaction` through the planner, the comments are
//! read through the planner and written through `community-comment` and
//! `community-report` (`routes/community.rs`).

use maud::{Markup, html};

use crate::db::{Db, DbIdentity, IdentityOptions};

/// `REACTIONS` of lib/labels.ts: key, label, emoji, in order.
const REACTIONS: [(&str, &str, &str); 6] = [
    ("understood", "이해됨", "💡"),
    ("funny", "웃김", "😂"),
    ("just_learned", "이제 알았다", "👀"),
    ("too_late", "이미 늦었다", "🕰️"),
    ("still_alive", "아직 살아있다", "🔥"),
    ("risky", "쓰면 위험하다", "🚨"),
];

/// `getReactionCounts`: the anonymous read of `meme_reaction_counts`; any
/// failure is no counts.
pub async fn reaction_counts(db: &Db, meme_id: &str) -> Vec<(String, i32)> {
    type Row = (Option<String>, Option<i32>);
    let meme_id = meme_id.to_owned();
    let rows: Result<Vec<Row>, sqlx::Error> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select reaction::text, cnt from public.meme_reaction_counts where meme_id = $1::uuid",
                )
                .bind(meme_id)
                .fetch_all(tx)
                .await
            })
        })
        .await;
    match rows {
        Ok(rows) => rows
            .into_iter()
            .filter_map(|(reaction, count)| Some((reaction?, count.unwrap_or(0))))
            .collect(),
        Err(error) => {
            tracing::warn!(%error, "reaction counts read failed");
            Vec::new()
        }
    }
}

/// `ReactionBar` before hydration: nothing is the reader's yet, and each
/// emoji waits at the scale its pop starts from.
pub fn reaction_bar(meme_id: &str, counts: &[(String, i32)]) -> Markup {
    html! {
        section aria-labelledby="reaction-bar-title" class="rounded-2xl border border-border bg-surface p-5" data-reaction-bar=(meme_id) {
            h2 id="reaction-bar-title" class="text-lg font-bold" { "이 밈, 어땠어요?" }
            div class="mt-3 flex flex-wrap gap-2" {
                @for (key, label, emoji) in REACTIONS {
                    // The last row of a reaction wins, as in the loop that builds `counts`.
                    @let count = counts.iter().rev().find(|(reaction, _)| reaction == key).map_or(0, |(_, count)| *count);
                    button type="button" aria-disabled="false" aria-pressed="false" class="hover-glow-flame inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-base font-medium transition-colors border-border bg-surface-2 text-foreground " tabindex="0" data-reaction=(key) data-count=(count) {
                        span aria-hidden="true" class="inline-block" style="transform:scale(1.3)" { (emoji) }
                        (label)
                        @if count > 0 {
                            span class="stat-mono relative inline-flex text-muted" {
                                span class="inline-flex overflow-hidden" {
                                    span style="opacity:1;transform:none" { (count) }
                                }
                                span aria-hidden="true" class="pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-(--signal-cyan)" style="opacity:0" {}
                            }
                        }
                    }
                }
            }
            p role="status" aria-live="polite" class="mt-2 min-h-5 text-sm text-muted" {}
        }
    }
}

/// `Comments` before its read: the form, then the loading skeleton.
pub fn comments(meme_id: &str) -> Markup {
    let field = format!("comment-body-root-{meme_id}");
    html! {
        section aria-label="댓글" class="space-y-4" data-comments=(meme_id) {
            h2 class="text-lg font-bold" { "댓글" }
            form class="space-y-2" data-comment-form {
                label class="sr-only" for=(field) { "댓글 내용" }
                textarea id=(field) placeholder="이 밈, 어디서 처음 봤어요? 편하게 남겨 주세요." maxlength="2000" rows="3" class="w-full resize-y rounded-xl border border-border bg-surface p-3 text-base placeholder:text-muted focus:border-signal-cyan focus:outline-none focus:ring-4 focus:ring-signal-cyan/20" {}
                div class="flex flex-wrap items-center justify-between gap-2" {
                    p class="text-sm text-muted" { "0/2,000자 · 10분에 최대 10개까지 쓸 수 있어요" }
                    button type="submit" disabled class="hover-glow-flame holo-sheen inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50" { "댓글 남기기" }
                }
            }
            ul class="space-y-3" aria-hidden="true" data-comments-loading {
                @for _ in 0..3 {
                    li class="instrument-grid animate-pulse rounded-xl bg-surface-2 p-4" {
                        div class="h-4 w-24 rounded bg-border" {}
                        div class="mt-2 h-4 w-full rounded bg-border" {}
                    }
                }
            }
            ul class="space-y-4" data-comments-list {}
        }
    }
}
