//! `components/global-header.tsx` with the language selector, the desktop
//! discovery links, the account control and the header menu.

use maud::{Markup, PreEscaped, html};

use super::{Frame, brand_tile, current, lucide};
use crate::pages::i18n::Locale;
use crate::pages::i18n::routing::{
    SEO_CONTENT_LOCALES, is_home_path, locale_destination, localized_static_path, parse_locale_path,
};
use crate::routes::public::js;

const SEARCH_ICON: &str =
    r#"<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>"#;
const CHEVRON_DOWN: &str = r#"<path d="m6 9 6 6 6-6"></path>"#;
const GRID: &str = r#"<path d="M12 3v18"></path><path d="M3 12h18"></path><rect x="3" y="3" width="18" height="18" rx="2"></rect>"#;
const LAYERS: &str = r#"<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"></path><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"></path><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"></path>"#;
const EARTH: &str = r#"<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"></path><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"></path><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"></path><circle cx="12" cy="12" r="10"></circle>"#;
const WAND: &str = r#"<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"></path><path d="m14 7 3 3"></path><path d="M5 6v4"></path><path d="M19 14v4"></path><path d="M10 2v2"></path><path d="M7 8H3"></path><path d="M21 16h-4"></path><path d="M11 3H9"></path>"#;
const MILESTONE: &str = r#"<path d="M12 13v8"></path><path d="M12 3v3"></path><path d="M18.172 6a2 2 0 0 1 1.414.586l2.06 2.06a1.207 1.207 0 0 1 0 1.708l-2.06 2.06a2 2 0 0 1-1.414.586H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"></path>"#;
const TROPHY: &str = r#"<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"></path><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"></path><path d="M18 9h1.5a1 1 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"></path><path d="M6 9H4.5a1 1 0 0 1 0-5H6"></path>"#;
const NEWSPAPER: &str = r#"<path d="M15 18h-5"></path><path d="M18 14h-8"></path><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"></path><rect width="8" height="4" x="10" y="6" rx="1"></rect>"#;
const DICES: &str = r#"<rect width="12" height="12" x="2" y="10" rx="2" ry="2"></rect><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"></path><path d="M6 18h.01"></path><path d="M10 14h.01"></path><path d="M15 6h.01"></path><path d="M18 9h.01"></path>"#;

const MENU_ITEM: &str = "hover-glow-flame flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent";
const ACCOUNT_ITEM: &str = "flex h-11 items-center rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

fn search_icon(class: &str) -> Markup {
    html! {
        svg class=(class) viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" {
            (PreEscaped(SEARCH_ICON))
        }
    }
}

pub fn header(frame: &Frame) -> Markup {
    let locale = frame.locale;
    let messages = locale.messages();
    let search_href = localized_static_path("/search", locale.code());
    html! {
        header data-site-header data-frame="header" class="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70" {
            div class="mx-auto flex min-h-16 max-w-site flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:flex-nowrap sm:px-6 sm:py-0 lg:gap-x-3" {
                div class="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto" {
                    a aria-label=(messages.home) class="group flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl py-1 pr-1 transition-transform active:scale-[0.97]" href=(localized_static_path("/", locale.code())) {
                        (brand_tile("size-8"))
                        span class="flex shrink-0 flex-col whitespace-nowrap leading-none" {
                            span class="text-lg font-extrabold tracking-[-0.045em]" { (messages.brand) }
                            span class="mt-1 hidden font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-muted sm:block" { "catchmeme.com" }
                        }
                    }
                    (language_selector(frame))
                }
                (discovery_links(frame))
                div class="flex w-full flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:flex-nowrap sm:justify-start *:shrink-0" {
                    form role="search" class="hidden lg:block" action=(search_href) {
                        label for="header-search" class="sr-only" { (messages.search) }
                        div class="relative" {
                            (search_icon("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"))
                            input id="header-search" type="search" placeholder=(messages.search_placeholder) autocomplete="off" enterkeyhint="search" class="peer h-11 w-48 rounded-xl border border-border bg-surface-2 pl-9 pr-9 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:ring-4 focus:ring-accent/20 xl:w-60" name="q";
                            kbd aria-hidden="true" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border bg-surface px-1.5 font-sans text-xs font-semibold leading-5 text-muted peer-focus:hidden" { "/" }
                        }
                    }
                    a rel="nofollow" class="hidden min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:inline-flex" href="/submit" { (messages.submit) }
                    a aria-label=(messages.search) class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-foreground transition-colors hover:border-border hover:bg-surface-2 lg:hidden" href=(search_href) {
                        (search_icon("h-5 w-5"))
                    }
                    (account(frame))
                    (menu(frame))
                }
            }
        }
    }
}

/// `components/language-selector.tsx`. An option whose choice navigates
/// carries the destination; the others change the frame in place.
fn language_selector(frame: &Frame) -> Markup {
    let locale = frame.locale;
    let home = is_home_path(frame.pathname());
    let options = Locale::all().filter(|option| {
        !home || option.is_korean() || SEO_CONTENT_LOCALES.contains(&option.code())
    });
    html! {
        label class="glass-panel relative grid h-11 min-w-[5.25rem] shrink-0 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-1.5 rounded-full px-3 text-xs font-bold text-foreground transition-shadow hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_55%,transparent)] focus-within:ring-4 focus-within:ring-(--flame-500)/20" {
            span class="sr-only" { (locale.messages().language) }
            span aria-hidden="true" class="relative text-sm leading-none" {
                (locale.info().flag)
                span aria-hidden="true" class="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-(--flame-500)" {}
            }
            span aria-hidden="true" { (locale.info().short) }
            (lucide("chevron-down", "h-3.5 w-3.5 text-muted", "2", CHEVRON_DOWN))
            select data-locale-select aria-label=(locale.messages().language_menu) class="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0" {
                @for option in options {
                    option value=(option.code()) selected[option.code() == locale.code()] data-dest=[locale_destination(frame.path_and_query, option.code())] {
                        (option.info().flag) " " (option.info().name)
                    }
                }
            }
        }
    }
}

/// `components/header-discovery-links.tsx`.
fn discovery_links(frame: &Frame) -> Markup {
    let locale = frame.locale;
    let messages = locale.messages();
    let pathname = parse_locale_path(frame.pathname()).1;
    // The component's own table, with `messages.explore` for the rest.
    let latest = match locale.code() {
        "ko" => "최신 밈",
        "en" => "Latest",
        "ja" | "zh" | "zh-tw" => "最新",
        _ => messages.explore.as_str(),
    };
    let items = [
        (
            localized_static_path("/explore?sort=recent", locale.code()),
            "/explore",
            latest,
        ),
        (
            "/community".to_owned(),
            "/community",
            messages.community.as_str(),
        ),
    ];
    html! {
        nav aria-label=(messages.discovery_nav) class="hidden shrink-0 items-center gap-0.5 md:flex lg:gap-1" {
            @for (href, path, label) in items {
                @let active = pathname == path || pathname.starts_with(&format!("{path}/"));
                a aria-current=[current(active)] class={"inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-2 lg:px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " (if active { "bg-surface-2 font-semibold text-foreground" } else { "font-medium text-muted hover:bg-surface-2 hover:text-foreground" })} href=(href) { (label) }
            }
        }
    }
}

/// `components/auth-menu.tsx`. The sign-in link until `ui/account.js` knows
/// who is signed in; then the avatar from the template, whose menu is a
/// template again: like the header menu, it exists only while open.
fn account(frame: &Frame) -> Markup {
    let messages = frame.locale.messages();
    let pathname = match frame.pathname() {
        "" | "/index" => "/",
        path => path,
    };
    html! {
        div data-account class="contents" {
            a data-account-login class="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl border border-border bg-transparent px-3 text-sm font-semibold text-foreground transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-11 md:px-4" href=(format!("/login?next={}", js::encode_uri_component(pathname))) { (messages.login) }
            template data-account-menu data-label=(messages.account_menu) {
                div class="relative flex items-center gap-1.5" {
                    button type="button" aria-haspopup="menu" aria-expanded="false" class="hover-glow-flame flex h-11 w-11 items-center justify-center rounded-full bg-accent-strong text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" {
                        span aria-hidden="true" data-initial {}
                    }
                    template data-panel {
                    div role="menu" aria-label=(messages.account_menu) class="menu-pop instrument-grid absolute right-0 top-[calc(100%+8px)] z-[100] w-64 rounded-2xl border border-border bg-surface p-2.5 shadow-lg" style="transform-origin:top right" {
                        div class="px-3 pb-2 pt-1" {
                            p class="truncate text-sm font-semibold text-foreground" data-nickname {}
                            p class="text-xs text-muted" { (messages.greeting) }
                        }
                        div class="my-1 h-px bg-border" {}
                        a href="/my" role="menuitem" class=(ACCOUNT_ITEM) { (messages.my) }
                        a href="/my#saved" role="menuitem" class=(ACCOUNT_ITEM) { (messages.saved_memes) }
                        div class="my-1 h-px bg-border" {}
                        button type="button" role="menuitem" data-sign-out class="flex h-11 w-full items-center rounded-lg px-3 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:bg-surface-2 focus-visible:text-foreground focus-visible:outline-none" { (messages.logout) }
                    }
                    }
                }
            }
        }
    }
}

/// `components/header-menu.tsx`: a disclosure, not a modal.
fn menu(frame: &Frame) -> Markup {
    let locale = frame.locale;
    let messages = locale.messages();
    let korean = locale.is_korean();
    let items: [(&str, &str, &str, &'static str); 6] = [
        ("/meme-cards", locale.meme_cards_nav(), "layers", LAYERS),
        (
            "/global",
            if korean {
                "글로벌 피드"
            } else {
                "Global feed"
            },
            "earth",
            EARTH,
        ),
        (
            "/studio",
            if korean {
                "밈 스튜디오"
            } else {
                "Meme studio (Korean)"
            },
            "wand-sparkles",
            WAND,
        ),
        ("/timeline", &messages.timeline, "milestone", MILESTONE),
        ("/rankings", &messages.rankings, "trophy", TROPHY),
        ("/news", &messages.news, "newspaper", NEWSPAPER),
    ];
    html! {
        div data-menu class="relative" {
            button type="button" aria-expanded="false" aria-controls="header-menu-panel" aria-label=(messages.menu) class="flex h-11 w-11 items-center justify-center rounded-full border border-transparent transition-colors hover:border-(--signal-cyan) active:scale-[0.95] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent text-foreground hover:bg-surface-2" {
                (lucide("grid2x2 lucide-grid-2x2", "size-5", "1.8", GRID))
            }
            // Next renders the panel only while it is open.
            template data-panel {
            nav id="header-menu-panel" aria-label=(messages.menu) class="menu-pop instrument-grid absolute end-0 top-[calc(100%+10px)] z-50 w-60 rounded-2xl border border-border bg-surface/95 p-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md" {
                ul {
                    @for (href, label, icon, paths) in items {
                        @let active = frame.pathname().starts_with(href);
                        li {
                            a aria-current=[current(active)] class={(MENU_ITEM) " " (if active { "bg-surface-2 font-semibold text-foreground" } else { "font-medium text-foreground/85 hover:bg-surface-2 hover:text-foreground" })} href=(href) {
                                (lucide(icon, if active { "size-[18px] text-accent" } else { "size-[18px] text-muted" }, "1.8", paths))
                                (label)
                            }
                        }
                    }
                }
                div aria-hidden="true" class="mx-3 my-1.5 h-px bg-border" {}
                a data-random-meme class="hover-glow-flame flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-foreground/85 transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent" href="/memes/random" {
                    (lucide("dices", "size-[18px] text-muted", "1.8", DICES))
                    (messages.random)
                }
            }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn render(code: &str, path: &str) -> String {
        let frame = Frame {
            locale: Locale::get(code).expect("locale"),
            path_and_query: path,
        };
        header(&frame).into_string()
    }

    #[test]
    fn the_language_options_say_which_choices_navigate() {
        let html = render("ko", "/about");
        assert!(html.contains(r#"<option value="ko" selected data-dest="/about">"#));
        assert!(html.contains(r#"<option value="ja" data-dest="/ja">"#));
        assert!(html.contains(r#"<option value="ar">"#));
        assert_eq!(html.matches("<option ").count(), 19);
        // The home offers only the languages with a home page.
        assert_eq!(render("ko", "/").matches("<option ").count(), 5);
    }

    #[test]
    fn the_header_speaks_the_frame_language() {
        let html = render("ja", "/ja/rankings");
        assert!(html.contains("ログイン"));
        assert!(html.contains(r#"action="/ja/search""#));
        assert!(html.contains(r#"href="/login?next=%2Fja%2Frankings""#));
        let korean = render("ko", "/rankings");
        assert!(korean.contains(r#"aria-current="page" class="hover-glow-flame"#));
    }
}
