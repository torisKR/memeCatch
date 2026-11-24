//! `GET /submit` (`app/(default)/submit/page.tsx`): the meme report form.
//! Signed out, `proxy.ts` sends the visitor to sign in first, keeping an
//! allowlisted `name` (`withAllowlistedSearch`). The page renders its request
//! locale, Korean on this path; the form (`components/submit-form.tsx`)
//! follows the language switch: the frame fragment brings its copy
//! (`copy::page_copy`) and `assets/pages/submit.js` writes it in.
//!
//! The script runs the form: the draft, the duplicate search (`search_memes`
//! through the planner), the link preview (`ContentUrlPreview`, R11's
//! `GET /api/oembed`), the image (uploaded at submit through `lib/upload.ts`)
//! and `POST /api/submit` (`routes/submit.rs`).

use axum::extract::{Request, State};
use axum::response::{IntoResponse, Response};
use maud::{Markup, PreEscaped, html};
use serde_json::Value;

use super::copy::{self, text};
use super::{proxy_redirect_307, respond};
use crate::AppState;
use crate::pages::DYNAMIC_PAGE_CACHE;
use crate::pages::document::Head;
use crate::routes::better_auth::page_user;
use crate::routes::public::js;

/// `UPLOAD_ACCEPT` of lib/upload-shared.ts: images only.
const ACCEPT_IMAGES: &str = "image/jpeg,image/png,image/webp,image/gif";
const AUTH_RETURN_MAX_NAME: usize = 100;
const INPUT: &str =
    "h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted";
const TEXTAREA: &str =
    "w-full rounded-xl border border-border bg-surface px-4 py-3 text-base placeholder:text-muted";

/// The values of `key` in the query, decoded.
fn params(query: Option<&str>, key: &str) -> Vec<String> {
    url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
        .filter(|(name, _)| name == key)
        .map(|(_, value)| value.into_owned())
        .collect()
}

/// `searchParams[key]` as the page reads it: a string only when the key
/// appears once.
fn single(query: Option<&str>, key: &str) -> Option<String> {
    let mut values = params(query, key);
    (values.len() == 1).then(|| values.remove(0))
}

/// `proxy.ts` for a visitor without a session: `/login?next=` the path with
/// `name` kept when it appears once, is not empty, has no control character
/// and is at most 100 UTF-16 units (`withAllowlistedSearch`).
pub fn login_location(query: Option<&str>) -> String {
    let name = single(query, "name").filter(|name| {
        !name.is_empty()
            && !name.chars().any(|c| c <= '\u{1f}' || c == '\u{7f}')
            && js::utf16_len(name) <= AUTH_RETURN_MAX_NAME
    });
    let next = match name {
        Some(name) => {
            let kept: String = url::form_urlencoded::Serializer::new(String::new())
                .append_pair("name", &name)
                .finish();
            format!("/submit?{kept}")
        }
        None => "/submit".to_owned(),
    };
    let encoded: String = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("next", &next)
        .finish();
    format!("/login?{encoded}")
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let query = request.uri().query();
    if page_user(&state, request.headers()).await.is_none() {
        return proxy_redirect_307(&login_location(query));
    }
    let ko = copy::submit("ko");
    // `sp.name.slice(0, 100)`; a surrogate left alone is written as U+FFFD.
    let default_name =
        single(query, "name").map_or_else(String::new, |name| {
            match js::utf16_slice(&name, AUTH_RETURN_MAX_NAME) {
                (head, None) => head.to_owned(),
                (head, Some(_)) => format!("{head}\u{FFFD}"),
            }
        });
    let tiktok = single(query, "tiktokImport");
    let imported = single(query, "imported").map(|value| js::number(&value));
    let head = Head {
        title: text(ko, "metadata.title").to_owned(),
        description: Some(text(ko, "metadata.description").to_owned()),
        robots: Some("noindex, nofollow"),
        site_card: true,
        script: Some("submit"),
        ..Head::default()
    };
    let form_copy = copy::page_copy("/submit", "ko").unwrap_or(Value::Null);
    let markup = html! {
        (main(&state, ko, &default_name, tiktok.as_deref(), imported))
        // The Korean form copy, until the frame brings the reader's language.
        script type="application/json" data-submit-copy { (PreEscaped(form_copy.to_string().replace('<', "\\u003c"))) }
    };
    respond(&state, &request, DYNAMIC_PAGE_CACHE, head, markup).into_response()
}

fn main(
    state: &AppState,
    ko: &Value,
    default_name: &str,
    tiktok: Option<&str>,
    imported: Option<f64>,
) -> Markup {
    let t = |key: &str| text(ko, key);
    let steps: Vec<&str> = ko["page"]["reviewSteps"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    html! {
        main class="mx-auto w-full max-w-site px-4 py-8" {
            div class="mx-auto w-full max-w-md" {
                h1 class="page-title" { (t("page.title")) }
                p class="page-lede" { (t("page.intro")) }
                ol class="instrument-grid mt-4 flex items-center gap-1.5 rounded-2xl border border-border px-2.5 py-2 text-[13px] font-medium text-muted" aria-label=(t("page.reviewProcess")) {
                    @for (index, step) in steps.iter().enumerate() {
                        li class="flex items-center gap-1.5" {
                            @if index > 0 {
                                span aria-hidden="true" class="text-border" { "→" }
                            }
                            span class=(if index == 0 { "rounded-full border border-flame-500/70 bg-flame-500/10 px-2.5 py-1 font-semibold text-accent" } else { "rounded-full bg-surface-2 px-2.5 py-1" }) { (step) }
                        }
                    }
                }
                section class="mt-5 rounded-2xl border border-border bg-surface p-4" {
                    p class="font-semibold" { (t("page.tiktokTitle")) }
                    p class="mt-1 text-sm text-muted" { (t("page.tiktokBody")) }
                    a class="mt-3 inline-flex min-h-11 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background" href="/auth/tiktok?import=1&next=/submit" { (t("page.tiktokAction")) }
                    @if tiktok == Some("done") {
                        p class="mt-3 text-sm text-safety-green" role="status" {
                            // `imported ? tiktokDone(imported) : tiktokEmpty`: NaN and 0 are falsy.
                            @match imported.filter(|count| *count != 0.0 && !count.is_nan()) {
                                Some(count) => (t("page.tiktokDone").replace("{count}", &js::number_to_string(count))),
                                None => (t("page.tiktokEmpty")),
                            }
                        }
                    }
                    @if tiktok == Some("failed") {
                        p class="mt-3 text-sm text-safety-red" role="alert" { (t("page.tiktokFailed")) }
                    }
                }
                div class="mt-6" { (form_or_closed(state.config.submissions_open, ko, default_name)) }
            }
        }
    }
}

/// The form while submissions are open (`flags.submissionsOpen`), else the
/// closed notice.
fn form_or_closed(open: bool, ko: &Value, default_name: &str) -> Markup {
    let t = |key: &str| text(ko, key);
    if open {
        return form(ko, default_name);
    }
    html! {
        section class="rounded-2xl border border-border bg-surface p-6 text-center" {
            h2 class="text-xl font-bold" { (t("page.closedTitle")) }
            p class="mt-2 text-muted" { (t("page.closedBody")) }
            a href="/" class="mt-6 flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-base font-semibold" { (t("page.home")) }
        }
    }
}

/// `SubmitForm` before hydration. Its ids stand where React's `useId` ones
/// do (`_R_…_`, read alike by the page gate).
fn form(ko: &Value, default_name: &str) -> Markup {
    let t = |key: &str| text(ko, key);
    let label = |id: &str, key: &str| html! { label for=(id) class="mb-1.5 block font-medium" data-submit-text=(key) { (t(key)) } };
    html! {
        form class="flex flex-col gap-5" novalidate data-submit-form data-default-name=(default_name) {
            div data-submit-field="name" {
                label for="_R_sname_" class="mb-1.5 block font-medium" data-submit-lead="form.nameLabel" {
                    (t("form.nameLabel"))
                    " "
                    span class="text-safety-red" aria-hidden="true" { "*" }
                    span class="sr-only" data-submit-required { "(" (t("form.required")) ")" }
                }
                input id="_R_sname_" type="text" required maxlength="100" placeholder=(t("form.namePlaceholder")) aria-invalid="false" class=(INPUT) name="name" value=(default_name);
            }
            div data-submit-field="seenAt" {
                (label("_R_sseen_", "form.seenAtLabel"))
                input id="_R_sseen_" type="text" maxlength="200" placeholder=(t("form.seenAtPlaceholder")) aria-invalid="false" class=(INPUT) name="seenAt" value="";
            }
            div data-submit-field="sourceUrl" {
                (label("_R_surl_", "form.sourceUrlLabel"))
                input id="_R_surl_" type="url" inputmode="url" maxlength="500" placeholder=(t("form.sourceUrlPlaceholder")) aria-invalid="false" class=(INPUT) name="sourceUrl" value="";
                p class="mt-2 text-sm text-muted" data-submit-preview { (t("preview.idle")) }
            }
            div data-submit-field="description" {
                (label("_R_sdesc_", "form.descriptionLabel"))
                textarea id="_R_sdesc_" name="description" rows="4" maxlength="2000" placeholder=(t("form.descriptionPlaceholder")) aria-invalid="false" class=(TEXTAREA) {}
            }
            div data-submit-field="guessReason" {
                (label("_R_sguess_", "form.guessLabel"))
                textarea id="_R_sguess_" name="guessReason" rows="3" maxlength="1000" placeholder=(t("form.guessPlaceholder")) aria-invalid="false" class=(TEXTAREA) {}
            }
            div data-submit-field="tags" {
                (label("_R_stags_", "form.tagsLabel"))
                input id="_R_stags_" type="text" maxlength="300" placeholder=(t("form.tagsPlaceholder")) aria-invalid="false" class=(INPUT) name="tags" value="";
            }
            div data-submit-field="attachment" {
                (label("_R_sfile_", "form.attachmentLabel"))
                input id="_R_sfile_" type="file" accept=(ACCEPT_IMAGES) aria-invalid="false" aria-describedby="_R_sfile_-hint" class="w-full cursor-pointer rounded-xl border border-border bg-surface px-4 py-3 text-base text-muted file:mr-3 file:h-8 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:text-sm file:font-semibold file:text-foreground";
                p id="_R_sfile_-hint" class="mt-1.5 text-sm text-muted" data-submit-text="form.attachmentHint" { (t("form.attachmentHint")) }
            }
            button type="submit" class="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-strong text-base font-bold text-white disabled:opacity-60" { (t("form.submit")) }
            p class="text-center text-sm text-muted" data-submit-text="form.draftHint" { (t("form.draftHint")) }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closed_submissions_show_the_notice_instead_of_the_form() {
        let ko = copy::submit("ko");
        let closed = form_or_closed(false, ko, "").into_string();
        assert!(closed.contains(text(ko, "page.closedTitle")));
        assert!(!closed.contains("<form"));
        let open = form_or_closed(true, ko, "우당탕").into_string();
        assert!(open.contains(r#"name="name" value="우당탕""#));
    }

    // Expected values: proxy.ts's redirect URL under Node.
    #[test]
    fn the_sign_in_redirect_keeps_an_allowlisted_name() {
        assert_eq!(login_location(None), "/login?next=%2Fsubmit");
        assert_eq!(
            login_location(Some("name=우당탕 탕")),
            "/login?next=%2Fsubmit%3Fname%3D%25EC%259A%25B0%25EB%258B%25B9%25ED%2583%2595%2B%25ED%2583%2595"
        );
        assert_eq!(
            login_location(Some("name=a&name=b")),
            "/login?next=%2Fsubmit"
        );
        assert_eq!(login_location(Some("name=")), "/login?next=%2Fsubmit");
        assert_eq!(login_location(Some("name=a%01")), "/login?next=%2Fsubmit");
        assert_eq!(
            login_location(Some(&format!("name={}", "a".repeat(101)))),
            "/login?next=%2Fsubmit"
        );
        assert_eq!(
            login_location(Some("x=1&name=a")),
            "/login?next=%2Fsubmit%3Fname%3Da"
        );
    }
}
