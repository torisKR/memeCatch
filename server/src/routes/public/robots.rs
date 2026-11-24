//! `GET /robots.txt`: `app/robots.txt/route.ts` and `lib/robots.ts`.
//!
//! The text is rendered once at startup from `NEXT_PUBLIC_SITE_URL`.

use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};

const PRIVATE_PATHS: [&str; 7] = [
    "/admin", "/my", "/api/", "/go/", "/auth/", "/submit", "/login",
];
// SEO_CONTENT_LOCALES in lib/i18n-routing.ts.
const SEO_CONTENT_LOCALES: [&str; 4] = ["en", "ja", "zh", "zh-tw"];
const AI_CRAWLER_USER_AGENTS: [&str; 6] = [
    "GPTBot",
    "ClaudeBot",
    "Claude-Web",
    "PerplexityBot",
    "Google-Extended",
    "CCBot",
];
// Daum checks that this exact line is present. Do not change it.
const DAUM_WEBMASTER_VERIFICATION: &str = "#DaumWebMasterTool:4bdf39757ad941fd692decfa5a97dfd5b26f372c0690ffa5832b6d14d43a48d7:9OXzxfMP1b1VGCOsL/bJCQ==";

/// `renderRobotsTxt()` for a given raw `NEXT_PUBLIC_SITE_URL` (or its default).
pub fn render(site_url: &str) -> String {
    // SITE_URL in lib/site.ts: `.replace(/\/+$/, "")`.
    let site_url = site_url.trim_end_matches('/');
    // localizedPath(path, locale) is `/<locale><path>` for these paths: none
    // carries a locale prefix and none is "/".
    let disallowed: Vec<String> = PRIVATE_PATHS
        .iter()
        .map(|path| (*path).to_owned())
        .chain(SEO_CONTENT_LOCALES.iter().flat_map(|locale| {
            PRIVATE_PATHS
                .iter()
                .map(move |path| format!("/{locale}{path}"))
        }))
        .collect();

    let mut content = String::new();
    for user_agents in [&["*"][..], &AI_CRAWLER_USER_AGENTS[..]] {
        for agent in user_agents {
            content.push_str(&format!("User-Agent: {agent}\n"));
        }
        content.push_str("Allow: /\n");
        for path in &disallowed {
            content.push_str(&format!("Disallow: {path}\n"));
        }
        content.push('\n');
    }
    content.push_str(&format!("Sitemap: {site_url}/sitemap.xml\n"));
    content.push_str(&format!("\n{DAUM_WEBMASTER_VERIFICATION}\n"));
    content
}

pub fn response(body: String) -> Response {
    (
        [
            (CONTENT_TYPE, "text/plain; charset=utf-8"),
            // A static route that never changes.
            (CACHE_CONTROL, "s-maxage=31536000"),
        ],
        // Always a cache hit, as a prerendered route says.
        [("x-nextjs-cache", "HIT")],
        body,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    // The body for NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001.
    const FROM_NEXT: &str = include_str!("../../../tests/fixtures/robots.txt");

    #[test]
    fn renders_the_bytes_next_prerendered() {
        assert_eq!(render("http://127.0.0.1:3001"), FROM_NEXT);
    }

    #[test]
    fn site_url_loses_its_trailing_slashes_and_keeps_everything_else() {
        let production = FROM_NEXT.replace("http://127.0.0.1:3001", "https://catchmeme.com");

        assert_eq!(render("https://catchmeme.com"), production);
        assert_eq!(render("https://catchmeme.com///"), production);
        // An empty value is not the default: `??` keeps it.
        assert!(render("").contains("\nSitemap: /sitemap.xml\n"));
    }
}
