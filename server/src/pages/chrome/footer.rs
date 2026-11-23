//! `components/site-footer.tsx` and `components/bottom-nav.tsx`.

use maud::{Markup, PreEscaped, html};
use time::OffsetDateTime;

use super::{Frame, current};
use crate::pages::i18n::routing::{localized_static_path, parse_locale_path};

/// `CONTACT_EMAIL` in lib/site.ts.
const CONTACT_EMAIL: &str = "toris@toris.kr";
const FOOTER_LINK: &str = "-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500";

pub fn footer(frame: &Frame) -> Markup {
    let locale = frame.locale;
    let m = locale.messages();
    // `FOOTER_LINKS`, after the two links only the Korean frame has.
    let links = [
        ("/about", &m.about),
        ("/editorial", &m.editorial),
        ("/guides", &m.guides),
        ("/privacy", &m.privacy),
        ("/terms", &m.terms),
        ("/rankings", &m.rankings),
        ("/news", &m.news),
        ("/submit", &m.submit),
        ("/support", &m.support),
    ];
    html! {
        footer data-frame="footer" class="instrument-grid mt-16 border-t border-border bg-surface-2" {
            div class="mx-auto max-w-site px-4 py-8" {
                nav aria-label=(m.footer_nav) {
                    ul class="flex flex-wrap gap-x-5 gap-y-2 text-sm" {
                        @if locale.is_korean() {
                            li { a class=(FOOTER_LINK) href="/memes" { "밈 전체 목록" } }
                            li { a class=(FOOTER_LINK) href="/contact" { "문의" } }
                        }
                        @for (href, label) in links {
                            li { a class=(FOOTER_LINK) href=(href) { (label) } }
                        }
                    }
                }
                div class="mt-3 text-[13px] leading-relaxed text-muted" {
                    details class="group" open {
                        summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground sm:hidden [&::-webkit-details-marker]:hidden" {
                            (m.legal_summary)
                            svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {
                                path d="m7 10 5 5 5-5" {}
                            }
                        }
                        div class="space-y-1.5 pb-2 leading-normal sm:pb-0" {
                            p class="break-keep leading-normal" { (m.legal1) }
                            p class="break-keep leading-normal" {
                                (m.legal2) " "
                                a href=(format!("mailto:{CONTACT_EMAIL}")) class="underline underline-offset-2 hover:text-foreground" { (CONTACT_EMAIL) }
                            }
                        }
                    }
                    p class="stat-mono mt-2" { "© " (OffsetDateTime::now_utc().year()) " " (m.brand) }
                }
            }
        }
    }
}

struct Tab {
    href: String,
    label: String,
    icon: &'static str,
    stroke_width: &'static str,
    emphasized: bool,
    nofollow: bool,
    active: bool,
}

const HOME_ICON: &str = r#"<path d="M3 10.5 12 3l9 7.5V21H3z" stroke-linejoin="round"></path>"#;
const COMPASS_ICON: &str = r#"<circle cx="12" cy="12" r="9"></circle><path d="m15.5 8.5-2 5-5 2 2-5z" stroke-linejoin="round"></path>"#;
const COMMUNITY_ICON: &str = r#"<path d="M4 5.5h16v11H9l-5 3v-14Z" stroke-linejoin="round"></path><path d="M8 10h8M8 13h5" stroke-linecap="round"></path>"#;
const PLUS_ICON: &str = r#"<path d="M12 5v14M5 12h14" stroke-linecap="round"></path>"#;
const USER_ICON: &str = r#"<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" stroke-linecap="round"></path>"#;

fn tabs(frame: &Frame) -> [Tab; 5] {
    let locale = frame.locale;
    let m = locale.messages();
    let code = locale.code();
    let current_path = parse_locale_path(frame.pathname()).1;
    let target_active = |target: &str| {
        let target = parse_locale_path(target).1;
        let target = target.split('?').next().unwrap_or_default().to_owned();
        current_path == target || current_path.starts_with(&format!("{target}/"))
    };
    // `homeLabel` and `latestLabel` of the component.
    let home = match code {
        "ko" => "홈",
        "ja" => "ホーム",
        "zh" => "首页",
        "zh-tw" => "首頁",
        "ar" => "الرئيسية",
        _ => "Home",
    };
    let latest = match code {
        "ko" => "최신",
        "ja" | "zh" | "zh-tw" => "最新",
        "ar" => "استكشاف",
        _ => "Latest",
    };
    let latest_href = localized_static_path("/explore?sort=recent", code);
    let tab = |href: String, label: &str, icon, emphasized, nofollow, active| Tab {
        href,
        label: label.to_owned(),
        icon,
        stroke_width: if emphasized { "2.2" } else { "2" },
        emphasized,
        nofollow,
        active,
    };
    [
        tab(
            localized_static_path("/", code),
            home,
            HOME_ICON,
            false,
            false,
            current_path == "/" || current_path == "/index",
        ),
        tab(
            latest_href.clone(),
            latest,
            COMPASS_ICON,
            false,
            false,
            target_active(&latest_href),
        ),
        tab(
            "/community".to_owned(),
            &m.community,
            COMMUNITY_ICON,
            false,
            false,
            target_active("/community"),
        ),
        tab(
            "/submit".to_owned(),
            &m.submit,
            PLUS_ICON,
            true,
            true,
            target_active("/submit"),
        ),
        tab(
            "/my".to_owned(),
            &m.my,
            USER_ICON,
            false,
            true,
            target_active("/my"),
        ),
    ]
}

pub fn bottom_nav(frame: &Frame) -> Markup {
    html! {
        nav aria-label=(frame.locale.messages().main_nav) data-site-bottom-nav data-frame="bottom-nav" class="fixed inset-x-0 bottom-0 z-40 border-t border-(--foreground)/10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-(--surface)/72 md:hidden" style="padding-bottom:env(safe-area-inset-bottom)" {
            ul class="mx-auto flex min-w-[19.25rem] max-w-2xl items-stretch justify-around" {
                @for tab in tabs(frame) {
                    li class="flex min-w-11 flex-1" {
                        a rel=[tab.nofollow.then_some("nofollow")] aria-current=[current(tab.active)] class={"no-press flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs " (if tab.emphasized || tab.active { "text-accent-text font-semibold" } else { "text-muted" })} href=(tab.href) {
                            span class="relative grid h-5 w-5 place-items-center" {
                                @if tab.active && !tab.emphasized {
                                    span aria-hidden="true" class="signal-live absolute -top-0.5 right-0 size-1.5 rounded-full bg-(--signal-cyan)" {}
                                }
                                svg class={"h-5 w-5 " (if tab.emphasized { "rounded-full bg-accent-soft p-0.5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_50%,transparent),0_0_10px_1px_color-mix(in_srgb,var(--flame-500)_55%,transparent)]" } else { "" })} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=(tab.stroke_width) aria-hidden="true" {
                                    (PreEscaped(tab.icon))
                                }
                            }
                            span class="whitespace-nowrap text-[11px] leading-none sm:text-xs " { (tab.label) }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pages::i18n::Locale;

    fn frame(code: &str, path: &'static str) -> Frame<'static> {
        Frame {
            locale: Locale::get(code).expect("locale"),
            path_and_query: path,
        }
    }

    #[test]
    fn only_the_korean_footer_lists_every_meme_and_the_contact_page() {
        let korean = footer(&frame("ko", "/about")).into_string();
        assert!(korean.contains(r#"href="/memes""#) && korean.contains("운영·저작권 안내"));
        let english = footer(&frame("en", "/about")).into_string();
        assert!(!english.contains(r#"href="/memes""#));
        assert!(english.contains("mailto:toris@toris.kr"));
    }

    #[test]
    fn the_bottom_nav_marks_the_current_tab() {
        let home = bottom_nav(&frame("ko", "/")).into_string();
        assert_eq!(home.matches(r#"aria-current="page""#).count(), 1);
        assert!(home.contains("signal-live"));
        let about = bottom_nav(&frame("ko", "/about")).into_string();
        assert!(!about.contains("aria-current"));
        let arabic = bottom_nav(&frame("ar", "/about")).into_string();
        assert!(arabic.contains("الرئيسية") && arabic.contains("استكشاف"));
    }
}
