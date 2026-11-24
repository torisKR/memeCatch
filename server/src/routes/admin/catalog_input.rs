//! `catalogRegistrationSchema` and `catalogDuplicateCheckSchema` of
//! lib/catalog-registration.ts as zod 4 runs them: the same issues, paths
//! and messages, in the schema's key order. An issue of a wrong type or an
//! enum value aborts what comes after it (the int check's own range checks,
//! the object's `superRefine`); a size or refine issue does not.

use serde_json::{Map, Value};

use crate::pages::admin::growth::is_uuid;
use crate::pages::content_depth::public_source_url;
use crate::routes::chat::facts::meme_title_key;
use crate::routes::public::js;
use crate::routes::sources::url::normalize_source_url;

pub const PLATFORMS: [&str; 7] = [
    "youtube",
    "youtube_shorts",
    "tiktok",
    "instagram",
    "broadcast_archive",
    "public_archive",
    "web",
];
pub const ROLES: [&str; 5] = [
    "original",
    "official_reupload",
    "earliest_known",
    "secondary_reference",
    "usage_example",
];
pub const RIGHTS: [&str; 7] = [
    "official_embed",
    "creator_permission",
    "creative_commons",
    "public_data",
    "link_only",
    "unknown",
    "blocked",
];
const PRECISIONS: [&str; 5] = ["exact", "year", "approximate", "decade", "unknown"];
const SAFETY: [&str; 4] = ["green", "yellow", "gray", "red"];
const CATEGORIES: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];
const DIFFICULTIES: [&str; 3] = ["beginner", "normal", "deep"];
const SENTIMENTS: [&str; 5] = ["funny", "ironic", "controversial", "negative", "wholesome"];
const CONTEXTS: [&str; 4] = ["work", "friends", "family", "sns"];

/// `normalizeCatalogSourceUrl(raw)`: a social link's canonical URL, else a
/// public HTTPS URL without its fragment.
pub fn normalize_catalog_source_url(raw: &str) -> Option<String> {
    if let Some(social) = normalize_source_url(raw) {
        return Some(social.canonical_url);
    }
    let public = public_source_url(Some(raw))?;
    let mut url = url::Url::parse(&public).ok()?;
    if url.scheme() != "https" {
        return None;
    }
    url.set_fragment(None);
    Some(url.to_string())
}

/// What zod found, in order.
#[derive(Default)]
pub struct Issues {
    list: Vec<(String, String)>,
    aborted: bool,
}

fn type_name(value: Option<&Value>) -> &'static str {
    match value {
        None => "undefined",
        Some(Value::Null) => "null",
        Some(Value::Bool(_)) => "boolean",
        Some(Value::Number(_)) => "number",
        Some(Value::String(_)) => "string",
        Some(Value::Array(_)) => "array",
        Some(Value::Object(_)) => "object",
    }
}

impl Issues {
    pub fn is_empty(&self) -> bool {
        self.list.is_empty()
    }

    fn push(&mut self, path: &str, message: String, aborts: bool) {
        self.list.push((path.to_owned(), message));
        self.aborted |= aborts;
    }

    fn wrong_type(&mut self, path: &str, expected: &str, value: Option<&Value>) {
        self.push(
            path,
            format!(
                "Invalid input: expected {expected}, received {}",
                type_name(value)
            ),
            true,
        );
    }

    /// `error.issues` as `fieldErrors`: `path.join(".") || "input"`, the
    /// last message of a path kept at its first place.
    pub fn field_errors(&self) -> Value {
        let mut map = Map::new();
        for (path, message) in &self.list {
            let key = if path.is_empty() { "input" } else { path };
            map.insert(key.to_owned(), Value::from(message.as_str()));
        }
        Value::Object(map)
    }

    /// `z.string()` with `.trim()` when `trim`, then `.min(min)` and `.max(max)`.
    fn text(
        &mut self,
        path: &str,
        value: Option<&Value>,
        min: usize,
        max: usize,
    ) -> Option<String> {
        let Some(Value::String(text)) = value else {
            self.wrong_type(path, "string", value);
            return None;
        };
        let text = js::trim(text).to_owned();
        let length = js::utf16_len(&text);
        if length < min {
            self.push(
                path,
                format!("Too small: expected string to have >={min} characters"),
                false,
            );
        }
        if length > max {
            self.push(
                path,
                format!("Too big: expected string to have <={max} characters"),
                false,
            );
        }
        Some(text)
    }

    /// `.optional().default("")` over a trimmed `.max(max)`.
    fn optional_text(&mut self, path: &str, value: Option<&Value>, max: usize) -> String {
        if value.is_none() {
            return String::new();
        }
        self.text(path, value, 0, max).unwrap_or_default()
    }

    fn option(&mut self, path: &str, value: Option<&Value>, options: &[&str]) -> Option<String> {
        match value {
            Some(Value::String(text)) if options.contains(&text.as_str()) => Some(text.clone()),
            _ => {
                let list: Vec<String> = options
                    .iter()
                    .map(|option| format!("\"{option}\""))
                    .collect();
                self.push(
                    path,
                    format!("Invalid option: expected one of {}", list.join("|")),
                    true,
                );
                None
            }
        }
    }

    /// `z.number().int().min(1980).max(2100).nullable()`.
    fn year(&mut self, path: &str, value: Option<&Value>) -> Value {
        let number = match value {
            Some(Value::Null) => return Value::Null,
            Some(Value::Number(number)) => number.as_f64().unwrap_or(f64::NAN),
            other => {
                self.wrong_type(path, "number", other);
                return Value::Null;
            }
        };
        if number.fract() != 0.0 || !number.is_finite() {
            self.push(
                path,
                "Invalid input: expected int, received number".to_owned(),
                true,
            );
            return Value::Null;
        }
        if number < 1980.0 {
            self.push(
                path,
                "Too small: expected number to be >=1980".to_owned(),
                false,
            );
        }
        if number > 2100.0 {
            self.push(
                path,
                "Too big: expected number to be <=2100".to_owned(),
                false,
            );
        }
        value.cloned().unwrap_or(Value::Null)
    }

    /// `z.array(item)` with `.min(min)` / `.max(max)`. zod runs the length
    /// checks on a string given instead of the array too.
    fn array<'a>(
        &mut self,
        path: &str,
        value: Option<&'a Value>,
        min: Option<usize>,
        max: usize,
    ) -> Option<&'a Vec<Value>> {
        let (length, origin) = match value {
            Some(Value::Array(items)) => (items.len(), "array"),
            Some(Value::String(text)) => (js::utf16_len(text), "string"),
            _ => (usize::MAX, ""),
        };
        let items = match value {
            Some(Value::Array(items)) => Some(items),
            other => {
                self.wrong_type(path, "array", other);
                None
            }
        };
        if length != usize::MAX {
            let unit = if origin == "array" {
                "items"
            } else {
                "characters"
            };
            if let Some(min) = min.filter(|min| length < *min) {
                self.push(
                    path,
                    format!("Too small: expected {origin} to have >={min} {unit}"),
                    false,
                );
            }
            if length > max {
                self.push(
                    path,
                    format!("Too big: expected {origin} to have <={max} {unit}"),
                    false,
                );
            }
        }
        items
    }

    /// The array's items as texts, after the checks of the items (zod parses
    /// the items, then the array's own checks run).
    fn texts(
        &mut self,
        path: &str,
        value: Option<&Value>,
        min: Option<usize>,
        max: usize,
        item_max: usize,
    ) -> Vec<String> {
        let items = value.and_then(Value::as_array).cloned().unwrap_or_default();
        let texts = items
            .iter()
            .enumerate()
            .filter_map(|(i, item)| self.text(&format!("{path}.{i}"), Some(item), 1, item_max))
            .collect();
        self.array(path, value, min, max);
        texts
    }
}

fn object<'a>(
    issues: &mut Issues,
    path: &str,
    value: Option<&'a Value>,
) -> Option<&'a Map<String, Value>> {
    match value {
        Some(Value::Object(map)) => Some(map),
        other => {
            issues.wrong_type(path, "object", other);
            None
        }
    }
}

fn join(path: &str, key: &str) -> String {
    if path.is_empty() {
        key.to_owned()
    } else {
        format!("{path}.{key}")
    }
}

/// One parsed source of `catalogSourceSchema`.
struct Source {
    url: String,
    platform: String,
    role: String,
    rights: String,
    title: String,
    creator: String,
    note: String,
}

fn source(issues: &mut Issues, path: &str, value: &Value) -> Option<Source> {
    let map = object(issues, path, Some(value))?;
    let url_path = join(path, "url");
    let url = issues.text(&url_path, map.get("url"), 1, 2_048);
    if let Some(url) = &url
        && normalize_catalog_source_url(url).is_none()
    {
        issues.push(
            &url_path,
            "최종 HTTPS 공개 URL을 입력해 주세요.".to_owned(),
            false,
        );
    }
    let platform = issues.option(&join(path, "platform"), map.get("platform"), &PLATFORMS);
    let role = issues.option(&join(path, "sourceRole"), map.get("sourceRole"), &ROLES);
    let rights = issues.option(&join(path, "rightsBasis"), map.get("rightsBasis"), &RIGHTS);
    // Validated, then replaced by the social link's own id (`normalizeCatalogRegistration`).
    issues.optional_text(&join(path, "externalId"), map.get("externalId"), 240);
    let title = issues.optional_text(&join(path, "title"), map.get("title"), 300);
    let creator = issues.optional_text(&join(path, "creatorName"), map.get("creatorName"), 200);
    let note = issues.optional_text(&join(path, "reviewNote"), map.get("reviewNote"), 500);
    Some(Source {
        url: url?,
        platform: platform?,
        role: role?,
        rights: rights?,
        title,
        creator,
        note,
    })
}

/// `catalogRegistrationSchema.safeParse(input)` and, when it passes,
/// `normalizeCatalogRegistration`'s output as JSON.
pub fn registration(input: &Value) -> Result<Value, Issues> {
    let mut issues = Issues::default();
    let Some(map) = object(&mut issues, "", Some(input)) else {
        return Err(issues);
    };
    let key = map.get("registrationKey");
    match key {
        Some(Value::String(text)) if is_uuid(text) => {}
        Some(Value::String(_)) => issues.push("registrationKey", "Invalid UUID".to_owned(), false),
        other => issues.wrong_type("registrationKey", "string", other),
    }
    let title = issues.text("title", map.get("title"), 1, 160);
    let aliases = if map.get("aliases").is_none() {
        Vec::new()
    } else {
        issues.texts("aliases", map.get("aliases"), None, 20, 120)
    };
    let summary = issues.text("summary", map.get("summary"), 1, 300);
    let description = issues.text("description", map.get("description"), 1, 5_000);
    let origin = issues.text("origin", map.get("origin"), 1, 5_000);
    let years = ["sourceWorkYear", "memeFirstSeenYear", "koreaViralYear"]
        .map(|name| issues.year(name, map.get(name)));
    let precision = issues.option("yearPrecision", map.get("yearPrecision"), &PRECISIONS);
    let tags = issues.texts("tags", map.get("tags"), Some(1), 15, 60);
    let safety = issues.option("safetyLevel", map.get("safetyLevel"), &SAFETY);
    let category = issues.option("category", map.get("category"), &CATEGORIES);
    let difficulty = issues.option("difficulty", map.get("difficulty"), &DIFFICULTIES);
    let sentiment = issues.option("sentiment", map.get("sentiment"), &SENTIMENTS);
    let mut context = Map::new();
    if let Some(usage) = object(&mut issues, "usageContext", map.get("usageContext")) {
        for name in CONTEXTS {
            if let Some(level) =
                issues.option(&join("usageContext", name), usage.get(name), &SAFETY)
            {
                context.insert(name.to_owned(), Value::from(level));
            }
        }
    }
    let mut sources = Vec::new();
    if let Some(items) = map.get("sources").and_then(Value::as_array) {
        for (i, item) in items.iter().enumerate() {
            if let Some(parsed) = source(&mut issues, &format!("sources.{i}"), item) {
                sources.push(parsed);
            }
        }
    }
    issues.array("sources", map.get("sources"), Some(2), 8);
    if !issues.aborted {
        refine(
            &mut issues,
            title.as_deref().unwrap_or_default(),
            summary.as_deref().unwrap_or_default(),
            &sources,
        );
    }
    if !issues.is_empty() {
        return Err(issues);
    }
    Ok(normalized(
        map,
        [title, summary, description, origin],
        aliases,
        years,
        [precision, safety, category, difficulty, sentiment],
        context,
        tags,
        &sources,
    ))
}

/// The `superRefine` of the registration.
fn refine(issues: &mut Issues, title: &str, summary: &str, sources: &[Source]) {
    let key = meme_title_key(title);
    if !key.is_empty() && meme_title_key(summary) == key {
        issues.push(
            "summary",
            "밈의 뜻이나 사용 상황을 덧붙인 요약을 입력해 주세요.".to_owned(),
            false,
        );
    }
    let urls: Vec<Option<String>> = sources
        .iter()
        .map(|source| normalize_catalog_source_url(&source.url))
        .collect();
    let mut distinct = urls.clone();
    distinct.sort();
    distinct.dedup();
    if distinct.len() != urls.len() {
        issues.push(
            "sources",
            "같은 출처 URL을 두 번 등록할 수 없어요.".to_owned(),
            false,
        );
    }
    if !sources
        .iter()
        .any(|source| matches!(source.role.as_str(), "original" | "earliest_known"))
    {
        issues.push(
            "sources",
            "원문 또는 최초 확인 출처가 필요해요.".to_owned(),
            false,
        );
    }
    if !sources.iter().any(|source| {
        matches!(
            source.role.as_str(),
            "secondary_reference" | "official_reupload"
        )
    }) {
        issues.push(
            "sources",
            "독립적인 검증 출처가 필요해요.".to_owned(),
            false,
        );
    }
    for (i, source) in sources.iter().enumerate() {
        let social = normalize_source_url(&source.url);
        let social_platform = matches!(
            source.platform.as_str(),
            "youtube" | "youtube_shorts" | "tiktok" | "instagram"
        );
        let mismatch = match &social {
            Some(social) => social.platform.as_str() != source.platform,
            None => social_platform,
        };
        if mismatch {
            issues.push(
                &format!("sources.{i}.platform"),
                "URL과 플랫폼이 일치하지 않아요.".to_owned(),
                false,
            );
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn normalized(
    map: &Map<String, Value>,
    texts: [Option<String>; 4],
    aliases: Vec<String>,
    years: [Value; 3],
    options: [Option<String>; 5],
    context: Map<String, Value>,
    tags: Vec<String>,
    sources: &[Source],
) -> Value {
    let unique = |items: Vec<String>| {
        let mut kept: Vec<String> = Vec::new();
        for item in items {
            if !kept.contains(&item) {
                kept.push(item);
            }
        }
        kept
    };
    let [title, summary, description, origin] = texts.map(Option::unwrap_or_default);
    let [precision, safety, category, difficulty, sentiment] =
        options.map(Option::unwrap_or_default);
    let [source_work, first_seen, korea_viral] = years;
    let sources: Vec<Value> = sources
        .iter()
        .map(|source| {
            serde_json::json!({
                "url": normalize_catalog_source_url(&source.url).unwrap_or_default(),
                "platform": source.platform,
                "sourceRole": source.role,
                "rightsBasis": source.rights,
                "externalId": normalize_source_url(&source.url).map(|social| social.external_id).unwrap_or_default(),
                "title": source.title,
                "creatorName": source.creator,
                "reviewNote": source.note,
            })
        })
        .collect();
    serde_json::json!({
        "registrationKey": map.get("registrationKey"),
        "title": title,
        "aliases": unique(aliases),
        "summary": summary,
        "description": description,
        "origin": origin,
        "sourceWorkYear": source_work,
        "memeFirstSeenYear": first_seen,
        "koreaViralYear": korea_viral,
        "yearPrecision": precision,
        "tags": unique(tags.iter().map(|tag| tag.to_lowercase()).collect()),
        "safetyLevel": safety,
        "category": category,
        "difficulty": difficulty,
        "sentiment": sentiment,
        "usageContext": context,
        "sources": sources,
    })
}

/// `catalogDuplicateCheckSchema.safeParse(input)`: the trimmed title and the
/// normalized URLs.
pub fn duplicate_check(input: &Value) -> Result<(String, Vec<String>), Issues> {
    let mut issues = Issues::default();
    let Some(map) = object(&mut issues, "", Some(input)) else {
        return Err(issues);
    };
    let title = issues.text("title", map.get("title"), 1, 160);
    let mut urls = Vec::new();
    if let Some(items) = map.get("sourceUrls").and_then(Value::as_array) {
        for (i, item) in items.iter().enumerate() {
            let path = format!("sourceUrls.{i}");
            if let Some(url) = issues.text(&path, Some(item), 0, 2_048) {
                match normalize_catalog_source_url(&url) {
                    Some(normalized) => urls.push(normalized),
                    None => issues.push(&path, "Invalid input".to_owned(), false),
                }
            }
        }
    }
    issues.array("sourceUrls", map.get("sourceUrls"), Some(1), 8);
    match title {
        Some(title) if issues.is_empty() => Ok((title, urls)),
        _ => Err(issues),
    }
}
