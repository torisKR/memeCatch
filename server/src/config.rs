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
#[derive(Clone, Default, PartialEq, Eq)]
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

/// What `POST /api/admin/meme-studio` reads from the environment, as the
/// TypeScript and the AWS SDK read it (lib/meme-studio-bedrock.server.ts).
/// Values are kept as given: the route checks them per request, as the
/// TypeScript does.
#[derive(Clone, Debug, Default)]
pub struct BedrockStudioConfig {
    /// `BEDROCK_MEME_STUDIO_ENABLED === "true"`.
    pub enabled: bool,
    /// `BEDROCK_MEME_STUDIO_INPUT_NANO_USD_PER_TOKEN` and the output rate.
    pub input_rate: Option<String>,
    pub output_rate: Option<String>,
    /// `AWS_REGION?.trim()`, empty as unset.
    pub region: Option<String>,
    /// The SDK's environment credentials: both keys non-empty, and the
    /// session token when set. No other credential source is read.
    pub access_key_id: Option<String>,
    pub secret_access_key: Option<Secret>,
    pub session_token: Option<Secret>,
    /// `AWS_ENDPOINT_URL_BEDROCK_RUNTIME`, else `AWS_ENDPOINT_URL`, as the
    /// SDK reads them; unset is `https://bedrock-runtime.<region>.amazonaws.com`.
    pub endpoint_url: Option<String>,
}

/// The variables the OpenRouter calls read: the meme chat
/// (lib/meme-chat.server.ts) and the MPE evidence draft
/// (lib/mpe/openrouter.server.ts). Kept as given; each route checks them as
/// its TypeScript does.
#[derive(Clone, Debug, Default)]
pub struct OpenRouterConfig {
    /// `OPENROUTER_API_KEY` as set (each route trims it).
    pub api_key: Option<Secret>,
    /// `OPENROUTER_BASE_URL` as set.
    pub base_url: Option<String>,
    /// `OPENROUTER_MPE_MODEL` as set.
    pub mpe_model: Option<String>,
    /// `MEME_CHAT_GENERATION_ENABLED` as set.
    pub chat_generation: Option<String>,
    /// `MEME_CHAT_PROVIDER` as set.
    pub chat_provider: Option<String>,
    /// For tests only: `AXUM_TEST_OPENROUTER_ORIGIN`, an
    /// `http://127.0.0.1:<port>` or `http://localhost:<port>` that receives
    /// the requests meant for `https://openrouter.ai`. Nothing else is taken,
    /// so it cannot send them to another host.
    pub test_origin: Option<String>,
}

/// A loopback `http://host:port` with nothing after it, as written.
fn loopback_origin(raw: &str) -> Option<String> {
    let url = url::Url::parse(raw).ok()?;
    let loopback = matches!(url.host_str(), Some("127.0.0.1" | "localhost"));
    let bare = url.path() == "/" && url.query().is_none() && url.fragment().is_none();
    (url.scheme() == "http"
        && loopback
        && url.port().is_some()
        && bare
        && url.username().is_empty())
    .then(|| url.origin().ascii_serialization())
}

/// The radar connectors of `lib/trend/radar-platform-connectors.server.ts`,
/// each variable exactly as the environment holds it: the TypeScript trims
/// some and splits others untrimmed.
#[derive(Clone, Debug, Default)]
pub struct RadarConfig {
    pub x_terms: Option<String>,
    pub x_bearer_token: Option<Secret>,
    pub threads_terms: Option<String>,
    pub threads_access_token: Option<Secret>,
    pub instagram_hashtags: Option<String>,
    pub instagram_access_token: Option<Secret>,
    pub instagram_user_id: Option<String>,
    pub graph_api_version: Option<String>,
    /// For tests only: `AXUM_TEST_RADAR_ORIGIN`, a loopback `http://host:port`
    /// that receives the requests meant for `https://api.x.com`,
    /// `https://graph.threads.com` and `https://graph.facebook.com`, under
    /// `/<host>/<path>`.
    pub test_origin: Option<String>,
}

/// The variables the ChatGPT connector routes read (routes/mcp.rs), as set.
#[derive(Clone, Debug, Default)]
pub struct McpConfig {
    /// `MCP_EVENT_RETRY_TOKEN`: a second bearer for the retry cron.
    pub retry_token: Option<String>,
    /// `MCP_GITHUB_WEBHOOK_SECRET`: the GitHub webhook signing secret.
    pub github_secret: Option<String>,
    /// `MCP_EVENT_STATE_KEY`, only to know whether it is set: with it the
    /// stateful routes stay with Next.
    pub state_key: Option<String>,
    /// For tests only: `AXUM_TEST_MCP_ORIGIN`, a loopback `http://host:port`
    /// that receives the requests meant for `https://catchmeme.com` and
    /// `https://chatgpt.com`.
    pub test_origin: Option<String>,
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
    /// that forgets `NODE_ENV` must not accept the unprefixed cookie. Always
    /// equal to `node_env_production`.
    pub use_secure_cookies: bool,
    /// `CRON_SECRET` exactly as given; `None` when unset or empty. Four cron
    /// routes compare it untouched and one trims it first; the cron guards
    /// in `auth.rs` name them.
    pub cron_secret: Option<Secret>,
    /// `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
    pub r2: Option<R2Config>,
    pub bedrock_studio: BedrockStudioConfig,
    pub openrouter: OpenRouterConfig,
    pub mcp: McpConfig,
    /// `MEME_SEMANTIC_SEARCH_ENABLED === "true"`.
    pub semantic_search_enabled: bool,
    /// `MEME_EMBEDDING_URL` as given.
    pub embedding_url: Option<String>,
    /// `OBJECT_SIGNING_SECRET`, trimmed. The TS code falls back to
    /// `BETTER_AUTH_SECRET` when this is unset; that fallback belongs to the
    /// storage module.
    pub object_signing_secret: Option<Secret>,
    /// `LOCAL_OBJECT_STORAGE_DIR`, default `/tmp/memecatch-objects`.
    pub local_object_storage_dir: String,
    /// `MEMECATCH_SIGNING_SECRET`, trimmed; `None` when unset or blank
    /// (`signingSecret()` in `lib/auth/signing-secret.ts`). It keys the view
    /// counter and the analytics session cookie. The routes that need it are
    /// registered only when it is set (`routes/tracking.rs`).
    pub signing_secret: Option<Secret>,
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
    /// `AXUM_PILOT_ROUTES`: comma-separated ids of the page routes to switch
    /// on (`routes::PAGE_ROUTE_IDS`). The switch of every page, under its
    /// first name: docker-compose.axum.yml passes it by that name. A page is registered only when named
    /// here, and `AXUM_DISABLED_ROUTES` still wins.
    pub page_routes: HashSet<String>,
    /// `NEXT_PUBLIC_GA_ID`: the Google Analytics tag native pages load. Next
    /// fixes it at build time; give Axum the value the Next image was built
    /// with. `None` loads no analytics.
    pub ga_id: Option<String>,
    /// `NEXT_PUBLIC_ADSENSE_CLIENT`: the `google-adsense-account` meta of
    /// native pages, and the client of the ad loader. Also a Next build value.
    pub adsense_client: Option<String>,
    /// `ADSENSE_AUTO_ADS_ENABLED` is exactly `true` and `NODE_ENV` is exactly
    /// `production`, the two runtime conditions of `components/adsense-script.tsx`.
    pub adsense_auto_ads: bool,
    /// `BETTER_AUTH_URL`, trimmed; `None` when unset or blank. better-auth's
    /// `baseURL` is this or `SITE_URL` (lib/auth/server.ts:64), and its origin
    /// is a trusted origin of the sign-out check.
    pub better_auth_url: Option<String>,
    /// `AUTH_EMAIL_WEBHOOK?.trim()`, unset when empty: where the
    /// verification and reset mail is posted (lib/auth/server.ts).
    pub auth_email_webhook: Option<String>,
    /// `BETTER_AUTH_TRUSTED_ORIGINS` split on `,` as better-auth splits it
    /// (dist/context/helpers.mjs:83-84), untrimmed, empty entries dropped.
    pub better_auth_trusted_origins: Vec<String>,
    /// better-auth's `isProduction`, which turns its rate limiter on
    /// (dist/context/create-context.mjs:172). `NODE_ENV` is `production` or
    /// unset, the same reading as `use_secure_cookies`: the production Next
    /// build fixes `NODE_ENV`, so its cookies and its limiter never disagree.
    pub node_env_production: bool,
    /// The saved-state email delivery of `lib/trend/outbox.server.ts`.
    pub saved_state_email: SavedStateEmail,
    /// `AXUM_EXTRA_CA_CERTS`: a PEM file of root certificates that outbound
    /// HTTPS trusts besides the Mozilla roots compiled in. The Axum
    /// counterpart of `NODE_EXTRA_CA_CERTS`, for a provider behind a private
    /// CA or a test stub. `None`, the production case, trusts only the roots.
    pub extra_ca_certs: Option<String>,
    /// The connectors `/api/cron/trend-pulse` collects from.
    pub radar: RadarConfig,
    /// For tests only: `AXUM_TEST_OG_ORIGIN`, a loopback `http://host:port`
    /// that receives the share cards' requests for `https://i.ytimg.com`,
    /// under `/i.ytimg.com/<path>`.
    pub og_test_origin: Option<String>,
}

/// `PLUS_DIGEST_DELIVERY_URL`, `PLUS_DIGEST_DELIVERY_TOKEN` and
/// `PLUS_DIGEST_FROM_EMAIL` exactly as the environment holds them (empty when
/// unset). `runSavedStateChangeEmails` reads them untrimmed and treats an
/// empty value as unset.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct SavedStateEmail {
    pub delivery_url: String,
    pub delivery_token: Secret,
    pub from_email: String,
}

/// A comma-separated list of route ids. Blank entries are dropped.
fn id_list(raw: Option<String>) -> HashSet<String> {
    raw.map(|raw| {
        raw.split(',')
            .map(|id| id.trim().to_owned())
            .filter(|id| !id.is_empty())
            .collect()
    })
    .unwrap_or_default()
}

fn bedrock_studio(lookup: &impl Fn(&str) -> Option<String>) -> BedrockStudioConfig {
    let set = |name: &str| lookup(name).filter(|value| !value.is_empty());
    BedrockStudioConfig {
        enabled: lookup("BEDROCK_MEME_STUDIO_ENABLED").as_deref() == Some("true"),
        input_rate: lookup("BEDROCK_MEME_STUDIO_INPUT_NANO_USD_PER_TOKEN"),
        output_rate: lookup("BEDROCK_MEME_STUDIO_OUTPUT_NANO_USD_PER_TOKEN"),
        region: lookup("AWS_REGION")
            .map(|region| region.trim().to_owned())
            .filter(|region| !region.is_empty()),
        access_key_id: set("AWS_ACCESS_KEY_ID"),
        secret_access_key: set("AWS_SECRET_ACCESS_KEY").map(Secret::new),
        session_token: set("AWS_SESSION_TOKEN").map(Secret::new),
        endpoint_url: set("AWS_ENDPOINT_URL_BEDROCK_RUNTIME").or_else(|| set("AWS_ENDPOINT_URL")),
    }
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

        let test_origin = optional("AXUM_TEST_OPENROUTER_ORIGIN");
        let openrouter_test_origin = test_origin.as_deref().and_then(loopback_origin);
        if let (Some(raw), None) = (&test_origin, &openrouter_test_origin) {
            problems.push(format!(
                "AXUM_TEST_OPENROUTER_ORIGIN must be http://127.0.0.1:<port> or http://localhost:<port>, got {raw:?}"
            ));
        }

        let radar_test = optional("AXUM_TEST_RADAR_ORIGIN");
        let radar_test_origin = radar_test.as_deref().and_then(loopback_origin);
        if let (Some(raw), None) = (&radar_test, &radar_test_origin) {
            problems.push(format!(
                "AXUM_TEST_RADAR_ORIGIN must be http://127.0.0.1:<port> or http://localhost:<port>, got {raw:?}"
            ));
        }

        let og_test = optional("AXUM_TEST_OG_ORIGIN");
        let og_test_origin = og_test.as_deref().and_then(loopback_origin);
        if let (Some(raw), None) = (&og_test, &og_test_origin) {
            problems.push(format!(
                "AXUM_TEST_OG_ORIGIN must be http://127.0.0.1:<port> or http://localhost:<port>, got {raw:?}"
            ));
        }

        let mcp_origin = optional("AXUM_TEST_MCP_ORIGIN");
        let mcp_test_origin = mcp_origin.as_deref().and_then(loopback_origin);
        if let (Some(raw), None) = (&mcp_origin, &mcp_test_origin) {
            problems.push(format!(
                "AXUM_TEST_MCP_ORIGIN must be http://127.0.0.1:<port> or http://localhost:<port>, got {raw:?}"
            ));
        }

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

        // `NODE_ENV === "production"` as the production Next build sees it:
        // the build fixes it, so unset counts as production.
        let production = optional("NODE_ENV").is_none_or(|mode| mode == "production");

        Ok(Self {
            database_url: Secret::new(database_url),
            port,
            release_sha: optional("RELEASE_SHA"),
            csp_enforce: lookup("CSP_ENFORCE").as_deref() != Some("false"),
            csp_report_uri: Some(csp_report_uri).filter(|uri| !uri.is_empty()),
            site_url,
            site_url_env,
            better_auth_secret: Secret::new(better_auth_secret),
            use_secure_cookies: production,
            cron_secret: lookup("CRON_SECRET")
                .filter(|secret| !secret.is_empty())
                .map(Secret::new),
            r2,
            bedrock_studio: bedrock_studio(&lookup),
            openrouter: OpenRouterConfig {
                api_key: lookup("OPENROUTER_API_KEY").map(Secret::new),
                base_url: lookup("OPENROUTER_BASE_URL"),
                mpe_model: lookup("OPENROUTER_MPE_MODEL"),
                chat_generation: lookup("MEME_CHAT_GENERATION_ENABLED"),
                chat_provider: lookup("MEME_CHAT_PROVIDER"),
                test_origin: openrouter_test_origin,
            },
            mcp: McpConfig {
                retry_token: lookup("MCP_EVENT_RETRY_TOKEN"),
                github_secret: lookup("MCP_GITHUB_WEBHOOK_SECRET"),
                state_key: lookup("MCP_EVENT_STATE_KEY"),
                test_origin: mcp_test_origin,
            },
            semantic_search_enabled: lookup("MEME_SEMANTIC_SEARCH_ENABLED").as_deref()
                == Some("true"),
            embedding_url: lookup("MEME_EMBEDDING_URL").filter(|url| !url.is_empty()),
            object_signing_secret: optional("OBJECT_SIGNING_SECRET").map(Secret::new),
            local_object_storage_dir: optional("LOCAL_OBJECT_STORAGE_DIR")
                .unwrap_or_else(|| DEFAULT_LOCAL_OBJECT_STORAGE_DIR.into()),
            signing_secret: optional("MEMECATCH_SIGNING_SECRET").map(Secret::new),
            upstream,
            db_pool_max,
            disabled_routes: id_list(optional("AXUM_DISABLED_ROUTES")),
            page_routes: id_list(optional("AXUM_PILOT_ROUTES")),
            ga_id: optional("NEXT_PUBLIC_GA_ID"),
            adsense_client: optional("NEXT_PUBLIC_ADSENSE_CLIENT"),
            adsense_auto_ads: lookup("ADSENSE_AUTO_ADS_ENABLED").as_deref() == Some("true")
                && lookup("NODE_ENV").as_deref() == Some("production"),
            better_auth_url: optional("BETTER_AUTH_URL"),
            auth_email_webhook: optional("AUTH_EMAIL_WEBHOOK"),
            better_auth_trusted_origins: lookup("BETTER_AUTH_TRUSTED_ORIGINS")
                .map(|raw| {
                    raw.split(',')
                        .filter(|entry| !entry.is_empty())
                        .map(str::to_owned)
                        .collect()
                })
                .unwrap_or_default(),
            node_env_production: production,
            saved_state_email: SavedStateEmail {
                delivery_url: lookup("PLUS_DIGEST_DELIVERY_URL").unwrap_or_default(),
                delivery_token: Secret::new(
                    lookup("PLUS_DIGEST_DELIVERY_TOKEN").unwrap_or_default(),
                ),
                from_email: lookup("PLUS_DIGEST_FROM_EMAIL").unwrap_or_default(),
            },
            extra_ca_certs: optional("AXUM_EXTRA_CA_CERTS"),
            radar: RadarConfig {
                x_terms: lookup("RADAR_X_TERMS"),
                x_bearer_token: lookup("X_API_BEARER_TOKEN").map(Secret::new),
                threads_terms: lookup("RADAR_THREADS_TERMS"),
                threads_access_token: lookup("THREADS_ACCESS_TOKEN").map(Secret::new),
                instagram_hashtags: lookup("RADAR_INSTAGRAM_HASHTAGS"),
                instagram_access_token: lookup("META_INSTAGRAM_ACCESS_TOKEN").map(Secret::new),
                instagram_user_id: lookup("META_INSTAGRAM_USER_ID"),
                graph_api_version: lookup("META_GRAPH_API_VERSION"),
                test_origin: radar_test_origin,
            },
            og_test_origin,
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
        assert!(config.signing_secret.is_none());
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

    // The production Next build fixes `NODE_ENV` to `production`, which turns
    // on both the `__Secure-` cookie names and better-auth's limiter.
    #[test]
    fn the_cookie_names_and_the_limiter_follow_one_node_env_reading() {
        for (vars, production) in [
            (&[][..], true),
            (&[("NODE_ENV", "")][..], true),
            (&[("NODE_ENV", "production")][..], true),
            (&[("NODE_ENV", "development")][..], false),
            (&[("NODE_ENV", "test")][..], false),
        ] {
            let config = with_required(vars);
            assert_eq!(config.use_secure_cookies, production, "{vars:?}");
            assert_eq!(config.node_env_production, production, "{vars:?}");
        }
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
    fn the_openrouter_test_origin_must_be_a_loopback_origin() {
        let with = |origin: &str| {
            let mut vars = REQUIRED.to_vec();
            vars.push(("AXUM_TEST_OPENROUTER_ORIGIN", origin));
            config(&vars)
        };
        let accepted = with("http://127.0.0.1:3530/").expect("a loopback origin");
        assert_eq!(
            accepted.openrouter.test_origin.as_deref(),
            Some("http://127.0.0.1:3530")
        );
        assert!(with("http://localhost:9").is_ok());
        for refused in [
            "https://127.0.0.1:3530",
            "http://example.com:80",
            "http://127.0.0.1",
            "http://127.0.0.1:1/x",
            "nope",
        ] {
            assert!(with(refused).is_err(), "{refused}");
        }
        assert_eq!(
            config(&REQUIRED).expect("valid").openrouter.test_origin,
            None
        );
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
            ("MEMECATCH_SIGNING_SECRET", " padded view secret\n"),
        ])
        .expect("valid config");
        let blank = config(&[
            database,
            ("BETTER_AUTH_SECRET", "auth"),
            ("CRON_SECRET", "   "),
            ("OBJECT_SIGNING_SECRET", "   "),
            ("MEMECATCH_SIGNING_SECRET", " \t"),
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
        assert_eq!(
            padded.signing_secret.as_ref().map(Secret::expose),
            Some("padded view secret")
        );
        // `!secret` is false for a blank string that is not empty.
        assert_eq!(blank.cron_secret.as_ref().map(Secret::expose), Some("   "));
        assert_eq!(blank.object_signing_secret, None);
        assert_eq!(blank.signing_secret, None);
        assert_eq!(with_required(&[("CRON_SECRET", "")]).cron_secret, None);
        // A blank auth secret is still refused at startup.
        assert!(config(&[database, ("BETTER_AUTH_SECRET", " \t")]).is_err());
    }

    #[test]
    fn debug_output_hides_secret_values() {
        let config = with_required(&[
            ("CRON_SECRET", "cron-secret-value"),
            ("OBJECT_SIGNING_SECRET", "signing-secret-value"),
            ("MEMECATCH_SIGNING_SECRET", "view-secret-value"),
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
            "view-secret-value",
            "r2-secret-value",
        ] {
            assert!(!debug.contains(secret), "{secret} leaked into {debug}");
        }
    }
}
