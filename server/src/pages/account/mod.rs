//! Batch B6: sign-in, account, submission and community pages
//! (`docs/axum-migration/UI-PLAN.md`, PLAN.md section B6). The forms call
//! the `/api/auth/*` endpoints or a route per write, from `ui/auth-forms.js`
//! and the other scripts named in each module.
//!
//! Route ids: `page-forgot-password`, `page-reset-password`, `page-login`, `page-onboarding`.

pub mod copy;
pub mod forgot_password;
pub mod login;
pub mod my;
pub mod onboarding;
pub mod reset_password;
pub mod submit;
pub mod support;

use axum::body::Body;
use axum::extract::Request;
use axum::http::header::{CONTENT_LANGUAGE, LOCATION};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use maud::{Markup, html};

use super::document::{self, Head};
use super::{html_cached, path_and_query};
use crate::AppState;

/// A page with the frame around it and its `Cache-Control`.
pub(crate) fn respond(
    state: &AppState,
    request: &Request,
    cache_control: &'static str,
    head: Head,
    main: Markup,
) -> Response {
    let document = document::page(&state.pages.site, &head, path_and_query(request), main);
    html_cached(StatusCode::OK, cache_control, document)
}

/// A 307 to `location`, a path of this site, with no body.
pub(crate) fn redirect_307(location: &str) -> Response {
    let Ok(value) = HeaderValue::from_str(location) else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let mut response = Response::new(Body::empty());
    *response.status_mut() = StatusCode::TEMPORARY_REDIRECT;
    response.headers_mut().insert(LOCATION, value);
    response
}

/// The sign-in gate's 307, answered before routing: the target as the
/// body, `Content-Language: ko`, and no `Vary` (`AnsweredBeforeRouting`).
fn proxy_redirect_307(location: &str) -> Response {
    let Ok(value) = HeaderValue::from_str(location) else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let mut response = Response::new(Body::from(location.to_owned()));
    *response.status_mut() = StatusCode::TEMPORARY_REDIRECT;
    let headers = response.headers_mut();
    headers.insert(LOCATION, value);
    headers.insert(CONTENT_LANGUAGE, HeaderValue::from_static("ko"));
    response
        .extensions_mut()
        .insert(crate::headers::AnsweredBeforeRouting);
    response
}

/// `app/(default)/error.tsx`, the segment's error page, for a page script to
/// show in place of `<main>` when an action fails (`data-action-error`).
/// "다시 시도" loads the page again.
pub(crate) fn error_panel() -> Markup {
    html! {
        main class="relative mx-auto flex min-h-[70dvh] w-full max-w-site flex-col items-center justify-center overflow-hidden px-4 py-14 sm:py-20" {
            div aria-hidden="true" class="pointer-events-none absolute left-0 right-1/2 top-1/2 mr-[21rem] hidden h-px bg-gradient-to-r from-transparent via-border to-(--safety-red) opacity-70 sm:block" {}
            div aria-hidden="true" class="pointer-events-none absolute left-1/2 right-0 top-1/2 ml-[21rem] hidden h-px bg-gradient-to-l from-transparent via-border to-(--safety-red) opacity-70 sm:block" {}
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
                            button type="button" class="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-sm font-bold text-white transition-transform active:scale-[0.97]" data-action-retry { "다시 시도" }
                            a href="/" class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2" { "홈으로" }
                        }
                    }
                }
            }
        }
    }
}
