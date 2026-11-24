//! The eight editorial memes of the home guide (`CURATED_CORE_MEMES` of
//! lib/curated-memes.ts, exported to `i18n/curated.json`). When one of those
//! short ids has no database row, the page is `components/curated-meme-article.tsx`
//! with `curatedMemeMetadata` (lib/public-meme-document.ts): at whatever key
//! was asked, without a redirect, and without JSON-LD of its own. A row, when
//! there is one, wins and is the ordinary document.

use std::sync::LazyLock;

use maud::{Markup, html};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use super::{SHARE_CARD_SUFFIX, house, seo};
use crate::pages::content_depth::{DepthInput, content_depth};
use crate::pages::document::{Head, ShareImage, Site};
use crate::pages::labels::SafetyLevel;
use crate::routes::public::{js, labels::meme_path};

const CURATED_JSON: &str = include_str!("../../../i18n/curated.json");

#[derive(Deserialize)]
pub struct Line {
    speaker: String,
    line: String,
}

#[derive(Deserialize)]
pub struct Example {
    context: String,
    description: Option<String>,
    dialogue: Vec<Line>,
}

#[derive(Deserialize)]
pub struct UsageContext {
    friends: String,
    work: String,
    sns: String,
}

/// `CuratedMeme`, the fields the page reads.
#[derive(Deserialize)]
pub struct Curated {
    short_id: String,
    slug: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
    category: String,
    safety_level: String,
    origin_year: i32,
    usage_context: UsageContext,
    usage_examples: Vec<Example>,
    caution: Option<String>,
    pub tags: Vec<String>,
}

static CURATED: LazyLock<Vec<Curated>> =
    LazyLock::new(|| serde_json::from_str(CURATED_JSON).expect("i18n/curated.json parses"));

/// `findCuratedCoreMeme`.
pub fn find(short_id: &str) -> Option<&'static Curated> {
    CURATED.iter().find(|meme| meme.short_id == short_id)
}

impl Curated {
    /// `curatedDepthInput`: no sources, contents or tags; each example's text
    /// is its description or its lines joined.
    fn is_indexable(&self) -> bool {
        let examples: Vec<Value> = self
            .usage_examples
            .iter()
            .map(|example| {
                let text = example.description.clone().unwrap_or_else(|| {
                    example
                        .dialogue
                        .iter()
                        .map(|line| line.line.as_str())
                        .collect::<Vec<_>>()
                        .join("\n")
                });
                let dialogue: Vec<Value> = example
                    .dialogue
                    .iter()
                    .map(|line| json!({ "speaker": line.speaker, "line": line.line }))
                    .collect();
                json!({ "situation": example.context, "dialogue": dialogue, "text": text })
            })
            .collect();
        content_depth(&DepthInput {
            description: &self.description,
            origin: &self.origin,
            usage_note: None,
            caution: self.caution.as_deref(),
            usage_examples: &Value::Array(examples),
            sources: &[],
            contents: &[],
            tag_count: 0,
        })
        .is_indexable()
    }

    /// `curatedShareVersion(meme)`: the first six bytes of a SHA-256 of the
    /// card's fields, as a decimal.
    fn share_version(&self) -> u64 {
        let text = [
            self.title.as_str(),
            &self.summary,
            &self.origin_year.to_string(),
            &self.category,
            "",
        ]
        .join("\n");
        let digest = Sha256::digest(text.as_bytes());
        digest[..6]
            .iter()
            .fold(0u64, |value, byte| (value << 8) | u64::from(*byte))
    }

    /// `curatedMemeMetadata`: no hreflang, no alternate locales.
    pub fn head(&self, site: &Site) -> Head {
        let path = meme_path(&self.short_id, &self.slug);
        Head {
            title: seo::title(&self.title, false),
            description: Some(seo::description(&seo::DescriptionInput {
                title: &self.title,
                summary: &self.summary,
                origin_year: Some(self.origin_year),
                year_precision: "",
                safety_level: &self.safety_level,
                usage_example_count: self.usage_examples.len(),
                has_origin: !js::trim(&self.origin).is_empty(),
                has_caution: false,
                house_original: false,
            })),
            robots: (!self.is_indexable()).then_some(super::NOINDEX_FOLLOW),
            image: Some(ShareImage {
                url: site.absolute(&format!(
                    "{path}/{SHARE_CARD_SUFFIX}?v={}",
                    self.share_version()
                )),
                mime: None,
                alt: self.title.clone(),
            }),
            canonical: Some(path),
            ..Head::default()
        }
    }

    /// `CuratedMemeArticle`.
    pub fn article(&self) -> Markup {
        let safety = SafetyLevel::parse(&self.safety_level);
        let dialogue = self
            .usage_examples
            .first()
            .and_then(|example| example.dialogue.get(1))
            .map(|line| line.line.as_str());
        let places = [
            ("직장", &self.usage_context.work),
            ("친구", &self.usage_context.friends),
            ("SNS", &self.usage_context.sns),
        ];
        html! {
            article class="mx-auto w-full max-w-3xl px-4 py-10 text-foreground" {
                nav class="text-sm" {
                    a class="underline-offset-4 hover:underline" href="/" { "밈캐치" }
                }
                header class="mt-6 border-b border-border pb-8" {
                    p class="text-sm font-bold text-accent-text" { (safety.label()) " · " (self.origin_year) }
                    h1 class="mt-3 text-4xl font-black leading-tight tracking-tight text-balance [word-break:keep-all] sm:text-5xl" { (self.title) }
                    p class="mt-4 text-base leading-7" { (self.summary) }
                    img src=(house::card_data_url(&self.title, &self.summary, dialogue)) alt=(format!("{} 카드", self.title)) class="mt-6 aspect-square w-full max-w-md rounded-2xl border border-border";
                    @if !self.tags.is_empty() {
                        ul class="mt-4 flex flex-wrap gap-2" {
                            @for tag in &self.tags {
                                li class="rounded-full bg-surface-2 px-2.5 py-1 text-sm font-medium text-muted" { "#" (tag) }
                            }
                        }
                    }
                }
                section class="mt-8" {
                    h2 class="text-xl font-black" { "뜻" }
                    p class="mt-3 text-base leading-7" { (self.description) }
                }
                section class="mt-8" {
                    h2 class="text-xl font-black" { "유래" }
                    p class="mt-3 text-base leading-7" { (self.origin) }
                }
                section class="mt-8" {
                    h2 class="text-xl font-black" { "어디서 쓸까" }
                    ul class="mt-3 grid gap-2 text-base" {
                        @for (place, level) in places {
                            li class="flex items-center justify-between gap-4 border-b border-border py-2" {
                                span { (place) }
                                span class="font-semibold" { (SafetyLevel::parse(level).label()) }
                            }
                        }
                    }
                }
                section class="mt-8" {
                    h2 class="text-xl font-black" { "이렇게 써요" }
                    div class="mt-4 grid gap-4" {
                        @for example in &self.usage_examples {
                            div class="rounded-2xl border border-border bg-surface p-4" {
                                h3 class="text-base font-bold" { (example.context) }
                                ul class="mt-3 grid gap-2 text-base leading-7" {
                                    @for line in &example.dialogue {
                                        li {
                                            span class="font-semibold" { (line.speaker) ". " }
                                            (line.line)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                @if let Some(caution) = self.caution.as_deref().filter(|caution| !caution.is_empty()) {
                    section class="mt-8" {
                        h2 class="text-xl font-black" { "주의" }
                        p class="mt-3 text-base leading-7" { (caution) }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_editorial_meme_is_there_and_has_a_stable_card_version() {
        let ids = [
            "jkm2022k", "fmc2022k", "oyj2021k", "nmd2022k", "mng2022k", "bjk2021k", "gnact78h",
            "okk2020k",
        ];
        for id in ids {
            assert!(find(id).is_some(), "{id}");
        }
        // The `?v` of /memes/jkm2022k (`curatedShareVersion`).
        assert_eq!(
            find("jkm2022k").map(Curated::share_version),
            Some(165_252_446_285_410)
        );
    }
}
