//! `/api/random-meme` and `/memes/random`.

use super::*;

#[tokio::test]
async fn memes_random_is_left_to_the_upstream_when_the_site_url_cannot_be_a_redirect_target() {
    let upstream = marker_upstream().await;
    // Next throws on `new URL("/explore")` and answers 500 itself.
    let app = app_without_db(upstream, &[("NEXT_PUBLIC_SITE_URL", "")]).await;

    let reply = get(app, "/memes/random").await;

    assert_eq!(reply.body, "upstream saw GET /memes/random");
}

/// 31 approved memes, one per first letter of the short id alphabet, so a
/// random pivot lands before each of them equally often. Between them sit
/// memes in every other moderation status; `limited` ones are visible to the
/// anonymous role and must still never be picked.
fn spread_memes() -> Vec<SeedMeme> {
    const NOT_APPROVED: [&str; 5] = [
        "pending",
        "fact_checking",
        "rights_checking",
        "limited",
        "rejected",
    ];
    SHORT_ID_ALPHABET
        .chars()
        .enumerate()
        .flat_map(|(index, letter)| {
            [
                // A slug that needs percent-encoding on every third meme.
                SeedMeme::new(
                    &format!("{letter}mmmmmmm"),
                    &if index % 3 == 0 {
                        format!("밈 {index}/a?")
                    } else {
                        format!("plain-{index}")
                    },
                    "approved",
                ),
                SeedMeme::new(
                    &format!("{letter}nnnnnnn"),
                    &format!("hidden-{index}"),
                    NOT_APPROVED[index % NOT_APPROVED.len()],
                ),
            ]
        })
        .collect()
}

/// The path each approved meme of `spread_memes` must be served under.
fn spread_paths() -> BTreeSet<String> {
    SHORT_ID_ALPHABET
        .chars()
        .enumerate()
        .map(|(index, letter)| {
            let slug = if index % 3 == 0 {
                // encodeURIComponent("axum-t4-밈 " + index + "/a?")
                format!("axum-t4-%EB%B0%88%20{index}%2Fa%3F")
            } else {
                format!("axum-t4-plain-{index}")
            };
            format!("/memes/{letter}mmmmmmm-{slug}")
        })
        .collect()
}

// (30/31)^600 is 3e-9: the chance that 600 draws miss one given meme.
const DRAWS: usize = 600;

#[tokio::test]
async fn random_meme_db_serves_every_approved_meme_and_no_other() {
    #[derive(Deserialize)]
    struct PathBody {
        path: String,
    }
    let db = seed_db();
    let table = replace_approved_memes(&db, spread_memes()).await;
    let app = app_with_db(closed_addr().await).await;

    let mut paths = BTreeSet::new();
    for _ in 0..DRAWS {
        let reply = get(app, "/api/random-meme").await;
        assert_eq!(reply.status, StatusCode::OK);
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
        let body: PathBody = serde_json::from_str(&reply.body).expect("json body");
        // Exactly `{"path":"..."}`, nothing else in the object.
        assert_eq!(reply.body, format!("{{\"path\":\"{}\"}}", body.path));
        paths.insert(body.path);
    }
    table.remove_test_memes().await;

    assert_eq!(paths, spread_paths());
}

#[tokio::test]
async fn memes_random_db_redirects_to_every_approved_meme_and_no_other() {
    let db = seed_db();
    let table = replace_approved_memes(&db, spread_memes()).await;
    let app = app_with_db(closed_addr().await).await;

    let mut locations = BTreeSet::new();
    for _ in 0..DRAWS {
        let reply = get(app, "/memes/random").await;
        assert_eq!(reply.status, StatusCode::FOUND);
        assert_eq!(reply.body, "");
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(reply.header("content-language"), Some("ko"));
        assert_eq!(reply.header("content-type"), None);
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
        locations.insert(reply.header("location").expect("location").to_owned());
    }
    table.remove_test_memes().await;

    let expected: BTreeSet<String> = spread_paths()
        .iter()
        .map(|path| format!("{SITE_URL}{path}"))
        .collect();
    assert_eq!(locations, expected);
}

#[tokio::test]
async fn random_routes_db_fall_back_to_explore_when_no_meme_is_approved() {
    let db = seed_db();
    // `limited` is visible to the anonymous role but is not `approved`.
    let table = replace_approved_memes(
        &db,
        vec![
            SeedMeme::new("kkkkkkkk", "limited", "limited"),
            SeedMeme::new("pppppppp", "pending", "pending"),
        ],
    )
    .await;
    let app = app_with_db(closed_addr().await).await;

    let json = get(app, "/api/random-meme").await;
    let redirect = get(app, "/memes/random").await;
    let head = send(app, "HEAD", "/memes/random", &[], Body::empty()).await;
    table.remove_test_memes().await;

    assert_eq!(json.status, StatusCode::OK);
    assert_eq!(json.body, r#"{"path":"/explore"}"#);
    assert_eq!(json.header("cache-control"), Some("no-store"));
    for reply in [redirect, head] {
        assert_eq!(reply.status, StatusCode::FOUND);
        assert_eq!(
            reply.header("location"),
            Some("https://memes.example/explore")
        );
        // The fallback redirect sets no Cache-Control in the TypeScript.
        assert_eq!(reply.header("cache-control"), None);
        assert_eq!(reply.header("content-language"), Some("ko"));
        assert_eq!(reply.header("content-length"), None);
        assert_eq!(reply.body, "");
    }
}
