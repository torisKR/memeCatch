//! deploy/Caddyfile rendered as Caddy renders it before parsing (each
//! `{$NAME:default}` from the environment, then each `import` of a snippet
//! defined in the file), with `CLOUDFLARE_ORIGIN_PULL` off and on (PLAN.md
//! D5-6): on, the site requires Cloudflare's origin-pull client certificate;
//! off (the default), the site is as before. Also the compose file that runs
//! this Caddy, and the pin of the CA file it trusts.

use std::path::Path;

use sha2::{Digest, Sha256};

const CA_PATH: &str = "/etc/caddy/cloudflare-origin-pull-ca.pem";

fn repo_file(name: &str) -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join(name);
    std::fs::read_to_string(&path).unwrap_or_else(|_| panic!("{}", path.display()))
}

/// Caddy's `replaceEnvVars`: `{$NAME}` and `{$NAME:default}`, the default
/// when the variable is not set.
fn substitute(text: &str, env: &[(&str, &str)]) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(at) = rest.find("{$") {
        out.push_str(&rest[..at]);
        let end = rest[at..].find('}').expect("a closed placeholder") + at;
        let inner = &rest[at + 2..end];
        let (name, default) = inner.split_once(':').unwrap_or((inner, ""));
        let value = env
            .iter()
            .find(|(key, _)| *key == name)
            .map_or(default, |(_, value)| value);
        out.push_str(value);
        rest = &rest[end + 1..];
    }
    out.push_str(rest);
    out
}

/// The top-level snippets `(name) { ... }` and the text without them.
fn snippets(text: &str) -> (Vec<(String, Vec<String>)>, Vec<String>) {
    let mut found = Vec::new();
    let mut kept = Vec::new();
    let mut lines = text.lines();
    while let Some(line) = lines.next() {
        let Some(name) = line
            .strip_prefix('(')
            .and_then(|line| line.strip_suffix(") {"))
        else {
            kept.push(line.to_owned());
            continue;
        };
        let body: Vec<String> = lines
            .by_ref()
            .take_while(|line| *line != "}")
            .map(str::to_owned)
            .collect();
        found.push((name.to_owned(), body));
    }
    (found, kept)
}

/// The Caddyfile Caddy parses with `env`, or the snippet it cannot import.
fn render(env: &[(&str, &str)]) -> Result<String, String> {
    let text = substitute(&repo_file("deploy/Caddyfile"), env);
    let (snippets, lines) = snippets(&text);
    let mut out = Vec::new();
    for line in lines {
        let Some(name) = line.trim().strip_prefix("import ") else {
            out.push(line);
            continue;
        };
        let (_, body) = snippets
            .iter()
            .find(|(snippet, _)| snippet == name)
            .ok_or_else(|| name.to_owned())?;
        out.extend(body.iter().cloned());
    }
    Ok(out.join("\n"))
}

/// The site block of a rendered Caddyfile.
fn site(rendered: &str) -> &str {
    let start = rendered.find("\ncatchmeme.com {").expect("the site block");
    &rendered[start..]
}

#[test]
fn origin_pulls_are_off_by_default_and_the_site_is_as_before() {
    for env in [&[][..], &[("CLOUDFLARE_ORIGIN_PULL", "off")][..]] {
        let rendered = render(env).expect("renders");
        let block = site(&rendered);
        assert!(!rendered.contains("client_auth"), "{rendered}");
        assert!(!block.contains("tls"), "{block}");
        assert!(block.contains("reverse_proxy app:3000"), "{block}");
    }
}

#[test]
fn origin_pulls_on_require_cloudflare_s_client_certificate_on_the_site() {
    let on = render(&[("CLOUDFLARE_ORIGIN_PULL", "on")]).expect("renders");
    let off = render(&[]).expect("renders");
    let block = site(&on);
    // The snippet's lines, as indented in the snippet (Caddy ignores it).
    let tls = "\ttls {\n\
               \t\tclient_auth {\n\
               \t\t\tmode require_and_verify\n\
               \t\t\ttrust_pool file /etc/caddy/cloudflare-origin-pull-ca.pem\n\
               \t\t}\n\
               \t}";
    assert!(
        block.starts_with(&format!("\ncatchmeme.com {{\n{tls}\n")),
        "{block}"
    );
    // Nothing else changes: the trusted proxies, the redirect, the proxy.
    assert_eq!(on.replacen(&format!("{tls}\n"), "", 1), off);
}

#[test]
fn any_other_value_names_a_snippet_caddy_cannot_import() {
    for value in ["true", "1", "ON"] {
        assert_eq!(
            render(&[("CLOUDFLARE_ORIGIN_PULL", value)]),
            Err(format!("origin-pull-{value}")),
            "{value}"
        );
    }
}

#[test]
fn the_own_caddy_compose_passes_the_setting_and_mounts_the_ca() {
    let compose = repo_file("docker-compose.own-caddy.yml");
    assert!(
        compose.contains("      CLOUDFLARE_ORIGIN_PULL: ${CLOUDFLARE_ORIGIN_PULL:-off}\n"),
        "{compose}"
    );
    assert!(
        compose.contains(&format!(
            "      - ./deploy/cloudflare-origin-pull-ca.pem:{CA_PATH}:ro\n"
        )),
        "{compose}"
    );
}

/// The CA file is the one its pin names (source and SHA-256), and a PEM
/// certificate.
#[test]
fn the_origin_pull_ca_matches_its_pin() {
    let pin = repo_file("deploy/cloudflare-origin-pull-ca.pem.sha256");
    let line = pin
        .lines()
        .find(|line| !line.starts_with('#') && !line.trim().is_empty())
        .expect("a checksum line");
    let (sum, name) = line.split_once("  ").expect("sha256sum format");
    assert_eq!(name, "cloudflare-origin-pull-ca.pem");
    assert!(pin.contains("# Source: https://"), "{pin}");
    let pem = repo_file("deploy/cloudflare-origin-pull-ca.pem");
    assert_eq!(hex::encode(Sha256::digest(pem.as_bytes())), sum);
    assert!(pem.starts_with("-----BEGIN CERTIFICATE-----\n"), "{pem}");
    assert!(
        pem.trim_end().ends_with("-----END CERTIFICATE-----"),
        "{pem}"
    );
}
