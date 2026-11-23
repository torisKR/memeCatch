//! Locale prefixes in paths: `lib/i18n-routing.ts` and `localeDestination`
//! of components/language-selector.tsx, for the frame's links and its
//! language switch. The tests are the TypeScript tests of the same names.

use url::Url;
use url::form_urlencoded;

use super::{DEFAULT_LOCALE, Locale};

/// `SEO_CONTENT_LOCALES`: languages with their own URLs.
pub const SEO_CONTENT_LOCALES: [&str; 4] = ["en", "ja", "zh", "zh-tw"];
/// `LOCALIZED_STATIC_PATHS`: pages that exist under every SEO prefix.
const LOCALIZED_STATIC_PATHS: [&str; 4] = ["/", "/search", "/explore", "/meme-cards"];
const PARSE_BASE: &str = "https://memecatch.test";

fn is_seo_content_locale(code: &str) -> bool {
    SEO_CONTENT_LOCALES.contains(&code)
}

/// `isSeoRouteLocale`: Korean or a language with its own URLs.
pub fn is_seo_route_locale(code: &str) -> bool {
    code == DEFAULT_LOCALE || is_seo_content_locale(code)
}

/// `splitPath`: the path, and its `?query#hash` as written.
fn split_path(value: &str) -> (String, &str) {
    let marker = value.find(['?', '#']).unwrap_or(value.len());
    let (raw, suffix) = value.split_at(marker);
    let pathname = if raw.is_empty() {
        "/".to_owned()
    } else if raw.starts_with('/') {
        raw.to_owned()
    } else {
        format!("/{raw}")
    };
    (pathname, suffix)
}

/// `parseLocalePath`: `/en/about?x=1` is `("en", "/about?x=1", true)`.
pub fn parse_locale_path(value: &str) -> (&'static str, String, bool) {
    let (pathname, suffix) = split_path(value);
    let mut segments = pathname.split('/').filter(|part| !part.is_empty());
    let first = segments.next().unwrap_or("");
    let Some(locale) = Locale::get(first).filter(|l| is_seo_route_locale(l.code())) else {
        return (DEFAULT_LOCALE, format!("{pathname}{suffix}"), false);
    };
    let rest: Vec<&str> = segments.collect();
    let stripped = if rest.is_empty() {
        "/".to_owned()
    } else {
        format!("/{}", rest.join("/"))
    };
    (locale.code(), format!("{stripped}{suffix}"), true)
}

fn strip_locale_path(value: &str) -> String {
    parse_locale_path(value).1
}

/// `stripSharePrefix`: `ar` is a share prefix, not an SEO route.
fn strip_share_prefix(value: &str) -> String {
    let (pathname, suffix) = split_path(value);
    let mut segments = pathname.split('/').filter(|part| !part.is_empty());
    if segments.next() != Some("ar") {
        return value.to_owned();
    }
    let rest: Vec<&str> = segments.collect();
    let stripped = if rest.is_empty() {
        "/".to_owned()
    } else {
        format!("/{}", rest.join("/"))
    };
    format!("{stripped}{suffix}")
}

/// `localizePath`: Korean unprefixed, any other language as the first segment.
fn localize_path(value: &str, code: &str) -> String {
    let unprefixed = strip_share_prefix(&strip_locale_path(value));
    let (pathname, suffix) = split_path(&unprefixed);
    if code == DEFAULT_LOCALE {
        return format!("{pathname}{suffix}");
    }
    if pathname == "/" {
        format!("/{code}{suffix}")
    } else {
        format!("/{code}{pathname}{suffix}")
    }
}

fn is_localized_static_path(value: &str) -> bool {
    let (pathname, _) = split_path(&strip_locale_path(value));
    LOCALIZED_STATIC_PATHS.contains(&pathname.as_str())
}

/// `localizedStaticPath`: a prefix only where that page exists in the language.
pub fn localized_static_path(value: &str, code: &str) -> String {
    let unprefixed = strip_locale_path(value);
    if is_seo_content_locale(code) && is_localized_static_path(&unprefixed) {
        localize_path(&unprefixed, code)
    } else {
        unprefixed
    }
}

/// `isHomePath` of the language selector, which then offers only the
/// languages that have a home page.
pub fn is_home_path(pathname: &str) -> bool {
    let path = parse_locale_path(pathname).1;
    path == "/" || path == "/index"
}

/// `withoutLangQuery`: what `URLSearchParams.delete("lang")` leaves, which
/// also rewrites the rest of the query in its own encoding.
fn without_lang_query(value: &str) -> String {
    let Ok(mut url) = Url::parse(PARSE_BASE).and_then(|base| base.join(value)) else {
        return value.to_owned();
    };
    if url.query().is_some() {
        let kept: Vec<(String, String)> = url
            .query_pairs()
            .filter(|(key, _)| key != "lang")
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
        let query = form_urlencoded::Serializer::new(String::new())
            .extend_pairs(kept)
            .finish();
        url.set_query((!query.is_empty()).then_some(query.as_str()));
    }
    let mut out = url.path().to_owned();
    if let Some(query) = url.query() {
        out.push('?');
        out.push_str(query);
    }
    if let Some(hash) = url.fragment() {
        out.push('#');
        out.push_str(hash);
    }
    out
}

fn rankings_destination(value: &str, code: &str) -> Option<String> {
    let marker = value.find(['?', '#']).unwrap_or(value.len());
    let (raw, suffix) = value.split_at(marker);
    let parts: Vec<&str> = raw.split('/').filter(|part| !part.is_empty()).collect();
    let on_rankings = parts == ["rankings"]
        || (parts.len() == 2
            && parts[1] == "rankings"
            && parts[0] != DEFAULT_LOCALE
            && Locale::get(parts[0]).is_some());
    on_rankings.then(|| {
        if code == DEFAULT_LOCALE {
            format!("/rankings{suffix}")
        } else {
            format!("/{code}/rankings{suffix}")
        }
    })
}

/// `localeDestination`: where choosing `code` on `path_and_query` goes, or
/// `None` when the frame changes language in place.
pub fn locale_destination(path_and_query: &str, code: &str) -> Option<String> {
    let without_lang = without_lang_query(path_and_query);
    if let Some(rankings) = rankings_destination(&without_lang, code) {
        return Some(rankings);
    }
    let (_, pathname, had_prefix) = parse_locale_path(&without_lang);
    if !is_seo_content_locale(code) && code != DEFAULT_LOCALE {
        return (had_prefix || without_lang != path_and_query).then_some(pathname);
    }
    if code == DEFAULT_LOCALE {
        return Some(pathname);
    }
    if is_localized_static_path(&pathname) {
        return Some(localized_static_path(&pathname, code));
    }
    Some(localize_path("/", code))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dest(path: &str, code: &str) -> Option<String> {
        locale_destination(path, code)
    }

    #[test]
    fn sends_a_global_switch_to_the_guaranteed_home() {
        assert_eq!(
            dest("/memes/abc-original-slug", "en").as_deref(),
            Some("/en")
        );
        assert_eq!(
            dest("/en/memes/abc-translated-slug", "ja").as_deref(),
            Some("/ja")
        );
        assert_eq!(
            dest("/ja/memes/abc-translated-slug", "zh-tw").as_deref(),
            Some("/zh-tw")
        );
        assert_eq!(
            dest("/en/memes/abc-translated-slug", "ko").as_deref(),
            Some("/memes/abc-translated-slug")
        );
        assert_eq!(dest("/pricing", "en").as_deref(), Some("/en"));
    }

    #[test]
    fn keeps_queries_and_drops_an_obsolete_lang() {
        assert_eq!(
            dest("/en/search?q=%EC%9B%90%EC%98%81", "ja").as_deref(),
            Some("/ja/search?q=%EC%9B%90%EC%98%81")
        );
        assert_eq!(
            dest("/search?q=%EC%9B%90%EC%98%81", "en").as_deref(),
            Some("/en/search?q=%EC%9B%90%EC%98%81")
        );
        assert_eq!(dest("/?lang=ko", "en").as_deref(), Some("/en"));
        assert_eq!(
            dest("/?campaign=fall&lang=ko&q=memes", "en").as_deref(),
            Some("/en?campaign=fall&q=memes")
        );
        assert_eq!(
            dest("/products?tab=saved&lang=ko", "th").as_deref(),
            Some("/products?tab=saved")
        );
    }

    #[test]
    fn homes_static_pages_and_ui_only_languages() {
        assert_eq!(dest("/", "en").as_deref(), Some("/en"));
        assert_eq!(dest("/ja", "zh").as_deref(), Some("/zh"));
        assert_eq!(dest("/zh-tw", "ko").as_deref(), Some("/"));
        assert_eq!(dest("/explore", "ko").as_deref(), Some("/explore"));
        assert_eq!(dest("/meme-cards", "en").as_deref(), Some("/en/meme-cards"));
        assert_eq!(dest("/en/meme-cards", "ko").as_deref(), Some("/meme-cards"));
        assert_eq!(dest("/products", "th"), None);
        assert_eq!(dest("/about", "ar"), None);
        assert_eq!(
            dest("/en/memes/abc-translated-slug", "vi").as_deref(),
            Some("/memes/abc-translated-slug")
        );
        // A query in another encoding is rewritten, so the switch navigates.
        assert_eq!(
            dest("/about?x=a%20b", "ar").as_deref(),
            Some("/about?x=a+b")
        );
    }

    #[test]
    fn stays_on_rankings_for_every_supported_locale() {
        for locale in Locale::all() {
            let code = locale.code();
            let expected = if code == "ko" {
                "/rankings".to_owned()
            } else {
                format!("/{code}/rankings")
            };
            for from in [
                "/rankings",
                "/en/rankings",
                "/zh-tw/rankings",
                "/ar/rankings",
            ] {
                assert_eq!(dest(from, code), Some(expected.clone()), "{from} {code}");
            }
            assert_eq!(
                dest("/th/rankings?from=menu", code),
                Some(format!("{expected}?from=menu"))
            );
        }
    }

    #[test]
    fn static_paths_and_homes() {
        assert_eq!(localized_static_path("/", "en"), "/en");
        assert_eq!(localized_static_path("/search", "ja"), "/ja/search");
        assert_eq!(localized_static_path("/search", "ar"), "/search");
        assert_eq!(
            localized_static_path("/explore?sort=recent", "zh"),
            "/zh/explore?sort=recent"
        );
        assert_eq!(localized_static_path("/en/about", "ko"), "/about");
        assert!(is_home_path("/"));
        assert!(is_home_path("/en"));
        assert!(!is_home_path("/about"));
    }
}
