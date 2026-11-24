//! What the home page says, per language: `server/i18n/home.json`, exported
//! from lib/home-*-copy.ts, lib/safety-copy.ts, lib/i18n-routing.ts and
//! lib/curated-memes.ts by `scripts/build-i18n.mjs`.

use std::collections::HashMap;
use std::sync::LazyLock;

use serde::Deserialize;

#[derive(Deserialize)]
pub struct Link {
    pub href: String,
    pub label: String,
}

#[derive(Deserialize)]
pub struct Recent {
    pub title: String,
    pub all: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Community {
    pub title: String,
    pub description: String,
    pub action: String,
    pub create_action: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pathways {
    pub title: String,
    pub description: String,
    pub community: Community,
    pub contribution_label: String,
    pub submit_action: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trust {
    pub eyebrow: String,
    pub title: String,
    pub title_phrases: Option<Vec<String>>,
    pub description: String,
    pub links: Vec<Link>,
}

/// `HOME_COPY` of lib/home-copy.ts.
#[derive(Deserialize)]
pub struct HomeCopy {
    pub recent: Recent,
    pub pathways: Pathways,
    pub trust: Trust,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Web3Pathways {
    pub community_mark: String,
}

/// `HOME_WEB3_COPY` of lib/home-web3-copy.ts.
#[derive(Deserialize)]
pub struct Web3Copy {
    pub pathways: Web3Pathways,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    pub id: String,
    pub href: String,
    pub navigation_label: String,
    pub eyebrow: String,
    pub title: String,
    pub title_phrases: Option<Vec<String>>,
    pub description: String,
}

#[derive(Deserialize)]
pub struct StorySearch {
    pub label: String,
    pub placeholder: String,
    pub button: String,
}

/// `HOME_IMMERSIVE_COPY` of lib/home-immersive-copy.ts.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryCopy {
    pub navigation_label: String,
    pub skip_label: String,
    pub scene_label: String,
    pub pause_scene: String,
    pub play_scene: String,
    pub chapters: Vec<Chapter>,
    pub search: StorySearch,
    pub context_action: String,
    pub community_action: String,
}

/// `HOME_SCENE_COPY` of lib/home-scene-copy.ts.
#[derive(Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneCopy {
    pub controls_label: String,
    pub scroll_layout: String,
    pub scroll_hint: String,
    pub scroll_paused: String,
    pub scroll_reduced: String,
    pub layout_label: String,
    pub layout_loading: String,
    pub layout_unavailable: String,
    pub stack_label: String,
    pub spread_label: String,
    pub signal_group_label: String,
    pub reset_view: String,
    pub education_notice: String,
}

/// `HOME_DISCOVERY_COPY` of lib/home-discovery-copy.ts, the functions with
/// `{query}`, `{visible}` and `{total}` where their arguments go.
#[derive(Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryCopy {
    pub eyebrow: String,
    pub title: String,
    pub title_phrases: Option<Vec<String>>,
    pub description: String,
    pub search_label: String,
    pub search_placeholder: String,
    pub search_scope: String,
    pub search_archive: String,
    pub category_label: String,
    pub all_categories: String,
    pub results_label: String,
    pub result_status: String,
    pub clear_filters: String,
    pub no_results_title: String,
    pub no_results_description: String,
    pub empty_title: String,
    pub empty_description: String,
    pub unbroken_ending: Option<String>,
    pub original_label: String,
    pub preview_label: String,
    pub preview_eyebrow: String,
    pub preview_title: String,
    pub preview_phrases: Option<Vec<String>>,
    pub preview_description: String,
    pub preview_action: String,
    pub next_preview: String,
}

#[derive(Deserialize, serde::Serialize)]
pub struct Signal {
    pub label: String,
    pub summary: String,
    pub detail: String,
}

/// `getSafetySignalCopy(locale)` of lib/safety-copy.ts.
#[derive(Deserialize)]
pub struct SignalsCopy {
    pub eyebrow: String,
    pub title: String,
    pub description: String,
    pub disclaimer: String,
    pub expand: String,
    pub collapse: String,
    pub levels: HashMap<String, Signal>,
}

/// `getSeoCopy(locale)` of lib/i18n-routing.ts.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeoCopy {
    pub site_name: String,
    pub default_title: String,
    pub description: String,
    pub glossary_name: String,
    pub glossary_description: String,
    pub categories: HashMap<String, String>,
}

/// Everything the home page says in one language.
#[derive(Deserialize)]
pub struct Copy {
    pub home: HomeCopy,
    pub web3: Web3Copy,
    pub story: StoryCopy,
    pub scene: SceneCopy,
    pub discovery: DiscoveryCopy,
    pub signals: SignalsCopy,
    pub seo: SeoCopy,
}

/// The speaker and line of a curated meme's first example.
#[derive(Deserialize, Clone)]
pub struct Line {
    pub speaker: String,
    pub line: String,
}

/// A curated meme of lib/curated-memes.ts that passes the index gate.
#[derive(Deserialize)]
pub struct Curated {
    pub id: String,
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub category: String,
    pub safety_level: String,
    pub origin_year: i32,
    pub work: String,
    pub friends: String,
    pub dialogue: Option<Line>,
}

#[derive(Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Choice {
    pub label: String,
    pub level: String,
    pub is_correct: bool,
}

/// One question of `DIAGNOSTIC_QUESTIONS` (components/safety-diagnostic-quiz.tsx).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub situation: String,
    pub target_meme: String,
    pub meme_href: String,
    pub scenario: String,
    pub options: Vec<Choice>,
    pub explanation: String,
    pub safe_alternative: String,
}

/// `HINT_COPY` of components/home/translated-edition-hint.tsx.
#[derive(Deserialize)]
pub struct Hint {
    pub lead: String,
    pub cta: String,
}

#[derive(Deserialize)]
pub struct Home {
    pub locales: HashMap<String, Copy>,
    pub curated: Vec<Curated>,
    pub diagnostic: Vec<Diagnostic>,
    /// By `en`, `ja`, `zh`, `zh-tw`.
    pub hint: HashMap<String, Hint>,
}

pub static HOME: LazyLock<Home> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../i18n/home.json")).expect("home.json")
});

/// The copy of a home locale (`ko`, `en`, `ja`, `zh`, `zh-tw`).
pub fn copy(code: &str) -> &'static Copy {
    HOME.locales
        .get(code)
        .unwrap_or_else(|| panic!("home.json has no {code}"))
}

/// `SAFETY_SIGNAL_LEVELS`.
pub const SIGNAL_LEVELS: [&str; 4] = ["green", "yellow", "gray", "red"];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_home_locale_has_its_copy() {
        for code in ["ko", "en", "ja", "zh", "zh-tw"] {
            let copy = copy(code);
            assert_eq!(copy.story.chapters.len(), 3, "{code}");
            for level in SIGNAL_LEVELS {
                assert!(copy.signals.levels.contains_key(level), "{code} {level}");
            }
            assert!(copy.discovery.result_status.contains("{visible}"));
            assert!(copy.discovery.search_archive.contains("{query}"));
        }
        assert_eq!(HOME.diagnostic.len(), 5);
        assert!(!HOME.curated.is_empty());
    }
}
