//! `GET /feed.xml` and `GET /feed/updated.xml`: `app/feed.xml/route.ts`,
//! `app/feed/updated.xml/route.ts`, `lib/meme-rss.ts` and
//! `lib/meme-rss-feeds.ts`.
//!
//! Both are rendered on every request, with the `Cache-Control` the handler
//! sets. Only approved memes that pass the
//! indexability gate are listed.

use axum::extract::State;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};

use super::publication_export::{self, ExportRow, PrimaryOrder};
use super::{csp_report, js, js_date, labels};
use crate::AppState;

/// `MEME_FEED_ITEM_LIMIT`.
const ITEM_LIMIT: usize = 30;

/// `MemeFeedKind`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FeedKind {
    /// Newly published memes, dated by publication.
    New,
    /// Memes whose body changed most recently, dated by that change.
    Updated,
}

impl FeedKind {
    /// `MEME_FEEDS[kind]`: path, title, description.
    fn feed(self) -> (&'static str, &'static str, &'static str) {
        match self {
            Self::New => (
                "/feed.xml",
                "밈캐치 — 새로 등록된 밈",
                "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지. 최근 등록된 밈 30개를 전해드려요.",
            ),
            Self::Updated => (
                "/feed/updated.xml",
                "밈캐치 — 최근 내용이 바뀐 밈",
                "뜻·유래·사용 예시가 최근에 보강되거나 고쳐진 밈 30개를 전해드려요.",
            ),
        }
    }

    fn order(self) -> PrimaryOrder {
        match self {
            Self::New => PrimaryOrder::PublishedAt,
            Self::Updated => PrimaryOrder::UpdatedAt,
        }
    }
}

pub async fn new_memes(State(state): State<AppState>) -> Response {
    respond(&state, FeedKind::New).await
}

pub async fn updated_memes(State(state): State<AppState>) -> Response {
    respond(&state, FeedKind::Updated).await
}

/// `memeFeedResponse`.
async fn respond(state: &AppState, kind: FeedKind) -> Response {
    let loaded =
        publication_export::load_approved_indexable(&state.db, kind.order(), ITEM_LIMIT, false)
            .await;
    match loaded {
        Ok((memes, _)) => (
            [
                (CONTENT_TYPE, "application/rss+xml; charset=utf-8"),
                (CACHE_CONTROL, "public, max-age=3600"),
            ],
            render(
                &memes,
                kind,
                labels::site_url(&state.config.site_url),
                csp_report::now_ms(),
            ),
        )
            .into_response(),
        Err(error) => {
            tracing::error!("[{}] publication export failed: {error}", kind.feed().0);
            publication_export::unavailable_response()
        }
    }
}

/// `escapeXml`.
fn escape_xml(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            other => out.push(other),
        }
    }
    out
}

/// `validDate`: the instant of a real timestamp that is not in the future,
/// in milliseconds. Never falls back to now.
fn valid_date(value: Option<&str>, now_ms: i64) -> Option<i64> {
    js_date::evidence_ms(js::trim(value?), now_ms)
}

/// `renderItem`.
fn render_item(meme: &ExportRow, kind: FeedKind, site_url: &str, now_ms: i64) -> String {
    let url = format!(
        "{site_url}{}",
        labels::meme_path(&meme.short_id, &meme.slug)
    );
    let category = labels::category_label(&meme.category).unwrap_or(&meme.category);
    let item_date = match kind {
        FeedKind::New => valid_date(meme.published_at.as_deref(), now_ms),
        FeedKind::Updated => valid_date(Some(&meme.updated_at), now_ms),
    };
    let pub_date = item_date
        .and_then(js_date::to_utc_string)
        .map(|date| format!("\n      <pubDate>{date}</pubDate>"))
        .unwrap_or_default();
    // A rewrite is a new event for feed readers, so the updated feed keys the
    // guid on the revision as well as the meme.
    let guid = match (kind, item_date) {
        (FeedKind::Updated, Some(ms)) => format!("memecatch-{}-{ms}", meme.short_id),
        _ => format!("memecatch-{}", meme.short_id),
    };
    format!(
        "    <item>\n      <title>{}</title>\n      <link>{}</link>\n      <guid isPermaLink=\"false\">{}</guid>\n      <description>{}</description>\n      <category>{}</category>{pub_date}\n    </item>",
        escape_xml(&meme.title),
        escape_xml(&url),
        escape_xml(&guid),
        escape_xml(&meme.summary),
        escape_xml(category),
    )
}

/// `renderMemeRss`. `now_ms` is `Date.now()`: a date after it is left out.
pub fn render(memes: &[ExportRow], kind: FeedKind, site_url: &str, now_ms: i64) -> String {
    let (path, title, description) = kind.feed();
    let items: Vec<String> = memes
        .iter()
        .map(|meme| render_item(meme, kind, site_url, now_ms))
        .collect();
    let last_build_date = memes
        .iter()
        .filter_map(|meme| valid_date(Some(&meme.updated_at), now_ms))
        .max()
        .and_then(js_date::to_utc_string)
        .map(|date| format!("\n    <lastBuildDate>{date}</lastBuildDate>"))
        .unwrap_or_default();
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">\n  <channel>\n    <title>{}</title>\n    <link>{}</link>\n    <atom:link href=\"{}\" rel=\"self\" type=\"application/rss+xml\"/>\n    <description>{}</description>\n    <language>ko</language>{last_build_date}\n{}\n  </channel>\n</rss>",
        escape_xml(title),
        escape_xml(site_url),
        escape_xml(&format!("{site_url}{path}")),
        escape_xml(description),
        items.join("\n"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xml_escapes_the_five_characters_and_nothing_else() {
        assert_eq!(
            escape_xml("a & b < c > d \"e\" 'f' &amp; 밈\n"),
            "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos; &amp;amp; 밈\n"
        );
    }

    #[test]
    fn a_date_is_valid_only_when_real_and_not_in_the_future() {
        let now = js_date::parse_ms("2026-07-16T00:30:00+00:00").unwrap();

        assert_eq!(
            valid_date(Some(" 2026-07-16T00:30:00+00:00 "), now),
            Some(now)
        );
        assert_eq!(valid_date(Some("2026-07-16T00:30:00.001+00:00"), now), None);
        assert_eq!(valid_date(Some("2026-02-30"), now), None);
        assert_eq!(valid_date(Some(""), now), None);
        assert_eq!(valid_date(None, now), None);
    }
}
