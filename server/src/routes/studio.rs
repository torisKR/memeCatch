//! The meme studio: `POST /api/meme-studio` (`studio/public.rs`, route id
//! `meme-studio`) and `POST /api/admin/meme-studio` (`studio/admin.rs`, route
//! id `admin-meme-studio`), from `lib/meme-studio.server.ts`.
//!
//! The public studio never calls a model: it fills three fixed templates.
//! Only the operator route spends money, on AWS Bedrock.

mod admin;
mod bedrock;
mod converse;
mod public;
mod templates;

use std::sync::Arc;

use axum::Router;
use axum::extract::{Request, State};
use axum::routing::post;
use serde::Serialize;

use super::Routes;
use super::public::csp_report::now_ms;
use super::public::rate_limit::RateLimiter;
use super::request::SiteOrigin;
use crate::AppState;

/// `MEME_TONES`.
pub const TONES: [&str; 4] = ["wholesome", "sarcastic", "absurd", "hype"];
/// `MEME_FORMATS`.
pub const FORMATS: [&str; 3] = ["image-macro", "reaction", "caption"];

/// One entry of `MEME_COUNTRIES` in lib/meme-country.ts.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Country {
    pub code: &'static str,
    pub label: &'static str,
    pub local_language: &'static str,
}

const COUNTRIES: [Country; 10] = [
    country("KR", "대한민국", "한국어"),
    country("US", "미국", "English"),
    country("JP", "일본", "日本語"),
    country("GB", "영국", "English"),
    country("BR", "브라질", "Português"),
    country("MX", "멕시코", "Español"),
    country("CN", "중국", "简体中文"),
    country("TW", "대만", "繁體中文"),
    country("DE", "독일", "Deutsch"),
    country("FR", "프랑스", "Français"),
];

const fn country(code: &'static str, label: &'static str, local_language: &'static str) -> Country {
    Country {
        code,
        label,
        local_language,
    }
}

/// `getMemeCountry(code)`: `None` for anything `isMemeCountryCode` refuses.
pub fn meme_country(code: &str) -> Option<Country> {
    COUNTRIES
        .iter()
        .copied()
        .find(|country| country.code == code)
}

/// `MemeConcept`, its keys in the order the TypeScript builds them.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Concept {
    pub country_code: String,
    pub headline: String,
    pub caption: String,
    pub local_caption: String,
    pub cultural_anchor: String,
    pub visual_brief: String,
    pub why_it_works: String,
    pub usage_context: String,
}

impl Concept {
    /// `normalizeMemeConcept`: en and em dashes become hyphens.
    pub fn normalized(self) -> Self {
        let dash = |value: String| value.replace(['\u{2013}', '\u{2014}'], "-");
        Self {
            country_code: self.country_code,
            headline: dash(self.headline),
            caption: dash(self.caption),
            local_caption: dash(self.local_caption),
            cultural_anchor: dash(self.cultural_anchor),
            visual_brief: dash(self.visual_brief),
            why_it_works: dash(self.why_it_works),
            usage_context: dash(self.usage_context),
        }
    }
}

/// `lastHangulHasBatchim` of lib/korean-particles.ts.
fn last_hangul_has_batchim(text: &str) -> bool {
    let Some(last) = text.chars().rfind(|c| ('가'..='힣').contains(c)) else {
        return false;
    };
    (u32::from(last) - 0xAC00) % 28 != 0
}

/// `withKoreanParticle(word, "이/가" | "을/를")`.
pub fn with_particle(word: &str, pair: &str) -> String {
    let batchim = last_hangul_has_batchim(word);
    let ending = match (pair, batchim) {
        ("이/가", true) => "이",
        ("이/가", false) => "가",
        ("을/를", true) => "을",
        ("을/를", false) => "를",
        (_, true) => "은",
        (_, false) => "는",
    };
    format!("{word}{ending}")
}

pub fn router(state: &AppState) -> Router<AppState> {
    let limiter = Arc::new(RateLimiter::new(now_ms()));
    let routes = Routes::new(state).add(
        "meme-studio",
        "/api/meme-studio",
        post(move |_: State<AppState>, request: Request| {
            public::generate(limiter.clone(), request)
        }),
    );
    let site = SiteOrigin::from_site_url(&state.config.site_url);
    let bedrock = converse::Bedrock::new().map(Arc::new);
    let enabled = state.config.bedrock_studio.enabled;
    let (Some(site), Ok(bedrock), true) = (site, bedrock, enabled) else {
        // Next keeps the operator route: Bedrock not switched on here (Next
        // may have it on), a site URL `new URL` refuses, or no TLS.
        return routes.build();
    };
    routes
        .add(
            "admin-meme-studio",
            "/api/admin/meme-studio",
            post(move |state: State<AppState>, request: Request| {
                admin::studio(state, site.clone(), bedrock.clone(), request)
            }),
        )
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Each verdict is what withKoreanParticle of lib/korean-particles.ts gives.
    #[test]
    fn the_particle_follows_the_last_hangul_syllable() {
        assert_eq!(with_particle("고양이", "이/가"), "고양이가");
        assert_eq!(with_particle("밈", "이/가"), "밈이");
        assert_eq!(with_particle("밈", "을/를"), "밈을");
        assert_eq!(with_particle("사과", "을/를"), "사과를");
        assert_eq!(with_particle("밈 2026", "이/가"), "밈 2026이");
        assert_eq!(with_particle("cat", "이/가"), "cat가");
        assert_eq!(with_particle("", "을/를"), "를");
    }

    #[test]
    fn countries_are_the_ten_of_lib_meme_country() {
        assert_eq!(meme_country("JP").unwrap().local_language, "日本語");
        assert_eq!(meme_country("KR").unwrap().label, "대한민국");
        for refused in ["kr", "XX", "", "toString", "__proto__"] {
            assert_eq!(meme_country(refused), None, "{refused}");
        }
    }
}
