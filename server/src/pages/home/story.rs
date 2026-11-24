//! `HomeImmersiveStory` (components/home/home-immersive-story.tsx) and the
//! scene it pins between its chapters: `HomeScene` with `variant="story"`
//! (home-scene.tsx, home-story-scene-view.tsx) and its SVG stand-in
//! (home-scene-fallback.tsx).
//!
//! The markup is the server render: the renderer is still `fallback`, the
//! layout is `scroll`, the green signal is chosen. `ui/home.js` takes it
//! from there and imports the three.js scene (`assets/pages/home-scene.js`)
//! when the figure comes into view, as the component does.

use maud::{Markup, html};

use super::copy::{Copy, SIGNAL_LEVELS};
use super::icons;
use super::keep_phrases;
use crate::pages::labels::SafetyLevel;

/// The scene's ids. Next's are React's generated ones.
pub const EXPLANATION_ID: &str = "axum-id-scene-explanation";
const LAYOUT_NAME: &str = "story-layout-axum-id-scene";
const LAYOUTS: [&str; 3] = ["scroll", "stacked", "spread"];

/// `HomeImmersiveStory`.
pub fn story(code: &str, copy: &Copy) -> Markup {
    let story = &copy.story;
    let search_id = format!("home-story-search-{code}");
    html! {
        section id="home-top" class="home-immersive-story-story" data-home-scroll-track="true" data-home-section="hero-search" aria-label=(story.navigation_label) {
            nav class="home-immersive-story-chapter-nav h-rail" aria-label=(story.navigation_label) {
                ol class="home-immersive-story-chapter-nav-list" {
                    @for (index, chapter) in story.chapters.iter().enumerate() {
                        li {
                            a class="home-immersive-story-chapter-nav-link" href=(chapter.href) {
                                span aria-hidden="true" { (format!("{:02}", index + 1)) }
                                (chapter.navigation_label)
                            }
                        }
                    }
                }
                a class="home-immersive-story-skip-link" href="#home-latest" { (story.skip_label) (icons::arrow_right("")) }
            }
            div class="home-immersive-story-composition" data-home-scroll-range="true" {
                @for (index, chapter) in story.chapters.iter().enumerate() {
                    @let heading_id = format!("home-story-{}-title-{code}", chapter.id);
                    @let title = keep_phrases(&chapter.title, chapter.title_phrases.as_deref(), "home-immersive-story-keep-phrase");
                    section id=(format!("home-story-{}", chapter.id)) class="home-immersive-story-chapter" data-story-chapter=(chapter.id) aria-labelledby=(heading_id) {
                        header class="home-immersive-story-chapter-heading" {
                            p class="home-immersive-story-eyebrow" { (chapter.eyebrow) }
                            @if index == 0 {
                                h1 id=(heading_id) class="home-immersive-story-chapter-title" { (title) }
                            } @else {
                                h2 id=(heading_id) class="home-immersive-story-chapter-title" { (title) }
                            }
                        }
                        div class="home-immersive-story-chapter-center" aria-hidden="true" {}
                        div class="home-immersive-story-chapter-panel" {
                            p class="home-immersive-story-chapter-description" { (chapter.description) }
                            @if chapter.id == "discover" {
                                form action=(super::localized(code, "/search")) class="home-immersive-story-search-form" role="search" aria-label=(story.search.label) {
                                    label class="home-immersive-story-search-label" for=(search_id) { (story.search.label) }
                                    div class="home-immersive-story-search-shell" {
                                        (icons::search("home-immersive-story-search-icon"))
                                        input id=(search_id) class="home-immersive-story-search-input" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder=(story.search.placeholder);
                                        button class="home-immersive-story-search-button" type="submit" { (story.search.button) (icons::arrow_right("")) }
                                    }
                                }
                            }
                            @if chapter.id == "context" {
                                a class="home-immersive-story-text-action" href="#home-signals" { (story.context_action) (icons::arrow_right("")) }
                            }
                            @if chapter.id == "participate" {
                                div class="home-immersive-story-action-row" {
                                    a class="home-immersive-story-primary-action" href="/community" { (story.community_action) (icons::arrow_right("")) }
                                }
                            }
                        }
                    }
                    @if index == 0 {
                        div class="home-immersive-story-visual-pin" data-home-scroll-pin="true" data-home-artwork="immersive-story" {
                            (scene(code, copy))
                        }
                    }
                }
            }
        }
    }
}

/// `HomeStorySceneView` as the server renders it.
fn scene(code: &str, copy: &Copy) -> Markup {
    let scene = &copy.scene;
    // `showLayoutControls`: before the renderer is ready, only the other
    // languages show the (disabled) layout choices.
    let show_layout = code != "ko";
    let green = &copy.signals.levels["green"];
    html! {
        figure class="home-story-scene-view-scene home-immersive-story-scene" data-renderer="fallback" data-scene-variant="story" data-story-scene="true" data-layout-mode="scroll" {
            div class="home-story-scene-view-stage" data-home-scene-stage="true" {
                (fallback("green", "block size-full home-story-scene-view-fallback"))
                div aria-hidden="true" class="home-story-scene-view-canvas home-story-scene-view-hidden" {}
            }
            div class="home-story-scene-view-toolbar" data-story-toolbar="true" {
                details class="home-story-scene-view-disclosure" data-story-controls="true" {
                    summary class="home-story-scene-view-control" {
                        svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" {
                            path d="M3 5h14M3 10h14M3 15h14M7 3v4M13 8v4M8 13v4" {}
                        }
                        span { (scene.controls_label) }
                    }
                    div class="home-story-scene-view-panel" data-scene-control-dock="true" {
                        @if show_layout {
                            (layout_controls(copy))
                            p role="status" { (scene.layout_loading) }
                        }
                        fieldset aria-label=(scene.signal_group_label) {
                            legend { (scene.signal_group_label) }
                            div class="home-story-scene-view-signals" {
                                @for level in SIGNAL_LEVELS {
                                    button type="button" aria-pressed=(if level == "green" { "true" } else { "false" }) aria-controls=(EXPLANATION_ID) data-scene-signal=(level) data-level=(level) {
                                        (SafetyLevel::parse(level).icon("home-story-scene-view-signal-icon"))
                                        (copy.signals.levels[level].label)
                                    }
                                }
                            }
                        }
                        p id=(EXPLANATION_ID) role="status" aria-live="polite" { strong { (green.label) } " · " (green.summary) }
                        p class="home-story-scene-view-notice" { (scene.education_notice) }
                        @if show_layout {
                            (reset_button(copy))
                        }
                    }
                }
                div class="home-story-scene-view-progress" data-scene-scroll-cue="true" {
                    span class="home-story-scene-view-progress-text" { (scene.scroll_hint) }
                    span class="home-story-scene-view-track" aria-hidden="true" { span {} }
                }
            }
            figcaption class="sr-only" { (copy.story.scene_label) }
            // What the renderer brings when it is ready: the layout choices
            // (Korean shows them only then), the reset and playback buttons.
            template data-scene-ready {
                @if !show_layout {
                    (layout_controls(copy))
                    (reset_button(copy))
                }
                button type="button" class="home-story-scene-view-control home-story-scene-view-playback" aria-label=(copy.story.pause_scene) data-scene-playback="true" {
                    svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none" {
                        path d="M5.5 3v12M12.5 3v12" stroke="currentColor" stroke-linecap="round" stroke-width="2.5" {}
                    }
                }
            }
        }
    }
}

fn layout_controls(copy: &Copy) -> Markup {
    let scene = &copy.scene;
    html! {
        fieldset aria-label=(scene.layout_label) data-scene-layout-controls="true" {
            legend { (scene.layout_label) }
            div class="home-story-scene-view-choices" {
                @for mode in LAYOUTS {
                    label class="home-story-scene-view-choice" {
                        input type="radio" name=(LAYOUT_NAME) value=(mode) data-scene-layout=(mode) checked[mode == "scroll"] disabled;
                        span {
                            @match mode {
                                "scroll" => (scene.scroll_layout),
                                "stacked" => (scene.stack_label),
                                _ => (scene.spread_label),
                            }
                        }
                    }
                }
            }
        }
    }
}

fn reset_button(copy: &Copy) -> Markup {
    html! {
        button type="button" class="home-story-scene-view-control" data-scene-reset="true" disabled { (copy.scene.reset_view) }
    }
}

/// The stroke of a signal token when it is the chosen one or not:
/// `data-selected`, opacity, ring colour and width.
fn token(selected: &str, level: &str) -> (&'static str, &'static str, &'static str, &'static str) {
    if selected == level {
        ("true", "1", "#ff8356", "6")
    } else {
        ("false", "0.72", "#777d82", "2.5")
    }
}

/// `HomeSceneFallback`.
pub fn fallback(selected: &str, class: &str) -> Markup {
    html! {
        svg aria-hidden="true" class=(class) data-home-scene-fallback="true" data-selected-signal=(selected) focusable="false" preserveAspectRatio="xMidYMid slice" viewBox="0 0 900 450" xmlns="http://www.w3.org/2000/svg" {
            defs {
                radialGradient id="axum-id-scene-studio-glow" cx="50%" cy="49%" r="56%" {
                    stop offset="0" stop-color="#6d7376" stop-opacity="0.34" {}
                    stop offset="0.52" stop-color="#33373a" stop-opacity="0.15" {}
                    stop offset="1" stop-color="#111314" stop-opacity="0" {}
                }
                linearGradient data-paint="orange-enamel" id="axum-id-scene-enamel" x1="0.06" x2="0.92" y1="0" y2="1" {
                    stop offset="0" stop-color="#ffb07b" {}
                    stop offset="0.18" stop-color="#ff814d" {}
                    stop offset="0.58" stop-color="#f15827" {}
                    stop offset="1" stop-color="#b92d14" {}
                }
                linearGradient id="axum-id-scene-enamel-depth" x1="0" x2="1" y1="0" y2="1" {
                    stop offset="0" stop-color="#d6421e" {}
                    stop offset="0.55" stop-color="#9d2713" {}
                    stop offset="1" stop-color="#5f170f" {}
                }
                linearGradient id="axum-id-scene-enamel-highlight" x1="0" x2="1" y1="0" y2="0.9" {
                    stop offset="0" stop-color="#fff1df" stop-opacity="0.92" {}
                    stop offset="0.34" stop-color="#ffd1af" stop-opacity="0.42" {}
                    stop offset="1" stop-color="#ff9b6b" stop-opacity="0" {}
                }
                linearGradient data-paint="chrome" id="axum-id-scene-chrome" x1="0" x2="1" y1="0.12" y2="0.88" {
                    stop offset="0" stop-color="#5e6469" {}
                    stop offset="0.18" stop-color="#f8fbfc" {}
                    stop offset="0.36" stop-color="#92999e" {}
                    stop offset="0.59" stop-color="#ffffff" {}
                    stop offset="0.82" stop-color="#7c8388" {}
                    stop offset="1" stop-color="#34383b" {}
                }
                linearGradient data-paint="ivory" id="axum-id-scene-ivory" x1="0.08" x2="0.92" y1="0" y2="1" {
                    stop offset="0" stop-color="#fffef7" {}
                    stop offset="0.58" stop-color="#eee9dc" {}
                    stop offset="1" stop-color="#c8c1b3" {}
                }
                linearGradient id="axum-id-scene-ivory-shade" x1="0" x2="1" y1="0" y2="1" {
                    stop offset="0" stop-color="#dad5ca" {}
                    stop offset="1" stop-color="#98958e" {}
                }
                radialGradient id="axum-id-scene-token-glass" cx="34%" cy="24%" r="78%" {
                    stop offset="0" stop-color="#ffffff" stop-opacity="0.9" {}
                    stop offset="0.3" stop-color="#e5e9eb" stop-opacity="0.48" {}
                    stop offset="1" stop-color="#3c4145" stop-opacity="0.12" {}
                }
                filter id="axum-id-scene-cast-shadow" x="-35%" y="-45%" width="180%" height="220%" {
                    feDropShadow dx="0" dy="22" flood-color="#030405" flood-opacity="0.52" stdDeviation="19" {}
                }
                filter id="axum-id-scene-object-shadow" x="-35%" y="-45%" width="180%" height="220%" {
                    feDropShadow dx="5" dy="10" flood-color="#050607" flood-opacity="0.42" stdDeviation="8" {}
                }
            }
            ellipse cx="450" cy="225" fill="url(#axum-id-scene-studio-glow)" rx="390" ry="215" {}
            ellipse cx="455" cy="372" fill="#050607" filter="url(#axum-id-scene-cast-shadow)" opacity="0.32" rx="266" ry="26" {}
            g data-editorial-card="left" filter="url(#axum-id-scene-object-shadow)" transform="translate(155 118) rotate(-11 154 96)" {
                rect fill="url(#axum-id-scene-ivory-shade)" height="188" rx="23" width="308" x="11" y="13" {}
                rect fill="url(#axum-id-scene-chrome)" height="188" rx="23" width="308" {}
                rect fill="url(#axum-id-scene-ivory)" height="174" rx="17" width="294" x="7" y="7" {}
                path d="M28 34H206" opacity="0.34" stroke="#303437" stroke-linecap="round" stroke-width="8" {}
                path d="M28 60H252" opacity="0.14" stroke="#303437" stroke-linecap="round" stroke-width="5" {}
                path d="M28 78H177" opacity="0.12" stroke="#303437" stroke-linecap="round" stroke-width="5" {}
                circle cx="258" cy="135" fill="#d65028" r="24" {}
                circle cx="258" cy="135" fill="none" opacity="0.52" r="17" stroke="#fff7e9" stroke-width="2" {}
                path d="M250 135h16M258 127v16" opacity="0.82" stroke="#fff7e9" stroke-linecap="round" stroke-width="2" {}
            }
            g data-editorial-card="right" filter="url(#axum-id-scene-object-shadow)" transform="translate(470 94) rotate(9 142 105)" {
                rect fill="url(#axum-id-scene-ivory-shade)" height="205" rx="24" width="284" x="12" y="14" {}
                rect fill="url(#axum-id-scene-chrome)" height="205" rx="24" width="284" {}
                rect fill="url(#axum-id-scene-ivory)" height="191" rx="18" width="270" x="7" y="7" {}
                circle cx="47" cy="49" fill="#24282a" r="15" {}
                path d="M76 43H242" opacity="0.28" stroke="#303437" stroke-linecap="round" stroke-width="7" {}
                path d="M76 62H207" opacity="0.13" stroke="#303437" stroke-linecap="round" stroke-width="5" {}
                path d="M32 112H244" opacity="0.15" stroke="#303437" stroke-linecap="round" stroke-width="6" {}
                path d="M32 136H194" opacity="0.11" stroke="#303437" stroke-linecap="round" stroke-width="6" {}
                path d="M32 160H220" opacity="0.09" stroke="#303437" stroke-linecap="round" stroke-width="6" {}
            }
            g data-studio-emblem="speech-loop" transform="rotate(-7 450 225) skewX(-5)" {
                path d="M343 95H570c42 0 70 31 65 70l-15 92c-5 33-32 56-66 56h-18l8 52-64-51H341c-42 0-70-33-63-74l16-93c6-31 24-52 49-52Zm42 55c-14 0-23 10-25 24l-11 64c-3 17 8 30 25 30h139c16 0 28-10 31-25l11-65c3-16-8-28-24-28H385Z" fill="url(#axum-id-scene-enamel-depth)" fill-rule="evenodd" opacity="0.98" transform="translate(18 18)" {}
                path d="M343 95H570c42 0 70 31 65 70l-15 92c-5 33-32 56-66 56h-18l8 52-64-51H341c-42 0-70-33-63-74l16-93c6-31 24-52 49-52Zm42 55c-14 0-23 10-25 24l-11 64c-3 17 8 30 25 30h139c16 0 28-10 31-25l11-65c3-16-8-28-24-28H385Z" fill="url(#axum-id-scene-enamel)" fill-rule="evenodd" filter="url(#axum-id-scene-object-shadow)" stroke="#ff9a66" stroke-linejoin="round" stroke-width="4" {}
                path d="M342 112H568c29 0 48 20 45 47" fill="none" opacity="0.88" stroke="url(#axum-id-scene-enamel-highlight)" stroke-linecap="round" stroke-width="12" {}
                path d="M385 150h146c16 0 27 12 24 28l-11 65c-3 15-15 25-31 25H374c-17 0-28-13-25-30l11-64c2-14 11-24 25-24Z" fill="none" opacity="0.62" stroke="url(#axum-id-scene-chrome)" stroke-linejoin="round" stroke-width="6" {}
                path d="m490 321 45 35-7-43" fill="none" opacity="0.46" stroke="#5f170f" stroke-linecap="round" stroke-linejoin="round" stroke-width="5" {}
            }
            g data-selected=(token(selected, "green").0) data-signal-level="green" data-signal-token="safe" filter="url(#axum-id-scene-object-shadow)" opacity=(token(selected, "green").1) transform="translate(680 96)" {
                circle fill="url(#axum-id-scene-chrome)" r="40" {}
                circle fill="#1b1e20" r="33" stroke=(token(selected, "green").2) stroke-width=(token(selected, "green").3) {}
                circle fill="#68bd88" r="25" {}
                circle fill="url(#axum-id-scene-token-glass)" opacity="0.56" r="25" {}
                path d="m-11 0 8 8 15-18" data-signal-glyph="check" fill="none" stroke="#f9fbf8" stroke-linecap="round" stroke-linejoin="round" stroke-width="5" {}
            }
            g data-selected=(token(selected, "yellow").0) data-signal-level="yellow" data-signal-token="context" filter="url(#axum-id-scene-object-shadow)" opacity=(token(selected, "yellow").1) transform="translate(680 300)" {
                circle fill="url(#axum-id-scene-chrome)" r="40" {}
                circle fill="#1b1e20" r="33" stroke=(token(selected, "yellow").2) stroke-width=(token(selected, "yellow").3) {}
                circle fill="#dcae42" r="25" {}
                circle fill="url(#axum-id-scene-token-glass)" opacity="0.52" r="25" {}
                path d="M-12-9H8c6 0 10 4 10 10v3c0 6-4 10-10 10H2l-9 7 2-7h-7c-6 0-10-4-10-10V1c0-6 4-10 10-10Zm7 6v7m0 5v1" data-signal-glyph="context" fill="none" stroke="#fffdf8" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.4" {}
            }
            g data-selected=(token(selected, "gray").0) data-signal-level="gray" data-signal-token="late" filter="url(#axum-id-scene-object-shadow)" opacity=(token(selected, "gray").1) transform="translate(220 320)" {
                circle fill="url(#axum-id-scene-chrome)" r="40" {}
                circle fill="#1b1e20" r="33" stroke=(token(selected, "gray").2) stroke-width=(token(selected, "gray").3) {}
                circle fill="#858d93" r="25" {}
                circle fill="url(#axum-id-scene-token-glass)" opacity="0.5" r="25" {}
                path d="M0-15A15 15 0 1 1 0 15 15 15 0 0 1 0-15Zm0 6v10l7 5" data-signal-glyph="clock" fill="none" stroke="#fcfdfd" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.8" {}
            }
            g data-selected=(token(selected, "red").0) data-signal-level="red" data-signal-token="risk" filter="url(#axum-id-scene-object-shadow)" opacity=(token(selected, "red").1) transform="translate(220 115)" {
                circle fill="url(#axum-id-scene-chrome)" r="40" {}
                circle fill="#1b1e20" r="33" stroke=(token(selected, "red").2) stroke-width=(token(selected, "red").3) {}
                path d="m-10-20 20 0 15 15v10L10 20h-20L-25 5V-5l15-15Z" fill="#d85d45" {}
                path d="M-13 0h26" data-signal-glyph="stop" fill="none" stroke="#fff9f6" stroke-linecap="round" stroke-width="4.5" {}
                path d="M-15-15c6-7 18-8 26-3" fill="none" opacity="0.42" stroke="#fff" stroke-linecap="round" stroke-width="3" {}
            }
        }
    }
}
