//! Port of `lib/content-depth.ts`: whether a meme document holds enough prose
//! and evidence of its own to be listed and indexed. The sitemap, the feeds
//! and the llms exports all use this one gate (`isIndexableMeme`).

use std::collections::HashSet;

use serde::Deserialize;
use serde_json::Value;

use super::js;

// CONTENT_DEPTH_THRESHOLDS.
const MIN_PROSE_CHARS_INDEX: usize = 250;
const MIN_SCORE: u32 = 5;
const DESCRIPTION_RICH: usize = 400;
const DESCRIPTION_SOLID: usize = 250;
const DESCRIPTION_BASIC: usize = 150;
const ORIGIN_RICH: usize = 60;
const ORIGIN_BASIC: usize = 30;
const SUPPORTING_PROSE: usize = 40;
const TAGS: usize = 3;
// UNAVAILABLE_STATUSES in lib/content-availability.ts.
const UNAVAILABLE_STATUSES: [&str; 2] = ["dead", "region_blocked"];

/// One embedded `meme_sources` row. The localized full export also reads the
/// title and the platform.
#[derive(Clone, Debug, Default, Deserialize)]
pub struct SourceRef {
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub hidden_from_public: Option<bool>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub platform: Option<String>,
}

impl SourceRef {
    /// `isPublicDisplaySource` in lib/source-links.ts.
    pub fn is_public(&self) -> bool {
        self.hidden_from_public != Some(true)
    }
}

/// One embedded `meme_contents` row.
#[derive(Clone, Debug, Default, Deserialize)]
pub struct ContentRef {
    #[serde(default)]
    pub availability: Option<String>,
    #[serde(default)]
    pub moderation_status: Option<String>,
}

/// `ContentDepthInput`: the fields of a meme the score reads.
pub struct DepthInput<'a> {
    pub description: &'a str,
    pub origin: &'a str,
    pub usage_note: Option<&'a str>,
    pub caution: Option<&'a str>,
    /// jsonb of unknown shape; `None` for SQL null.
    pub usage_examples: Option<&'a Value>,
    pub sources: &'a [SourceRef],
    pub contents: &'a [ContentRef],
    pub tag_count: usize,
}

/// `textLength`: the UTF-16 length of the trimmed text.
fn text_length(value: &str) -> usize {
    js::utf16_len(js::trim(value))
}

/// `isBoilerplateOrigin`: `/공개\s*Wikimedia\s*기록을\s*바탕으로/` matches.
fn is_boilerplate_origin(origin: &str) -> bool {
    const PARTS: [&str; 4] = ["공개", "Wikimedia", "기록을", "바탕으로"];
    let origin = js::trim(origin);
    origin.match_indices(PARTS[0]).any(|(at, first)| {
        let mut rest = &origin[at + first.len()..];
        PARTS[1..].iter().all(|part| {
            rest = rest.trim_start_matches(js::is_space);
            match rest.strip_prefix(part) {
                Some(after) => {
                    rest = after;
                    true
                }
                None => false,
            }
        })
    })
}

/// `validUsageExamples`: how many examples render, and the trimmed length of
/// their `situation` and `text` together.
fn usage_examples(value: Option<&Value>) -> (usize, usize) {
    let Some(Value::Array(items)) = value else {
        return (0, 0);
    };
    let trimmed_len = |item: &Value, key: &str| {
        item.as_object()
            .and_then(|object| object.get(key))
            .and_then(Value::as_str)
            .map(text_length)
            .filter(|len| *len > 0)
    };
    items
        .iter()
        .filter_map(|item| Some(trimmed_len(item, "situation")? + trimmed_len(item, "text")?))
        .fold((0, 0), |(count, chars), len| (count + 1, chars + len))
}

/// `distinctSourceCount`: public sources by trimmed, lowercased URL.
fn distinct_source_count(sources: &[SourceRef]) -> usize {
    let urls: HashSet<String> = sources
        .iter()
        .filter(|source| source.is_public())
        .filter_map(|source| source.source_url.as_deref())
        .map(|url| js::trim(url).to_lowercase())
        .filter(|url| !url.is_empty())
        .collect();
    urls.len()
}

/// `isRenderableContent` in lib/content-availability.ts.
fn is_renderable(content: &ContentRef) -> bool {
    let unavailable = content
        .availability
        .as_deref()
        .is_some_and(|status| UNAVAILABLE_STATUSES.contains(&status));
    !unavailable && content.moderation_status.as_deref() == Some("approved")
}

/// `contentDepth`: the score and the prose length (UTF-16 units).
fn score_and_prose(meme: &DepthInput<'_>) -> (u32, usize) {
    let description = text_length(meme.description);
    let origin = if is_boilerplate_origin(meme.origin) {
        0
    } else {
        text_length(meme.origin)
    };
    let usage_note = meme.usage_note.map_or(0, text_length);
    let caution = meme.caution.map_or(0, text_length);
    let (example_count, example_chars) = usage_examples(meme.usage_examples);
    let source_count = distinct_source_count(meme.sources);
    let media_count = meme.contents.iter().filter(|c| is_renderable(c)).count();

    let supporting = |chars: usize| if chars >= SUPPORTING_PROSE { chars } else { 0 };
    let step = |value: usize, steps: &[usize]| {
        // The highest step reached is worth the most points.
        let reached = steps.iter().filter(|step| value >= **step).count();
        u32::try_from(reached).unwrap_or(u32::MAX)
    };
    let score = step(
        description,
        &[DESCRIPTION_BASIC, DESCRIPTION_SOLID, DESCRIPTION_RICH],
    ) + step(origin, &[ORIGIN_BASIC, ORIGIN_RICH])
        + step(example_count, &[1, 2])
        + step(source_count, &[1, 2])
        + step(media_count, &[1])
        + step(usage_note, &[SUPPORTING_PROSE])
        + step(caution, &[SUPPORTING_PROSE])
        + step(meme.tag_count, &[TAGS]);
    let prose = description + origin + supporting(usage_note) + supporting(caution) + example_chars;
    (score, prose)
}

/// `isIndexableMeme`.
pub fn is_indexable(meme: &DepthInput<'_>) -> bool {
    let (score, prose) = score_and_prose(meme);
    prose >= MIN_PROSE_CHARS_INDEX && score >= MIN_SCORE
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn source(url: &str, hidden: Option<bool>) -> SourceRef {
        SourceRef {
            source_url: Some(url.to_owned()),
            hidden_from_public: hidden,
            ..SourceRef::default()
        }
    }

    fn content(availability: &str, moderation_status: &str) -> ContentRef {
        ContentRef {
            availability: Some(availability.to_owned()),
            moderation_status: Some(moderation_status.to_owned()),
        }
    }

    struct Meme {
        description: String,
        origin: String,
        usage_note: Option<String>,
        caution: Option<String>,
        usage_examples: Option<Value>,
        sources: Vec<SourceRef>,
        contents: Vec<ContentRef>,
        tag_count: usize,
    }

    impl Meme {
        fn empty() -> Self {
            Self {
                description: String::new(),
                origin: String::new(),
                usage_note: None,
                caution: None,
                usage_examples: None,
                sources: Vec::new(),
                contents: Vec::new(),
                tag_count: 0,
            }
        }

        fn depth(&self) -> (u32, usize) {
            score_and_prose(&DepthInput {
                description: &self.description,
                origin: &self.origin,
                usage_note: self.usage_note.as_deref(),
                caution: self.caution.as_deref(),
                usage_examples: self.usage_examples.as_ref(),
                sources: &self.sources,
                contents: &self.contents,
                tag_count: self.tag_count,
            })
        }
    }

    // Each expected pair is what `contentDepth` of lib/content-depth.ts
    // returns for the same record (score, proseChars).
    #[test]
    fn score_and_prose_follow_the_typescript_thresholds() {
        let mut meme = Meme::empty();
        assert_eq!(meme.depth(), (0, 0));

        meme.description = format!("  {}  ", "가".repeat(150));
        assert_eq!(meme.depth(), (1, 150));
        meme.description = "가".repeat(250);
        assert_eq!(meme.depth(), (2, 250));
        meme.description = "가".repeat(400);
        assert_eq!(meme.depth(), (3, 400));

        meme.origin = "나".repeat(29);
        assert_eq!(meme.depth(), (3, 429));
        meme.origin = "나".repeat(60);
        assert_eq!(meme.depth(), (5, 460));

        // Below 40 characters a note scores nothing and is not prose.
        meme.usage_note = Some("다".repeat(39));
        meme.caution = Some("라".repeat(40));
        assert_eq!(meme.depth(), (6, 500));

        meme.tag_count = 3;
        meme.contents = vec![content("dead", "approved"), content("live", "pending")];
        assert_eq!(meme.depth(), (7, 500));
        meme.contents.push(content("unchecked", "approved"));
        assert_eq!(meme.depth(), (8, 500));
    }

    #[test]
    fn length_is_counted_in_utf16_units_after_a_javascript_trim() {
        let mut meme = Meme::empty();
        // U+FEFF is whitespace to JavaScript; an emoji is two units.
        meme.description = format!("\u{feff}{}\u{3000}", "😀".repeat(75));

        assert_eq!(meme.depth(), (1, 150));
    }

    #[test]
    fn boilerplate_origin_counts_as_no_origin() {
        let mut meme = Meme::empty();
        meme.origin = format!(
            "이 문서는 공개  Wikimedia\n기록을 바탕으로 {}",
            "가".repeat(60)
        );
        assert_eq!(meme.depth(), (0, 0));

        // The phrase must be whole and in order.
        meme.origin = format!("공개 기록을 바탕으로 Wikimedia {}", "가".repeat(60));
        assert_eq!(meme.depth().0, 2);
        // A first "공개" that does not start the phrase does not hide a later one.
        meme.origin = "공개 자료와 공개Wikimedia기록을바탕으로".to_owned();
        assert_eq!(meme.depth(), (0, 0));
    }

    #[test]
    fn only_examples_that_render_are_counted() {
        let mut meme = Meme::empty();
        meme.usage_examples = Some(json!([
            { "situation": " 회사 ", "text": "칼퇴 각" },
            { "situation": "", "text": "x" },
            { "situation": "y", "text": "   " },
            { "situation": 1, "text": "x" },
            ["situation", "text"],
            null,
            "text",
        ]));
        assert_eq!(meme.depth(), (1, 6));

        meme.usage_examples = Some(json!([
            { "situation": "a", "text": "b" },
            { "situation": "c", "text": "d", "extra": true },
        ]));
        assert_eq!(meme.depth(), (2, 4));

        for not_an_array in [
            json!({ "situation": "a", "text": "b" }),
            json!("x"),
            json!(3),
        ] {
            meme.usage_examples = Some(not_an_array);
            assert_eq!(meme.depth(), (0, 0));
        }
    }

    #[test]
    fn sources_are_counted_once_per_url_and_hidden_ones_are_not() {
        let mut meme = Meme::empty();
        meme.sources = vec![
            source("https://Example.com/a", None),
            source(" https://example.com/A ", Some(false)),
            source("https://example.com/hidden", Some(true)),
            source("   ", None),
            SourceRef::default(),
        ];
        assert_eq!(meme.depth().0, 1);

        meme.sources.push(source("https://example.com/b", None));
        assert_eq!(meme.depth().0, 2);
    }

    #[test]
    fn indexable_needs_both_the_prose_and_the_score() {
        let mut meme = Meme::empty();
        let indexable = |meme: &Meme| {
            is_indexable(&DepthInput {
                description: &meme.description,
                origin: &meme.origin,
                usage_note: meme.usage_note.as_deref(),
                caution: meme.caution.as_deref(),
                usage_examples: meme.usage_examples.as_ref(),
                sources: &meme.sources,
                contents: &meme.contents,
                tag_count: meme.tag_count,
            })
        };

        // 400 characters of description: enough prose, score 3.
        meme.description = "가".repeat(400);
        assert!(!indexable(&meme));
        // Score 5 with 249 characters of prose.
        meme.description = "가".repeat(189);
        meme.origin = "나".repeat(60);
        meme.sources = vec![
            source("https://a.example/1", None),
            source("https://a.example/2", None),
        ];
        assert_eq!(meme.depth(), (5, 249));
        assert!(!indexable(&meme));
        meme.description.push('가');
        assert!(indexable(&meme));
    }
}
