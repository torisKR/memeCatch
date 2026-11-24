//! The copy of the translated meme document and of the parts it shares with
//! the Korean one (`server/i18n/meme-edition.json`, from `DETAIL_COPY`,
//! `RELATED_COPY`, `PLAYER_COPY` and `MARKET_PASSPORT_COPY`).

use std::collections::HashMap;
use std::sync::LazyLock;

use serde::{Deserialize, Serialize};

/// `DETAIL_COPY` of app/[locale]/memes/[key]/page.tsx, the parts a
/// reviewed translation shows.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Detail {
    pub home: String,
    pub original_title: String,
    pub description: String,
    pub origin: String,
    pub usage: String,
    pub caution: String,
    pub sources: String,
    pub source_fallback: String,
    pub updated: String,
    /// With `{year}`.
    pub born: String,
    pub language: String,
    pub korean: String,
    pub reviewed: String,
    pub share: String,
    pub share_copied_status: String,
    pub context: String,
    pub context_unverified: String,
    pub contexts: HashMap<String, String>,
    pub safety: HashMap<String, String>,
}

/// `RELATED_COPY` of components/related-memes.tsx.
#[derive(Deserialize)]
pub struct Related {
    pub title: String,
    pub description: String,
}

/// `PLAYER_COPY` of components/meme-embed.tsx.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub representative_video: String,
    pub related_video: String,
    pub play_related_video: String,
    pub representative_content: String,
    pub related_content: String,
    pub example: String,
    pub open_post: String,
    pub tiktok_blank_hint: String,
    pub loading: String,
    pub unavailable: String,
    /// `" on"` in English (after "View"), a suffix of the name in the others.
    pub open_provider: String,
    pub error: String,
}

impl Player {
    /// The link to the post on its platform: "View on TikTok", "TikTok에서 보기".
    pub fn open(&self, english: bool, name: &str) -> String {
        if english {
            format!("View{} {name}", self.open_provider)
        } else {
            format!("{name}{}", self.open_provider)
        }
    }
}

/// `MARKET_PASSPORT_COPY` of lib/i18n-market-passport.ts.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Passport {
    pub title: String,
    pub description: String,
    pub language: String,
    pub active: String,
    pub adopted: String,
    pub origin_role: String,
    pub variant_title: String,
    pub variant_description: String,
    pub no_variants: String,
    pub usage: String,
    pub caution: String,
    pub market_names: HashMap<String, String>,
    pub relations: HashMap<String, String>,
}

#[derive(Deserialize)]
struct All {
    detail: HashMap<String, Detail>,
    related: HashMap<String, Related>,
    player: HashMap<String, Player>,
    passport: HashMap<String, Passport>,
}

static ALL: LazyLock<All> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../i18n/meme-edition.json"))
        .expect("meme-edition.json")
});

/// `code` is one of the four editions.
pub fn detail(code: &str) -> &'static Detail {
    &ALL.detail[code]
}

/// `code` is Korean or one of the four editions.
pub fn related(code: &str) -> &'static Related {
    &ALL.related[code]
}

pub fn player(code: &str) -> &'static Player {
    &ALL.player[code]
}

pub fn passport(code: &str) -> &'static Passport {
    &ALL.passport[code]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_language_has_its_copy() {
        for code in ["ko", "en", "ja", "zh", "zh-tw"] {
            assert!(!related(code).title.is_empty());
            assert!(!player(code).error.is_empty());
            assert!(!passport(code).title.is_empty());
        }
        assert_eq!(
            detail("en").born.replace("{year}", "2020"),
            "Originated around 2020"
        );
        assert_eq!(player("en").open(true, "TikTok"), "View on TikTok");
        assert_eq!(player("ja").open(false, "TikTok"), "TikTokで見る");
        assert_eq!(player("ko").open(false, "TikTok"), "TikTok에서 보기");
    }
}
