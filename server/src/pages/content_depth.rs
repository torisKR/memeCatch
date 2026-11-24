//! Port of `lib/content-depth.ts` and the source rules of
//! `lib/source-links.ts` it depends on: whether a meme document carries
//! enough prose and evidence of its own to be indexed and to carry ads.
//!
//! Lengths are JavaScript string lengths (UTF-16 code units) and `trim` is
//! JavaScript's, as in the TypeScript: one character of difference moves a
//! document across the 250-character line.

use std::collections::HashSet;

use serde::Deserialize;
use serde_json::Value;
use url::Url;

use crate::routes::public::js;

// CONTENT_DEPTH_THRESHOLDS.
const MIN_PROSE_CHARS: usize = 250;
const MIN_PROSE_CHARS_INDEX: usize = 250;
const MIN_SCORE: u32 = 5;
const DESCRIPTION_RICH: usize = 400;
const DESCRIPTION_SOLID: usize = 250;
const DESCRIPTION_BASIC: usize = 150;
const ORIGIN_RICH: usize = 60;
const ORIGIN_BASIC: usize = 30;
const SUPPORTING_PROSE: usize = 40;
const TAGS: usize = 3;

/// A row of `meme_sources`, with the columns the public pages read.
#[derive(Clone, Debug, Default, Deserialize)]
pub struct SourceRow {
    pub source_url: Option<String>,
    pub title: Option<String>,
    pub hidden_from_public: Option<bool>,
}

/// A row of `meme_contents`, with the two columns that decide whether the
/// page shows it.
#[derive(Clone, Debug, Default, Deserialize)]
pub struct ContentRow {
    pub availability: Option<String>,
    pub moderation_status: Option<String>,
}

/// `ContentDepthInput`.
pub struct DepthInput<'a> {
    pub description: &'a str,
    pub origin: &'a str,
    pub usage_note: Option<&'a str>,
    pub caution: Option<&'a str>,
    pub usage_examples: &'a Value,
    pub sources: &'a [SourceRow],
    pub contents: &'a [ContentRow],
    pub tag_count: usize,
}

/// `ContentDepth` with the signals the pages use.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentDepth {
    pub score: u32,
    pub prose_chars: usize,
    pub origin_chars: usize,
    pub usage_example_count: usize,
    pub source_count: usize,
}

impl ContentDepth {
    /// `isSubstantial`: the bar for the "still being written" note and for ads.
    pub fn is_substantial(&self) -> bool {
        self.prose_chars >= MIN_PROSE_CHARS && self.score >= MIN_SCORE
    }

    pub fn is_thin(&self) -> bool {
        !self.is_substantial()
    }

    /// `isIndexableMeme`: the bar for the sitemap, lists and `robots`.
    pub fn is_indexable(&self) -> bool {
        self.prose_chars >= MIN_PROSE_CHARS_INDEX && self.score >= MIN_SCORE
    }
}

fn text_length(value: &str) -> usize {
    js::utf16_len(js::trim(value))
}

/// `BOILERPLATE_ORIGIN_PATTERNS`: `/공개\s*Wikimedia\s*기록을\s*바탕으로/`.
fn is_boilerplate_origin(origin: &str) -> bool {
    const WORDS: [&str; 4] = ["공개", "Wikimedia", "기록을", "바탕으로"];
    let text = js::trim(origin);
    text.match_indices(WORDS[0]).any(|(start, _)| {
        let mut rest = &text[start..];
        WORDS.iter().enumerate().all(|(index, word)| {
            if index > 0 {
                rest = rest.trim_start_matches(js::is_space);
            }
            rest.strip_prefix(word).map(|after| rest = after).is_some()
        })
    })
}

/// `validUsageExamples`: characters of every `{situation, text}` entry whose
/// two fields are non-blank strings.
fn usage_examples(value: &Value) -> (usize, usize) {
    let Some(items) = value.as_array() else {
        return (0, 0);
    };
    let field = |item: &Value, name: &str| {
        item.as_object()
            .and_then(|object| object.get(name))
            .and_then(Value::as_str)
            .map(text_length)
            .filter(|length| *length > 0)
    };
    items
        .iter()
        .filter_map(|item| Some(field(item, "situation")? + field(item, "text")?))
        .fold((0, 0), |(count, chars), length| (count + 1, chars + length))
}

/// `isPublicDisplaySource`.
pub fn is_public_display_source(source: &SourceRow) -> bool {
    source.hidden_from_public != Some(true)
}

/// `publicSourceUrl`: the normalized URL of a citation link, or `None` for
/// anything that is not a plain `http(s)` link to a public host name.
pub fn public_source_url(value: Option<&str>) -> Option<String> {
    let value = value?;
    if js::utf16_len(value) > 2048
        || value
            .chars()
            .any(|c| c <= '\u{1f}' || c == '\u{7f}' || c == '\\')
    {
        return None;
    }
    let mut url = Url::parse(js::trim(value)).ok()?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return None;
    }
    let host = url.host_str()?.to_lowercase();
    let host = host.strip_suffix('.').unwrap_or(&host).to_owned();
    if !host.contains('.')
        || host.chars().all(|c| c.is_ascii_digit() || c == '.')
        || host.contains(':')
        || host.starts_with('[')
    {
        return None;
    }
    const RESERVED: [&str; 8] = [
        "localhost",
        "local",
        "internal",
        "invalid",
        "test",
        "example",
        "onion",
        "home.arpa",
    ];
    if RESERVED
        .iter()
        .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}")))
    {
        return None;
    }
    // /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/ for every label.
    let label_ok = |label: &str| {
        let bytes = label.as_bytes();
        let edge = |b: &u8| b.is_ascii_lowercase() || b.is_ascii_digit();
        (1..=63).contains(&bytes.len())
            && bytes.first().is_some_and(edge)
            && bytes.last().is_some_and(edge)
            && bytes.iter().all(|b| edge(b) || *b == b'-')
    };
    if !host.split('.').all(label_ok) {
        return None;
    }
    url.set_host(Some(&host)).ok()?;
    Some(url.into())
}

/// `sourceDocumentKey`: two links to one document, apart from the anchor,
/// are one source.
pub fn source_document_key(url: &str) -> &str {
    url.split('#').next().unwrap_or(url)
}

/// `isContextSourceUrl`: a wiki explains the context; it is not the original.
pub fn is_context_source_url(url: &str) -> bool {
    Url::parse(url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_lowercase))
        .is_some_and(|host| host == "namu.wiki" || host.ends_with(".wikipedia.org"))
}

/// `distinctSourceCount`: public sources with a URL, counted once per URL
/// (trimmed and lowercased, as stored, not normalized).
fn distinct_source_count(sources: &[SourceRow]) -> usize {
    sources
        .iter()
        .filter(|source| is_public_display_source(source))
        .filter_map(|source| source.source_url.as_deref())
        .map(|url| js::trim(url).to_lowercase())
        .filter(|url| !url.is_empty())
        .collect::<HashSet<_>>()
        .len()
}

/// `isRenderableContent` in `lib/content-availability.ts`.
fn is_renderable_content(content: &ContentRow) -> bool {
    !matches!(
        content.availability.as_deref(),
        Some("dead" | "region_blocked")
    ) && content.moderation_status.as_deref() == Some("approved")
}

/// `contentDepth`.
pub fn content_depth(meme: &DepthInput<'_>) -> ContentDepth {
    let description_chars = text_length(meme.description);
    let origin_chars = if is_boilerplate_origin(meme.origin) {
        0
    } else {
        text_length(meme.origin)
    };
    let usage_note_chars = meme.usage_note.map_or(0, text_length);
    let caution_chars = meme.caution.map_or(0, text_length);
    let (usage_example_count, usage_example_chars) = usage_examples(meme.usage_examples);
    let source_count = distinct_source_count(meme.sources);
    let supporting = |chars: usize| if chars >= SUPPORTING_PROSE { chars } else { 0 };

    let mut score = 0;
    score += match description_chars {
        n if n >= DESCRIPTION_RICH => 3,
        n if n >= DESCRIPTION_SOLID => 2,
        n if n >= DESCRIPTION_BASIC => 1,
        _ => 0,
    };
    score += match origin_chars {
        n if n >= ORIGIN_RICH => 2,
        n if n >= ORIGIN_BASIC => 1,
        _ => 0,
    };
    score += usage_example_count.min(2) as u32;
    score += source_count.min(2) as u32;
    score += u32::from(meme.contents.iter().any(is_renderable_content));
    score += u32::from(usage_note_chars >= SUPPORTING_PROSE);
    score += u32::from(caution_chars >= SUPPORTING_PROSE);
    score += u32::from(meme.tag_count >= TAGS);

    ContentDepth {
        score,
        prose_chars: description_chars
            + origin_chars
            + supporting(usage_note_chars)
            + supporting(caution_chars)
            + usage_example_chars,
        origin_chars,
        usage_example_count,
        source_count,
    }
}

/// The columns `row_depth` reads, for a query on `memes m`: the prose, the
/// sources and contents as JSON text, and the tag count.
pub const DEPTH_COLUMNS: &str = "\
m.description, m.origin, m.usage_note, m.caution, m.usage_examples::text as usage_examples, \
(select coalesce(json_agg(json_build_object('source_url', s.source_url, \
        'hidden_from_public', s.hidden_from_public)), '[]'::json)::text \
   from public.meme_sources s where s.meme_id = m.id) as sources, \
(select coalesce(json_agg(json_build_object('availability', c.availability, \
        'moderation_status', c.moderation_status)), '[]'::json)::text \
   from public.meme_contents c where c.meme_id = m.id) as contents, \
(select count(*) from public.meme_tags_map t where t.meme_id = m.id) as tag_count";

/// `contentDepth` of a row that has `DEPTH_COLUMNS`.
pub fn row_depth(row: &sqlx::postgres::PgRow) -> Result<ContentDepth, sqlx::Error> {
    use sqlx::Row;
    let decode = |error: serde_json::Error| sqlx::Error::Decode(Box::new(error));
    let sources: Vec<SourceRow> = serde_json::from_str(row.try_get("sources")?).map_err(decode)?;
    let contents: Vec<ContentRow> =
        serde_json::from_str(row.try_get("contents")?).map_err(decode)?;
    let usage_examples: Option<String> = row.try_get("usage_examples")?;
    let usage_examples = usage_examples
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null);
    let tag_count: i64 = row.try_get("tag_count")?;
    let description: Option<String> = row.try_get("description")?;
    let origin: Option<String> = row.try_get("origin")?;
    let usage_note: Option<String> = row.try_get("usage_note")?;
    let caution: Option<String> = row.try_get("caution")?;
    Ok(content_depth(&DepthInput {
        description: description.as_deref().unwrap_or_default(),
        origin: origin.as_deref().unwrap_or_default(),
        usage_note: usage_note.as_deref(),
        caution: caution.as_deref(),
        usage_examples: &usage_examples,
        sources: &sources,
        contents: &contents,
        tag_count: usize::try_from(tag_count).unwrap_or_default(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn source(url: &str) -> SourceRow {
        SourceRow {
            source_url: Some(url.to_owned()),
            ..SourceRow::default()
        }
    }

    fn depth(
        description: &str,
        origin: &str,
        examples: Value,
        sources: &[SourceRow],
    ) -> ContentDepth {
        content_depth(&DepthInput {
            description,
            origin,
            usage_note: None,
            caution: None,
            usage_examples: &examples,
            sources,
            contents: &[],
            tag_count: 0,
        })
    }

    #[test]
    fn a_document_needs_both_250_characters_of_its_own_prose_and_five_points() {
        let long = "가".repeat(250);
        let examples = json!([
            {"situation": "회의", "text": "예문 하나"},
            {"situation": "단톡", "text": "예문 둘"},
        ]);
        let sources = [
            source("https://a.example.org/1"),
            source("https://b.example.org/2"),
        ];

        // 250 characters score 2; two examples 2; two sources 2.
        let rich = depth(&long, "", examples.clone(), &sources);
        assert_eq!(rich.score, 6);
        assert!(rich.is_indexable() && rich.is_substantial());

        // One character short of the prose line, examples aside.
        let short = depth(&"가".repeat(249), "", json!([]), &sources);
        assert_eq!(short.prose_chars, 249);
        assert!(!short.is_indexable());

        // Enough prose, too few points: a long description alone scores 3.
        let bare = depth(&"가".repeat(400), "", json!(null), &[]);
        assert_eq!(bare.score, 3);
        assert!(!bare.is_indexable());
    }

    #[test]
    fn the_generated_wikimedia_sentence_is_not_prose_of_this_document() {
        let origin = "이 문서는 공개 Wikimedia  기록을 바탕으로 2019년 무렵의 유행을 정리했습니다. 충분히 긴 문장입니다.";
        assert_eq!(depth("", origin, json!(null), &[]).origin_chars, 0);
        let own = "공개 방송에서 처음 나온 말로, 이후 커뮤니티에서 널리 퍼졌습니다.";
        assert!(depth("", own, json!(null), &[]).origin_chars > 0);
    }

    #[test]
    fn sources_count_once_per_url_and_hidden_ones_do_not_count() {
        let hidden = SourceRow {
            hidden_from_public: Some(true),
            ..source("https://c.example.org/")
        };
        let sources = [
            source("https://A.example.org/x"),
            source(" https://a.example.org/x "),
            hidden,
            SourceRow::default(),
        ];
        assert_eq!(depth("", "", json!(null), &sources).source_count, 1);
    }

    #[test]
    fn invalid_usage_examples_are_not_counted() {
        let examples = json!([
            {"situation": " ", "text": "빈 상황"},
            {"situation": "상황", "text": 3},
            "문자열",
            {"situation": "상황", "text": "문장"},
        ]);
        let result = depth("", "", examples, &[]);
        assert_eq!(result.usage_example_count, 1);
        assert_eq!(result.prose_chars, 4);
    }

    #[test]
    fn public_source_url_accepts_only_plain_links_to_public_hosts() {
        // Expected values are what lib/source-links.ts publicSourceUrl returns in Node.
        let ok = |input: &str, expected: &str| {
            assert_eq!(
                public_source_url(Some(input)).as_deref(),
                Some(expected),
                "{input}"
            );
        };
        ok("https://namu.wiki/w/밈", "https://namu.wiki/w/%EB%B0%88");
        ok(
            " HTTPS://Example.ORG./a?b=C#d ",
            "https://example.org/a?b=C#d",
        );
        ok(
            "https://www.merriam-webster.com/dictionary/slop",
            "https://www.merriam-webster.com/dictionary/slop",
        );
        for bad in [
            "ftp://example.org/",
            "https://user@example.org/",
            "https://example.org:8443/",
            "https://localhost/",
            "https://intranet/",
            "https://10.0.0.1/",
            "https://a.internal/",
            "https://exa_mple.org/",
            "https://example.org/a\\b",
            "not a url",
        ] {
            assert_eq!(public_source_url(Some(bad)), None, "{bad}");
        }
        assert_eq!(public_source_url(None), None);
    }

    #[test]
    fn wikis_are_context_sources() {
        assert!(is_context_source_url("https://namu.wiki/w/x"));
        assert!(is_context_source_url("https://ko.wikipedia.org/wiki/x"));
        assert!(!is_context_source_url("https://wikipedia.org.example.com/"));
        assert!(!is_context_source_url("nope"));
    }
}
