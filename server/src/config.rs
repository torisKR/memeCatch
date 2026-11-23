//! Runtime configuration, read once at startup from the environment.
//!
//! Names match the Next app (`docker-compose.yml`) so one `.env` serves both.
//! Compose passes unset optional values as empty strings, so an empty optional
//! value means "not set" unless noted otherwise.

use std::collections::HashSet;
use std::fmt;

use axum::http::uri::{Authority, Scheme, Uri};

const DEFAULT_PORT: u16 = 3000;
const DEFAULT_SITE_URL: &str = "https://catchmeme.com";
const DEFAULT_UPSTREAM_URL: &str = "http://127.0.0.1:3001";
const DEFAULT_DB_POOL_MAX: u32 = 4;
const DEFAULT_LOCAL_OBJECT_STORAGE_DIR: &str = "/tmp/memecatch-objects";

/// A value that must never reach logs. `Debug` prints a placeholder.
#[derive(Clone, PartialEq, Eq)]
pub struct Secret(String);

impl Secret {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Secret(***)")
    }
}

/// R2 is configured only when all four values are set, as in
/// `lib/object-storage.ts`. Otherwise storage falls back to the local directory.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct R2Config {
    pub account_id: String,
    pub access_key_id: String,
    pub secret_access_key: Secret,
    pub bucket: String,
}

#[derive(Clone, Debug)]
pub struct Config {
    /// `DATABASE_URL`. Holds the password, hence `Secret`.
    pub database_url: Secret,
    /// `PORT`, default 3000.
    pub port: u16,
    /// `RELEASE_SHA`, trimmed. `None` when unset or blank.
    pub release_sha: Option<String>,
    /// `NEXT_PUBLIC_SITE_URL`, default `https://catchmeme.com`.
    pub site_url: String,
    /// `NEXT_PUBLIC_SITE_URL` as given, `None` when unset. For code whose
    /// default is not `site_url`'s (`app/(default)/memes/random/route.ts`,
    /// `signedObjectUrl` in `lib/object-storage.ts`).
    pub site_url_env: Option<String>,
    /// `CSP_ENFORCE`: anything except the exact string `false` enforces.
    pub csp_enforce: bool,
    /// `CSP_REPORT_URI`. Unset: `<site_url>/api/csp-report`. Set but empty:
    /// `None`, reporting off. This one keeps the unset/empty distinction that
    /// `next.config.ts` has (`??`).
    pub csp_report_uri: Option<String>,
    /// `BETTER_AUTH_SECRET`, required (as in `docker-compose.yml`) and kept
    /// exactly as given: better-auth signs session cookies with the untouched
    /// value (`lib/auth/server.ts`). `lib/object-storage.ts` trims it for its
    /// fallback, and so does the storage module.
    pub better_auth_secret: Secret,
    /// better-auth's `useSecureCookies`, which the Next app sets from
    /// `NODE_ENV === "production"` (lib/auth/server.ts). It decides which
    /// session cookie name is read. Unset counts as production: a container
    /// that forgets `NODE_ENV` must not accept the unprefixed cookie.
    pub use_secure_cookies: bool,
    /// `CRON_SECRET` exactly as given; `None` when unset or empty. Four cron
    /// routes compare it untouched and one trims it first; the cron guards
    /// in `auth.rs` name them.
    pub cron_secret: Option<Secret>,
    /// `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
    pub r2: Option<R2Config>,
    /// `OBJECT_SIGNING_SECRET`, trimmed. The TS code falls back to
    /// `BETTER_AUTH_SECRET` when this is unset; that fallback belongs to the
    /// storage module.
    pub object_signing_secret: Option<Secret>,
    /// `LOCAL_OBJECT_STORAGE_DIR`, default `/tmp/memecatch-objects`.
    pub local_object_storage_dir: String,
    /// Host and port of `UPSTREAM_URL` (plain `http://host:port`), default
    /// `http://127.0.0.1:3001`.
    pub upstream: Authority,
    /// `AXUM_DB_POOL_MAX`, default 4: the size of the main pool. The deadline
    /// pool holds 2 more, so this server can open `AXUM_DB_POOL_MAX` + 2
    /// connections. Postgres allows 30 in total and the Next app, the worker
    /// and the backup share them.
    pub db_pool_max: u32,
    /// `AXUM_DISABLED_ROUTES`: comma-separated native route ids that are not
    /// registered, so their requests fall through to the upstream.
    pub disabled_routes: HashSet<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct ConfigError(String);

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "invalid configuration: {}", self.0)
    }
}

impl std::error::Error for ConfigError {}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|name| std::env::var(name).ok())
    }

    /// `lookup` returns the raw value of a variable, or `None` when it is unset.
    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        // Trimmed and non-empty, or None.
        let optional = |name: &str| {
            lookup(name)
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty())
        };

        let mut problems = Vec::new();
        let mut required = |name: &str| {
            optional(name).unwrap_or_else(|| {
                problems.push(format!("{name} is required"));
                String::new()
            })
        };
        let database_url = required("DATABASE_URL");
        // Kept as given: better-auth signs with the untouched value.
        let better_auth_secret = lookup("BETTER_AUTH_SECRET").unwrap_or_default();
        if better_auth_secret.trim().is_empty() {
            problems.push("BETTER_AUTH_SECRET is required".to_owned());
        }

        let port = match optional("PORT") {
            None => DEFAULT_PORT,
            Some(raw) => raw.parse().unwrap_or_else(|_| {
                problems.push(format!("PORT must be a port number, got {raw:?}"));
                DEFAULT_PORT
            }),
        };
        let db_pool_max = match optional("AXUM_DB_POOL_MAX") {
            None => DEFAULT_DB_POOL_MAX,
            Some(raw) => match raw.parse() {
                Ok(max) if max >= 1 => max,
                _ => {
                    problems.push(format!(
                        "AXUM_DB_POOL_MAX must be a positive integer, got {raw:?}"
                    ));
                    DEFAULT_DB_POOL_MAX
                }
            },
        };
        let upstream_url = optional("UPSTREAM_URL").unwrap_or_else(|| DEFAULT_UPSTREAM_URL.into());
        let upstream = parse_upstream(&upstream_url).unwrap_or_else(|| {
            problems.push(format!(
                "UPSTREAM_URL must look like http://host:port with no path, got {upstream_url:?}"
            ));
            Authority::from_static("127.0.0.1:3001")
        });

        if !problems.is_empty() {
            return Err(ConfigError(problems.join("; ")));
        }

        let site_url_env = lookup("NEXT_PUBLIC_SITE_URL");
        let site_url = site_url_env
            .clone()
            .unwrap_or_else(|| DEFAULT_SITE_URL.into());
        let csp_report_uri =
            lookup("CSP_REPORT_URI").unwrap_or_else(|| format!("{site_url}/api/csp-report"));
        let r2 = match (
            optional("R2_ACCOUNT_ID"),
            optional("R2_ACCESS_KEY_ID"),
            optional("R2_SECRET_ACCESS_KEY"),
            optional("R2_BUCKET"),
        ) {
            (Some(account_id), Some(access_key_id), Some(secret), Some(bucket)) => Some(R2Config {
                account_id,
                access_key_id,
                secret_access_key: Secret::new(secret),
                bucket,
            }),
            _ => None,
        };

        Ok(Self {
            database_url: Secret::new(database_url),
            port,
            release_sha: optional("RELEASE_SHA"),
            csp_enforce: lookup("CSP_ENFORCE").as_deref() != Some("false"),
            csp_report_uri: Some(csp_report_uri).filter(|uri| !uri.is_empty()),
            site_url,
            site_url_env,
            better_auth_secret: Secret::new(better_auth_secret),
            use_secure_cookies: optional("NODE_ENV").is_none_or(|mode| mode == "production"),
            cron_secret: lookup("CRON_SECRET")
                .filter(|secret| !secret.is_empty())
                .map(Secret::new),
            r2,
            object_signing_secret: optional("OBJECT_SIGNING_SECRET").map(Secret::new),
            local_object_storage_dir: optional("LOCAL_OBJECT_STORAGE_DIR")
                .unwrap_or_else(|| DEFAULT_LOCAL_OBJECT_STORAGE_DIR.into()),
            upstream,
            db_pool_max,
            disabled_routes: optional("AXUM_DISABLED_ROUTES")
                .map(|raw| {
                    raw.split(',')
                        .map(|id| id.trim().to_owned())
                        .filter(|id| !id.is_empty())
                        .collect()
                })
                .unwrap_or_default(),
        })
    }
}

/// The proxy speaks plain HTTP to a server on the same host or Docker network.
fn parse_upstream(raw: &str) -> Option<Authority> {
    let uri: Uri = raw.parse().ok()?;
    let has_path = !matches!(uri.path(), "" | "/") || uri.query().is_some();
    if uri.scheme() != Some(&Scheme::HTTP) || has_path {
        return None;
    }
    uri.authority().cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(vars: &[(&str, &str)]) -> Result<Config, ConfigError> {
        Config::from_lookup(|name| {
            vars.iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| (*value).to_owned())
        })
    }

    const REQUIRED: [(&str, &str); 2] = [
        (
            "DATABASE_URL",
            "postgresql://memecatch:pw@127.0.0.1:5432/memecatch",
        ),
        ("BETTER_AUTH_SECRET", "test-auth-secret"),
    ];

    fn with_required(extra: &[(&'static str, &'static str)]) -> Config {
        config(&[&REQUIRED[..], extra].concat()).expect("valid config")
    }

    #[test]
    fn applies_defaults_when_only_required_values_are_set() {
        let config = with_required(&[]);

        assert_eq!(config.port, 3000);
        assert_eq!(config.upstream.as_str(), "127.0.0.1:3001");
        assert_eq!(config.db_pool_max, 4);
        assert_eq!(config.site_url, "https://catchmeme.com");
        assert!(config.csp_enforce);
        assert_eq!(
            config.csp_report_uri.as_deref(),
            Some("https://catchmeme.com/api/csp-report")
        );
        assert_eq!(config.release_sha, None);
        assert_eq!(config.local_object_storage_dir, "/tmp/memecatch-objects");
        assert!(config.r2.is_none());
        assert!(config.cron_secret.is_none());
        assert!(config.disabled_routes.is_empty());
    }

    #[test]
    fn names_every_missing_required_value() {
        let error = config(&[("DATABASE_URL", "  ")]).unwrap_err().to_string();

        assert!(error.contains("DATABASE_URL is required"), "{error}");
        assert!(error.contains("BETTER_AUTH_SECRET is required"), "{error}");
    }

    #[test]
    fn rejects_bad_port_pool_size_and_upstream() {
        for (name, value) in [
            ("PORT", "http"),
            ("AXUM_DB_POOL_MAX", "0"),
            ("UPSTREAM_URL", "https://next:3001"),
            ("UPSTREAM_URL", "http://next:3001/base"),
            ("UPSTREAM_URL", "next:3001"),
        ] {
            let error = config(&[&REQUIRED[..], &[(name, value)]].concat())
                .unwrap_err()
                .to_string();
            assert!(error.contains(name), "{name}={value}: {error}");
        }
    }

    #[test]
    fn treats_empty_optional_values_from_compose_as_unset() {
        let config = with_required(&[
            ("PORT", ""),
            ("RELEASE_SHA", " "),
            ("CRON_SECRET", ""),
            ("R2_ACCOUNT_ID", ""),
            ("AXUM_DISABLED_ROUTES", ""),
            ("CSP_ENFORCE", ""),
        ]);

        assert_eq!(config.port, 3000);
        assert_eq!(config.release_sha, None);
        assert!(config.cron_secret.is_none());
        assert!(config.r2.is_none());
        assert!(config.disabled_routes.is_empty());
        assert!(config.csp_enforce);
    }

    #[test]
    fn empty_csp_report_uri_turns_reporting_off() {
        assert_eq!(
            with_required(&[("CSP_REPORT_URI", "")]).csp_report_uri,
            None
        );
    }

    #[test]
    fn only_the_exact_string_false_turns_enforcement_off() {
        assert!(!with_required(&[("CSP_ENFORCE", "false")]).csp_enforce);
        assert!(with_required(&[("CSP_ENFORCE", "FALSE")]).csp_enforce);
        assert!(with_required(&[("CSP_ENFORCE", "0")]).csp_enforce);
    }

    #[test]
    fn secure_cookies_are_off_only_when_node_env_names_another_mode() {
        assert!(with_required(&[]).use_secure_cookies);
        assert!(with_required(&[("NODE_ENV", "")]).use_secure_cookies);
        assert!(with_required(&[("NODE_ENV", "production")]).use_secure_cookies);
        assert!(!with_required(&[("NODE_ENV", "development")]).use_secure_cookies);
        assert!(!with_required(&[("NODE_ENV", "test")]).use_secure_cookies);
    }

    #[test]
    fn r2_needs_all_four_values() {
        let partial = with_required(&[("R2_ACCOUNT_ID", "acct"), ("R2_BUCKET", "bucket")]);
        let full = with_required(&[
            ("R2_ACCOUNT_ID", "acct"),
            ("R2_ACCESS_KEY_ID", "key"),
            ("R2_SECRET_ACCESS_KEY", "secret"),
            ("R2_BUCKET", "bucket"),
        ]);

        assert!(partial.r2.is_none());
        assert_eq!(full.r2.expect("r2 configured").bucket, "bucket");
    }

    #[test]
    fn parses_disabled_route_ids() {
        let config = with_required(&[("AXUM_DISABLED_ROUTES", "health, robots ,,")]);

        assert_eq!(config.disabled_routes.len(), 2);
        assert!(config.disabled_routes.contains("health"));
        assert!(config.disabled_routes.contains("robots"));
    }

    // lib/auth/server.ts:65 and four cron routes use the value untouched;
    // lib/object-storage.ts:22 trims.
    #[test]
    fn each_secret_is_kept_the_way_its_typescript_use_site_reads_it() {
        let database = (
            "DATABASE_URL",
            "postgresql://memecatch:pw@127.0.0.1:5432/memecatch",
        );
        let padded = config(&[
            database,
            ("BETTER_AUTH_SECRET", " \tpadded auth secret\n"),
            ("CRON_SECRET", " padded cron secret "),
            ("OBJECT_SIGNING_SECRET", " padded signing secret\n"),
        ])
        .expect("valid config");
        let blank = config(&[
            database,
            ("BETTER_AUTH_SECRET", "auth"),
            ("CRON_SECRET", "   "),
            ("OBJECT_SIGNING_SECRET", "   "),
        ])
        .expect("valid config");

        assert_eq!(
            padded.better_auth_secret.expose(),
            " \tpadded auth secret\n"
        );
        assert_eq!(
            padded.cron_secret.as_ref().map(Secret::expose),
            Some(" padded cron secret ")
        );
        assert_eq!(
            padded.object_signing_secret.as_ref().map(Secret::expose),
            Some("padded signing secret")
        );
        // `!secret` is false for a blank string that is not empty.
        assert_eq!(blank.cron_secret.as_ref().map(Secret::expose), Some("   "));
        assert_eq!(blank.object_signing_secret, None);
        assert_eq!(with_required(&[("CRON_SECRET", "")]).cron_secret, None);
        // A blank auth secret is still refused at startup.
        assert!(config(&[database, ("BETTER_AUTH_SECRET", " \t")]).is_err());
    }

    #[test]
    fn debug_output_hides_secret_values() {
        let config = with_required(&[
            ("CRON_SECRET", "cron-secret-value"),
            ("OBJECT_SIGNING_SECRET", "signing-secret-value"),
            ("R2_ACCOUNT_ID", "acct"),
            ("R2_ACCESS_KEY_ID", "key"),
            ("R2_SECRET_ACCESS_KEY", "r2-secret-value"),
            ("R2_BUCKET", "bucket"),
        ]);

        let debug = format!("{config:?}");

        for secret in [
            "pw@127.0.0.1",
            "test-auth-secret",
            "cron-secret-value",
            "signing-secret-value",
            "r2-secret-value",
        ] {
            assert!(!debug.contains(secret), "{secret} leaked into {debug}");
        }
    }
}
