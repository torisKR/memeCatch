//! `GET /login` (`app/(default)/login/`): sign-in and sign-up, with the
//! social buttons. Next renders it on request (it reads the query), after
//! `proxy.ts` has read the session (`getUser()` for `/login`); the page
//! itself does not use it.
//!
//! The query: `next` (`safeNext`, where to go after signing in), `tab=signup`
//! (the sign-up tab first) and `error=auth` (the callback's failure notice).
//! A name given twice is an array to Next and matches nothing.
//!
//! Next mounts one tab's form at a time. Here the other tab's form waits in a
//! `<template>` after `<main>`, and `ui/login.js` swaps them, runs the social
//! buttons, and changes the copy in place when the language switch changes
//! the frame (`LoginForm` follows `useLocale()`; `copy.rs`). The two forms
//! are `ui/auth-forms.js` forms (`signin`, `signup`).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::respond;
use crate::AppState;
use crate::pages::DYNAMIC_PAGE_CACHE;
use crate::pages::chrome::brand_tile;
use crate::pages::document::Head;
use crate::routes::better_auth::page_user;
use crate::routes::next_compat::safe_next;
use crate::routes::public::js;

const INPUT: &str = "h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/20";
const SUBMIT: &str = "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60";
const TEXT_LINK: &str = "font-semibold text-accent-text underline-offset-4 hover:underline";
const TAB: &str = "relative min-h-11 rounded-lg text-base font-semibold transition-colors";

/// Korean copy by key (`LOGIN_COPY.ko`).
fn ko(key: &str) -> &'static str {
    super::copy::text(super::copy::login("ko"), key)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
    Login,
    Signup,
}

struct Query {
    next: String,
    callback_error: bool,
    mode: Mode,
}

/// `searchParams` as the page reads it: a name given twice is an array.
fn query(raw: Option<&str>) -> Query {
    let pairs: Vec<(String, String)> = url::form_urlencoded::parse(raw.unwrap_or("").as_bytes())
        .into_owned()
        .collect();
    let single = |name: &str| {
        let mut values = pairs.iter().filter(|(key, _)| key == name);
        match (values.next(), values.next()) {
            (Some((_, value)), None) => Some(value.as_str()),
            _ => None,
        }
    };
    Query {
        next: safe_next(single("next")),
        callback_error: single("error") == Some("auth"),
        mode: if single("tab") == Some("signup") {
            Mode::Signup
        } else {
            Mode::Login
        },
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    // proxy.ts reads the session for /login (a refresh or an expired row is
    // written); the page does not use it.
    let _ = page_user(&state, request.headers()).await;
    let query = query(request.uri().query());
    let head = Head {
        title: "로그인".to_owned(),
        description: Some("로그인하면 밈을 저장하고 직접 제보할 수 있어요.".to_owned()),
        site_card: true,
        ..Head::default()
    };
    let other = match query.mode {
        Mode::Login => Mode::Signup,
        Mode::Signup => Mode::Login,
    };
    let markup = html! {
        (main(&query))
        template data-login-form=(mode_name(other)) { (form(other, &query.next)) }
    };
    respond(&state, &request, DYNAMIC_PAGE_CACHE, head, markup)
}

fn mode_name(mode: Mode) -> &'static str {
    match mode {
        Mode::Login => "login",
        Mode::Signup => "signup",
    }
}

fn main(query: &Query) -> Markup {
    let (title, description) = match query.mode {
        Mode::Login => ("loginTitle", "loginDescription"),
        Mode::Signup => ("signupTitle", "signupDescription"),
    };
    html! {
        main class="mx-auto w-full max-w-site px-4 py-10" {
            div class="mx-auto grid w-full max-w-md overflow-hidden rounded-3xl lg:max-w-4xl lg:grid-cols-[0.85fr_1.15fr] lg:border lg:border-border lg:bg-surface" {
                div aria-hidden="true" class="relative hidden lg:block" {
                    img src="/brand/login-signal.webp" alt="" width="1024" height="1536" loading="lazy" decoding="async" class="absolute inset-0 h-full w-full object-cover";
                    div class="absolute inset-x-6 bottom-6 border-l-2 border-(--flame-400) pl-3" {
                        p class="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55" { "Save / Submit / Catch first" }
                        p class="mt-1 text-lg font-bold leading-snug text-white" { "저장하고, 제보하고, 가장 먼저 캐치하세요." }
                    }
                }
                div class="instrument-grid lg:p-8" {
                    div data-login=(mode_name(query.mode)) data-login-next=(query.next) {
                        div class="flex items-center gap-2" {
                            (brand_tile("size-9"))
                            span class="text-lg font-extrabold tracking-tight" data-i18n="brand" { (ko("brand")) }
                        }
                        h1 class="mt-6 text-[1.75rem] font-extrabold leading-tight" data-login-title { (ko(title)) }
                        p class="mt-2 text-muted" data-login-description { (ko(description)) }
                        @if query.callback_error {
                            p role="alert" class="mt-4 rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red" data-i18n="callbackError" { (ko("callbackError")) }
                        }
                        (social(&query.next))
                        p role="status" aria-live="polite" class="mt-2 min-h-5 text-sm text-muted" data-login-notice {}
                        div class="my-5 flex items-center gap-3" aria-hidden="true" {
                            span class="h-px flex-1 bg-border" {}
                            span class="text-sm text-muted" data-i18n="emailDivider" { (ko("emailDivider")) }
                            span class="h-px flex-1 bg-border" {}
                        }
                        div role="tablist" aria-label=(ko("tabListLabel")) class="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" data-i18n-label="tabListLabel" {
                            (tab(Mode::Login, query.mode))
                            (tab(Mode::Signup, query.mode))
                        }
                        div class="mt-6" {
                            div style="opacity:1;transform:none" data-login-slot { (form(query.mode, &query.next)) }
                        }
                        p class="mt-8 text-center text-muted" {
                            a class="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground" href="/" data-i18n="browseWithoutLogin" { (ko("browseWithoutLogin")) }
                        }
                    }
                }
            }
        }
    }
}

/// The tab; the selected one holds the sliding pill.
fn tab(mode: Mode, selected: Mode) -> Markup {
    let on = mode == selected;
    let key = match mode {
        Mode::Login => "loginTab",
        Mode::Signup => "signupTab",
    };
    let tone = if on { "text-foreground" } else { "text-muted" };
    html! {
        button type="button" role="tab" aria-selected=(on) class=(format!("{TAB} {tone}")) data-login-tab=(mode_name(mode)) {
            @if on {
                span class="absolute inset-0 rounded-lg bg-surface shadow-sm" data-login-pill {}
            }
            span class="relative" data-i18n=(key) { (ko(key)) }
        }
    }
}

fn social(next: &str) -> Markup {
    html! {
        div class="mt-6 flex flex-col gap-2.5" {
            button type="button" class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 text-base font-semibold text-[#191600] transition-transform active:scale-[0.98] disabled:opacity-60" data-login-provider="kakao" data-i18n="kakaoButton" {
                svg viewBox="0 0 24 24" class="h-5 w-5" fill="#191600" aria-hidden="true" {
                    path d="M12 3.5c-4.97 0-9 3.14-9 7.02 0 2.5 1.68 4.69 4.2 5.94-.14.5-.9 3.1-.93 3.31 0 0-.02.15.08.21.1.06.22.01.22.01.28-.04 3.24-2.13 3.76-2.5.53.08 1.09.12 1.67.12 4.97 0 9-3.14 9-7.1 0-3.87-4.03-7.01-9-7.01Z" {}
                }
                (ko("kakaoButton"))
            }
            button type="button" class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-base font-semibold text-foreground transition-transform active:scale-[0.98] disabled:opacity-60" data-login-provider="google" data-i18n="googleButton" {
                svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" {
                    path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.34-.17-1.97H12v3.73h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.28Z" {}
                    path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.58A10 10 0 0 0 12 22Z" {}
                    path fill="#FBBC05" d="M6.42 13.9a6 6 0 0 1 0-3.8V7.52H3.06a10 10 0 0 0 0 8.96l3.36-2.58Z" {}
                    path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.52l3.36 2.58C7.2 7.74 9.4 5.98 12 5.98Z" {}
                }
                (ko("googleButton"))
            }
            a href=(format!("/auth/tiktok?next={}", js::encode_uri_component(next))) class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#111111] px-4 text-base font-semibold text-white transition-transform active:scale-[0.98]" data-i18n="tiktokButton" {
                svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" {
                    path d="M14.4 3.2c.5 2.5 1.9 4 4.4 4.5v3.1a8.6 8.6 0 0 1-4.4-1.4v6.1a5.8 5.8 0 1 1-5-5.7v3.2a2.7 2.7 0 1 0 1.8 2.5V3.2h3.2Z" fill="currentColor" {}
                }
                (ko("tiktokButton"))
            }
            p class="px-1 text-xs leading-relaxed text-muted" data-i18n-lead="socialConsent" {
                (ko("socialConsent")) " "
                a class=(TEXT_LINK) href="/terms" data-i18n="termsLink" { (ko("termsLink")) }
                " · "
                a class=(TEXT_LINK) href="/privacy" data-i18n="privacyLink" { (ko("privacyLink")) }
            }
        }
    }
}

/// A labelled field as `Field` renders it.
fn field(id: &str, key: &str, input: Markup) -> Markup {
    html! {
        div {
            label for=(id) class="mb-1.5 block font-medium" data-i18n=(key) { (ko(key)) }
            (input)
        }
    }
}

fn email_field(id: &str) -> Markup {
    field(
        id,
        "email",
        html! { input id=(id) type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" aria-invalid="false" class=(INPUT) name="email"; },
    )
}

fn form(mode: Mode, next: &str) -> Markup {
    match mode {
        Mode::Login => html! {
            form class="flex flex-col gap-4" novalidate data-auth-form="signin" {
                input type="hidden" name="next" value=(next);
                (email_field("signin-email"))
                (field("signin-password", "password", html! {
                    input id="signin-password" type="password" autocomplete="current-password" aria-invalid="false" class=(INPUT) name="password";
                }))
                button type="submit" class=(SUBMIT) data-i18n="loginSubmit" { (ko("loginSubmit")) }
                a class="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-accent-text transition-colors hover:text-accent" href="/forgot-password" data-i18n="forgotPassword" { (ko("forgotPassword")) }
            }
        },
        Mode::Signup => html! {
            form class="flex flex-col gap-4" novalidate data-auth-form="signup" {
                input type="hidden" name="next" value=(next);
                (field("signup-nickname", "nickname", html! {
                    input id="signup-nickname" type="text" autocomplete="nickname" maxlength="20" placeholder=(ko("nicknamePlaceholder")) aria-invalid="false" class=(INPUT) name="nickname" data-i18n-placeholder="nicknamePlaceholder";
                }))
                (email_field("signup-email"))
                (field("signup-password", "password", html! {
                    input id="signup-password" type="password" autocomplete="new-password" placeholder=(ko("newPasswordPlaceholder")) aria-invalid="false" class=(INPUT) name="password" data-i18n-placeholder="newPasswordPlaceholder";
                }))
                label for="signup-agree" class="flex items-start gap-2.5 text-sm leading-relaxed text-muted" {
                    input id="signup-agree" type="checkbox" required class="mt-1 size-4 shrink-0 rounded border-border accent-accent-strong" name="agree";
                    span data-i18n-lead="signupConsent" {
                        (ko("signupConsent")) " "
                        a class=(TEXT_LINK) href="/terms" data-i18n="termsLink" { (ko("termsLink")) }
                        " · "
                        a class=(TEXT_LINK) href="/privacy" data-i18n="privacyLink" { (ko("privacyLink")) }
                    }
                }
                button type="submit" disabled class=(SUBMIT) data-i18n="signupSubmit" { (ko("signupSubmit")) }
            }
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_query_reads_as_the_page_reads_it() {
        let read = |raw| {
            let query = query(Some(raw));
            (query.next, query.callback_error, query.mode == Mode::Signup)
        };
        assert_eq!(read(""), ("/".to_owned(), false, false));
        assert_eq!(
            read("next=%2Fmy&error=auth&tab=signup"),
            ("/my".to_owned(), true, true)
        );
        assert_eq!(read("next=%2Fmy&next=%2Fx"), ("/".to_owned(), false, false));
        assert_eq!(
            read("tab=signup&tab=signup&error=x"),
            ("/".to_owned(), false, false)
        );
        assert_eq!(read("next=%2F%2Fevil"), ("/".to_owned(), false, false));
    }
}
