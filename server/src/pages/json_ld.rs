//! Structured data of `components/json-ld.tsx`, for the Korean pages.
//!
//! The text is what `JSON.stringify(data).replace(/</g, "\\u003c")` writes:
//! the same keys in the same order, so a diff against Next is a diff of facts.

use maud::{Markup, PreEscaped, html};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use super::content_depth::{
    SourceRow, is_public_display_source, public_source_url, source_document_key,
};
use super::document::Site;
use super::labels;
use crate::routes::public::js;

const SITE_NAME: &str = "밈캐치";
const GLOSSARY_NAME: &str = "밈캐치 밈 사전";
const CONTACT_EMAIL: &str = "toris@toris.kr";

/// A JSON value whose object keys keep the order they were written in.
/// (`serde_json::Value` sorts them.)
enum Json {
    Text(String),
    Number(u32),
    List(Vec<Json>),
    Object(Vec<(&'static str, Json)>),
}

fn text(value: impl Into<String>) -> Json {
    Json::Text(value.into())
}

impl Json {
    fn write(&self, out: &mut String) {
        match self {
            Self::Text(value) => {
                out.push_str(&serde_json::to_string(value).expect("a string serializes"));
            }
            Self::Number(value) => out.push_str(&value.to_string()),
            Self::List(items) => {
                out.push('[');
                for (index, item) in items.iter().enumerate() {
                    if index > 0 {
                        out.push(',');
                    }
                    item.write(out);
                }
                out.push(']');
            }
            Self::Object(fields) => {
                out.push('{');
                for (index, (key, value)) in fields.iter().enumerate() {
                    if index > 0 {
                        out.push(',');
                    }
                    out.push_str(&serde_json::to_string(key).expect("a string serializes"));
                    out.push(':');
                    value.write(out);
                }
                out.push('}');
            }
        }
    }
}

/// `<script type="application/ld+json">`. `<` is escaped so no value can
/// close the script element.
fn script(data: &Json) -> Markup {
    let mut json = String::new();
    data.write(&mut json);
    html! { script type="application/ld+json" { (PreEscaped(json.replace('<', "\\u003c"))) } }
}

/// `OrganizationJsonLd`: once on every page.
pub fn organization(site: &Site) -> Markup {
    let url = &site.url;
    script(&Json::Object(vec![
        ("@context", text("https://schema.org")),
        ("@type", text("Organization")),
        ("@id", text(format!("{url}#org"))),
        ("name", text(SITE_NAME)),
        (
            "alternateName",
            Json::List(vec![text("MemeCatch"), text("catchmeme")]),
        ),
        ("url", text(url)),
        ("logo", text(format!("{url}/icons/icon-512.png"))),
        (
            "description",
            text(
                "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지 알려주는 한국 밈 실시간 사전.",
            ),
        ),
        ("email", text(CONTACT_EMAIL)),
        (
            "founder",
            Json::Object(vec![
                ("@type", text("Person")),
                ("name", text("toris-dev")),
                ("url", text("https://github.com/toris-dev")),
            ]),
        ),
        ("publishingPrinciples", text(format!("{url}/editorial"))),
        (
            "correctionsPolicy",
            text(format!("{url}/editorial#corrections")),
        ),
        (
            "contactPoint",
            Json::Object(vec![
                ("@type", text("ContactPoint")),
                ("contactType", text("customer support")),
                ("email", text(CONTACT_EMAIL)),
                ("url", text(format!("{url}/support"))),
                (
                    "availableLanguage",
                    Json::List(vec![text("ko"), text("en")]),
                ),
            ]),
        ),
        (
            "sameAs",
            Json::List(vec![
                text("https://github.com/toris-dev/memeCatch"),
                text("https://fairy.hada.io/@toris-dev"),
            ]),
        ),
    ]))
}

fn glossary(site: &Site) -> Json {
    Json::Object(vec![
        ("@type", text("DefinedTermSet")),
        ("@id", text(format!("{}#glossary", site.url))),
        ("name", text(GLOSSARY_NAME)),
        ("url", text(&site.url)),
    ])
}

/// `evidenceTimestamp`: a stored timestamp, unless it is malformed or in the
/// future. The text is passed on as stored.
fn evidence_timestamp(value: Option<&str>, now: OffsetDateTime) -> Option<&str> {
    let value = js::trim(value?);
    OffsetDateTime::parse(value, &Rfc3339)
        .ok()
        .filter(|time| *time <= now)
        .map(|_| value)
}

/// `sourceLinksWithContent(sources, [])` then `citableSources(...).map(url)`:
/// public sources with a valid link and a title, once per document.
pub fn citations(sources: &[SourceRow]) -> Vec<String> {
    let mut seen: Vec<String> = Vec::new();
    let mut urls = Vec::new();
    for source in sources
        .iter()
        .filter(|source| is_public_display_source(source))
    {
        let Some(url) = public_source_url(source.source_url.as_deref()) else {
            continue;
        };
        let key = source_document_key(&url).to_owned();
        if seen.contains(&key) {
            continue;
        }
        // The first row for a document decides: a later row with a title
        // does not rescue an untitled first one (it was already deduplicated).
        seen.push(key);
        if source
            .title
            .as_deref()
            .is_some_and(|title| !js::trim(title).is_empty())
        {
            urls.push(url);
        }
    }
    urls
}

pub struct MemeTerm<'a> {
    pub name: &'a str,
    pub summary: &'a str,
    pub description: &'a str,
    /// `memePathFrom(short_id, slug)`.
    pub path: &'a str,
    pub category: &'a str,
    pub published_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
    pub sources: &'a [SourceRow],
}

/// `MemeWebPageJsonLd`: only for a document that is indexed.
pub fn meme_web_page(site: &Site, meme: &MemeTerm<'_>, now: OffsetDateTime) -> Markup {
    let url = site.absolute(meme.path);
    let mut fields = vec![
        ("@context", text("https://schema.org")),
        ("@type", text("WebPage")),
        ("name", text(meme.name)),
        ("description", text(meme.summary)),
        ("url", text(&url)),
        ("inLanguage", text("ko")),
    ];
    if let Some(published) = evidence_timestamp(meme.published_at, now) {
        fields.push(("datePublished", text(published)));
    }
    if let Some(modified) = evidence_timestamp(meme.updated_at, now) {
        fields.push(("dateModified", text(modified)));
    }
    let citations = citations(meme.sources);
    if !citations.is_empty() {
        fields.push((
            "citation",
            Json::List(citations.into_iter().map(text).collect()),
        ));
    }
    let definition = if meme.description.is_empty() {
        meme.summary
    } else {
        meme.description
    };
    fields.extend([
        (
            "isPartOf",
            Json::Object(vec![
                ("@type", text("WebSite")),
                ("name", text(SITE_NAME)),
                ("url", text(&site.url)),
            ]),
        ),
        (
            "publisher",
            Json::Object(vec![("@id", text(format!("{}#org", site.url)))]),
        ),
        (
            "speakable",
            Json::Object(vec![
                ("@type", text("SpeakableSpecification")),
                (
                    "cssSelector",
                    Json::List(vec![text("h1"), text("#meme-summary")]),
                ),
            ]),
        ),
        (
            "mainEntity",
            Json::Object(vec![
                ("@type", text("DefinedTerm")),
                ("name", text(meme.name)),
                ("description", text(definition)),
                ("url", text(&url)),
                ("inDefinedTermSet", glossary(site)),
            ]),
        ),
    ]);
    script(&Json::Object(fields))
}

/// `MemeDefinedTermJsonLd`: the dictionary entry on its own.
pub fn meme_defined_term(site: &Site, meme: &MemeTerm<'_>) -> Markup {
    script(&Json::Object(vec![
        ("@context", text("https://schema.org")),
        ("@type", text("DefinedTerm")),
        ("name", text(meme.name)),
        ("description", text(meme.summary)),
        ("url", text(site.absolute(meme.path))),
        ("inLanguage", text("ko")),
        ("inDefinedTermSet", glossary(site)),
    ]))
}

/// `MemeBreadcrumbJsonLd`: home, the category's explore list, the document.
/// `None` for a category outside the enum, which Next cannot render either.
pub fn meme_breadcrumb(site: &Site, meme: &MemeTerm<'_>) -> Option<Markup> {
    let category_name = labels::category_label(meme.category)?;
    let display = labels::display_category(meme.category)?;
    let item = |position: u32, name: &str, url: String| {
        Json::Object(vec![
            ("@type", text("ListItem")),
            ("position", Json::Number(position)),
            ("name", text(name)),
            ("item", text(url)),
        ])
    };
    Some(script(&Json::Object(vec![
        ("@context", text("https://schema.org")),
        ("@type", text("BreadcrumbList")),
        (
            "itemListElement",
            Json::List(vec![
                item(1, SITE_NAME, site.url.clone()),
                item(
                    2,
                    category_name,
                    site.absolute(&format!("/explore?category={display}")),
                ),
                item(3, meme.name, site.absolute(meme.path)),
            ]),
        ),
    ])))
}

/// The `CollectionPage` of /memes: the page, and the first ten of its list
/// with their position in the whole directory.
pub fn directory_page(
    site: &Site,
    name: &str,
    path: &str,
    item_count: usize,
    start: usize,
    first: &[(String, String)],
) -> Markup {
    let number = |value: usize| Json::Number(u32::try_from(value).unwrap_or(u32::MAX));
    script(&Json::Object(vec![
        ("@context", text("https://schema.org")),
        ("@type", text("CollectionPage")),
        ("name", text(name)),
        ("url", text(site.absolute(path))),
        ("inLanguage", text("ko")),
        ("isPartOf", website(site)),
        (
            "mainEntity",
            Json::Object(vec![
                ("@type", text("ItemList")),
                ("numberOfItems", number(item_count)),
                (
                    "itemListElement",
                    Json::List(
                        first
                            .iter()
                            .enumerate()
                            .map(|(index, (name, path))| {
                                Json::Object(vec![
                                    ("@type", text("ListItem")),
                                    ("position", number(start + index + 1)),
                                    ("name", text(name.as_str())),
                                    ("url", text(site.absolute(path))),
                                ])
                            })
                            .collect(),
                    ),
                ),
            ]),
        ),
    ]))
}

/// `isPartOf` of the list pages.
fn website(site: &Site) -> Json {
    Json::Object(vec![
        ("@type", text("WebSite")),
        ("name", text(SITE_NAME)),
        ("url", text(site.url.clone())),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 2026-06-01T00:00:00Z.
    fn june_2026() -> OffsetDateTime {
        OffsetDateTime::from_unix_timestamp(1_780_272_000).expect("a valid timestamp")
    }

    fn site() -> Site {
        Site {
            url: "http://127.0.0.1:3001".to_owned(),
            ga_id: None,
            adsense_client: None,
            adsense_auto_ads: false,
            css_href: String::new(),
            js_href: String::new(),
        }
    }

    fn source(url: &str, title: Option<&str>) -> SourceRow {
        SourceRow {
            source_url: Some(url.to_owned()),
            title: title.map(str::to_owned),
            hidden_from_public: None,
        }
    }

    #[test]
    fn breadcrumb_is_byte_for_byte_what_next_writes() {
        // Copied from the page Next renders for the seeded meme pgrich01
        // (parity/pages/seed.sql), built with NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001.
        const NEXT: &str = r#"<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"밈캐치","item":"http://127.0.0.1:3001"},{"@type":"ListItem","position":2,"name":"밈 용어(유행어)","item":"http://127.0.0.1:3001/explore?category=meme_term"},{"@type":"ListItem","position":3,"name":"패리티 리치","item":"http://127.0.0.1:3001/memes/pgrich01-parity-rich"}]}</script>"#;
        let meme = MemeTerm {
            name: "패리티 리치",
            summary: "",
            description: "",
            path: "/memes/pgrich01-parity-rich",
            category: "phrase",
            published_at: None,
            updated_at: None,
            sources: &[],
        };
        assert_eq!(
            meme_breadcrumb(&site(), &meme)
                .expect("a known category")
                .into_string(),
            NEXT
        );
    }

    #[test]
    fn web_page_escapes_markup_and_leaves_out_what_it_cannot_state() {
        let sources = [source("https://a.example.org/x", None)];
        let meme = MemeTerm {
            name: "</script><b>",
            summary: "요약",
            description: "",
            path: "/memes/abc-x",
            category: "phrase",
            published_at: Some("2999-01-01T00:00:00+00:00"),
            updated_at: Some("not a date"),
            sources: &sources,
        };
        let out = meme_web_page(&site(), &meme, june_2026()).into_string();
        // Every `<` of a value is written as a JSON escape.
        let escaped = |json: &str| json.replace('<', "\\u003c");

        assert!(!out["<script type=\"application/ld+json\">".len()..].contains("</script><b>"));
        assert!(out.contains(&escaped(r#""name":"</script><b>""#)));
        assert!(
            !out.contains("datePublished"),
            "a future date is not evidence"
        );
        assert!(!out.contains("dateModified"));
        assert!(!out.contains("citation"), "an untitled source is not cited");
        // With no description the entry is defined by its summary.
        assert!(out.contains(&escaped(
            r#""mainEntity":{"@type":"DefinedTerm","name":"</script><b>","description":"요약""#
        )));
    }

    #[test]
    fn citations_are_titled_public_links_once_per_document() {
        let hidden = SourceRow {
            hidden_from_public: Some(true),
            ..source("https://hidden.example.org/", Some("숨김"))
        };
        let sources = [
            source("https://news.example.org/a", Some("기사")),
            source("https://news.example.org/a#part", Some("같은 문서")),
            source("https://namu.wiki/w/밈", Some(" 위키 ")),
            source("https://untitled.example.org/", Some("  ")),
            source("ftp://files.example.org/", Some("링크 아님")),
            hidden,
        ];
        assert_eq!(
            citations(&sources),
            [
                "https://news.example.org/a",
                "https://namu.wiki/w/%EB%B0%88"
            ]
        );
    }

    #[test]
    fn a_stored_timestamp_is_evidence_only_when_it_has_passed() {
        let now = june_2026();
        let stored = "2026-01-05T03:04:05.678+00:00";
        assert_eq!(evidence_timestamp(Some(stored), now), Some(stored));
        assert_eq!(
            evidence_timestamp(Some("2026-06-01T00:00:01+00:00"), now),
            None
        );
        assert_eq!(evidence_timestamp(Some(""), now), None);
        assert_eq!(evidence_timestamp(None, now), None);
    }
}
