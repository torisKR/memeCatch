//! `components/meme-chatbot.tsx`: the launcher, and the panel it opens as a
//! template until `ui/chat.js` opens it. The class names of its
//! CSS module are spelled `meme-chatbot-<class>` (`scripts/build-ui.mjs`).
//! Answers, references and the progress card are filled into the templates
//! at the end; a character changes state as `setCharacter` in `ui/chat.js`
//! does it: `data-character-state`, the image, and one of the icon templates.

use maud::{Markup, PreEscaped, html};

use super::Frame;
use crate::pages::i18n::routing::parse_locale_path;

/// `HIDDEN_PATHS`: pages without the chat.
const HIDDEN_PATHS: [&str; 6] = [
    "/admin",
    "/auth",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
];
const STILL: &str = "/images/meme-chat/mascot-idle.png";
const LOOP: &str = "/images/meme-chat/mascot-wave.gif";
const CLOSE_ICON: &str = r#"<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>"#;
const SMALL_CLOSE: &str = r#"<path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>"#;
const CHECK: &str = r#"<path d="M20 6 9 17l-5-5"></path>"#;
/// `MemeChatCharacter`'s status icons, by state.
const STATE_ICONS: [(&str, &str, &str); 4] = [
    (
        "reading",
        "book-open",
        r#"<path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path>"#,
    ),
    (
        "searching",
        "search",
        r#"<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>"#,
    ),
    (
        "answering",
        "message-circle",
        r#"<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path>"#,
    ),
    ("ready", "check", CHECK),
];

/// `MemeChatCharacter`. `ui/chat.js` changes its state the same way.
fn character(state: &str, size: u32) -> Markup {
    let animated = state != "ready" && state != "found";
    let icon = STATE_ICONS
        .iter()
        .find(|(name, _, _)| *name == state || (state == "found" && *name == "ready"));
    html! {
        span class="meme-chatbot-character" data-character-state=(state) aria-hidden="true" style=(format!("width:{size}px;height:{size}px")) {
            picture {
                source media="(prefers-reduced-motion: reduce)" srcset=(STILL);
                img src=(if animated { LOOP } else { STILL }) alt="" width=(size) height=(size) class="meme-chatbot-character-image" decoding="async" draggable="false";
            }
            @if let Some((_, name, paths)) = icon {
                (state_icon(name, paths))
            }
        }
    }
}

fn state_icon(name: &str, paths: &'static str) -> Markup {
    html! {
        span class="meme-chatbot-character-state" {
            svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class=(format!("lucide lucide-{name}")) aria-hidden="true" {
                (PreEscaped(paths))
            }
        }
    }
}

pub fn chat(frame: &Frame) -> Markup {
    let route = parse_locale_path(frame.pathname()).1;
    let hidden = HIDDEN_PATHS
        .iter()
        .any(|path| route == *path || route.starts_with(&format!("{path}/")));
    if hidden {
        return html! { div data-frame="chat" hidden {} };
    }
    let (code, copy) = frame.locale.chat();
    let copy_json = serde_json::to_string(copy).expect("chat copy serializes");
    html! {
        div data-frame="chat" data-chat data-chat-locale=(code) data-chat-copy=(copy_json) class="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-[45] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 md:bottom-6 md:right-6" {
            // `ui/chat.js` shows the panel from here and keeps it, with the
            // conversation, between openings.
            template data-chat-panel {
            section id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" data-chat-panel class="meme-chatbot-panel menu-pop flex max-h-[calc(100dvh-16rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] h-[min(38rem,calc(100dvh-16rem-env(safe-area-inset-bottom)-env(safe-area-inset-top)))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border bg-surface text-foreground shadow-[0_16px_60px_rgba(0,0,0,0.18)] md:max-h-[min(36rem,calc(100dvh-14rem))]" {
                header class="meme-chatbot-panel-header flex shrink-0 items-center gap-3 border-b border-border px-4 py-3" {
                    span data-chat-face { (character("idle", 54)) }
                    div class="min-w-0 flex-1" {
                        h2 id="chat-title" class="text-base font-bold" { (copy.title) }
                        p class="mt-0.5 text-xs text-muted" { (copy.subtitle) }
                    }
                    button type="button" data-chat-close aria-label=(copy.close) class="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-background focus-visible:outline-2 focus-visible:outline-accent" {
                        svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" { (PreEscaped(CLOSE_ICON)) }
                    }
                }
                div data-chat-scroll class="meme-chatbot-chat-log min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 text-sm" {
                    div role="log" aria-live="polite" aria-relevant="additions" data-chat-log class="space-y-4" {
                        div data-chat-welcome class="meme-chatbot-welcome" {
                            div class="flex items-start gap-2" {
                                (character("idle", 42))
                                div class="meme-chatbot-bot-bubble" { p class="leading-relaxed" { (copy.welcome) } }
                            }
                            div class="meme-chatbot-suggestions" {
                                @for suggestion in [&copy.starter_one, &copy.starter_two, &copy.starter_three] {
                                    button type="button" data-chat-suggestion class="meme-chatbot-suggestion" { (suggestion) span aria-hidden="true" { "↗" } }
                                }
                            }
                            p class="mt-3 text-center text-xs leading-relaxed text-muted" { (copy.privacy) }
                        }
                    }
                    div data-chat-pending-slot {}
                }
                form data-chat-form aria-label=(copy.question) class="shrink-0 border-t border-border px-4 pb-3 pt-3" {
                    p class="mb-2 text-xs leading-relaxed text-muted" { (copy.disclosure) }
                    p role="alert" data-chat-error hidden class="mb-2 text-sm leading-relaxed text-accent-text" {}
                    label for="chat-input" class="sr-only" { (copy.question) }
                    textarea id="chat-input" aria-describedby="chat-input-hint" rows="2" maxlength="120" placeholder=(copy.placeholder) class="block w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60" {}
                    p id="chat-input-hint" class="meme-chatbot-keyboard-hint mt-1.5 text-[11px] text-muted" { (copy.input_hint) }
                    div class="mt-2 flex items-center gap-3" {
                        button type="button" data-chat-clear class="min-h-11 min-w-11 text-xs text-muted underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent" { (copy.clear) }
                        span data-chat-count class="ml-auto text-xs text-muted" aria-hidden="true" { "0/120" }
                        button type="submit" disabled class="min-h-11 min-w-11 rounded-full bg-accent-strong px-4 text-sm font-bold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50" { (copy.send) }
                    }
                }
            }
            }
            button type="button" data-chat-launcher data-chat-open="false" aria-label=(copy.open) aria-expanded="false" class="meme-chatbot-launcher flex h-16 w-16 shrink-0 items-center justify-center border border-accent/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" {
                span class="meme-chatbot-launcher-prompt" aria-hidden="true" data-chat-prompt { (copy.launcher_hint) }
                span data-chat-face { (character("idle", 58)) }
                span class="meme-chatbot-launcher-close" aria-hidden="true" data-chat-x hidden {
                    svg viewBox="0 0 16 16" width="12" height="12" { (PreEscaped(SMALL_CLOSE)) }
                }
            }
            (templates())
        }
    }
}

/// What `ui/chat.js` fills in: an answered turn, a reference, a source
/// link, the progress card, and a character in each state.
fn templates() -> Markup {
    html! {
        template data-chat-turn {
            article class="space-y-2" {
                p class="meme-chatbot-user-bubble ml-8 whitespace-pre-wrap bg-accent-soft px-3 py-2 text-foreground" data-question {}
                div class="meme-chatbot-answer flex items-start gap-2" {
                    (character("ready", 34))
                    div class="min-w-0 flex-1 space-y-3" {
                        div class="meme-chatbot-bot-bubble" {
                            p class="mb-1 text-xs font-medium text-accent-text" data-mode {}
                            p class="whitespace-pre-wrap leading-relaxed" data-answer {}
                        }
                        div data-references {
                            h3 class="mb-2 text-xs font-semibold text-muted" data-references-title {}
                            ul class="space-y-2" {}
                        }
                    }
                }
            }
        }
        template data-chat-reference {
            li class="meme-chatbot-reference rounded-2xl border border-border bg-background p-3" {
                a class="font-bold text-foreground underline decoration-accent/40 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" data-title {}
                p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted" data-summary {}
                div class="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-xs" data-sources {
                    span class="text-muted" data-sources-title {}
                }
            }
        }
        template data-chat-source {
            a target="_blank" rel="noopener noreferrer" class="text-accent-text underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" {}
        }
        template data-chat-pending {
            div class="space-y-2" {
                p class="meme-chatbot-user-bubble ml-8 whitespace-pre-wrap bg-accent-soft px-3 py-2" data-question {}
                div class="flex items-start gap-2" data-chat-progress="pending" {
                    span data-chat-face { (character("idle", 50)) }
                    div class="meme-chatbot-wait-card min-w-0 flex-1" {
                        div class="flex items-center justify-between gap-2" {
                            p role="status" aria-atomic="true" class="text-sm font-medium leading-relaxed" data-status {}
                            span class="meme-chatbot-dots" aria-hidden="true" { span {} span {} span {} }
                        }
                        span data-found hidden {
                            svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" data-found-check { path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" {} }
                            span data-found-label {}
                        }
                        span class="meme-chatbot-skeleton" aria-hidden="true" data-skeleton hidden { span {} span {} }
                    }
                }
            }
        }
        @for (state, name, paths) in STATE_ICONS {
            template data-chat-icon=(state) { (state_icon(name, paths)) }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pages::i18n::Locale;

    #[test]
    fn the_chat_is_absent_from_sign_in_pages_and_speaks_english_for_arabic() {
        let frame = |code: &str, path: &'static str| Frame {
            locale: Locale::get(code).expect("locale"),
            path_and_query: path,
        };
        assert!(
            !chat(&frame("ko", "/login"))
                .into_string()
                .contains("data-chat-launcher")
        );
        let korean = chat(&frame("ko", "/about")).into_string();
        assert!(korean.contains(r#"aria-label="밈캐치 챗봇 열기""#));
        let arabic = chat(&frame("ar", "/about")).into_string();
        assert!(arabic.contains(r#"data-chat-locale="en""#));
    }
}
