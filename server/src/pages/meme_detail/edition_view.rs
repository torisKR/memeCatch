//! The `<article>` of a translated meme document
//! (`LocalizedMemePage` in app/[locale]/memes/[key]/page.tsx).

use maud::{Markup, html};
use serde_json::Value;

use super::edition::EditionDocument;
use super::edition_copy::{self, Detail};
use super::{embed, export, view};
use crate::pages::content_depth::SourceRow;
use crate::pages::dates;
use crate::pages::home::copy as home_copy;
use crate::pages::i18n::Locale;

const PANEL: &str = "glass-panel relative overflow-hidden rounded-2xl p-5 sm:p-7";
const LEVELS: [&str; 4] = ["green", "yellow", "gray", "red"];

/// `usageContexts(meme.usage_context)`: the entries with a known level, in
/// the order Postgres writes a `jsonb` object (shorter keys first).
fn usage_contexts(value: &Value) -> Vec<(&str, &str)> {
    let Some(object) = value.as_object() else {
        return Vec::new();
    };
    let mut entries: Vec<(&str, &str)> = object
        .iter()
        .filter_map(|(key, level)| {
            let level = level.as_str()?;
            LEVELS.contains(&level).then_some((key.as_str(), level))
        })
        .collect();
    entries.sort_by(|(a, _), (b, _)| a.len().cmp(&b.len()).then_with(|| a.cmp(b)));
    entries
}

/// `isUnverifiedContexts`: two or more entries, all green.
fn unverified(entries: &[(&str, &str)]) -> bool {
    entries.len() >= 2 && entries.iter().all(|(_, level)| *level == "green")
}

/// The language a version link names.
fn language_name(code: &str) -> &'static str {
    match code {
        "zh-tw" => "繁體中文",
        "zh" => "简体中文",
        "ja" => "日本語",
        _ => "English",
    }
}

fn prose(id: &str, heading: &str, text: &str, extra: Markup) -> Markup {
    html! {
        section aria-labelledby=(id) class=(PANEL) {
            div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0" {}
            div class="relative" {
                h2 id=(id) class="text-2xl font-black tracking-tight" { (heading) }
                p class="mt-3 whitespace-pre-line leading-relaxed" { (text) }
                (extra)
            }
        }
    }
}

fn contexts(copy: &Detail, value: &Value) -> Markup {
    let entries = usage_contexts(value);
    let level = |level: &str| copy.safety.get(level).cloned().unwrap_or_default();
    html! {
        @if unverified(&entries) {
            div class="mt-5 border-t border-border pt-4" {
                p class="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted" {
                    span aria-hidden="true" { "◌" }
                    (copy.context_unverified)
                }
            }
        } @else if !entries.is_empty() {
            div class="mt-5 border-t border-border pt-4" {
                h3 class="text-sm font-bold" { (copy.context) }
                dl class="mt-3 grid gap-2 sm:grid-cols-2" {
                    @for (context, value) in &entries {
                        div class="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm" {
                            dt { (copy.contexts.get(*context).map_or(*context, String::as_str)) }
                            dd class="font-semibold" { (level(value)) }
                        }
                    }
                }
            }
        }
    }
}

/// A text that is not blank: `value || …`.
fn filled(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|text| !text.is_empty())
}

fn sources(copy: &Detail, links: &[&SourceRow]) -> Markup {
    let text = filled;
    html! {
        aside class="rounded-2xl border border-border bg-surface-2 p-5 lg:sticky lg:top-20" {
            h2 class="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)" { (copy.sources) }
            ol class="mt-4 space-y-3" {
                @for (index, source) in links.iter().enumerate() {
                    li class="text-sm" {
                        a href=(source.source_url.as_deref().unwrap_or_default()) target="_blank" rel="noopener noreferrer" class="font-semibold underline decoration-border underline-offset-4 hover:text-accent" {
                            @if let Some(title) = text(&source.title).or(text(&source.platform)) {
                                (title)
                            } @else {
                                (copy.source_fallback) " " (index + 1)
                            }
                            span aria-hidden="true" { " ↗" }
                        }
                        @if let Some(creator) = text(&source.creator_name) {
                            p class="mt-1 text-xs text-muted" { (creator) }
                        }
                    }
                }
            }
        }
    }
}

pub(super) fn article(doc: &EditionDocument<'_>) -> Markup {
    let (code, meme, translation) = (doc.code, doc.meme, doc.translation);
    let copy = edition_copy::detail(code);
    let seo = &home_copy::copy(code).seo;
    let locale = Locale::get(code).expect("an edition is a locale");
    let category = seo
        .categories
        .get(&meme.category)
        .map_or("", String::as_str);
    let updated = translation
        .updated_at
        .as_deref()
        .and_then(dates::parse)
        .map(|time| dates::edition_date(code, time));
    let usage_note = translation
        .usage_note
        .as_deref()
        .filter(|note| !note.is_empty());
    let caution = translation
        .caution
        .as_deref()
        .filter(|text| !text.is_empty());
    let source_links: Vec<&SourceRow> = doc
        .source_links
        .iter()
        .filter(|source| source.source_url.is_some())
        .collect();
    html! {
        article lang=(locale.info().lang) dir="ltr" class="mx-auto max-w-site px-4 py-8 pb-16 text-foreground" {
            (doc.json_ld)
            nav aria-label="Breadcrumb" class="mb-8 text-sm text-muted" {
                a href=(format!("/{code}")) class="underline-offset-4 hover:text-foreground hover:underline" { (copy.home) }
                span aria-hidden="true" class="mx-2" { "/" }
                span aria-current="page" { (translation.title()) }
            }
            header class="border-b border-border pb-8" {
                div class="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.1em]" {
                    span class="rounded-full bg-accent-soft px-3 py-1.5 text-accent" { (category) }
                    span class="rounded-full bg-surface-2 px-3 py-1.5 text-muted" { (copy.safety.get(&meme.safety_level).map_or("", String::as_str)) }
                    span class="rounded-full bg-safety-green-bg px-3 py-1.5 text-safety-green" { (copy.reviewed) }
                }
                div class="meme-detail-title-frame" {
                    h1 class="meme-detail-title-title mt-5 whitespace-normal font-black leading-tight tracking-[-0.03em]" { (translation.title()) }
                }
                div class="mt-4" {
                    p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted" { (copy.original_title) }
                    p lang="ko" dir="ltr" class="mt-1 text-lg font-bold" { (meme.title) }
                }
                p id="meme-summary" class="mt-6 max-w-3xl text-xl font-medium leading-relaxed" { (translation.summary()) }
                p class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" {
                    // `{meme.origin_year && …}`: React writes a year of 0 as "0".
                    @match meme.origin_year {
                        Some(0) => "0",
                        Some(year) => span { (copy.born.replace("{year}", &year.to_string())) },
                        None => {},
                    }
                    span { (copy.updated) ": " (updated.unwrap_or_else(|| "Invalid Date".to_owned())) }
                }
            }
            nav aria-label=(copy.language) class="border-b border-border py-5" {
                p class="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted" { (copy.language) }
                ul class="flex flex-wrap gap-2" {
                    li {
                        a href=(meme.path()) hreflang="ko" lang="ko" class="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-sm font-semibold hover:border-accent" { (copy.korean) }
                    }
                    @for version in &doc.versions {
                        li {
                            a href=(version.path) hreflang=(version.hreflang) aria-current=[(version.code == code).then_some("page")] class="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-sm font-semibold hover:border-accent aria-[current=page]:border-accent aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent" { (language_name(version.code)) }
                        }
                    }
                }
            }
            div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,15rem)] lg:items-start" {
                (view::save_button(&meme.id, locale))
                (export::button(&meme.short_id, locale))
            }
            div class="mt-3 flex justify-end" {
                (view::share_button(&doc.canonical, translation.title(), &copy.share, Some((&seo.site_name, &copy.share_copied_status))))
            }
            div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start" {
                div class="space-y-6" {
                    @if let Some(video) = &doc.video {
                        (embed::embed(&embed::Embed {
                            content: Some(video),
                            fallback_source_url: None,
                            fallback_reason: None,
                            embedding_allowed: true,
                            title: translation.title(),
                            representative: video.is_representative == Some(true),
                            category: None,
                            origin_year: None,
                            locale: code,
                        }))
                    }
                    @if !translation.description().is_empty() {
                        (prose("meme-description", &copy.description, translation.description(), html! {}))
                    }
                    @if !translation.origin().is_empty() {
                        (prose("meme-origin", &copy.origin, translation.origin(), html! {}))
                    }
                    @if let Some(note) = usage_note {
                        (prose("meme-usage", &copy.usage, note, contexts(copy, &meme.usage_context)))
                    }
                    @if let Some(caution) = caution {
                        section aria-labelledby="meme-caution" class="rounded-2xl border border-safety-yellow bg-safety-yellow-bg p-5 text-safety-yellow sm:p-7" {
                            h2 id="meme-caution" class="text-xl font-black" { (copy.caution) }
                            p class="mt-2 whitespace-pre-line leading-relaxed" { (caution) }
                        }
                    }
                    (doc.passport)
                    (doc.related)
                }
                @if !source_links.is_empty() {
                    (sources(copy, &source_links))
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn contexts_come_in_jsonb_key_order_and_unknown_levels_are_dropped() {
        let value = json!({ "work": "yellow", "friends": "green", "sns": "red", "family": "blue" });

        assert_eq!(
            usage_contexts(&value),
            [("sns", "red"), ("work", "yellow"), ("friends", "green")]
        );
        assert!(unverified(&usage_contexts(
            &json!({ "work": "green", "sns": "green" })
        )));
        assert!(!unverified(&usage_contexts(&json!({ "work": "green" }))));
        assert!(usage_contexts(&json!([])).is_empty());
    }
}
