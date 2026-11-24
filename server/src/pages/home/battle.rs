//! The community meme battle beside the home page:
//! `getCommunityMemeBattle` (lib/community-battle.server.ts) and
//! `CommunityMemeBattle` (components/home/community-meme-battle.tsx).
//!
//! The server renders the first period; the other periods travel as JSON
//! for `ui/home.js`, which switches the tab in place as the component does.

use maud::{Markup, html};
use serde::Serialize;
use sqlx::Row;

use super::icons;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::meme_delivery::normalize_source_url;

/// `BATTLE_PERIODS` and `BATTLE_PERIOD_LABELS`.
const PERIODS: [(&str, &str); 3] = [("day", "오늘"), ("week", "이번 주"), ("month", "이번 달")];
/// `BATTLE_LIST_LIMIT`.
const LIST_LIMIT: i32 = 50;
/// The component's ids, fixed.
const BASE_ID: &str = "axum-id-battle";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    post_id: String,
    title: String,
    thumbnail_url: Option<String>,
    like_count: i64,
    comment_count: i64,
    rank: i64,
    is_promotion_candidate: bool,
}

/// A period that read well (`status: "ready"`); one that did not is left out,
/// as the page drops it.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Board {
    period: &'static str,
    label: &'static str,
    entries: Vec<Entry>,
    total_posts: i64,
    promotion_count: i64,
}

const BATTLE_SQL: &str = "select post_id::text as post_id, title, like_count, comment_count, rank, \
     total_posts, promotion_count, is_promotion_candidate \
     from public.community_meme_battle($1, $2)";

/// `toCount`: a whole number of zero or more.
fn count(row: &sqlx::postgres::PgRow, column: &str) -> Option<i64> {
    row.try_get::<Option<i32>, _>(column)
        .ok()
        .flatten()
        .map(i64::from)
        .filter(|value| *value >= 0)
}

/// `toBattleBoard`: rows of the wrong shape are dropped.
fn board(period: &'static str, label: &'static str, rows: &[sqlx::postgres::PgRow]) -> Board {
    let mut entries = Vec::new();
    let (mut total_posts, mut promotion_count) = (0, 0);
    for row in rows {
        let post_id: Option<String> = row.try_get("post_id").ok().flatten();
        let title: Option<String> = row.try_get("title").ok().flatten();
        let (Some(post_id), Some(title), Some(rank), Some(like_count)) =
            (post_id, title, count(row, "rank"), count(row, "like_count"))
        else {
            continue;
        };
        let title = crate::routes::public::js::trim(&title).to_owned();
        if title.is_empty() || rank < 1 {
            continue;
        }
        total_posts = total_posts.max(count(row, "total_posts").unwrap_or(0));
        promotion_count = promotion_count.max(count(row, "promotion_count").unwrap_or(0));
        entries.push(Entry {
            post_id,
            title,
            thumbnail_url: None,
            like_count,
            comment_count: count(row, "comment_count").unwrap_or(0),
            rank,
            is_promotion_candidate: row
                .try_get::<Option<bool>, _>("is_promotion_candidate")
                .ok()
                .flatten()
                == Some(true),
        });
    }
    entries.sort_by_key(|entry| entry.rank);
    Board {
        period,
        label,
        entries,
        total_posts,
        promotion_count,
    }
}

/// `getCommunityMemeBattle()` without the periods that failed.
pub async fn load(db: &Db) -> Vec<Board> {
    let mut boards = Vec::new();
    for (period, label) in PERIODS {
        let rows = db
            .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
                Box::pin(async move {
                    sqlx::query(BATTLE_SQL)
                        .bind(period)
                        .bind(LIST_LIMIT)
                        .fetch_all(tx)
                        .await
                })
            })
            .await;
        match rows {
            Ok(rows) => boards.push(board(period, label, &rows)),
            Err(error) => tracing::error!(%error, period, "[community-battle] board unavailable"),
        }
    }
    add_previews(db, boards).await
}

/// `addBattlePreviews`: the YouTube still of each visible post's body. A
/// failed read keeps the ranks as they are.
async fn add_previews(db: &Db, mut boards: Vec<Board>) -> Vec<Board> {
    let mut ids: Vec<String> = Vec::new();
    for entry in boards.iter().flat_map(|board| &board.entries) {
        if !ids.contains(&entry.post_id) {
            ids.push(entry.post_id.clone());
        }
    }
    if ids.is_empty() {
        return boards;
    }
    let rows: Result<Vec<(String, String)>, _> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select id::text, body from public.community_posts \
                     where status = 'visible' and id::text = any($1)",
                )
                .bind(ids)
                .fetch_all(tx)
                .await
            })
        })
        .await;
    let Ok(rows) = rows else {
        tracing::error!("[community-battle] previews unavailable");
        return boards;
    };
    for entry in boards.iter_mut().flat_map(|board| &mut board.entries) {
        entry.thumbnail_url = rows
            .iter()
            .find(|(id, _)| *id == entry.post_id)
            .and_then(|(_, body)| thumbnail(body));
    }
    boards
}

/// JavaScript's `\s`.
fn is_space(c: char) -> bool {
    c.is_whitespace() || c == '\u{feff}'
}

/// The destinations of `/!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g`.
fn markdown_destinations(body: &str) -> Vec<&str> {
    let mut found = Vec::new();
    let mut from = 0;
    while let Some(offset) = body[from..].find('[') {
        let open = from + offset;
        let after = &body[open + 1..];
        let matched = (|| {
            let close = after.find([']', '\n'])?;
            if !after[close..].starts_with("](") {
                return None;
            }
            let start = open + 1 + close + 2;
            let rest = &body[start..];
            let skipped = rest.len() - rest.trim_start_matches(is_space).len();
            let target = &rest[skipped..];
            // `<…>` first; when it does not close, the bare form (which
            // then starts with `<`), as the alternation tries it.
            if let Some(inner) = target.strip_prefix('<')
                && let Some(end) = inner.find(['>', '\n'])
                && end > 0
                && inner[end..].starts_with('>')
            {
                return Some((&inner[..end], start + skipped + 1 + end + 1));
            }
            let end = target
                .find(|c: char| is_space(c) || c == ')')
                .unwrap_or(target.len());
            (end > 0).then(|| (&target[..end], start + skipped + end))
        })();
        match matched {
            Some((destination, end)) => {
                found.push(destination);
                from = end;
            }
            None => from = open + 1,
        }
    }
    found
}

/// The matches of `/https:\/\/[^\s<>"']+/g`.
fn https_urls(body: &str) -> Vec<&str> {
    let mut found = Vec::new();
    let mut from = 0;
    while let Some(offset) = body[from..].find("https://") {
        let start = from + offset;
        let rest = &body[start + "https://".len()..];
        let end = rest
            .find(|c: char| is_space(c) || matches!(c, '<' | '>' | '"' | '\''))
            .unwrap_or(rest.len());
        if end == 0 {
            from = start + 1;
            continue;
        }
        let stop = start + "https://".len() + end;
        found.push(&body[start..stop]);
        from = stop;
    }
    found
}

/// `communityBattleThumbnail`: the still of the first YouTube video the
/// body links, and nothing else.
fn thumbnail(body: &str) -> Option<String> {
    markdown_destinations(body)
        .into_iter()
        .chain(https_urls(body))
        .find_map(|candidate| {
            let trimmed = candidate.trim_end_matches(|c: char| "])}>,.!?;:".contains(c));
            let source = normalize_source_url(trimmed)?;
            matches!(source.platform, "youtube" | "youtube_shorts").then(|| {
                format!(
                    "https://i.ytimg.com/vi/{}/hqdefault.jpg",
                    source.external_id
                )
            })
        })
}

const TAB: &str = "min-h-11 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
pub const TAB_ON: &str = "bg-background text-foreground shadow-sm";
pub const TAB_OFF: &str = "text-muted hover:text-foreground";

/// `CommunityMemeBattle` with the first period chosen.
pub fn battle(boards: &[Board]) -> Markup {
    let Some(first) = boards.first() else {
        return html! {};
    };
    html! {
        section aria-labelledby=(format!("{BASE_ID}-title")) class="rounded-2xl border border-border bg-surface p-4 text-foreground" data-battle {
            div class="flex items-center gap-2" {
                (icons::trophy("h-5 w-5 text-accent"))
                h2 id=(format!("{BASE_ID}-title")) class="text-base font-bold" { "밈대결" }
            }
            p class="mt-1 text-sm leading-6 text-muted" { "좋아요를 가장 많이 받은 밈이 이겨요. 기간마다 상위 1%는 검수를 거쳐 밈 사전에 올라가요." }
            div role="tablist" aria-label="밈대결 기간" class="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1" {
                @for board in boards {
                    @let selected = board.period == first.period;
                    button type="button" role="tab" id=(format!("{BASE_ID}-tab-{}", board.period)) aria-selected=(if selected { "true" } else { "false" }) aria-controls=(format!("{BASE_ID}-panel")) class={(TAB) " " (if selected { TAB_ON } else { TAB_OFF })} data-battle-tab=(board.period) {
                        (board.label)
                    }
                }
            }
            div role="tabpanel" id=(format!("{BASE_ID}-panel")) aria-labelledby=(format!("{BASE_ID}-tab-{}", first.period)) class="mt-3" {
                (panel(first))
            }
            div class="mt-3 grid grid-cols-2 gap-2" {
                a href="/community/new" class="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-transparent px-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" { "밈 올리기" }
                a href="/community" class="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" { "투표하러 가기" }
            }
            @for board in boards {
                template data-battle-panel=(board.period) { (panel(board)) }
            }
        }
    }
}

fn panel(board: &Board) -> Markup {
    html! {
        @if board.entries.is_empty() {
            p class="py-4 text-base leading-7 text-foreground" { (board.label) " 올라온 밈이 아직 없어요. 첫 밈을 올려 보세요." }
        } @else {
            ol class="space-y-1" {
                @for entry in &board.entries {
                    li { (entry_link(entry)) }
                }
            }
            p class="mt-2 text-xs text-muted" { "참가 " (board.total_posts) "개 중 상위 " (board.promotion_count) "개가 밈 사전 후보예요." }
            @if board.total_posts > i64::from(LIST_LIMIT) {
                a href="/community" class="mt-2 inline-flex text-xs font-semibold text-accent-text underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" { "나머지 참가작은 커뮤니티에서 보기" }
            }
        }
    }
}

fn entry_link(entry: &Entry) -> Markup {
    let fallback = html! {
        span aria-hidden="true" data-thumbnail-state="fallback" class="flex h-full w-full items-center justify-center text-muted" {
            (icons::image("h-5 w-5"))
        }
    };
    html! {
        a href=(format!("/community/{}", entry.post_id)) class="flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" {
            span class="w-5 shrink-0 text-center text-sm font-bold tabular-nums" { (entry.rank) }
            span class="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2" {
                @match &entry.thumbnail_url {
                    Some(src) => {
                        img src=(src) alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false" data-thumbnail-state="image" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100";
                        template data-thumbnail-fallback { (fallback) }
                    }
                    None => (fallback),
                }
            }
            span class="min-w-0 flex-1" {
                span class="line-clamp-2 break-words text-sm font-semibold leading-5" { (entry.title) }
                span class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted" {
                    span class="inline-flex items-center gap-0.5" {
                        (icons::heart("h-3.5 w-3.5"))
                        span class="sr-only" { "좋아요" }
                        (entry.like_count)
                    }
                    span class="inline-flex items-center gap-0.5" {
                        (icons::message_circle("h-3.5 w-3.5"))
                        span class="sr-only" { "댓글" }
                        (entry.comment_count)
                    }
                    @if entry.is_promotion_candidate {
                        span class="inline-flex rounded-full border border-accent px-1.5 font-semibold text-accent" { "상위 1% 후보" }
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
    fn a_body_gives_the_still_of_its_first_youtube_link() {
        let id = "dQw4w9WgXcQ";
        let still = format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg");
        assert_eq!(
            thumbnail(&format!("봐요 https://youtu.be/{id}.")),
            Some(still.clone())
        );
        assert_eq!(
            thumbnail(&format!(
                "[영상](<https://www.youtube.com/watch?v={id}>) 그리고 https://example.com"
            )),
            Some(still.clone())
        );
        assert_eq!(
            thumbnail(&format!("![x]( https://www.youtube.com/shorts/{id})")),
            Some(still)
        );
        assert_eq!(thumbnail("https://example.com/a.png [b](c d)"), None);
    }

    #[test]
    fn markdown_and_bare_links_are_found_as_javascript_finds_them() {
        assert_eq!(
            markdown_destinations("[a](b) [c\n](d) [e](<f g>) [](h)"),
            ["b", "f g", "h"]
        );
        assert_eq!(markdown_destinations("[x](<open) [y](z)"), ["<open", "z"]);
        assert_eq!(markdown_destinations("[x](<open [y](<>)"), ["open [y](<"]);
        assert_eq!(
            https_urls("x https://a.b/c\"d https://e<f https:// "),
            ["https://a.b/c", "https://e"]
        );
    }
}
