//! `components/export-button.tsx`: the "export card" button of the left rail.
//! Closed, it is the button. Open, it is the panel in the template next to
//! it, which `ui/export.js` puts in its place, fills with the copy of the
//! page's language (it follows the language switch) and downloads from
//! `/memes/{short_id}/export`.

use maud::{Markup, html};

use crate::pages::i18n::Locale;

const GLOW: &str = "hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)]";
const TEMPLATES: [&str; 3] = ["classic", "minimal", "bold"];
const FORMATS: [&str; 2] = ["card", "story"];
// The choice buttons, before `ui/export.js` adds the selected or idle classes.
const CHOICE: &str =
    "relative flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors";

/// `locale` is the page's (the frame's) language.
pub fn button(short_id: &str, locale: Locale) -> Markup {
    let copy = locale.export_copy();
    let open = copy["open"].as_str().unwrap_or_default();
    html! {
        button type="button" class={(GLOW) " inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface-2 px-5 text-sm font-semibold text-foreground transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"} data-export=(short_id) data-export-locale=(locale.code()) data-export-copy=(copy.to_string()) {
            span aria-hidden="true" { "⬇" }
            (open)
        }
        template data-export-panel {
            section class="rounded-2xl border border-border bg-surface-2 p-4" {
                div class="mb-3 flex items-center justify-between" {
                    h3 class="text-sm font-bold text-foreground" data-copy-key="title" {}
                    button type="button" class="grid h-11 w-11 place-items-center rounded-full text-text-muted hover:bg-surface" data-export-close {
                        span aria-hidden="true" { "✕" }
                    }
                }
                p class="mb-1.5 text-xs font-semibold text-text-muted" data-copy-key="template" {}
                div class="mb-3 flex gap-2" {
                    @for template in TEMPLATES {
                        button type="button" class=(CHOICE) data-export-template=(template) data-copy-key=(template) {}
                    }
                }
                p class="mb-1.5 text-xs font-semibold text-text-muted" data-copy-key="format" {}
                div class="mb-3 flex gap-2" {
                    @for format in FORMATS {
                        button type="button" class=(CHOICE) data-export-format=(format) data-copy-key=(format) {}
                    }
                }
                p class="mb-2 text-xs text-text-muted" data-copy-key="watermarkNote" {}
                p class="mb-2 text-xs text-safety-red" data-export-error data-copy-key="failed" {}
                button type="button" class={(GLOW) " inline-flex h-11 w-full items-center justify-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"} data-export-download {}
            }
        }
    }
}
