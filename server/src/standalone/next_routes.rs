//! Next's route table (`next_routes.json`, written from `app/` by
//! `scripts/next-routes.mjs`) and the route Next would pick for a path.

use std::sync::LazyLock;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct NextRoute {
    /// As in `app/`, without route groups: `/memes/[key]`.
    pub path: String,
    pub kind: Kind,
    /// The methods a route handler exports; `["GET"]` for a page.
    pub methods: Vec<String>,
    /// Prerendered by `next build`: another method gets the static 405.
    #[serde(rename = "static")]
    pub is_static: bool,
}

#[derive(Debug, Deserialize, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Page,
    Route,
}

static ROUTES: LazyLock<Vec<NextRoute>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("next_routes.json")).expect("next_routes.json is valid")
});

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
enum Rank {
    Static,
    Dynamic,
    CatchAll,
    OptionalCatchAll,
}

fn rank(segment: &str) -> Rank {
    if segment.starts_with("[[...") {
        Rank::OptionalCatchAll
    } else if segment.starts_with("[...") {
        Rank::CatchAll
    } else if segment.starts_with('[') {
        Rank::Dynamic
    } else {
        Rank::Static
    }
}

fn segments(path: &str) -> Vec<&str> {
    path.split('/').filter(|part| !part.is_empty()).collect()
}

fn matches(pattern: &[&str], parts: &[&str]) -> bool {
    match (pattern.first(), parts.first()) {
        (None, None) => true,
        (Some(segment), _) if rank(segment) == Rank::OptionalCatchAll => true,
        (Some(segment), Some(_)) if rank(segment) == Rank::CatchAll => true,
        (Some(segment), Some(part)) => {
            let fits = rank(segment) == Rank::Dynamic || segment == part;
            fits && matches(&pattern[1..], &parts[1..])
        }
        _ => false,
    }
}

/// The route Next routes `path` to (percent-encoded, as received). Static
/// segments win over dynamic ones, dynamic over catch-all, from the left.
pub fn find(path: &str) -> Option<&'static NextRoute> {
    let parts = segments(path);
    ROUTES
        .iter()
        .filter(|route| matches(&segments(&route.path), &parts))
        .min_by_key(|route| {
            segments(&route.path)
                .iter()
                .map(|segment| rank(segment))
                .collect::<Vec<_>>()
        })
}

impl NextRoute {
    /// Answers `method` itself (`HEAD` with `GET`, as Next adds it).
    pub fn allows(&self, method: &str) -> bool {
        self.methods.iter().any(|allowed| allowed == method)
            || (method == "HEAD" && self.methods.iter().any(|allowed| allowed == "GET"))
    }

    /// Under `app/[locale]`: the first segment must be an SEO locale, or the
    /// layout answers 404.
    pub fn under_locale(&self) -> bool {
        self.path.starts_with("/[locale]")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn route_of(path: &str) -> Option<&'static str> {
        find(path).map(|route| route.path.as_str())
    }

    #[test]
    fn static_segments_win_over_dynamic_ones() {
        assert_eq!(route_of("/"), Some("/"));
        assert_eq!(route_of("/about"), Some("/about"));
        assert_eq!(route_of("/nope"), Some("/[locale]"));
        assert_eq!(route_of("/memes/random"), Some("/memes/random"));
        assert_eq!(route_of("/memes/abc-x"), Some("/memes/[key]"));
        assert_eq!(route_of("/en/memes/abc-x"), Some("/[locale]/memes/[key]"));
        assert_eq!(
            route_of("/api/auth/sign-in/email"),
            Some("/api/auth/[...all]")
        );
        assert_eq!(
            route_of("/api/creator-products"),
            Some("/api/creator-products/[[...slug]]")
        );
        assert_eq!(
            route_of("/api/media/a/b/c.png"),
            Some("/api/media/[...path]")
        );
        assert_eq!(route_of("/a/b"), None);
        assert_eq!(route_of("/api/nope"), None);
        assert_eq!(route_of("/en/rankings"), None);
    }

    #[test]
    fn methods_come_from_the_exports() {
        let health = find("/api/health").unwrap();
        assert!(health.allows("GET") && health.allows("HEAD"));
        assert!(!health.allows("POST"));
        assert!(find("/robots.txt").unwrap().is_static);
        assert_eq!(find("/about").unwrap().kind, Kind::Page);
        assert!(find("/en").unwrap().under_locale());
    }
}
