//! `GET /{locale}` (`app/[locale]/page.tsx`, with the `[locale]` layout):
//! a translated edition's home. The same `HomeExperience` as `/`, in the
//! edition's language, without the Korean home's daily quiz, battle and
//! edition hint; its deck is the newest reviewed translations
//! (`getLocalizedFeaturedMemes`), topped up with curated memes.

use std::cmp::Ordering;
use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, PreEscaped, html};
use serde_json::json;

use super::sections::Entry;
use super::{CACHE, HOME_TTL, copy, experience, guaranteed, head, localized};
use crate::AppState;
use crate::pages::cache::Keyed;
use crate::pages::document::{self, Site};
use crate::pages::i18n::Locale;
use crate::pages::{html_in, path_and_query};
use crate::routes::public::js_date;
use crate::routes::public::labels::meme_path;
use crate::routes::public::localized::{LocalizedMeme, featured};

/// `SEO_CONTENT_LOCALES`, and the path of each edition's home.
pub const EDITIONS: [&str; 4] = ["en", "ja", "zh", "zh-tw"];
pub const PATHS: [&str; 4] = ["/en", "/ja", "/zh", "/zh-tw"];
/// `getLocalizedFeaturedMemes(locale, 24)`, of which the newest six.
const AVAILABLE: usize = 24;
const SHOWN: usize = 6;
/// About the size of one edition's 24 rows with their contents.
const ROW_BYTES: usize = 8 * 1024;
const CACHE_MAX_BYTES: usize = 4 * AVAILABLE * ROW_BYTES;

pub type Featured = Arc<Vec<LocalizedMeme>>;

pub fn cache() -> Keyed<&'static str, Featured> {
    Keyed::new(HOME_TTL, CACHE_MAX_BYTES, |rows| rows.len() * ROW_BYTES)
}

/// `SEO_LOCALE_CONFIG[locale].bcp47`.
fn bcp47(code: &str) -> &'static str {
    match code {
        "en" => "en-US",
        "ja" => "ja-JP",
        "zh" => "zh-CN",
        _ => "zh-TW",
    }
}

/// The six whose translation changed last, newest first (a stable sort, as
/// `Array.prototype.sort`; an unreadable date compares equal, as `NaN`).
fn newest(available: &[LocalizedMeme]) -> Vec<&LocalizedMeme> {
    let mut sorted: Vec<&LocalizedMeme> = available.iter().collect();
    sorted.sort_by(|left, right| {
        match (
            js_date::parse_ms(&left.translation_updated_at),
            js_date::parse_ms(&right.translation_updated_at),
        ) {
            (Some(left), Some(right)) => right.cmp(&left),
            _ => Ordering::Equal,
        }
    });
    sorted.truncate(SHOWN);
    sorted
}

fn deck(code: &'static str, available: &[LocalizedMeme]) -> Vec<Entry> {
    let copy = copy::copy(code);
    let live = newest(available)
        .into_iter()
        .map(|meme| Entry {
            href: localized(code, &meme_path(&meme.short_id, &meme.slug)),
            category_label: copy
                .seo
                .categories
                .get(&meme.card.category)
                .cloned()
                .unwrap_or_default(),
            original_title: Some(meme.original_title.clone()),
            meme: meme.card.clone(),
        })
        .collect();
    guaranteed(code, copy, live)
}

/// The page's `@graph`: the edition's `WebSite` and its glossary.
fn json_ld(site: &Site, code: &str) -> Markup {
    let seo = &copy::copy(code).seo;
    let home = site.absolute(&format!("/{code}"));
    let data = json!({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": format!("{home}#website"),
                "name": seo.site_name,
                "url": home,
                "description": seo.description,
                "inLanguage": bcp47(code),
                "publisher": { "@id": format!("{}#org", site.url) },
            },
            {
                "@type": "DefinedTermSet",
                "@id": format!("{home}#glossary"),
                "name": seo.glossary_name,
                "description": seo.glossary_description,
                "url": home,
                "inLanguage": bcp47(code),
            },
        ],
    });
    let text = data.to_string().replace('<', "\\u003c");
    html! { script type="application/ld+json" { (PreEscaped(text)) } }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let Some(code) = EDITIONS
        .into_iter()
        .find(|code| request.uri().path().strip_prefix('/') == Some(*code))
    else {
        return crate::fallback::answer(State(state), request).await;
    };
    // A failed read is the empty list Next renders too; it is not kept.
    let available = state
        .pages
        .home_editions
        .get_or_load(code, || async {
            featured(&state.db, code, AVAILABLE).await.map(Arc::new)
        })
        .await
        .inspect_err(|error| tracing::warn!(%error, code, "edition featured memes not read"))
        .unwrap_or_default();
    let site = &state.pages.site;
    let locale = Locale::get(code).expect("an edition is a locale");
    let language = locale.info().lang.as_str();
    let main = html! {
        main lang=(language) dir="ltr" class="bg-background text-foreground" {
            (json_ld(site, code))
            (experience(site, code, &deck(code, &available), &[]))
        }
    };
    html_in(
        StatusCode::OK,
        CACHE,
        language,
        document::page_in(
            site,
            &head(site, code),
            path_and_query(&request),
            main,
            locale,
        ),
    )
}
