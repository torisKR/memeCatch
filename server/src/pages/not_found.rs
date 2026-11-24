//! The "no such meme" document (`app/(default)/not-found.tsx`), sent with
//! status 404 for a meme key that names no public row.
//!
//! Next answers the same request with a prerendered document whose `<body>`
//! is empty until its scripts run. Here the text is in the HTML. Both say
//! `noindex` and keep links followable.

use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};

use super::document::{self, Head, Site};
use super::html as html_response;

/// `target` is the request's path and query, as received.
pub fn response(site: &Site, target: &str) -> Response {
    response_titled(site, target, false)
}

/// The same document under `app/[locale]`, whose layout sets no title
/// template: the title has no ` | 밈캐치`.
pub fn locale_response(site: &Site, target: &str) -> Response {
    response_titled(site, target, true)
}

fn response_titled(site: &Site, target: &str, bare_title: bool) -> Response {
    let head = Head {
        title: "이 밈은 아직 없어요".to_owned(),
        title_absolute: bare_title,
        description: None,
        robots: Some("noindex, follow"),
        canonical: None,
        languages: Vec::new(),
        image: None,
        ..Head::default()
    };
    html_response(
        StatusCode::NOT_FOUND,
        document::page(site, &head, target, main()),
    )
}

const BUTTON: &str = "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2";

pub(crate) fn main() -> Markup {
    html! {
        main class="mx-auto w-full max-w-5xl px-4 py-14 sm:py-20" {
            div class="mx-auto w-full max-w-2xl" {
                div class="relative overflow-hidden rounded-3xl border border-border bg-surface-2 px-6 py-10 text-center sm:px-10 sm:py-12" style="background-image:radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 11%, transparent), transparent 52%)" {
                    div class="relative mx-auto max-w-md" {
                        img src="/brand/state-404.webp" alt="" width="1024" height="768" loading="lazy" decoding="async" class="mx-auto mb-4 w-52 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent_98%)] sm:w-60";
                        p class="inline-flex min-h-8 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white" {
                            span aria-hidden="true" class="flex items-center gap-1" {
                                span class="h-2 w-2 rounded-full bg-accent" {}
                                span class="h-2 w-2 rounded-full bg-white/20" {}
                                span class="h-2 w-2 rounded-full bg-white/20" {}
                            }
                            "신호 없음 · 404"
                        }
                        p aria-hidden="true" class="mt-6 text-7xl font-extrabold leading-none tracking-tighter sm:text-8xl" {
                            "4" span class="text-accent-text" { "0" } "4"
                        }
                        h1 class="mt-5 text-2xl font-extrabold tracking-tight" { "이 밈은... 아직 없네요" }
                        p class="mt-2 text-base text-muted" {
                            "주소가 바뀌었거나, 아직 사전에 안 잡힌 밈일 수 있어요."
                            br class="hidden sm:block";
                            " 검색으로 다시 잡아 볼까요?"
                        }
                        form action="/search" role="search" class="mt-6" {
                            div class="flex gap-2" {
                                label for="nf-q" class="sr-only" { "밈 검색" }
                                input id="nf-q" type="search" name="q" placeholder="어떤 밈을 찾고 있었나요?" class="h-12 w-full min-w-0 rounded-xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted focus:border-accent";
                                button type="submit" class="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-[0.97]" {
                                    svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" {
                                        circle cx="11" cy="11" r="7" {}
                                        path d="m20 20-3.6-3.6" {}
                                    }
                                    "검색"
                                }
                            }
                        }
                        div class="mt-4 flex flex-wrap items-center justify-center gap-2.5" {
                            a href="/" class=(BUTTON) { "홈으로" }
                            a href="/explore" class=(BUTTON) { "밈 탐색하기" }
                        }
                    }
                }
            }
        }
    }
}
