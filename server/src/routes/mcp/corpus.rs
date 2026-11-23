//! `Corpus` of integrations/memecatch-chatgpt/src/corpus.mjs: the public
//! memes parsed from `https://catchmeme.com/llms-full.txt`, kept for five
//! minutes, and the `search_memes` and `get_meme` tools over them.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use time::OffsetDateTime;
use unicode_normalization::UnicodeNormalization;
use url::Url;

use super::{Failure, Outbound};
use crate::routes::js_string::JsString;
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::js;
use crate::routes::request::{self, Json};
use crate::routes::unicode_classes::{LETTER_OR_NUMBER, contains};

pub const SOURCE: &str = "https://catchmeme.com/llms-full.txt";
const SCOPE: &str = "밈캐치가 공개 본문으로 제공하는 일부 밈을 검색합니다. 전체 사전 검색은 밈캐치 사이트를 이용하세요.";
const LIMIT_BYTES: usize = 5 * 1024 * 1024;
const TTL_MS: i64 = 300_000;
const FIELD_NAMES: [&str; 7] = [
    "사용 안전도",
    "시기",
    "별칭",
    "한 줄 뜻",
    "설명",
    "유래",
    "사용법·주의",
];
const FIELD_KEYS: [&str; 7] = [
    "safety",
    "year",
    "aliases",
    "summary",
    "description",
    "origin",
    "usage",
];

/// One parsed meme, its fields in `FIELD_NAMES` order.
#[derive(Clone, Debug)]
pub struct Meme {
    pub id: String,
    pub title: JsString,
    pub url: String,
    pub fields: [JsString; 7],
    pub safety_code: &'static str,
}

struct Entry {
    title: String,
    aliases: String,
    rest: String,
}

struct Loaded {
    memes: Vec<Meme>,
    index: Vec<Entry>,
    at: i64,
}

/// What a tool call gives.
pub enum Lookup {
    /// The members of the tool result (`content`, `structuredContent`).
    Found(String),
    /// A `TypeError`: the tool answers -32602 with this message.
    Invalid(String),
    /// Anything else: the tool answers `isError`.
    Unavailable,
}

/// `normalize`: NFKC, lower case, letters and numbers only.
fn normalize(value: &str) -> String {
    let lower = value.nfkc().collect::<String>().to_lowercase();
    lower
        .chars()
        .filter(|c| contains(&LETTER_OR_NUMBER, *c))
        .collect()
}

fn lossy(value: &JsString) -> String {
    char::decode_utf16(value.units().iter().copied())
        .filter_map(Result::ok)
        .collect()
}

/// `safeMemeUrl`.
pub fn safe_meme_url(value: Option<&JsString>) -> Option<String> {
    let url = Url::parse(&lossy(value?)).ok()?;
    let empty = |part: Option<&str>| part.is_none_or(str::is_empty);
    let bare = url.username().is_empty()
        && url.password().is_none()
        && empty(url.query())
        && empty(url.fragment());
    let rest = url.path().strip_prefix("/memes/")?;
    let (id, slug) = rest.split_once('-')?;
    let path_ok = (3..=36).contains(&id.len())
        && id.bytes().all(|b| b.is_ascii_alphanumeric())
        && !slug.is_empty()
        && !slug.contains('/');
    (url.origin().ascii_serialization() == "https://catchmeme.com" && bare && path_ok)
        .then(|| url.to_string())
}

/// Splits at `^### ` in multiline mode: after any line terminator JavaScript knows.
fn blocks(text: &str) -> Vec<&str> {
    let mut starts = Vec::new();
    let mut previous: Option<char> = None;
    for (at, c) in text.char_indices() {
        let line_start =
            previous.is_none_or(|p| matches!(p, '\n' | '\r' | '\u{2028}' | '\u{2029}'));
        if line_start && text[at..].starts_with("### ") {
            starts.push(at);
        }
        previous = Some(c);
    }
    let mut out = Vec::new();
    for (index, start) in starts.iter().enumerate() {
        let end = starts.get(index + 1).copied().unwrap_or(text.len());
        out.push(&text[start + 4..end]);
    }
    out
}

/// `/^- ([^:]+):\s*(.*)$/` on one line: the key and the value.
fn field(line: &str) -> Option<(&str, &str)> {
    let rest = line.strip_prefix("- ")?;
    let (key, value) = rest.split_once(':')?;
    let value = value.trim_start_matches(js::is_space);
    let breaks = value.contains(['\n', '\r', '\u{2028}', '\u{2029}']);
    (!key.is_empty() && !breaks).then_some((key, value))
}

fn safety_code(safety: &JsString) -> &'static str {
    let text = lossy(safety);
    [
        ("써도 됨", "safe"),
        ("맥락 주의", "context"),
        ("이미 늦음", "outdated"),
        ("쓰면 위험", "risky"),
    ]
    .iter()
    .find(|(label, _)| text.contains(label))
    .map_or("unknown", |(_, code)| code)
}

fn meme(block: &str) -> Option<(String, Meme)> {
    let mut lines = block.split('\n');
    let title = JsString::from(lines.next().unwrap_or_default())
        .trim()
        .prefix(240);
    let mut fields: Vec<(String, JsString)> = Vec::new();
    for (key, value) in lines.filter_map(field) {
        let key = js::trim(key).to_owned();
        let value = JsString::from(value).trim().prefix(6000);
        fields.retain(|(known, _)| *known != key);
        fields.push((key, value));
    }
    let find = |name: &str| {
        fields
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value)
    };
    let url = safe_meme_url(find("URL"))?;
    if title.is_empty() {
        return None;
    }
    let id = url.split('/').nth(4)?.split('-').next()?.to_owned();
    let mut values: [JsString; 7] = Default::default();
    for (slot, name) in values.iter_mut().zip(FIELD_NAMES) {
        *slot = find(name).cloned().unwrap_or_default();
    }
    let safety_code = safety_code(&values[0]);
    if values[0].is_empty() {
        values[0] = JsString::from("사용 안전도 정보 없음");
    }
    Some((
        url.clone(),
        Meme {
            id,
            title,
            url,
            fields: values,
            safety_code,
        },
    ))
}

/// `parseCorpus(text)`; `None` when no meme could be read.
pub fn parse_corpus(text: &str) -> Option<Vec<Meme>> {
    let mut memes = Vec::new();
    let mut seen: Vec<String> = Vec::new();
    for block in blocks(text).into_iter().take(800) {
        let Some((url, item)) = meme(block) else {
            continue;
        };
        if seen.contains(&url) || seen.contains(&item.id) {
            continue;
        }
        seen.push(item.id.clone());
        seen.push(url);
        memes.push(item);
    }
    (!memes.is_empty()).then_some(memes)
}

fn index(memes: &[Meme]) -> Vec<Entry> {
    memes
        .iter()
        .map(|meme| Entry {
            title: normalize(&lossy(&meme.title)),
            aliases: normalize(&lossy(&meme.fields[2])),
            rest: normalize(&lossy(&JsString::join(&meme.fields[3..7], " "))),
        })
        .collect()
}

/// A meme as `JSON.stringify` writes the item.
pub fn meme_json(meme: &Meme) -> String {
    let fields: Vec<String> = FIELD_KEYS
        .iter()
        .zip(&meme.fields)
        .map(|(key, value)| format!(r#""{key}":{}"#, value.json()))
        .collect();
    format!(
        r#"{{"id":{},"title":{},"url":{},{},"safetyCode":"{}"}}"#,
        serde_json::to_string(&meme.id).expect("a string"),
        meme.title.json(),
        serde_json::to_string(&meme.url).expect("a string"),
        fields.join(","),
        meme.safety_code
    )
}

/// `new Date(at).toISOString()`.
fn iso(at: i64) -> String {
    let time = OffsetDateTime::from_unix_timestamp_nanos(i128::from(at) * 1_000_000)
        .unwrap_or(OffsetDateTime::UNIX_EPOCH);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        time.year(),
        u8::from(time.month()),
        time.day(),
        time.hour(),
        time.minute(),
        time.second(),
        time.millisecond()
    )
}

/// `toolResult(data)`: the text summary and the structured data.
fn tool_result(memes: &[&Meme], corpus_size: usize, at: i64, data: String) -> String {
    let mut parts = vec![
        JsString::from(SCOPE),
        JsString::from(
            format!(
                "공개 본문 {corpus_size}개 항목 중 검색 결과. 확인: {}",
                iso(at)
            )
            .as_str(),
        ),
    ];
    for meme in memes {
        let line = [
            meme.title.clone(),
            JsString::from(" — "),
            meme.fields[3].clone(),
            JsString::from("\n사용 주의: "),
            meme.fields[0].clone(),
            JsString::from(format!("\n{}", meme.url).as_str()),
        ];
        parts.push(JsString::join(&line, ""));
    }
    if memes.is_empty() {
        parts.push(JsString::from(
            "해당 공개 본문에서 결과를 찾지 못했습니다. 전체 사전에서는 다시 검색할 수 있습니다.",
        ));
    }
    format!(
        r#""content":[{{"type":"text","text":{}}}],"structuredContent":{data}"#,
        JsString::join(&parts, "\n\n").json()
    )
}

pub struct Corpus {
    outbound: Outbound,
    cached: Mutex<Option<Arc<Loaded>>>,
    loading: tokio::sync::Mutex<()>,
}

impl Corpus {
    pub fn new(outbound: Outbound) -> Self {
        Self {
            outbound,
            cached: Mutex::new(None),
            loading: tokio::sync::Mutex::new(()),
        }
    }

    fn fresh(&self) -> Option<Arc<Loaded>> {
        let cached = self.cached.lock().expect("corpus lock");
        cached
            .as_ref()
            .filter(|loaded| now_ms() - loaded.at < TTL_MS)
            .cloned()
    }

    /// `load()`: the cached corpus, or a new fetch (one at a time). A
    /// `TypeError` on the way becomes -32602 with its message.
    async fn load(&self) -> Result<Arc<Loaded>, Lookup> {
        if let Some(loaded) = self.fresh() {
            return Ok(loaded);
        }
        let _one = self.loading.lock().await;
        if let Some(loaded) = self.fresh() {
            return Ok(loaded);
        }
        let rejected = |failure| match failure {
            Failure::Network => Lookup::Invalid("fetch failed".to_owned()),
            Failure::Terminated => Lookup::Invalid("terminated".to_owned()),
            Failure::TimedOut | Failure::TooLarge => Lookup::Unavailable,
        };
        let fetched = self
            .outbound
            .get(
                SOURCE,
                "text/plain",
                false,
                Duration::from_secs(12),
                LIMIT_BYTES,
            )
            .await
            .map_err(rejected)?;
        // `Number(response.headers.get('content-length')) > LIMIT_BYTES`.
        let declared = fetched
            .content_length
            .as_deref()
            .and_then(|value| value.trim().parse::<f64>().ok());
        if !fetched.status.is_success()
            || declared.is_some_and(|length| length > LIMIT_BYTES as f64)
        {
            return Err(Lookup::Unavailable);
        }
        let text = String::from_utf8_lossy(&fetched.body.map_err(rejected)?).into_owned();
        let memes = parse_corpus(&text).ok_or(Lookup::Unavailable)?;
        let loaded = Arc::new(Loaded {
            index: index(&memes),
            memes,
            at: now_ms(),
        });
        *self.cached.lock().expect("corpus lock") = Some(loaded.clone());
        Ok(loaded)
    }

    /// `search({ query, limit, includeRisky })`.
    pub async fn search(&self, args: &[(String, Json)]) -> Lookup {
        const INVALID: &str = "검색어는 160자 이내, 결과 수는 1~12여야 합니다.";
        let query = match request::property(args, "query") {
            None => String::new(),
            Some(Json::String(query)) if js::utf16_len(query) <= 160 => query.clone(),
            Some(_) => return Lookup::Invalid(INVALID.to_owned()),
        };
        let limit = match request::property(args, "limit") {
            None => 6,
            Some(Json::Number(n)) if n.fract() == 0.0 && (1.0..=12.0).contains(n) => *n as usize,
            Some(_) => return Lookup::Invalid(INVALID.to_owned()),
        };
        let risky = match request::property(args, "includeRisky") {
            None => false,
            Some(Json::Bool(flag)) => *flag,
            Some(_) => return Lookup::Invalid(INVALID.to_owned()),
        };
        let loaded = match self.load().await {
            Ok(loaded) => loaded,
            Err(lookup) => return lookup,
        };
        let term = normalize(js::trim(&query));
        if !js::trim(&query).is_empty() && term.is_empty() {
            return Lookup::Invalid("검색할 단어나 밈 이름을 입력하세요.".to_owned());
        }
        let (top, matched) = rank(&loaded, &term, limit, risky);
        let memes: Vec<String> = top.iter().map(|meme| meme_json(meme)).collect();
        let data = format!(
            r#"{{"query":{},"memes":[{}],"matched":{matched},"corpusSize":{},"scope":"{SCOPE}","source":"{SOURCE}","fetchedAt":"{}","siteSearchUrl":"https://catchmeme.com/search?q={}"}}"#,
            serde_json::to_string(&query).expect("a string"),
            memes.join(","),
            loaded.memes.len(),
            iso(loaded.at),
            js::encode_uri_component(&query)
        );
        Lookup::Found(tool_result(&top, loaded.memes.len(), loaded.at, data))
    }

    /// `get(id)`.
    pub async fn get(&self, id: Option<&Json>) -> Lookup {
        let id = match id {
            Some(Json::String(id))
                if (3..=36).contains(&id.len())
                    && id.bytes().all(|b| b.is_ascii_alphanumeric()) =>
            {
                id.clone()
            }
            _ => return Lookup::Invalid("유효한 밈 ID가 필요합니다.".to_owned()),
        };
        let loaded = match self.load().await {
            Ok(loaded) => loaded,
            Err(lookup) => return lookup,
        };
        let Some(meme) = loaded.memes.iter().find(|meme| meme.id == id) else {
            return Lookup::Invalid("공개 본문에서 해당 밈을 찾지 못했습니다.".to_owned());
        };
        let data = format!(
            r#"{{"memes":[{}],"corpusSize":{},"scope":"{SCOPE}","source":"{SOURCE}","fetchedAt":"{}"}}"#,
            meme_json(meme),
            loaded.memes.len(),
            iso(loaded.at)
        );
        Lookup::Found(tool_result(&[meme], loaded.memes.len(), loaded.at, data))
    }
}

/// The scoring loop of `search`: the best `limit`, ties in corpus order.
fn rank<'a>(loaded: &'a Loaded, term: &str, limit: usize, risky: bool) -> (Vec<&'a Meme>, usize) {
    let mut top: Vec<(&Meme, u32)> = Vec::new();
    let mut matched = 0;
    for (entry, meme) in loaded.index.iter().zip(&loaded.memes) {
        if !risky && matches!(meme.safety_code, "risky" | "unknown") {
            continue;
        }
        let score = if term.is_empty() {
            1
        } else if entry.title == term {
            100
        } else if entry.title.contains(term) {
            60
        } else if entry.aliases.contains(term) {
            40
        } else if entry.rest.contains(term) {
            10
        } else {
            0
        };
        if score == 0 {
            continue;
        }
        matched += 1;
        match top.iter().position(|(_, known)| *known < score) {
            None if top.len() < limit => top.push((meme, score)),
            None => {}
            Some(at) => {
                top.insert(at, (meme, score));
                if top.len() > limit {
                    top.pop();
                }
            }
        }
    }
    (top.into_iter().map(|(meme, _)| meme).collect(), matched)
}
