//! The records an answer is built from: `hydrate`, `exactTitleFacts` and
//! `retrieved` of lib/meme-chat.server.ts, with `memeTitleKey`
//! (scripts/meme-title-key.mjs) and the localized paths and citations it
//! uses.

use serde::Deserialize;
use sha2::{Digest, Sha256};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;
use unicode_normalization::UnicodeNormalization;

use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::pages::content_depth::{public_source_url, source_document_key};
use crate::routes::js_string::JsString;
use crate::routes::public::content_depth::{self, DepthInput, SourceRef};
use crate::routes::public::{js, labels};
use crate::routes::unicode_classes::{TITLE_KEY_DROP, contains};

// What lib/db/execute.ts compiles for the `hydrate` query (from the
// Postgres statement log of the real Next).
const HYDRATE_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."short_id", r1."slug", r1."title", r1."summary", r1."description", r1."origin", r1."usage_note", r1."caution", r1."origin_year", r1."year_precision", r1."moderation_status", r1."updated_at", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r2."source_url", r2."title", r2."platform", r2."hidden_from_public" FROM public."meme_sources" r2 WHERE r2."meme_id" = r1."id" AND TRUE ORDER BY r2."captured_at" DESC LIMIT $1::int) e) AS "meme_sources", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r3."locale", r3."status", r3."localized_slug", r3."title", r3."summary", r3."description", r3."origin", r3."usage_note", r3."caution", r3."source_updated_at", r3."updated_at" FROM public."meme_translations" r3 WHERE r3."meme_id" = r1."id" AND r3."locale" = $2 AND r3."status" = $3 LIMIT $4::int) e) AS "meme_translations" FROM public."memes" r1 WHERE r1."id" = ANY($5::uuid[]) AND r1."moderation_status"::text = ANY($6::text[])) SELECT row_to_json(__q)::text FROM __q"#;

/// `MEME_CHAT_LOCALES`.
pub const LOCALES: [&str; 5] = ["ko", "en", "ja", "zh", "zh-tw"];

/// `MemeChatItem`.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Item {
    pub id: String,
    pub short_id: String,
    pub slug: JsString,
    pub title: JsString,
    pub summary: JsString,
    pub href: String,
    /// `{ url, label }`.
    pub sources: Vec<(String, JsString)>,
}

/// `Fact`.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Fact {
    pub item: Item,
    pub title_keys: Vec<String>,
    pub description: JsString,
    pub origin: JsString,
    pub usage_note: JsString,
    pub caution: JsString,
    pub origin_year: Option<i64>,
    pub year_precision: JsString,
    pub revision: (String, Option<String>),
}

#[derive(Deserialize)]
struct Translation {
    locale: String,
    status: String,
    localized_slug: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
    #[serde(default)]
    usage_note: Option<String>,
    #[serde(default)]
    caution: Option<String>,
    source_updated_at: String,
    updated_at: String,
}

/// `rowSchema`; a row that does not fit is skipped, as `safeParse` fails.
#[derive(Deserialize)]
struct Row {
    id: String,
    short_id: String,
    slug: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
    #[serde(default)]
    usage_note: Option<String>,
    #[serde(default)]
    caution: Option<String>,
    origin_year: Option<i64>,
    year_precision: String,
    moderation_status: String,
    updated_at: String,
    meme_sources: Vec<SourceRef>,
    meme_translations: Vec<Translation>,
}

/// `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
pub fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(at, byte)| match at {
            8 | 13 | 18 | 23 => *byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        })
}

impl Row {
    fn fits(&self) -> bool {
        let short = (4..=32).contains(&self.short_id.len())
            && self
                .short_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric());
        let slug = JsString::from(self.slug.as_str()).len();
        is_uuid(&self.id)
            && short
            && (1..=300).contains(&slug)
            && matches!(self.moderation_status.as_str(), "approved" | "limited")
    }

    fn is_indexable(&self) -> bool {
        content_depth::is_indexable(&DepthInput {
            description: &self.description,
            origin: &self.origin,
            usage_note: self.usage_note.as_deref(),
            caution: self.caution.as_deref(),
            usage_examples: None,
            sources: &self.meme_sources,
            contents: &[],
            tag_count: 0,
        })
    }

    /// The reviewed translation a localized page would show, if current.
    fn current_translation(&self, locale: &str) -> Option<&Translation> {
        if locale == "ko" || !self.is_indexable() {
            return None;
        }
        self.meme_translations.iter().find(|item| {
            let filled = [
                &item.title,
                &item.summary,
                &item.description,
                &item.origin,
                &item.localized_slug,
            ]
            .iter()
            .all(|value| !js::trim(value).is_empty());
            item.locale == locale
                && item.status == "reviewed"
                && date_parse(&item.source_updated_at)
                    .is_some_and(|at| Some(at) == date_parse(&self.updated_at))
                && filled
        })
    }
}

/// `Date.parse` of a timestamp as `row_to_json` writes it: milliseconds,
/// further digits dropped. `None` is `NaN`.
fn date_parse(value: &str) -> Option<i128> {
    let at = OffsetDateTime::parse(value, &Rfc3339).ok()?;
    Some(at.unix_timestamp_nanos().div_euclid(1_000_000))
}

/// `text(value, max)`: control characters as spaces, trimmed, the first
/// `max` UTF-16 units.
pub fn text(value: Option<&str>, max: usize) -> JsString {
    let cleaned: String = value
        .unwrap_or_default()
        .chars()
        .map(|c| {
            if c <= '\u{1f}' || c == '\u{7f}' {
                ' '
            } else {
                c
            }
        })
        .collect();
    JsString::from(cleaned.as_str()).trim().prefix(max)
}

/// `text` again on text that has been through it (no control characters).
pub fn retext(value: &JsString, max: usize) -> JsString {
    value.trim().prefix(max)
}

/// `memeTitleKey`: NFKC, lower case, without spaces, punctuation, symbols
/// and `_`.
pub fn meme_title_key(value: &str) -> String {
    let normalized: String = value.nfkc().collect();
    normalized
        .to_lowercase()
        .chars()
        .filter(|c| !contains(&TITLE_KEY_DROP, *c))
        .collect()
}

/// `citableSources(row.meme_sources)` as the chat keeps them: public, valid,
/// titled links, one per document, with `text(title, 100)` as the label.
fn citable(sources: &[SourceRef]) -> Vec<(String, JsString)> {
    let mut seen: Vec<String> = Vec::new();
    let mut out = Vec::new();
    for source in sources.iter().filter(|source| source.is_public()) {
        let url = public_source_url(source.source_url.as_deref());
        let titled = source
            .title
            .as_deref()
            .is_some_and(|title| !js::trim(title).is_empty());
        let (Some(url), true) = (url, titled) else {
            continue;
        };
        let key = source_document_key(&url).to_owned();
        if seen.contains(&key) {
            continue;
        }
        seen.push(key);
        out.push((url, text(source.title.as_deref(), 100)));
    }
    out
}

/// Why the records could not be read: the query failed, or a localized path
/// could not be written (`encodeURIComponent` throws). Both reject `hydrate`.
#[derive(Debug)]
pub struct Unavailable;

/// The page of the record: the localized one when a translation is shown.
fn href(row: &Row, locale: &str, localized_slug: Option<&JsString>) -> Result<String, Unavailable> {
    let Some(slug) = localized_slug else {
        return Ok(labels::meme_path(&row.short_id, &row.slug));
    };
    let encoded = slug.encode_uri_component().ok_or(Unavailable)?;
    Ok(format!("/{locale}/memes/{}-{encoded}", row.short_id))
}

/// `[...new Set([memeTitleKey(title), translated key])].filter(Boolean)`.
fn title_keys(row: &Row, translation: Option<&Translation>) -> Vec<String> {
    let mut keys = vec![meme_title_key(&row.title)];
    if let Some(t) = translation {
        let key = meme_title_key(&t.title);
        if !keys.contains(&key) {
            keys.push(key);
        }
    }
    keys.retain(|key| !key.is_empty());
    keys
}

fn fact(row: &Row, locale: &str) -> Result<Fact, Unavailable> {
    let translation = row.current_translation(locale);
    let own = |own: &str, localized: Option<&str>| localized.unwrap_or(own).to_owned();
    let title = own(&row.title, translation.map(|t| t.title.as_str()));
    let summary = own(&row.summary, translation.map(|t| t.summary.as_str()));
    let description = own(
        &row.description,
        translation.map(|t| t.description.as_str()),
    );
    let origin = own(&row.origin, translation.map(|t| t.origin.as_str()));
    let (usage_note, caution) = match translation {
        Some(t) => (t.usage_note.as_deref(), t.caution.as_deref()),
        None => (row.usage_note.as_deref(), row.caution.as_deref()),
    };
    let slug_source = translation.map_or(row.slug.as_str(), |t| t.localized_slug.as_str());
    let slug = text(Some(slug_source), 300);
    let href = href(row, locale, translation.map(|_| &slug))?;
    let keys = title_keys(row, translation);
    let mut sources = citable(&row.meme_sources);
    sources.truncate(2);
    Ok(Fact {
        title_keys: keys,
        item: Item {
            id: row.id.clone(),
            short_id: row.short_id.clone(),
            slug,
            title: text(Some(&title), 160),
            summary: text(Some(&summary), 240),
            href,
            sources,
        },
        description: text(Some(&description), 360),
        origin: text(Some(&origin), 260),
        usage_note: text(usage_note, 180),
        caution: text(caution, 180),
        origin_year: row.origin_year,
        year_precision: text(Some(&row.year_precision), 40),
        revision: (
            row.updated_at.clone(),
            translation.map(|t| t.updated_at.clone()),
        ),
    })
}

/// `hydrate(ids, locale)`: the records of `ids` that are still public, in
/// the order of `ids`.
pub async fn hydrate(
    state: &AppState,
    ids: &[String],
    locale: &'static str,
) -> Result<Vec<Fact>, Unavailable> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let bound = ids.to_vec();
    let rows: Result<Vec<String>, sqlx::Error> = state
        .db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(HYDRATE_SQL)
                    .persistent(false)
                    .bind(8_i32)
                    .bind(locale)
                    .bind("reviewed")
                    .bind(1_i32)
                    .bind(bound)
                    .bind(vec!["approved".to_owned(), "limited".to_owned()])
                    .fetch_all(tx)
                    .await
            })
        })
        .await;
    let rows = rows.map_err(|error| {
        tracing::error!(%error, "meme chat records unavailable");
        Unavailable
    })?;
    from_rows(&rows, ids, locale)
}

/// The facts of the rows `row_to_json` wrote, for `ids`, in their order.
pub fn from_rows(rows: &[String], ids: &[String], locale: &str) -> Result<Vec<Fact>, Unavailable> {
    let mut facts: Vec<Fact> = Vec::new();
    for row in rows
        .iter()
        .filter_map(|row| serde_json::from_str::<Row>(row).ok())
    {
        if !row.fits() || !ids.contains(&row.id) {
            continue;
        }
        let fact = fact(&row, locale)?;
        // `facts.set(row.id, ...)`: a later row of the same id replaces it.
        facts.retain(|known| known.item.id != fact.item.id);
        facts.push(fact);
    }
    Ok(ids
        .iter()
        .filter_map(|id| facts.iter().find(|fact| fact.item.id == *id).cloned())
        .collect())
}

/// `exactTitleFacts`: the records whose title is the question, if any.
pub fn exact_title_facts(question: &str, facts: Vec<Fact>) -> Vec<Fact> {
    let key = meme_title_key(question);
    if key.is_empty() {
        return facts;
    }
    let matches: Vec<Fact> = facts
        .iter()
        .filter(|fact| fact.title_keys.contains(&key))
        .cloned()
        .collect();
    if matches.is_empty() { facts } else { matches }
}

/// `createHash("sha256").update(JSON.stringify(facts))`: equal for equal
/// records, which is all the answer cache compares.
pub fn fingerprint(facts: &[Fact]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{facts:?}"));
    hex::encode(hasher.finalize())
}

/// `COPY[locale]`.
pub struct Copy {
    pub empty: &'static str,
    pub retrieved: &'static str,
    pub no_sources: &'static str,
    pub timing_uncertainty: &'static str,
}

pub fn copy(locale: &str) -> Copy {
    match locale {
        "en" => Copy {
            empty: "No related public meme records were found. Try a meme name or a more specific situation.",
            retrieved: "These are summaries from public search results. Check each meme for its full context.",
            no_sources: "Records without external sources need further verification of their origins and dates.",
            timing_uncertainty: "Years marked unknown or approximate, and origin or popularity dates more precise than the records, are not confirmed facts.",
        },
        "ja" => Copy {
            empty: "関連する公開ミーム資料が見つかりませんでした。名前や具体的な状況で再度質問してください。",
            retrieved: "公開検索結果の要約です。詳しい背景は各ミームで確認してください。",
            no_sources: "外部出典のない項目の由来と年代は追加確認が必要です。",
            timing_uncertainty: "不明・推定と記録された年や、資料より細かい発生・流行の日付は、確定した情報ではありません。",
        },
        "zh" => Copy {
            empty: "没有找到相关的公开梗资料。请尝试梗名称或更具体的场景。",
            retrieved: "以下是公开搜索结果的摘要。完整背景请查看各个条目。",
            no_sources: "没有外部来源的条目，其起源和年份需要进一步核实。",
            timing_uncertainty: "标为未知或推测的年份，以及比资料更精确的起源、流行日期，都不是已确认的信息。",
        },
        "zh-tw" => Copy {
            empty: "沒有找到相關的公開迷因資料。請嘗試名稱或更具體的情境。",
            retrieved: "以下是公開搜尋結果的摘要。完整背景請查看各個條目。",
            no_sources: "沒有外部來源的條目，其起源和年份需要進一步核實。",
            timing_uncertainty: "標為未知或推測的年份，以及比資料更精確的起源、流行日期，都不是已確認的資訊。",
        },
        _ => Copy {
            empty: "공개 밈 자료에서 관련 항목을 찾지 못했어요. 밈 이름이나 구체적인 상황으로 다시 질문해 주세요.",
            retrieved: "검색된 공개 자료의 요약이에요. 자세한 맥락은 각 밈에서 확인해 주세요.",
            no_sources: "외부 출처가 없는 항목의 기원과 연도는 추가 확인이 필요해요.",
            timing_uncertainty: "미상·추정으로 기록된 연도와 자료보다 세밀한 발생·유행 날짜는 확정된 정보가 아니에요.",
        },
    }
}

fn string(value: &str) -> String {
    serde_json::to_string(value).expect("a string serializes")
}

/// `MemeChatItem` as `JSON.stringify` writes it.
pub fn item_json(item: &Item) -> String {
    let sources: Vec<String> = item
        .sources
        .iter()
        .map(|(url, label)| format!(r#"{{"url":{},"label":{}}}"#, string(url), label.json()))
        .collect();
    format!(
        r#"{{"id":{},"short_id":{},"slug":{},"title":{},"summary":{},"href":{},"sources":[{}]}}"#,
        string(&item.id),
        string(&item.short_id),
        item.slug.json(),
        item.title.json(),
        item.summary.json(),
        string(&item.href),
        sources.join(",")
    )
}

fn items_json<'a>(items: impl Iterator<Item = &'a Item>) -> String {
    let items: Vec<String> = items.map(item_json).collect();
    format!("[{}]", items.join(","))
}

/// `retrieved(facts, locale, retrievalMode)` as the JSON of the result.
pub fn retrieved(facts: &[Fact], locale: &str, retrieval_mode: &str) -> String {
    let copy = copy(locale);
    let answer = if facts.is_empty() {
        JsString::from(copy.empty)
    } else {
        let mut lines = vec![JsString::from(copy.retrieved)];
        for fact in facts {
            let line = JsString::join(&[fact.item.title.clone(), fact.item.summary.clone()], ": ");
            lines.push(line);
        }
        if facts.iter().all(|fact| fact.item.sources.is_empty()) {
            lines.push(JsString::from(copy.no_sources));
        }
        JsString::join(&lines, "\n")
    };
    let mode = if facts.is_empty() {
        "empty"
    } else {
        "retrieved"
    };
    format!(
        r#"{{"mode":"{mode}","retrievalMode":"{retrieval_mode}","answer":{},"items":{}}}"#,
        answer.json(),
        items_json(facts.iter().map(|fact| &fact.item))
    )
}

/// `generatedResult(value, facts, locale, retrievalMode)` as JSON.
pub fn generated(
    answer: &str,
    citations: &[String],
    facts: &[Fact],
    locale: &str,
    retrieval_mode: &str,
) -> String {
    let cited: Vec<&Fact> = facts
        .iter()
        .filter(|fact| citations.contains(&fact.item.id))
        .collect();
    let copy = copy(locale);
    let mut notices = Vec::new();
    if cited.iter().any(|fact| fact.item.sources.is_empty()) {
        notices.push(copy.no_sources);
    }
    let uncertain = |fact: &&Fact| {
        !fact.year_precision.eq_str("exact")
            && (fact.origin_year.is_some() || !fact.origin.is_empty())
    };
    if cited.iter().any(uncertain) {
        notices.push(copy.timing_uncertainty);
    }
    let mut lines = vec![answer];
    lines.extend(
        notices
            .into_iter()
            .filter(|notice| !answer.contains(notice)),
    );
    format!(
        r#"{{"answer":{},"mode":"generated","retrievalMode":"{retrieval_mode}","items":{}}}"#,
        string(&lines.join("\n")),
        items_json(cited.iter().map(|fact| &fact.item))
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_keys_drop_spaces_punctuation_symbols_and_underscores() {
        assert_eq!(
            meme_title_key("  “중꺾마” — 중요한 건_꺾이지 않는 마음!! "),
            "중꺾마중요한건꺾이지않는마음"
        );
        assert_eq!(meme_title_key("ＡＢＣ　ｄｅｆ"), "abcdef");
        assert_eq!(meme_title_key("😀 + ★"), "");
    }

    #[test]
    fn text_replaces_controls_trims_and_cuts_utf16_units() {
        assert!(text(Some(" a\u{0}b\u{7f}c\n "), 10).eq_str("a b c"));
        assert!(text(None, 10).is_empty());
        assert_eq!(text(Some("ab😀"), 3).json(), r#""ab\ud83d""#);
    }

    #[test]
    fn date_parse_keeps_milliseconds_only() {
        assert_eq!(
            date_parse("2026-11-23T19:27:14.123456+00:00"),
            date_parse("2026-11-23T19:27:14.123999+00:00")
        );
        assert_ne!(
            date_parse("2026-11-23T19:27:14.123+00:00"),
            date_parse("2026-11-23T19:27:14.124+00:00")
        );
        assert_eq!(date_parse("infinity"), None);
    }

    #[test]
    fn uuids_are_checked_as_the_regex_does() {
        assert!(is_uuid("A1000000-0000-4000-8000-000000000002"));
        assert!(!is_uuid("curated-jkm2022k"));
        assert!(!is_uuid("a1000000-0000-4000-8000-00000000000"));
    }
}
