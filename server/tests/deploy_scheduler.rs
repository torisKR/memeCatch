//! The scheduler's schedule (deploy/scheduler/crontab, run by supercronic):
//! which cron routes it calls. `/api/cron/mcp-events` is off while the
//! operator MCP is not configured in production (PLAN.md D5-4); its route
//! stays (tests/mcp.rs), and the crontab says how to turn it back on.

use std::path::Path;

fn crontab() -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../deploy/scheduler/crontab");
    std::fs::read_to_string(path).expect("deploy/scheduler/crontab")
}

/// The path each active line runs, after checking its shape: five schedule
/// fields, `run-cron`, one `/api/cron/` path.
fn scheduled(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            assert_eq!(fields.len(), 7, "{line}");
            assert_eq!(fields[5], "/usr/local/bin/run-cron", "{line}");
            assert!(fields[6].starts_with("/api/cron/"), "{line}");
            fields[6].to_owned()
        })
        .collect()
}

#[test]
fn the_scheduler_does_not_call_the_mcp_events_cron() {
    let text = crontab();
    assert_eq!(
        scheduled(&text),
        [
            "/api/cron/trend-pulse",
            "/api/cron/source-refresh",
            "/api/cron/growth-baseline",
            "/api/cron/saved-state-emails",
            "/api/cron/meme-embeddings",
        ]
    );
    // The way back: the line to restore, and what must be configured first.
    assert!(
        text.lines()
            .any(|line| line == "# */5 * * * * /usr/local/bin/run-cron /api/cron/mcp-events"),
        "{text}"
    );
    assert!(text.contains("MCP_EVENT_STATE_KEY"), "{text}");
}
