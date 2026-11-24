//! The frame of the operator screens: `app/(default)/admin/layout.tsx`
//! (`AdminLayout` with `AdminNav`) inside one of two documents.
//!
//! - Most screens sit in the site's own root (`RootDocument`), whose header,
//!   footer, bottom bar and chat all hide themselves under `/admin`. What is
//!   left is the `<head>` of every page, the organisation JSON-LD, the
//!   progress bar and the install prompt.
//! - `/admin/activity` and `/admin/analytics` are in `app/(admin)`, a root
//!   layout of their own: a bare `<html lang="ko">`, `referrer: no-referrer`,
//!   and no analytics or site script.

use maud::{DOCTYPE, Markup, PreEscaped, html};

use super::super::chrome::overlays;
use super::super::document::{self, Head, Site};
use super::super::json_ld;
use crate::routes::public::js;

/// `metadata.title.template` of the admin layouts.
const TITLE_SUFFIX: &str = " | 밈캐치 관리자";
/// The title of `/admin` (app/(default)/admin/page.tsx).
pub const DASHBOARD_TITLE: &str = "대시보드";
/// `getSeoCopy("ko").description`, which the site layout gives every page.
const SITE_DESCRIPTION: &str = "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지 한눈에 정리한 한국 밈 사전이에요. 1990년대 유행어부터 최신 숏폼 챌린지까지 사용 신호와 출처를 함께 보여 드려요. 궁금한 밈, 3초 안에 확인하세요.";
/// The page script every operator screen loads (`ui/admin.js`).
pub const SCRIPT: &str = "admin";

/// Which root layout a screen is in.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Root {
    /// `app/(default)`: the site's document.
    Site,
    /// `app/(admin)`: the private document.
    Private,
}

/// A whole operator screen. `pathname` picks the current menu entry; `main`
/// is the page's content inside `<main>`.
pub fn document(site: &Site, root: Root, title: &str, pathname: &str, main: Markup) -> Markup {
    let layout = layout(pathname, main);
    match root {
        Root::Site => site_document(site, title, layout),
        Root::Private => private_document(site, title, layout),
    }
}

/// `app/(default)/admin/error.tsx`, which a screen whose server render threw
/// shows in place of its content. "다시 시도" reloads (`ui/admin.js`).
pub fn error_boundary() -> Markup {
    html! {
        div class="flex min-h-60 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface p-8 text-center" {
            p class="text-lg font-semibold" { "문제가 발생했어요" }
            p class="text-base text-muted" { "데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }
            button type="button" data-admin-retry class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white" { "다시 시도" }
        }
    }
}

/// What a browser shows after `notFound()` in a screen of the site's root:
/// `app/(default)/not-found.tsx` in place of the admin layout, under the
/// screen's title. Next streams it with status 200 behind the loading screen;
/// this is sent with 404 (PLAN B7-2).
pub fn not_found(site: &Site, title: &str) -> Markup {
    site_document(site, title, super::super::not_found::main())
}

fn site_document(site: &Site, title: &str, layout: Markup) -> Markup {
    // The admin layout's template names its children; `/admin` itself is in
    // the layout's own segment and gets the site's template.
    let suffix = if title == DASHBOARD_TITLE {
        " | 밈캐치"
    } else {
        TITLE_SUFFIX
    };
    let head = Head {
        title: format!("{title}{suffix}"),
        title_absolute: true,
        description: Some(SITE_DESCRIPTION.to_owned()),
        robots: Some("noindex, nofollow"),
        site_card: true,
        script: Some(SCRIPT),
        ..Head::default()
    };
    html! {
        (DOCTYPE)
        html lang="ko" dir="ltr" data-ga=[site.ga_id.as_deref()] {
            head { (document::head(site, &head)) }
            body class="flex min-h-dvh flex-col max-md:pb-[calc(4.5rem+4rem+1rem)] md:pb-0" {
                (json_ld::organization(site))
                (overlays::nav_progress())
                div class="flex min-w-0 flex-1 flex-col" {
                    div class="min-w-0 flex-1" { (layout) }
                }
                (overlays::install_prompt())
                @if let Some(id) = &site.ga_id {
                    script async src=(format!("https://www.googletagmanager.com/gtag/js?id={}", js::encode_uri_component(id))) {}
                }
                script defer src=(site.js_href) {}
                (page_script(site))
            }
        }
    }
}

fn private_document(site: &Site, title: &str, layout: Markup) -> Markup {
    let title = format!("{title}{TITLE_SUFFIX}");
    // Next has no `metadataBase` in this layout and resolves the default
    // share image against `http://localhost:<port>` with a hash of the file;
    // the site's own address is used here (PLAN B7).
    let image = site.absolute("/opengraph-image");
    let alt = "밈캐치 — 그 밈, 3초 안에 알려드려요";
    html! {
        (DOCTYPE)
        html lang="ko" {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                link rel="stylesheet" href=(site.css_href);
                title { (title) }
                link rel="manifest" href="/manifest.webmanifest";
                meta name="referrer" content="no-referrer";
                meta name="robots" content="noindex, nofollow";
                meta property="og:title" content=(title);
                meta property="og:image" content=(image);
                meta property="og:image:type" content="image/png";
                meta property="og:image:width" content="1200";
                meta property="og:image:height" content="630";
                meta property="og:image:alt" content=(alt);
                meta name="twitter:card" content="summary_large_image";
                meta name="twitter:title" content=(title);
                meta name="twitter:image" content=(image);
                meta name="twitter:image:alt" content=(alt);
                meta name="twitter:image:type" content="image/png";
                meta name="twitter:image:width" content="1200";
                meta name="twitter:image:height" content="630";
                link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16";
                link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any";
                link rel="apple-touch-icon" href="/apple-icon.png" type="image/png" sizes="180x180";
            }
            body class="bg-background text-foreground" {
                (layout)
                (page_script(site))
            }
        }
    }
}

fn page_script(site: &Site) -> Markup {
    html! {
        @if let Some((_, href)) = site.page_js.iter().find(|(page, _)| *page == SCRIPT) {
            script defer src=(href) {}
        }
    }
}

/// `AdminLayout`.
fn layout(pathname: &str, main: Markup) -> Markup {
    html! {
        div class="min-h-dvh bg-background text-foreground md:flex" {
            aside class="border-b border-border bg-surface md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r" {
                div class="flex items-center gap-2 px-4 py-4" {
                    span class="text-lg font-bold" { "밈캐치 관리자" }
                }
                (nav(pathname))
            }
            main class="min-w-0 flex-1 px-4 py-6 md:px-8" { (main) }
        }
    }
}

const GAUGE: &str = r#"<path d="M4 14a8 8 0 1 1 16 0" stroke-linecap="round"></path><path d="M12 14l4-4" stroke-linecap="round"></path>"#;
const USERS: &str = r#"<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="10" cy="8" r="3.2"></circle><path d="M20 19v-1.4a3.2 3.2 0 0 0-2.4-3.1M15.5 5.2a3.2 3.2 0 0 1 0 5.6" stroke-linecap="round"></path>"#;
const INBOX: &str =
    r#"<path d="M4 5h16v14H4z M4 14h5l1.5 2h3L15 14h5" stroke-linejoin="round"></path>"#;
const BOOK: &str = r#"<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M19 16H8a3 3 0 0 0-3 3" stroke-linejoin="round"></path>"#;
const LINK: &str = r#"<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" stroke-linecap="round" stroke-linejoin="round"></path><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" stroke-linecap="round" stroke-linejoin="round"></path>"#;
const FLAG: &str =
    r#"<path d="M6 21V4m0 1h12l-3 4 3 4H6" stroke-linecap="round" stroke-linejoin="round"></path>"#;
const CHAT: &str = r#"<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-linecap="round"></path>"#;
const ARROW_LEFT: &str =
    r#"<path d="M19 12H5m6-6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"></path>"#;

/// `LINKS` of components/admin/admin-nav.tsx.
const LINKS: [(&str, &str, &str); 12] = [
    ("/admin", "대시보드", GAUGE),
    ("/admin/activity", "사용자 활동", USERS),
    ("/admin/analytics", "GA4 리포트", GAUGE),
    ("/admin/submissions", "제보 큐", INBOX),
    ("/admin/publisher-readiness", "퍼블리셔 준비도", BOOK),
    ("/admin/sources", "출처 검수", LINK),
    ("/admin/mpe", "MPE 검수", INBOX),
    ("/admin/radar-safety", "Radar 안전", FLAG),
    ("/admin/memes", "밈 관리", BOOK),
    ("/admin/reports", "신고", FLAG),
    ("/admin/users", "사용자 관리", USERS),
    ("/admin/inquiries", "문의 관리", CHAT),
];

fn icon(paths: &'static str) -> Markup {
    html! {
        svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" { (PreEscaped(paths)) }
    }
}

/// `AdminNav`: the current entry is `/admin` itself or the one whose path
/// the page's path starts with.
fn nav(pathname: &str) -> Markup {
    html! {
        nav aria-label="관리자 메뉴" class="overflow-x-auto md:flex-1 md:overflow-visible" {
            ul class="flex gap-1 px-2 pb-2 md:flex-col md:pb-0" {
                @for (href, label, paths) in LINKS {
                    @let active = if href == "/admin" { pathname == "/admin" } else { pathname.starts_with(href) };
                    li class="shrink-0" {
                        @if active {
                            a aria-current="page" class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-base bg-accent-soft font-semibold text-accent" href=(href) { (icon(paths)) (label) }
                        } @else {
                            a class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-base text-muted hover:bg-surface-2 hover:text-foreground" href=(href) { (icon(paths)) (label) }
                        }
                    }
                }
                li class="shrink-0 md:mt-auto md:pt-4" {
                    a class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-base text-muted hover:bg-surface-2 hover:text-foreground" href="/" { (icon(ARROW_LEFT)) "사이트로 돌아가기" }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_current_entry_is_the_one_the_path_is_under() {
        let html = nav("/admin/users/abc").into_string();
        assert_eq!(html.matches("aria-current=\"page\"").count(), 1);
        assert!(html.contains(r#"aria-current="page" class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-base bg-accent-soft font-semibold text-accent" href="/admin/users""#));
        let dashboard = nav("/admin").into_string();
        assert!(dashboard.contains(r#"text-accent" href="/admin">"#));
        assert_eq!(dashboard.matches("aria-current").count(), 1);
    }
}
