//! Every environment variable the server reads must reach it in production:
//! a variable missing from the `app` service of `docker-compose.yml` leaves a
//! route with other settings than intended. That happened to
//! `memes-semantic-search` (reason `disabled` instead of
//! `model_unavailable`). This test reads the variable names out of the Rust
//! sources and fails when one is neither passed to the service nor left out
//! below.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

/// Read by the server, and not passed to it on purpose. A trailing `*` is a
/// prefix.
const LEFT_OUT: &[&str] = &[
    // The operator studio's Bedrock credential source on the VM is still
    // open (PLAN.md section 5, row 61): without these it is not registered.
    "BEDROCK_*",
    "AWS_*",
    // Production runs without them.
    "CSP_ENFORCE",
    "CSP_REPORT_URI",
    // Build args of the image (deploy/build.env), kept in its environment.
    "RELEASE_SHA",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_GA_ID",
    "NEXT_PUBLIC_ADSENSE_CLIENT",
    "NEXT_PUBLIC_SUBMISSIONS_OPEN",
    "NEXT_PUBLIC_COMMUNITY_ENABLED",
    // Tests and parity runs only: send OpenRouter, llms-full.txt and ChatGPT
    // client metadata requests to a local stub.
    "AXUM_TEST_OPENROUTER_ORIGIN",
    // Tests and parity runs only: sends the radar's provider requests to a
    // local stub.
    "AXUM_TEST_RADAR_ORIGIN",
    "AXUM_TEST_OG_ORIGIN",
    "AXUM_TEST_INDEXNOW_ORIGIN",
    // Tests only: Google's and Kakao's token and profile requests go to a
    // loopback stub (A3). Loopback origins only, refused otherwise.
    "AXUM_TEST_OAUTH_ORIGIN",
    "AXUM_TEST_MCP_ORIGIN",
    // Tests and parity runs only: the oEmbed and YouTube Data API requests
    // go to a local stub (R11).
    "AXUM_TEST_OEMBED_ORIGIN",
    // Extra root certificates for outbound HTTPS (R4's config.rs), for a test
    // stub or a provider behind a private CA. Production trusts only the
    // compiled-in roots.
    "AXUM_EXTRA_CA_CERTS",
    // The public/ folder, which Dockerfile.server sets in the image
    // environment.
    "AXUM_PUBLIC_DIR",
    // The switches that handed routes back to Next. Still read until that
    // code goes; not passed, so the VM's .env cannot turn a route off.
    "AXUM_PILOT_ROUTES",
    "AXUM_DISABLED_ROUTES",
    // Sign-out's extra trusted origins (A1): production has none.
    "BETTER_AUTH_TRUSTED_ORIGINS",
    // Read only by `memecatch-server embedder`, the compose service
    // `embedder`, whose image sets it (Dockerfile.server).
    "MEME_EMBEDDING_MODEL_ROOT",
];

fn matches(entry: &str, name: &str) -> bool {
    match entry.strip_suffix('*') {
        Some(prefix) => name.starts_with(prefix),
        None => entry == name,
    }
}

fn rust_files(dir: &Path, out: &mut Vec<String>) {
    for entry in fs::read_dir(dir).expect("a source directory") {
        let path = entry.expect("an entry").path();
        if path.is_dir() {
            rust_files(&path, out);
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            out.push(fs::read_to_string(&path).expect("a source file"));
        }
    }
}

/// The names in `lookup("X")`, `optional("X")`, `required("X")`, `set("X")`,
/// `test_origin("X")` and `var("X")`: every way `config.rs` (or any other
/// file) reads one.
fn names_read() -> BTreeSet<String> {
    let mut sources = Vec::new();
    rust_files(
        &Path::new(env!("CARGO_MANIFEST_DIR")).join("src"),
        &mut sources,
    );
    let mut names = BTreeSet::new();
    for source in &sources {
        for call in [
            "lookup(\"",
            "optional(\"",
            "required(\"",
            "set(\"",
            "test_origin(\"",
            "var(\"",
        ] {
            for (at, _) in source.match_indices(call) {
                let rest = &source[at + call.len()..];
                let name: String = rest
                    .chars()
                    .take_while(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || *c == '_')
                    .collect();
                if !name.is_empty() && rest[name.len()..].starts_with('"') {
                    names.insert(name);
                }
            }
        }
    }
    names
}

/// `services.<service>.environment` of a compose file at the repository
/// root, as `(key, value)` pairs.
fn environment(file: &str, service: &str) -> Vec<(String, String)> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join(file);
    let compose = fs::read_to_string(path).expect("a compose file");
    let lines: Vec<&str> = compose.lines().collect();
    let indent = |line: &str| line.len() - line.trim_start().len();
    let header = format!("  {service}:");
    let at = lines
        .iter()
        .position(|line| *line == header)
        .expect("the service");
    let body: Vec<&str> = lines[at + 1..]
        .iter()
        .take_while(|line| line.trim().is_empty() || indent(line) > 2)
        .copied()
        .collect();
    let Some(start) = body
        .iter()
        .position(|line| line.trim_start().starts_with("environment:"))
    else {
        return Vec::new();
    };
    body[start + 1..]
        .iter()
        .take_while(|line| line.trim().is_empty() || indent(line) > 4)
        .map(|line| line.trim())
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter_map(|line| {
            line.split_once(':')
                .map(|(key, value)| (key.to_owned(), value.trim().to_owned()))
        })
        .collect()
}

/// The keys of `services.app.environment` in `docker-compose.yml`.
fn names_passed() -> BTreeSet<String> {
    environment("docker-compose.yml", "app")
        .into_iter()
        .map(|(key, _)| key)
        .collect()
}

#[test]
fn every_variable_the_server_reads_is_passed_to_axum_or_left_out_on_purpose() {
    let (read, passed) = (names_read(), names_passed());
    assert!(
        read.contains("DATABASE_URL") && read.contains("OPENROUTER_API_KEY"),
        "{read:?}"
    );
    assert!(
        passed.contains("DATABASE_URL") && passed.contains("NODE_ENV"),
        "{passed:?}"
    );
    let missing: Vec<&String> = read
        .iter()
        .filter(|name| {
            !passed.contains(*name) && !LEFT_OUT.iter().any(|entry| matches(entry, name))
        })
        .collect();
    assert!(
        missing.is_empty(),
        "read by the server but not passed in docker-compose.yml: {missing:?}"
    );
    for entry in LEFT_OUT {
        let named: Vec<&String> = read.iter().filter(|name| matches(entry, name)).collect();
        assert!(
            !named.is_empty(),
            "{entry} is left out but no longer read: drop it"
        );
        assert!(
            named.iter().all(|name| !passed.contains(*name)),
            "{entry} is left out but passed"
        );
    }
}
