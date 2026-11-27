//! Batch B6: the community (`app/(default)/community/`). Route ids
//! `page-community` (the list), `page-community-post` (a post), `page-community-new` (the writing form).
//!
//! Shared here: the post card and meme chip (`components/community-post-
//! card.tsx`), `CatchMascot`, `StatusPanel`, `timeAgo` and
//! `stripMarkdownToText` (lib/markdown.ts).

pub mod list;
pub mod new;
pub mod post;

use maud::{Markup, PreEscaped, html};

use crate::pages::labels;
use crate::routes::public::js;

/// `POSTS_PAGE_SIZE`.
pub const POSTS_PAGE_SIZE: i64 = 20;

/// A post as `POST_SELECT` reads it.
pub struct Post {
    pub id: String,
    pub title: String,
    pub body: String,
    pub like_count: i64,
    pub comment_count: i64,
    /// As the planner returns `created_at` (`datetime`), and in milliseconds.
    pub created_at: (String, i64),
    pub nickname: Option<String>,
    pub meme: Option<MemeMini>,
    pub origin_source_url: Option<String>,
    pub origin_source_platform: Option<String>,
    pub origin_source_availability: String,
}

/// `CommunityMemeMini`.
pub struct MemeMini {
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub category: String,
}

/// `POST_SELECT` as SQL: the author's nickname and the attached meme as
/// visible to the reader (row-level security on both).
pub const POST_COLUMNS: &str = r#"p.id::text, p.title, p.body, p.like_count::bigint, p.comment_count::bigint,
       (to_json(p.created_at at time zone 'UTC') #>> '{}') || '+00:00',
       floor(extract(epoch from p.created_at) * 1000)::bigint,
       pr.nickname, m.short_id, m.slug, m.title, m.summary, m.category::text,
       p.origin_source_url, p.origin_source_platform, p.origin_source_availability::text"#;
pub const POST_FROM: &str = "public.community_posts p
  left join public.profiles pr on pr.id = p.user_id
  left join public.memes m on m.id = p.meme_id";

pub type PostRow = (
    String,
    String,
    String,
    i64,
    i64,
    String,
    i64,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    String,
);

pub fn post_from_row(row: PostRow) -> Post {
    let (
        id,
        title,
        body,
        like_count,
        comment_count,
        created,
        created_ms,
        nickname,
        short_id,
        slug,
        meme_title,
        summary,
        category,
        origin_source_url,
        origin_source_platform,
        origin_source_availability,
    ) = row;
    let meme = match (short_id, meme_title) {
        (Some(short_id), Some(title)) => Some(MemeMini {
            short_id,
            slug: slug.unwrap_or_default(),
            title,
            summary: summary.unwrap_or_default(),
            category: category.unwrap_or_default(),
        }),
        _ => None,
    };
    Post {
        id,
        title,
        body,
        like_count,
        comment_count,
        created_at: (created, created_ms),
        nickname,
        meme,
        origin_source_url,
        origin_source_platform,
        origin_source_availability,
    }
}

/// `timeAgo(iso)` at `now_ms`. Past 30 days, `toLocaleDateString("ko-KR")`
/// in UTC.
pub fn time_ago(created_ms: i64, now_ms: i64) -> String {
    let minutes = (now_ms - created_ms).div_euclid(60_000);
    if minutes < 1 {
        return "방금 전".to_owned();
    }
    if minutes < 60 {
        return format!("{minutes}분 전");
    }
    let hours = minutes / 60;
    if hours < 24 {
        return format!("{hours}시간 전");
    }
    let days = hours / 24;
    if days < 30 {
        return format!("{days}일 전");
    }
    let at = time::OffsetDateTime::from_unix_timestamp_nanos(i128::from(created_ms) * 1_000_000)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    format!("{}. {}. {}.", at.year(), u8::from(at.month()), at.day())
}

/// `toLocaleString("ko-KR")` of a count: digits grouped by commas.
pub fn grouped(count: i64) -> String {
    let digits = count.unsigned_abs().to_string();
    let mut out = String::new();
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            out.push(',');
        }
        out.push(digit);
    }
    if count < 0 { format!("-{out}") } else { out }
}

/// One fence of `stripMarkdownToText` replaced by its content:
/// `/F[^\n]*\n?([\s\S]*?)F/g` with the regex's backtracking (a fence with
/// no closing marker after its first line closes on the last marker of
/// that line, with nothing inside).
fn strip_fences(text: &str, fence: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find(fence) {
        let after = &rest[start + fence.len()..];
        let line_end = after.find('\n');
        let closed = line_end.and_then(|end| {
            after[end + 1..]
                .find(fence)
                .map(|close| (end + 1, end + 1 + close))
        });
        let matched = closed.or_else(|| {
            let line = &after[..line_end.unwrap_or(after.len())];
            line.rfind(fence).map(|close| (close, close))
        });
        match matched {
            Some((from, to)) => {
                out.push_str(&rest[..start]);
                out.push_str(&after[from..to]);
                rest = &after[to + fence.len()..];
            }
            None => {
                out.push_str(&rest[..start + 1]);
                rest = &rest[start + 1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// `[label](url)` (or `![alt](url)` with `bang`) replaced by the label:
/// `/!?\[([^\]]*)\]\([^)]*\)/g`.
fn strip_links(text: &str, bang: bool) -> String {
    let open = if bang { "![" } else { "[" };
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find(open) {
        let label_start = start + open.len();
        let matched = rest[label_start..].find(']').and_then(|close| {
            let after = label_start + close + 1;
            if !rest[after..].starts_with('(') {
                return None;
            }
            rest[after + 1..]
                .find(')')
                .map(|end| (label_start + close, after + 1 + end + 1))
        });
        match matched {
            Some((label_end, end)) => {
                out.push_str(&rest[..start]);
                out.push_str(&rest[label_start..label_end]);
                rest = &rest[end..];
            }
            None => {
                out.push_str(&rest[..start + 1]);
                rest = &rest[start + 1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// The length of `http://` or `https://` at the start, case-insensitively.
fn url_scheme_len(text: &str) -> Option<usize> {
    let head = text
        .get(..8)
        .or_else(|| text.get(..7))
        .unwrap_or_default()
        .to_ascii_lowercase();
    if head.starts_with("https://") {
        Some(8)
    } else if head.starts_with("http://") {
        Some(7)
    } else {
        None
    }
}

/// `/<https?:\/\/[^>]+>/gi` and then `/https?:\/\/\S+/gi`, removed.
fn strip_urls(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find('<') {
        let matched = url_scheme_len(&rest[start + 1..]).and_then(|scheme| {
            let body = start + 1 + scheme;
            let close = rest[body..].find('>')?;
            (close > 0).then_some(body + close + 1)
        });
        match matched {
            Some(end) => {
                out.push_str(&rest[..start]);
                rest = &rest[end..];
            }
            None => {
                out.push_str(&rest[..start + 1]);
                rest = &rest[start + 1..];
            }
        }
    }
    out.push_str(rest);
    let text = out;
    let mut out = String::new();
    let mut index = 0;
    while index < text.len() {
        let here = &text[index..];
        if here.starts_with(['h', 'H'])
            && let Some(scheme) = url_scheme_len(here)
        {
            let tail = &here[scheme..];
            let run = tail.find(js::is_space).unwrap_or(tail.len());
            if run > 0 {
                index += scheme + run;
                continue;
            }
        }
        let c = here.chars().next().unwrap_or_default();
        out.push(c);
        index += c.len_utf8();
    }
    out
}

/// The three line-start rules (`/^…/gm`), line by line.
fn strip_line_starts(text: &str) -> String {
    let blank = |c: char| c == ' ' || c == '\t';
    let rule = |line: &str| -> String {
        let mut line = line.to_owned();
        // /^[ \t]*#{1,6}[ \t]+/
        let rest = line.trim_start_matches(blank);
        let hashes = rest.chars().take_while(|c| *c == '#').count();
        if (1..=6).contains(&hashes) && rest[hashes..].starts_with(blank) {
            line = rest[hashes..].trim_start_matches(blank).to_owned();
        }
        // /^[ \t]*>+[ \t]?/
        let rest = line.trim_start_matches(blank);
        if rest.starts_with('>') {
            let quoted = rest.trim_start_matches('>');
            line = quoted.strip_prefix(blank).unwrap_or(quoted).to_owned();
        }
        // /^[ \t]*(?:[-*+]|\d+\.)[ \t]+/
        let rest = line.trim_start_matches(blank);
        let marker = if rest.starts_with(['-', '*', '+']) {
            Some(1)
        } else {
            let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
            (digits > 0 && rest[digits..].starts_with('.')).then_some(digits + 1)
        };
        if let Some(marker) = marker
            && rest[marker..].starts_with(blank)
        {
            line = rest[marker..].trim_start_matches(blank).to_owned();
        }
        line
    };
    text.split('\n').map(rule).collect::<Vec<_>>().join("\n")
}

/// `/(\*\*|__|~~|`|\*)/g` removed: every `*` and backtick, and `_` or `~`
/// in pairs from the left.
fn strip_emphasis(text: &str) -> String {
    let mut out = String::new();
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '*' | '`' => {}
            '_' | '~' if chars.peek() == Some(&c) => {
                chars.next();
            }
            _ => out.push(c),
        }
    }
    out
}

/// Runs of `c` of at least `min` replaced by `with`.
fn collapse_runs(text: &str, is_run: impl Fn(char) -> bool, min: usize, with: &str) -> String {
    let mut out = String::new();
    let mut run = String::new();
    for c in text.chars().chain(std::iter::once('\0')) {
        if c != '\0' && is_run(c) {
            run.push(c);
            continue;
        }
        if run.chars().count() >= min {
            out.push_str(with);
        } else {
            out.push_str(&run);
        }
        run.clear();
        if c != '\0' {
            out.push(c);
        }
    }
    out
}

/// `stripMarkdownToText`.
pub fn strip_markdown(md: &str) -> String {
    let text = strip_fences(md, "```");
    let text = strip_fences(&text, "~~~");
    let text = strip_links(&text, true);
    let text = strip_links(&text, false);
    let text = strip_urls(&text);
    let text = strip_line_starts(&text);
    let text = strip_emphasis(&text);
    let text = collapse_runs(&text, |c| c == '\n', 3, "\n\n");
    let text = collapse_runs(&text, |c| c == ' ' || c == '\t', 2, " ");
    js::trim(&text).to_owned()
}

/// `memePathFrom(shortId, slug)`.
pub fn meme_path(short_id: &str, slug: &str) -> String {
    if slug.is_empty() {
        format!("/memes/{short_id}")
    } else {
        format!("/memes/{short_id}-{slug}")
    }
}

const HEART: &str = r#"<path d="M12 20.5S4 15.5 4 9.8A4.3 4.3 0 0 1 8.3 5.5c1.6 0 3 .9 3.7 2.1a4.3 4.3 0 0 1 3.7-2.1A4.3 4.3 0 0 1 20 9.8c0 5.7-8 10.7-8 10.7Z"></path>"#;
const BUBBLE: &str = r#"<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15.5H10l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 14V7A1.5 1.5 0 0 1 5 5.5Z"></path>"#;
const CHEVRON: &str = r#"<path d="m9 6 6 6-6 6"></path>"#;

/// A stroked 24-unit icon of this module (trusted constant paths).
pub fn icon(class: &str, paths: &'static str) -> Markup {
    html! {
        svg class=(class) viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" { (PreEscaped(paths)) }
    }
}

pub fn heart_icon(class: &str) -> Markup {
    icon(class, HEART)
}

pub fn bubble_icon(class: &str) -> Markup {
    icon(class, BUBBLE)
}

/// `CommunityMemeChip`.
pub fn meme_chip(meme: &MemeMini, class: &str) -> Markup {
    html! {
        a href=(meme_path(&meme.short_id, &meme.slug)) class=(format!("flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2 transition-colors hover:border-accent {class}")) {
            @if let Some(tag) = labels::category_tag(&meme.category, "") { (tag) }
            span class="min-w-0 flex-1" {
                span class="block truncate text-sm font-bold" { (meme.title) }
                span class="block truncate text-xs text-muted" { (meme.summary) }
            }
            (icon("h-4 w-4 shrink-0 text-muted", CHEVRON))
        }
    }
}

/// `CommunityPostCard`.
pub fn post_card(post: &Post, now_ms: i64) -> Markup {
    html! {
        article data-pointer-light="" class="signal-surface hover-glow-flame rounded-2xl border border-border bg-surface p-4 shadow-sm" {
            header class="flex items-center gap-2 text-sm text-muted" {
                span class="font-semibold text-foreground" { (post.nickname.as_deref().unwrap_or("익명")) }
                time datetime=(post.created_at.0) { (time_ago(post.created_at.1, now_ms)) }
            }
            h2 class="mt-1.5" {
                a href=(format!("/community/{}", post.id)) class="text-lg font-extrabold leading-snug underline-offset-2 after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" { (post.title) }
            }
            p class="mt-1 line-clamp-2 whitespace-pre-wrap text-base leading-relaxed text-muted" { (strip_markdown(&post.body)) }
            @if let Some(meme) = &post.meme {
                div class="relative z-10 mt-3 w-fit max-w-full" { (meme_chip(meme, "")) }
            }
            footer class="mt-3 flex items-center gap-4 text-sm text-muted" {
                span class="inline-flex items-center gap-1" {
                    (heart_icon("h-4 w-4"))
                    span class="stat-mono text-signal-cyan" { (grouped(post.like_count)) }
                    span class="sr-only" { "개 좋아요" }
                }
                span class="inline-flex items-center gap-1" {
                    (bubble_icon("h-4 w-4"))
                    span class="stat-mono text-signal-cyan" { (grouped(post.comment_count)) }
                    span class="sr-only" { "개 댓글" }
                }
            }
        }
    }
}

/// `CatchMascot size="sm" state="help"`, with fixed ids.
pub fn catch_mascot_help() -> Markup {
    const ID: &str = "_S_c_";
    let body = format!("catch-body-{ID}");
    let highlight = format!("catch-highlight-{ID}");
    let shadow = format!("catch-shadow-{ID}");
    html! {
        div aria-hidden="true" data-catch-size="sm" data-catch-state="help" class="catch-mascot catch-mascot-sm catch-mascot-help" style="--catch-size:9rem" {
            div class="catch-mascot-signal catch-mascot-signal-a" {}
            div class="catch-mascot-signal catch-mascot-signal-b" {}
            svg aria-hidden="true" class="catch-mascot-art" focusable="false" viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" {
                defs {
                    linearGradient id=(body) x1="72" y1="48" x2="230" y2="230" gradientUnits="userSpaceOnUse" {
                        stop stop-color="var(--accent)" {}
                        stop offset="1" stop-color="var(--accent-strong)" {}
                    }
                    linearGradient id=(highlight) x1="82" y1="66" x2="150" y2="150" gradientUnits="userSpaceOnUse" {
                        stop stop-color="white" stop-opacity="0.42" {}
                        stop offset="1" stop-color="white" stop-opacity="0" {}
                    }
                    filter id=(shadow) x="20" y="20" width="280" height="250" filterUnits="userSpaceOnUse" {
                        feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="var(--accent-strong)" flood-opacity="0.18" {}
                    }
                }
                ellipse cx="160" cy="250" rx="78" ry="12" fill="var(--accent-strong)" opacity="0.13" {}
                g class="catch-mascot-scan" aria-hidden="true" {
                    path d="M228 66 273 45M238 88l51-4M241 111l43 13" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" {}
                    circle cx="274" cy="45" r="4" fill="var(--accent-strong)" {}
                    circle cx="289" cy="84" r="4" fill="var(--accent-strong)" {}
                    circle cx="284" cy="124" r="4" fill="var(--accent-strong)" {}
                }
                g class="catch-mascot-context" aria-hidden="true" {
                    rect x="227" y="35" width="68" height="47" rx="10" fill="var(--surface)" stroke="var(--accent-strong)" stroke-width="3" {}
                    path d="M239 50h34M239 61h23" stroke="var(--accent-strong)" stroke-width="4" stroke-linecap="round" {}
                    circle cx="282" cy="61" r="7" fill="var(--safety-green)" {}
                    path d="m279 61 2 2 4-5" stroke="var(--surface)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" {}
                }
                g class="catch-mascot-bob" filter=(format!("url(#{shadow})")) {
                    path d="M217 70c-17-23-43-37-72-37-51 0-92 41-92 92 0 45 32 83 75 91l-13 29 30-21c39 0 73-24 87-58" fill=(format!("url(#{body})")) {}
                    path d="M217 70c-17-23-43-37-72-37-51 0-92 41-92 92 0 45 32 83 75 91" stroke="var(--accent-strong)" stroke-width="10" stroke-linecap="round" {}
                    path d="M105 64c15-14 34-22 56-22 19 0 37 6 51 18-25 1-50 11-69 29-15 14-25 32-30 51-7-12-11-27-11-42 0-13 1-24 3-34Z" fill=(format!("url(#{highlight})")) {}
                    circle class="catch-mascot-dot" cx="204" cy="76" r="13" fill="var(--surface)" {}
                    circle class="catch-mascot-dot-core" cx="204" cy="76" r="7" fill="var(--accent-strong)" {}
                    path d="M151 132c12 10 27 10 39 0" stroke="var(--surface)" stroke-width="6" stroke-linecap="round" {}
                    path d="M112 200 99 229l31-16" fill="var(--accent-strong)" {}
                    path d="M196 196 213 221l4-31" fill="var(--accent-strong)" {}
                    path d="M234 108c22 10 34 28 34 50 0 18-8 34-22 45l-13-19c6-7 9-15 9-25 0-11-5-22-14-29l6-22Z" fill="var(--accent)" opacity="0.55" {}
                }
            }
        }
    }
}

/// `StatusPanel tone="error" role="alert"` with its actions.
pub fn error_panel(
    label: &str,
    title: &str,
    description: &str,
    class: &str,
    actions: Markup,
) -> Markup {
    html! {
        div role="alert" class=(format!("glass-panel relative overflow-hidden rounded-3xl px-6 py-7 text-center sm:px-8 sm:py-8 {class}")) {
            div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0" {}
            div class="relative mx-auto max-w-md" {
                img src="/brand/state-error.webp" alt="" width="1024" height="768" loading="lazy" decoding="async" class="mx-auto mb-3 w-44 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent_98%)] sm:w-48";
                div class="inline-flex min-h-8 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white" {
                    span aria-hidden="true" class="flex items-center gap-1" {
                        span class="h-2 w-2 rounded-full " style="background-color:rgb(255 255 255 / 0.22)" {}
                        span class="h-2 w-2 rounded-full " style="background-color:rgb(255 255 255 / 0.22)" {}
                        span class="h-2 w-2 rounded-full signal-live" style="background-color:var(--safety-red)" {}
                    }
                    (label)
                }
                p class="mt-4 text-xl font-extrabold tracking-tight" { (title) }
                p class="mt-1.5 text-base text-muted" { (description) }
                div class="mt-5 flex flex-wrap items-center justify-center gap-2.5" { (actions) }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values: stripMarkdownToText under Node (lib/markdown.ts).
    #[test]
    fn markdown_is_stripped_as_the_regexes_strip_it() {
        for (md, text) in [
            (
                "**굵게** 쓴 문장과 `코드`.\n\n![사진](/api/media/meme-uploads/x/a.png)\n[링크](https://example.com/a) 와 https://example.com/bare\n\n```js\nconst a = 1;\n```",
                "굵게 쓴 문장과 코드.\n\n사진\n링크 와 \n\nconst a = 1;",
            ),
            (
                "# 제목\n> 인용\n- 목록 하나\n1. 번호",
                "제목\n인용\n목록 하나\n번호",
            ),
            ("a___b ~~c~~ <https://x.y/z> \n\n\n\nd   e", "a_b c \n\nd e"),
            ("```a```b", "b"),
            ("[x](y", "[x](y"),
            ("```a\nb", "a\nb"),
            ("x\t\ty  z\n\n\n\n\nw", "x y z\n\nw"),
        ] {
            assert_eq!(strip_markdown(md), text, "{md:?}");
        }
    }

    // Expected values: timeAgo with Node in UTC.
    #[test]
    fn times_and_counts_read_as_the_card_writes_them() {
        let now = 1_795_700_000_000;
        assert_eq!(time_ago(now - 30_000, now), "방금 전");
        assert_eq!(time_ago(now - 5 * 60_000, now), "5분 전");
        assert_eq!(time_ago(now - 3 * 3_600_000, now), "3시간 전");
        assert_eq!(time_ago(now - 29 * 86_400_000, now), "29일 전");
        assert_eq!(time_ago(1_788_224_400_000, now), "2026. 9. 1.");
        assert_eq!(grouped(1234), "1,234");
        assert_eq!(grouped(0), "0");
        assert_eq!(grouped(1_000_000), "1,000,000");
    }
}
