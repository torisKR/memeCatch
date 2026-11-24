//! The error document: status 500 for a page whose data could not be read.
//! "다시 시도" reloads the same address.

use axum::http::header::CACHE_CONTROL;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use maud::{Markup, html};

use super::document::{self, Head, Site};
use super::html as html_response;

const TITLE: &str = "일시적인 오류";
const NO_STORE: &str = "private, no-cache, no-store, max-age=0, must-revalidate";
const BUTTON: &str = "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2";

/// `target` is the request's path and query, as received.
pub fn response(site: &Site, target: &str) -> Response {
    let head = Head {
        title: TITLE.to_owned(),
        robots: Some("noindex"),
        ..Head::default()
    };
    let mut response = html_response(
        StatusCode::INTERNAL_SERVER_ERROR,
        document::page(site, &head, target, main(target)),
    );
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static(NO_STORE));
    response
}

fn main(target: &str) -> Markup {
    html! {
        main class="relative mx-auto flex min-h-[70dvh] w-full max-w-site flex-col items-center justify-center overflow-hidden px-4 py-14 sm:py-20" {
            div class="mx-auto w-full max-w-2xl" {
                div role="alert" class="relative overflow-hidden rounded-3xl border border-border bg-surface-2 px-6 py-10 text-center sm:px-10 sm:py-12" style="background-image:radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--safety-red) 10%, transparent), transparent 52%)" {
                    div class="relative mx-auto max-w-md" {
                        img src="/brand/state-error.webp" alt="" width="1024" height="768" loading="lazy" decoding="async" class="mx-auto mb-4 w-56 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent_98%)] sm:w-64";
                        p class="inline-flex min-h-8 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white" {
                            span aria-hidden="true" class="flex items-center gap-1" {
                                span class="h-2 w-2 rounded-full bg-white/20" {}
                                span class="h-2 w-2 rounded-full bg-white/20" {}
                                span class="signal-flicker h-2 w-2 rounded-full bg-safety-red" {}
                            }
                            "신호 오류"
                        }
                        h1 class="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl" { "밈을 잡다가 놓쳤어요" }
                        p class="mt-2 text-base text-muted" { "일시적인 오류예요. 다시 시도하면 대부분 해결돼요." }
                        div class="mt-6 flex flex-wrap items-center justify-center gap-2.5" {
                            a href=(target) class="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-sm font-bold text-white transition-transform active:scale-[0.97]" { "다시 시도" }
                            a href="/" class=(BUTTON) { "홈으로" }
                        }
                    }
                }
            }
        }
    }
}
