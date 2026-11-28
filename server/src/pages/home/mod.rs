//! `GET /` (`app/(default)/page.tsx`): the home page. Its sections are
//! `HomeExperience` (components/home/home-experience.tsx) with the daily
//! quiz after the story, and the community battle beside it.
//!
//! What the page does in the browser is `ui/home.js` (`assets/pages/home.js`);
//! the three.js scene is `assets/pages/home-scene.js`, which that script
//! imports when the scene comes into view, as home-scene.tsx does.

mod battle;
pub mod copy;
pub mod edition;
mod icons;
mod sections;
mod story;

use std::time::Duration;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, PreEscaped, html};
use serde_json::json;

use self::copy::{Copy, HOME, SIGNAL_LEVELS};
use self::sections::Entry;
use super::document::{self, Head, ShareImage, Site};
use super::meme_card::{CardMeme, MIN_LISTING};
use super::{explore, html_cached, json_ld, path_and_query};
use crate::AppState;

/// The page's `Cache-Control`: an hour at the CDN.
const CACHE: &str = "s-maxage=3600, stale-while-revalidate=31532400";
/// How long the recent memes and the battle are kept; a catalogue edit
/// drops them at once (`pages::expire_catalog`).
pub const HOME_TTL: Duration = Duration::from_secs(300);
/// `getRecentlyPublishedMemes(6, …)`.
const RECENT: usize = 6;
/// Translated editions with fewer live entries are topped up with curated
/// memes, up to `DECK_MAX`. The Korean home only shows image-backed entries.
const LIVE_ENOUGH: usize = 4;
const DECK_MAX: usize = 8;

/// What the page reads from the database.
#[derive(Clone)]
pub struct Data {
    /// `None` when the discovery index or the list could not be read.
    recent: Option<Vec<Entry>>,
    boards: Vec<battle::Board>,
    battle_samples: Vec<battle::Sample>,
}

/// `localizedPath(path, locale)`.
pub fn localized(code: &str, path: &str) -> String {
    match (code, path) {
        ("ko", _) => path.to_owned(),
        (_, "/") => format!("/{code}"),
        _ => format!("/{code}{path}"),
    }
}

/// `cjkKeepPhrases`: each phrase on one line, when they make up the text.
pub fn keep_phrases(text: &str, phrases: Option<&[String]>, class: &str) -> Markup {
    match phrases {
        Some(phrases) if phrases.concat() == text => html! {
            @for phrase in phrases { span class=(class) { (phrase) } }
        },
        _ => html! { (text) },
    }
}

async fn recent(state: &AppState) -> Option<Vec<Entry>> {
    let categories = &copy::copy("ko").seo.categories;
    Some(
        explore::recent_image_cards(state, RECENT)
            .await?
            .into_iter()
            .map(|(meme, card)| Entry {
                href: meme.path(),
                category_label: categories.get(&meme.category).cloned().unwrap_or_default(),
                original_title: None,
                meme,
                image_card: Some(card),
            })
            .collect(),
    )
}

async fn fetch(state: &AppState) -> Data {
    let discovery = explore::discovery(state).await;
    let recent = recent(state).await;
    let battle_samples = match &discovery {
        Some(ids) => battle::load_samples(&state.db, ids).await,
        None => Vec::new(),
    };
    Data {
        recent,
        boards: battle::load(&state.db).await,
        battle_samples,
    }
}

/// The page's data, kept while it read completely.
async fn load(state: &AppState) -> Data {
    state
        .pages
        .home
        .get_or_load(|| async {
            let data = fetch(state).await;
            if data.recent.is_some() {
                Ok(data)
            } else {
                Err(data)
            }
        })
        .await
        .unwrap_or_else(|partial| partial)
}

/// `getGuaranteedHomeEntries(locale, liveEntries)`.
fn guaranteed(code: &str, copy: &Copy, mut entries: Vec<Entry>) -> Vec<Entry> {
    let label = |category: &str| copy.seo.categories.get(category).cloned();
    if entries.len() >= LIVE_ENOUGH {
        return entries;
    }
    let live: Vec<String> = entries.iter().map(|entry| entry.meme.id.clone()).collect();
    let fallback = HOME
        .curated
        .iter()
        .filter(|curated| !live.contains(&curated.id))
        .map(|curated| {
            let meme = CardMeme {
                id: curated.id.clone(),
                category: curated.category.clone(),
                short_id: curated.short_id.clone(),
                slug: curated.slug.clone(),
                title: curated.title.clone(),
                summary: curated.summary.clone(),
                safety_level: super::labels::SafetyLevel::parse_known(&curated.safety_level),
                origin_year: Some(curated.origin_year),
                trend_score: None,
                // Its thumbnail is a data: URL card, which is not owned art.
                contents: Vec::new(),
            };
            Entry {
                href: localized(code, &meme.path()),
                category_label: label(&curated.category).unwrap_or_else(|| "밈 용어".to_owned()),
                original_title: None,
                meme,
                image_card: None,
            }
        });
    entries.extend(fallback);
    entries.truncate(DECK_MAX);
    entries
}

/// `entrySearchText` before it is normalized.
fn search_text(entry: &Entry) -> String {
    [
        entry.meme.title.as_str(),
        entry.meme.summary.as_str(),
        entry.category_label.as_str(),
        entry.original_title.as_deref().unwrap_or(""),
    ]
    .join(" ")
}

/// What `ui/home.js` needs besides the markup, as JSON in the page.
fn script_data(
    site: &Site,
    copy: &Copy,
    entries: &[Entry],
    boards: &[battle::Board],
    korean: bool,
) -> Markup {
    let scene = &copy.scene;
    let module = site
        .page_js
        .iter()
        .find(|(name, _)| *name == "home-scene")
        .map(|(_, href)| href.clone());
    let signals: serde_json::Map<String, serde_json::Value> = SIGNAL_LEVELS
        .iter()
        .map(|level| {
            let signal = &copy.signals.levels[*level];
            (
                (*level).to_owned(),
                json!({ "label": signal.label, "summary": signal.summary }),
            )
        })
        .collect();
    let data = json!({
        "locales": super::i18n::Locale::all().map(super::i18n::Locale::code).collect::<Vec<_>>(),
        "scene": {
            "module": module,
            "korean": korean,
            "pause": copy.story.pause_scene,
            "play": copy.story.play_scene,
            "hint": scene.scroll_hint,
            "paused": scene.scroll_paused,
            "reduced": scene.scroll_reduced,
            "loading": scene.layout_loading,
            "unavailable": scene.layout_unavailable,
            "signals": signals,
        },
        "discovery": {
            "status": copy.discovery.result_status,
            "archive": copy.discovery.search_archive,
            "previewAction": copy.discovery.preview_action,
            "originalLabel": copy.discovery.original_label,
            "entries": entries.iter().map(|entry| json!({
                "title": entry.meme.title,
                "text": search_text(entry),
                "category": entry.category_label,
                "href": entry.href,
                "original": entry.original_title,
            })).collect::<Vec<_>>(),
        },
        "diagnostic": HOME.diagnostic.iter().map(|question| json!({
            "situation": question.situation,
            "targetMeme": question.target_meme,
            "memeHref": question.meme_href,
            "linked": sections::diagnostic_link_shown(&question.meme_href),
            "scenario": question.scenario,
            "options": question.options,
            "explanation": question.explanation,
            "safeAlternative": question.safe_alternative,
        })).collect::<Vec<_>>(),
        "battle": boards,
    });
    // Inside <script>: no `<` may close it.
    let text = data.to_string().replace('<', "\\u003c");
    html! { script type="application/json" id="home-data" { (PreEscaped(text)) } }
}

/// `HomeExperience`, with the daily quiz and edition hint `/` adds, and
/// the JSON its script reads.
fn experience(site: &Site, code: &str, entries: &[Entry], boards: &[battle::Board]) -> Markup {
    let copy = copy::copy(code);
    let korean = code == "ko";
    html! {
        div class="home-web3-page" {
            @if korean { (sections::edition_hint()) }
            (story::story(code, copy))
            @if korean {
                div class="home-web3-plain-section" { (sections::daily_quiz()) }
            }
            @if korean || entries.len() >= MIN_LISTING {
                section id="home-latest" data-home-section="recent-content" aria-label=(copy.home.recent.title) class="home-web3-editorial-section home-web3-anchor-target" {
                    (sections::discovery(code, copy, entries))
                    div class="home-web3-recent-signal-rail" {
                        a href=(localized(code, "/explore?sort=recent")) class="home-web3-contribution-link-strong" {
                            (copy.home.recent.all) " " (icons::arrow_right("home-web3-button-icon"))
                        }
                    }
                }
            }
            section id="home-safety-showcase" data-home-section="safety-showcase" class="home-web3-plain-section" { (sections::showcase()) }
            section id="home-safety-quiz" data-home-section="safety-quiz" class="home-web3-plain-section" { (sections::diagnostic()) }
            section id="home-signals" data-home-section="usage-signals" class="home-web3-signals-section home-web3-anchor-target" {
                div class="home-web3-signals-frame" { (sections::signals(copy)) }
            }
            (sections::pathways(code, copy))
            (sections::trust(code, copy))
        }
        (script_data(site, copy, entries, boards, korean))
    }
}

/// The `<head>` of `/` and of `/{locale}` (`buildLocalizedMetadata` with
/// every edition available).
fn head(site: &Site, code: &'static str) -> Head {
    let seo = &copy::copy(code).seo;
    let korean = code == "ko";
    Head {
        title: seo.default_title.clone(),
        title_absolute: true,
        description: Some(seo.description.clone()),
        canonical: Some(localized(code, "/").trim_end_matches('/').to_owned()),
        languages: [
            ("ko", ""),
            ("en", "/en"),
            ("ja", "/ja"),
            ("zh-Hans", "/zh"),
            ("zh-Hant", "/zh-tw"),
            ("x-default", "/en"),
        ]
        .map(|(lang, path)| (lang.to_owned(), path.to_owned()))
        .to_vec(),
        image: Some(if korean {
            ShareImage::site_default(site)
        } else {
            ShareImage::edition_default(site, code)
        }),
        alternate_locales: true,
        script: Some("home"),
        stylesheet: Some("home"),
        edition: (!korean).then_some(code),
        ..Head::default()
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let data = load(&state).await;
    let site = &state.pages.site;
    let seo = &copy::copy("ko").seo;
    let deck = data.recent.as_deref().unwrap_or_default();
    let main = html! {
        main class="bg-background text-foreground" data-ads=[site.ads_client()] {
            (json_ld::home_website(site, "", &seo.site_name, "ko", "/search"))
            (json_ld::home_glossary(site, "", &seo.glossary_name, &seo.glossary_description, "ko"))
            // The battle sits beside the page from the widest screens.
            div class=[(!data.boards.is_empty()).then_some("xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start")] {
                (experience(site, "ko", deck, &data.boards))
                @if !data.boards.is_empty() {
                    aside class="px-4 pb-8 xl:pr-4 xl:pl-0" { (battle::battle(&data.boards, &data.battle_samples)) }
                }
            }
        }
    };
    html_cached(
        StatusCode::OK,
        CACHE,
        document::page(site, &head(site, "ko"), path_and_query(&request), main),
    )
}

/// The cache of `Shared`.
pub fn cache(freshness: &super::cache::Freshness) -> super::cache::Timed<Data> {
    super::cache::Timed::new(HOME_TTL, freshness)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_are_localized_as_localized_path_does() {
        assert_eq!(localized("ko", "/search"), "/search");
        assert_eq!(localized("en", "/"), "/en");
        assert_eq!(
            localized("zh-tw", "/explore?sort=recent"),
            "/zh-tw/explore?sort=recent"
        );
    }

    #[test]
    fn translated_decks_are_topped_up_with_curated_memes_when_thin() {
        let copy = copy::copy("en");
        let fallback = guaranteed("en", copy, Vec::new());
        assert_eq!(fallback.len(), HOME.curated.len().min(DECK_MAX));
        assert!(fallback.iter().all(|entry| entry.meme.contents.is_empty()));
        let live = fallback[0].clone();
        let topped = guaranteed("en", copy, vec![live.clone()]);
        assert_eq!(topped[0].meme.id, live.meme.id);
        assert_eq!(
            topped
                .iter()
                .filter(|entry| entry.meme.id == live.meme.id)
                .count(),
            1
        );
    }

    #[test]
    fn phrases_are_kept_only_when_they_make_the_text() {
        let phrases = ["가나".to_owned(), "다라".to_owned()];
        assert_eq!(
            keep_phrases("가나다라", Some(&phrases), "k").into_string(),
            r#"<span class="k">가나</span><span class="k">다라</span>"#
        );
        assert_eq!(
            keep_phrases("가나다", Some(&phrases), "k").into_string(),
            "가나다"
        );
    }
}
