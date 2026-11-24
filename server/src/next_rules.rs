//! Rules by path that apply before any route runs: which paths the sign-in
//! gate and the locale rules see (the `proxy.ts` matcher), and the
//! `Cache-Control` the site gives some paths whatever answers them.

/// The file name endings the first `proxy.ts` matcher skips.
const SKIPPED_ENDINGS: [&str; 10] = [
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".xml",
    ".txt",
    ".webmanifest",
];

/// Ends in a name the first `proxy.ts` matcher skips (case-sensitive, as
/// its regular expression is).
pub fn has_skipped_ending(path: &str) -> bool {
    SKIPPED_ENDINGS.iter().any(|ending| path.ends_with(ending))
}

/// The first `proxy.ts` matcher (apex host):
/// `/((?!api|auth|_next/static|_next/image|favicon.ico|.*\.(?:…)$).*)`.
/// The lookahead tests prefixes, so `/apix` and `/authors` are skipped too.
pub fn proxy_matches(path: &str) -> bool {
    let rest = path.strip_prefix('/').unwrap_or(path);
    let skipped_prefix = ["api", "auth", "_next/static", "_next/image", "favicon.ico"]
        .iter()
        .any(|prefix| rest.starts_with(prefix));
    !skipped_prefix && !has_skipped_ending(path)
}

const IMAGE_CACHE: &str = "public, max-age=2592000, stale-while-revalidate=86400";
const BRAND_CACHE: &str = "public, max-age=31536000, stale-while-revalidate=86400";
const SITEMAP_CACHE: &str = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/// The `Cache-Control` a `next.config.ts` `headers()` entry gives `path`,
/// the last matching entry winning. Paths match without regard to case, and
/// the value applies to whatever answers the path, a 404 included.
pub fn config_cache_control(path: &str) -> Option<&'static str> {
    let path = path.to_ascii_lowercase();
    // `/brand/:path*`: the parameter may be empty, so `/brand` matches too.
    let under = |folder: &str| {
        path.strip_prefix(folder)
            .is_some_and(|rest| rest.is_empty() || rest.starts_with('/'))
    };
    if under("/brand") || under("/icons") {
        return Some(BRAND_CACHE);
    }
    if path == "/sitemap.xml" {
        return Some(SITEMAP_CACHE);
    }
    // `/:path*\.(svg|png|…)`: the extension must follow a non-empty path.
    const IMAGE_EXTENSIONS: [&str; 8] =
        ["svg", "png", "jpg", "jpeg", "webp", "avif", "ico", "woff2"];
    let (stem, extension) = path.rsplit_once('.')?;
    let has_name = stem.len() > 1;
    (has_name && IMAGE_EXTENSIONS.contains(&extension)).then_some(IMAGE_CACHE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_matcher_skips_api_auth_next_assets_and_file_names() {
        assert!(proxy_matches("/"));
        assert!(proxy_matches("/about"));
        assert!(proxy_matches("/sw.js"));
        assert!(proxy_matches("/brand/hero.avif"));
        assert!(proxy_matches("/a.PNG"));
        assert!(!proxy_matches("/api/health"));
        assert!(!proxy_matches("/apix"));
        assert!(!proxy_matches("/authors"));
        assert!(!proxy_matches("/_next/static/x.js"));
        assert!(!proxy_matches("/favicon.ico"));
        assert!(!proxy_matches("/ads.txt"));
        assert!(!proxy_matches("/feed.xml"));
        assert!(!proxy_matches("/manifest.webmanifest"));
    }

    #[test]
    fn cache_control_follows_the_last_matching_entry() {
        assert_eq!(
            config_cache_control("/icons/icon-192.png"),
            Some(BRAND_CACHE)
        );
        assert_eq!(config_cache_control("/brand/x.txt"), Some(BRAND_CACHE));
        assert_eq!(config_cache_control("/icons"), Some(BRAND_CACHE));
        assert_eq!(config_cache_control("/Brand/x"), Some(BRAND_CACHE));
        assert_eq!(config_cache_control("/brandx"), None);
        assert_eq!(config_cache_control("/nope.png"), Some(IMAGE_CACHE));
        assert_eq!(config_cache_control("/a/b.avif"), Some(IMAGE_CACHE));
        assert_eq!(config_cache_control("/favicon.ico"), Some(IMAGE_CACHE));
        assert_eq!(config_cache_control("/.png"), None);
        assert_eq!(config_cache_control("/X.PNG"), Some(IMAGE_CACHE));
        assert_eq!(config_cache_control("/ads.txt"), None);
        assert_eq!(config_cache_control("/sitemap.xml"), Some(SITEMAP_CACHE));
    }
}
