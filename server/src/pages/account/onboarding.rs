//! `GET /onboarding` (`app/(default)/onboarding/`): nickname, purpose,
//! interests, platforms and age group, all optional. Rendered on request for
//! a signed-in user; anyone else goes to sign in and back.
//!
//! `ui/onboarding.js` keeps the chips and the hidden inputs as the form's
//! state keeps them, and posts the inputs to `POST /api/account/onboarding`
//! (`routes/account.rs`, `completeOnboarding`), which answers where to go.
//! When the action fails the page script shows the error panel
//! (`super::error_panel`). A visitor without a session gets a 307 to the
//! sign-in page.

use axum::extract::{Request, State};
use axum::response::{IntoResponse, Response};
use maud::{Markup, html};
use serde_json::Value;

use super::copy::{self, interest_categories, text};
use super::{error_panel, redirect_307, respond};
use crate::AppState;
use crate::db::IdentityOptions;
use crate::pages::DYNAMIC_PAGE_CACHE;
use crate::pages::chrome::brand_tile;
use crate::pages::document::Head;
use crate::routes::better_auth::{PageUser, page_user};
use crate::routes::next_compat::safe_next;
use crate::routes::public::js;

const AGE_GROUPS: [&str; 5] = ["10s", "20s", "30s", "40s", "50s+"];
const USE_PURPOSES: [&str; 3] = ["creator", "brand", "global"];
const PLATFORMS: [&str; 4] = ["instagram", "tiktok", "x", "youtube"];

const CHIP: &str = "inline-flex min-h-11 items-center rounded-full border px-4 text-base font-medium transition-colors";
const CHIP_ON: &str = "border-accent bg-accent-soft text-accent";
const CHIP_OFF: &str = "border-border bg-surface text-foreground hover:border-accent";

/// What `get_my_profile` returns; empty when it returns nothing.
#[derive(Default)]
struct Profile {
    nickname: Option<String>,
    interests: Option<Vec<String>>,
    age_group: Option<String>,
    use_purpose: Option<String>,
    preferred_platforms: Option<Vec<String>>,
}

async fn profile(state: &AppState, user: &PageUser) -> Profile {
    type Row = (
        Option<String>,
        Option<Vec<String>>,
        Option<String>,
        Option<String>,
        Option<Vec<String>>,
    );
    let identity = crate::db::DbIdentity::authenticated(user.id.as_str());
    let row: Result<Option<Row>, sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select nickname, interests, age_group, use_purpose, preferred_platforms from public.get_my_profile()",
                )
                .fetch_optional(tx)
                .await
            })
        })
        .await;
    match row {
        Ok(Some((nickname, interests, age_group, use_purpose, preferred_platforms))) => Profile {
            nickname,
            interests,
            age_group,
            use_purpose,
            preferred_platforms,
        },
        Ok(None) => Profile::default(),
        Err(error) => {
            // `.maybeSingle()` with an error: `profile` is null.
            tracing::warn!(%error, "get_my_profile failed");
            Profile::default()
        }
    }
}

/// `safeNext(sp.next)`: a name given twice is an array, which is not a string.
fn next_param(query: Option<&str>) -> String {
    let mut values = url::form_urlencoded::parse(query.unwrap_or("").as_bytes())
        .filter(|(key, _)| key == "next")
        .map(|(_, value)| value.into_owned());
    let single = match (values.next(), values.next()) {
        (Some(value), None) => Some(value),
        _ => None,
    };
    safe_next(single.as_deref())
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let next = next_param(request.uri().query());
    let Some(user) = page_user(&state, request.headers()).await else {
        let back = format!("/onboarding?next={next}");
        return redirect_307(&format!("/login?next={}", js::encode_uri_component(&back)));
    };
    let profile = profile(&state, &user).await;
    let ko = copy::my("ko");
    let head = Head {
        title: text(ko, "onboarding.title").to_owned(),
        description: Some(text(ko, "onboarding.body").to_owned()),
        site_card: true,
        ..Head::default()
    };
    let markup = html! {
        (main(ko, &next, &profile))
        template data-action-error { (error_panel()) }
    };
    respond(&state, &request, DYNAMIC_PAGE_CACHE, head, markup).into_response()
}

/// The chips' initial state as the form's `useState` initialisers set it.
struct Choices {
    /// Every category of each chip one of the saved interests belongs to,
    /// in chip order.
    interests: Vec<&'static str>,
    age_group: String,
    use_purpose: &'static str,
    platforms: Vec<&'static str>,
}

fn choices(profile: &Profile) -> Choices {
    let saved = profile.interests.as_deref().unwrap_or_default();
    let mut interests: Vec<&'static str> = Vec::new();
    for (_, categories) in interest_categories() {
        if categories
            .iter()
            .any(|category| saved.iter().any(|s| s == category))
        {
            for category in categories {
                if !interests.contains(&category) {
                    interests.push(category);
                }
            }
        }
    }
    let use_purpose = profile
        .use_purpose
        .as_deref()
        .and_then(|purpose| USE_PURPOSES.into_iter().find(|known| *known == purpose))
        .unwrap_or("creator");
    let mut platforms: Vec<&'static str> = Vec::new();
    for saved in profile.preferred_platforms.as_deref().unwrap_or_default() {
        if let Some(known) = PLATFORMS.into_iter().find(|known| known == saved)
            && !platforms.contains(&known)
        {
            platforms.push(known);
        }
    }
    Choices {
        interests,
        age_group: profile.age_group.clone().unwrap_or_default(),
        use_purpose,
        platforms,
    }
}

fn chip_class(on: bool, press: bool) -> String {
    let press = if press { " active:scale-[0.97]" } else { "" };
    format!("{CHIP}{press} {}", if on { CHIP_ON } else { CHIP_OFF })
}

fn main(ko: &Value, next: &str, profile: &Profile) -> Markup {
    let choices = choices(profile);
    let t = |path: &str| text(ko, path).to_owned();
    html! {
        main class="instrument-grid mx-auto w-full max-w-site px-4 py-10" {
            div class="mx-auto w-full max-w-md" {
                div {
                    div class="flex items-center gap-2" {
                        (brand_tile("size-9"))
                        span class="text-sm font-semibold text-muted" data-i18n="onboarding.step" { (t("onboarding.step")) }
                    }
                    h1 class="mt-4 text-[1.75rem] font-extrabold leading-tight" data-i18n="onboarding.title" { (t("onboarding.title")) }
                    p class="mt-2 text-muted" data-i18n="onboarding.body" { (t("onboarding.body")) }
                    form class="mt-8 flex flex-col gap-8" data-onboarding data-chip-on=(CHIP_ON) data-chip-off=(CHIP_OFF) {
                        input type="hidden" name="next" value=(next);
                        @for category in &choices.interests {
                            input type="hidden" name="interests" value=(category);
                        }
                        input type="hidden" name="age_group" value=(choices.age_group);
                        input type="hidden" name="use_purpose" value=(choices.use_purpose);
                        @for platform in &choices.platforms {
                            input type="hidden" name="preferred_platforms" value=(platform);
                        }
                        section {
                            label for="onboarding-nickname" class="mb-2 block font-bold" data-i18n="onboarding.nicknameLabel" { (t("onboarding.nicknameLabel")) }
                            input id="onboarding-nickname" name="nickname" type="text" autocomplete="nickname" minlength="2" maxlength="20" required value=(profile.nickname.as_deref().unwrap_or_default()) placeholder=(t("onboarding.nicknamePlaceholder")) data-i18n-placeholder="onboarding.nicknamePlaceholder" class="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/20";
                        }
                        section {
                            h2 class="font-bold" data-i18n="onboarding.purposeTitle" { (t("onboarding.purposeTitle")) }
                            p class="mt-1 text-sm text-muted" data-i18n="onboarding.purposeBody" { (t("onboarding.purposeBody")) }
                            ul role="radiogroup" aria-label=(t("onboarding.purposeTitle")) data-i18n-label="onboarding.purposeTitle" class="mt-3 flex flex-wrap gap-2" {
                                @for purpose in USE_PURPOSES {
                                    @let on = choices.use_purpose == purpose;
                                    li {
                                        button type="button" role="radio" aria-checked=(on) class=(chip_class(on, false)) data-onboarding-purpose=(purpose) data-i18n=(format!("onboarding.purposes.{purpose}")) {
                                            (t(&format!("onboarding.purposes.{purpose}")))
                                        }
                                    }
                                }
                            }
                        }
                        section {
                            h2 class="font-bold" data-i18n="onboarding.interestsTitle" { (t("onboarding.interestsTitle")) }
                            p class="mt-1 text-sm text-muted" data-i18n="onboarding.interestsBody" { (t("onboarding.interestsBody")) }
                            ul class="mt-3 flex flex-wrap gap-2" {
                                @for (_, categories) in interest_categories() {
                                    @let on = categories.iter().any(|category| choices.interests.contains(category));
                                    @let label = format!("categories.{}", categories.first().copied().unwrap_or("phrase"));
                                    li {
                                        button type="button" aria-pressed=(on) class=(chip_class(on, true)) data-onboarding-interest=(categories.join(" ")) data-i18n=(label) {
                                            (t(&label))
                                        }
                                    }
                                }
                            }
                        }
                        section {
                            h2 class="font-bold" data-i18n="onboarding.platformsTitle" { (t("onboarding.platformsTitle")) }
                            p class="mt-1 text-sm text-muted" data-i18n="onboarding.platformsBody" { (t("onboarding.platformsBody")) }
                            ul class="mt-3 flex flex-wrap gap-2" {
                                @for platform in PLATFORMS {
                                    @let on = choices.platforms.contains(&platform);
                                    li {
                                        button type="button" aria-pressed=(on) class=(chip_class(on, false)) data-onboarding-platform=(platform) data-i18n=(format!("onboarding.platforms.{platform}")) {
                                            (t(&format!("onboarding.platforms.{platform}")))
                                        }
                                    }
                                }
                            }
                        }
                        section {
                            h2 class="font-bold" data-i18n-lead="onboarding.ageTitle" {
                                (t("onboarding.ageTitle")) " "
                                span class="font-normal text-muted" data-onboarding-optional { "(" (t("onboarding.optional")) ")" }
                            }
                            p class="mt-1 text-sm text-muted" data-i18n="onboarding.ageBody" { (t("onboarding.ageBody")) }
                            ul role="radiogroup" aria-label=(t("onboarding.ageTitle")) data-i18n-label="onboarding.ageTitle" class="mt-3 flex flex-wrap gap-2" {
                                @for age in AGE_GROUPS.into_iter().chain([""]) {
                                    @let on = choices.age_group == age;
                                    @let label = if age.is_empty() { "onboarding.notSelected".to_owned() } else { format!("ageGroups.{age}") };
                                    li {
                                        button type="button" role="radio" aria-checked=(on) class=(chip_class(on, true)) data-onboarding-age=(age) data-i18n=(label) {
                                            (t(&label))
                                        }
                                    }
                                }
                            }
                        }
                        div class="flex flex-col gap-3" {
                            button type="submit" class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60" data-i18n="onboarding.submit" { (t("onboarding.submit")) }
                            a class="inline-flex min-h-11 items-center justify-center text-base font-medium text-muted underline underline-offset-4 hover:text-foreground" href=(next) data-i18n="onboarding.skip" { (t("onboarding.skip")) }
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

    #[test]
    fn the_chips_start_as_the_forms_state_starts() {
        let profile = Profile {
            nickname: Some("밈러".into()),
            interests: Some(vec!["challenge".into(), "song".into(), "nope".into()]),
            age_group: Some("weird".into()),
            use_purpose: Some("nope".into()),
            preferred_platforms: Some(vec![
                "youtube".into(),
                "x".into(),
                "youtube".into(),
                "myspace".into(),
            ]),
        };
        let choices = choices(&profile);
        assert_eq!(choices.interests, ["dance", "challenge", "song"]);
        assert_eq!(choices.age_group, "weird");
        assert_eq!(choices.use_purpose, "creator");
        assert_eq!(choices.platforms, ["youtube", "x"]);
        assert_eq!(next_param(Some("next=%2Fabout&next=%2Fx")), "/");
        assert_eq!(next_param(Some("next=%2Fabout")), "/about");
    }
}
