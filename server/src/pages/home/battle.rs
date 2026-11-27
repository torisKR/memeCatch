//! The community meme battle beside the home page:
//! `getCommunityMemeBattle` (lib/community-battle.server.ts) and
//! `CommunityMemeBattle` (components/home/community-meme-battle.tsx).
//!
//! The server renders the first period; the other periods travel as JSON
//! for `ui/home.js`, which switches the tab in place as the component does.
//!
//! A period with fewer than `SAMPLE_TARGET` entries is topped up with
//! dictionary memes that have a verified live original source (prioritising
//! entries with a thumbnail). They link to the meme page and carry no rank or
//! likes: they are suggestions, not entries.

use maud::{Markup, html};
use serde::Serialize;
use sqlx::Row;

use super::icons;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::pages::meme_card::{self, CardContent, CardMeme};
use crate::routes::public::meme_delivery::normalize_source_url;

/// `BATTLE_PERIODS` and `BATTLE_PERIOD_LABELS`.
const PERIODS: [(&str, &str); 3] = [("day", "오늘"), ("week", "이번 주"), ("month", "이번 달")];
/// `BATTLE_LIST_LIMIT`.
const LIST_LIMIT: i32 = 50;
/// The component's ids, fixed.
const BASE_ID: &str = "axum-id-battle";
/// Fewer real entries than this and the free places show dictionary memes.
const SAMPLE_TARGET: usize = 5;
/// Indexable live-origin candidates scanned so thumbnail-backed memes rank first.
const SAMPLE_POOL: usize = 24;

/// A dictionary meme shown under a thin board.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sample {
    pub href: String,
    pub title: String,
    pub thumbnail_url: Option<String>,
}

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

fn sample_thumbnail(meme: &CardMeme) -> Option<String> {
    meme_card::video_preview(&meme.contents).or_else(|| {
        meme.contents
            .iter()
            .find_map(|content| meme_card::owned_art_path(content.thumbnail_url.as_deref()))
    })
}

fn pick_samples(memes: &[CardMeme]) -> Vec<Sample> {
    let mut items: Vec<Sample> = memes
        .iter()
        .map(|meme| Sample {
            href: meme.path(),
            title: meme.title.clone(),
            thumbnail_url: sample_thumbnail(meme),
        })
        .collect();
    // Preserve SQL trend/recency order within each tier, placing memes with a
    // renderable thumbnail ahead of text-only/social-only origins.
    items.sort_by_key(|sample| sample.thumbnail_url.is_none());
    items.truncate(SAMPLE_TARGET);
    items
}

/// Dictionary memes eligible to top up a thin battle board: approved,
/// indexable, and backed by a live original source (`meme_has_live_origin`).
pub async fn load_samples(db: &Db, discovery_ids: &[String]) -> Vec<Sample> {
    if discovery_ids.is_empty() {
        return Vec::new();
    }
    let condition = format!(
        "{} and m.moderation_status = 'approved' and m.published_at is not null \
         and public.meme_has_live_origin(m.id)",
        meme_card::id_in("string_to_array($1, ',')::uuid[]")
    );
    let order = "\
        case when exists ( \
          select 1 from public.meme_contents c \
          where c.meme_id = m.id \
            and c.moderation_status = 'approved' \
            and c.availability not in ('dead', 'region_blocked') \
            and ( \
              c.url ~* '^https://([a-z0-9-]+\\.)?(youtube\\.com/(watch\\?|shorts/|embed/)|youtu\\.be/)' \
              or c.thumbnail_url like '/api/media/meme-thumbs/verified/%' \
              or c.thumbnail_url like 'https://catchmeme.com/api/media/meme-thumbs/verified/%' \
            ) \
        ) then 0 else 1 end asc, \
        m.trend_score desc nulls last, m.published_at desc nulls last, m.id asc";
    match meme_card::indexable(
        db,
        &condition,
        order,
        meme_card::scan_limit(SAMPLE_POOL),
        SAMPLE_POOL,
        vec![discovery_ids.join(",")],
    )
    .await
    {
        Ok(memes) => pick_samples(&memes),
        Err(error) => {
            tracing::warn!(%error, "[community-battle] origin samples unavailable");
            Vec::new()
        }
    }
}

/// `addBattlePreviews`: thumbnail from each post's `origin_source_url`, its
/// attached meme's `video_preview`, or a fallback YouTube link in `body`.
/// A failed read keeps the ranks as they are.
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
    type PreviewRow = (String, String, Option<String>, String);
    let rows: Result<Vec<PreviewRow>, _> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select cp.id::text, cp.body, cp.origin_source_url, \
                     (select coalesce(json_agg(json_build_object( \
                         'type', c.type, 'thumbnail_url', c.thumbnail_url, \
                         'is_representative', c.is_representative, 'platform', c.platform, \
                         'url', c.url, 'content_id', c.content_id, \
                         'availability', c.availability, 'moderation_status', c.moderation_status, \
                         'manual_video_verified', c.manual_video_verified)), '[]'::json)::text \
                        from public.meme_contents c where c.meme_id = cp.meme_id) as meme_contents \
                     from public.community_posts cp \
                     where cp.status = 'visible' and cp.id::text = any($1)",
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
            .find(|(id, _, _, _)| *id == entry.post_id)
            .and_then(|(_, body, origin_url, meme_contents)| {
                origin_url
                    .as_deref()
                    .and_then(youtube_thumbnail)
                    .or_else(|| {
                        serde_json::from_str::<Vec<CardContent>>(meme_contents)
                            .ok()
                            .and_then(|contents| meme_card::video_preview(&contents))
                    })
                    .or_else(|| thumbnail(body))
            });
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

fn youtube_thumbnail(candidate: &str) -> Option<String> {
    let trimmed = candidate.trim_end_matches(|c: char| "])}>,.!?;:".contains(c));
    let source = normalize_source_url(trimmed)?;
    matches!(source.platform, "youtube" | "youtube_shorts").then(|| {
        format!(
            "https://i.ytimg.com/vi/{}/hqdefault.jpg",
            source.external_id
        )
    })
}

/// `communityBattleThumbnail`: the still of the first YouTube video the
/// body links, and nothing else.
fn thumbnail(body: &str) -> Option<String> {
    markdown_destinations(body)
        .into_iter()
        .chain(https_urls(body))
        .find_map(youtube_thumbnail)
}

const TAB: &str = "min-h-11 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
pub const TAB_ON: &str = "bg-background text-foreground shadow-sm";
pub const TAB_OFF: &str = "text-muted hover:text-foreground";

/// `CommunityMemeBattle` with the first period chosen.
pub fn battle(boards: &[Board], samples: &[Sample]) -> Markup {
    let Some(first) = boards.first() else {
        return html! {};
    };
    html! {
        section aria-labelledby=(format!("{BASE_ID}-title")) class="rounded-2xl border border-border bg-surface p-4 text-foreground" data-battle {
            div class="flex items-center gap-2" {
                (icons::trophy("h-5 w-5 text-accent"))
                h2 id=(format!("{BASE_ID}-title")) class="text-base font-bold" { "밈대결" }
            }
            p class="mt-1 text-sm leading-6 text-muted" { "좋아요를 가장 많이 받은 밈이 이겨요. 원본 출처가 확인된 밈만 참가하며, 기간마다 상위 1%는 검수를 거쳐 밈 사전에 올라가요." }
            div role="tablist" aria-label="밈대결 기간" class="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1" {
                @for board in boards {
                    @let selected = board.period == first.period;
                    button type="button" role="tab" id=(format!("{BASE_ID}-tab-{}", board.period)) aria-selected=(if selected { "true" } else { "false" }) aria-controls=(format!("{BASE_ID}-panel")) class={(TAB) " " (if selected { TAB_ON } else { TAB_OFF })} data-battle-tab=(board.period) {
                        (board.label)
                    }
                }
            }
            div role="tabpanel" id=(format!("{BASE_ID}-panel")) aria-labelledby=(format!("{BASE_ID}-tab-{}", first.period)) class="mt-3" {
                (panel(first, samples))
            }
            div class="mt-3 grid grid-cols-2 gap-2" {
                a href="/community/new" class="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-transparent px-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" { "밈 올리기" }
                a href="/community" class="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" { "투표하러 가기" }
            }
            @for board in boards {
                template data-battle-panel=(board.period) { (panel(board, samples)) }
            }
        }
    }
}

/// The samples a board shows: none once it has `SAMPLE_TARGET` entries.
fn samples_for<'a>(board: &Board, samples: &'a [Sample]) -> &'a [Sample] {
    let free = SAMPLE_TARGET.saturating_sub(board.entries.len());
    &samples[..free.min(samples.len())]
}

fn panel(board: &Board, samples: &[Sample]) -> Markup {
    let fill = samples_for(board, samples);
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
        @if !fill.is_empty() {
            div class="mt-3 border-t border-border pt-3" {
                h3 class="text-xs font-semibold text-muted" { "이런 밈으로 도전해 보세요" }
                ul class="mt-1 space-y-1" {
                    @for sample in fill {
                        li {
                            a href=(sample.href) class=(ROW_LINK) {
                                (thumb(sample.thumbnail_url.as_deref()))
                                span class="min-w-0 flex-1" {
                                    span class="line-clamp-2 break-words text-sm font-semibold leading-5" { (sample.title) }
                                    span class="mt-1 inline-flex rounded-full border border-border px-1.5 text-xs text-muted" { "밈 사전 추천" }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

const ROW_LINK: &str = "flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

fn thumb(src: Option<&str>) -> Markup {
    let fallback = html! {
        span aria-hidden="true" data-thumbnail-state="fallback" class="flex h-full w-full items-center justify-center text-muted" {
            (icons::image("h-5 w-5"))
        }
    };
    html! {
        span class="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2" {
            @match src {
                Some(src) => {
                    img src=(src) alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false" data-thumbnail-state="image" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100";
                    template data-thumbnail-fallback { (fallback) }
                }
                None => (fallback),
            }
        }
    }
}

fn entry_link(entry: &Entry) -> Markup {
    html! {
        a href=(format!("/community/{}", entry.post_id)) class=(ROW_LINK) {
            span class="w-5 shrink-0 text-center text-sm font-bold tabular-nums" { (entry.rank) }
            (thumb(entry.thumbnail_url.as_deref()))
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

    fn board_of(entries: usize) -> Board {
        Board {
            period: "day",
            label: "오늘",
            entries: (1..=entries)
                .map(|rank| Entry {
                    post_id: format!("post-{rank}"),
                    title: format!("밈 {rank}"),
                    thumbnail_url: None,
                    like_count: 0,
                    comment_count: 0,
                    rank: rank as i64,
                    is_promotion_candidate: false,
                })
                .collect(),
            total_posts: entries as i64,
            promotion_count: 0,
        }
    }

    #[test]
    fn thin_boards_are_topped_up_after_their_entries_and_full_ones_are_not() {
        let samples: Vec<Sample> = (0..8)
            .map(|index| Sample {
                href: format!("/memes/s{index}"),
                title: format!("추천 {index}"),
                thumbnail_url: None,
            })
            .collect();
        assert_eq!(samples_for(&board_of(0), &samples).len(), 5);
        assert_eq!(samples_for(&board_of(2), &samples).len(), 3);
        assert!(samples_for(&board_of(5), &samples).is_empty());
        assert_eq!(samples_for(&board_of(0), &samples[..2]).len(), 2);

        let html = panel(&board_of(2), &samples).into_string();
        let entry = html.find("/community/post-2").unwrap();
        let sample = html.find("/memes/s0").unwrap();
        assert!(entry < sample, "real entries come first");
        assert_eq!(html.matches("밈 사전 추천").count(), 3);
        assert!(!html.contains("/memes/s3"));
    }

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

    #[test]
    fn pick_samples_prioritises_thumbnail_backed_memes_and_caps_at_five() {
        let make = |id: &str, yt: Option<&str>| CardMeme {
            id: id.to_owned(),
            category: "challenge".to_owned(),
            short_id: id.to_owned(),
            slug: id.to_owned(),
            title: format!("제목 {id}"),
            summary: String::new(),
            safety_level: None,
            origin_year: None,
            trend_score: None,
            contents: yt
                .map(|vid| {
                    vec![CardContent {
                        kind: Some("video".to_owned()),
                        thumbnail_url: None,
                        is_representative: Some(true),
                        url: Some(format!("https://www.youtube.com/watch?v={vid}")),
                        content_id: Some(vid.to_owned()),
                        availability: Some("live".to_owned()),
                        moderation_status: Some("approved".to_owned()),
                        manual_video_verified: Some(false),
                    }]
                })
                .unwrap_or_default(),
        };
        let memes = vec![
            make("no-thumb-1", None),
            make("yt-1", Some("dQw4w9WgXcQ")),
            make("no-thumb-2", None),
            make("yt-2", Some("9bZkp7q19f0")),
            make("no-thumb-3", None),
            make("no-thumb-4", None),
        ];
        let picked = pick_samples(&memes);
        assert_eq!(picked.len(), SAMPLE_TARGET);
        assert_eq!(picked[0].title, "제목 yt-1");
        assert!(picked[0].thumbnail_url.is_some());
        assert_eq!(picked[1].title, "제목 yt-2");
        assert!(picked[1].thumbnail_url.is_some());
        assert_eq!(picked[2].title, "제목 no-thumb-1");
    }
}
