//! The copy of the account pages that follows the language switch. On Next
//! these client components read `useLocale()`, so the language selector
//! changes their text in place. Here the frame fragment of such a page
//! (`/_axum/frame/{locale}?path=`, `chrome::fragment`) carries the page's
//! copy as `page`, and `ui/core.js` writes it into the elements marked
//! `data-i18n` (text), `data-i18n-lead` (the first text, then a space),
//! `data-i18n-placeholder` and `data-i18n-label` (`aria-label`), each a dot
//! path into that copy. The pages render Korean.
//!
//! The dictionaries are `i18n/login.json` (`LOGIN_COPY`) and `i18n/my.json`
//! (`MY_COPY` and the interest chips), from `scripts/build-i18n.mjs`.

use std::sync::LazyLock;

use serde_json::{Value, json};

const LOGIN_JSON: &str = include_str!("../../../i18n/login.json");
const MY_JSON: &str = include_str!("../../../i18n/my.json");

static LOGIN: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(LOGIN_JSON).expect("i18n/login.json parses"));
static MY: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(MY_JSON).expect("i18n/my.json parses"));

/// `LOGIN_COPY[locale]`, Korean for a code it does not know.
pub fn login(locale: &str) -> &'static Value {
    LOGIN.get(locale).unwrap_or(&LOGIN["ko"])
}

/// `MY_COPY[locale]` as far as the native pages use it.
pub fn my(locale: &str) -> &'static Value {
    MY["locales"].get(locale).unwrap_or(&MY["locales"]["ko"])
}

/// `my.json` itself: the category tables beside the copy.
pub fn my_tables() -> &'static Value {
    &MY
}

/// `INTEREST_CATEGORIES` of the onboarding form: each chip's key and the
/// legacy categories it stands for.
pub fn interest_categories() -> impl Iterator<Item = (&'static str, Vec<&'static str>)> {
    MY["interestCategories"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|chip| {
            let categories = chip["categories"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .collect();
            (chip["key"].as_str().unwrap_or_default(), categories)
        })
}

/// The text at a dot path, or "" when there is none.
pub fn text<'a>(copy: &'a Value, path: &str) -> &'a str {
    path.split('.')
        .try_fold(copy, |node, key| node.get(key))
        .and_then(Value::as_str)
        .unwrap_or_default()
}

/// The copy the frame fragment of `path_and_query` carries in `locale`.
pub fn page_copy(path_and_query: &str, locale: &str) -> Option<Value> {
    let path = path_and_query.split(['?', '#']).next().unwrap_or_default();
    match path {
        "/login" => Some(login(locale).clone()),
        "/onboarding" => {
            let my = my(locale);
            Some(json!({
                "onboarding": my["onboarding"],
                "categories": my["categories"],
                "ageGroups": my["ageGroups"],
            }))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_is_found_by_language_and_path() {
        assert_eq!(text(login("ko"), "loginTab"), "로그인");
        assert_eq!(text(login("en"), "loginTab"), "Log in");
        assert_eq!(text(login("nope"), "loginTab"), "로그인");
        assert_eq!(text(my("ko"), "ageGroups.50s+"), "50대 이상");
        assert_eq!(text(my("ko"), "onboarding.missing"), "");
        assert!(page_copy("/login?next=%2F", "en").is_some());
        assert!(page_copy("/onboarding", "ja").is_some());
        assert!(page_copy("/login/x", "en").is_none());
        assert!(page_copy("/loginx", "en").is_none());
        let chips: Vec<_> = interest_categories().collect();
        assert_eq!(chips.len(), 5);
        assert_eq!(chips[1], ("challenge_dance", vec!["dance", "challenge"]));
    }
}
