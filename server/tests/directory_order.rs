//! The /memes order (`pages::directory_order`) against the order the real
//! `sortDirectory` gives the catalog of `parity/directory-catalog.mjs` on the
//! Node of the Next image. Any title placed differently fails, with the
//! neighbours it was placed between.

use memecatch_server::pages::directory_order::{compare, listed_title};
use serde::Deserialize;

#[derive(Deserialize)]
struct Item {
    short_id: String,
    slug: String,
    title: String,
}

#[derive(Deserialize)]
struct Fixture {
    icu: String,
    items: Vec<Item>,
    order: Vec<String>,
}

#[test]
fn the_directory_order_is_the_typescript_order_for_every_title() {
    let fixture: Fixture =
        serde_json::from_str(include_str!("fixtures/directory_order.json")).unwrap();
    assert!(
        fixture.items.len() >= 3_000,
        "the catalog has {} titles",
        fixture.items.len()
    );
    // `loadMemeDirectory`: `row.title?.trim() || row.slug`.
    let mut listed: Vec<(String, &str)> = fixture
        .items
        .iter()
        .map(|item| {
            let title = listed_title(Some(&item.title), &item.slug);
            (title.to_owned(), item.short_id.as_str())
        })
        .collect();
    listed.sort_by(|a, b| compare(&a.0, a.1, &b.0, b.1));

    let ours: Vec<&str> = listed.iter().map(|(_, id)| *id).collect();
    let title_of = |id: &str| {
        listed
            .iter()
            .find(|(_, other)| *other == id)
            .map_or("?", |(title, _)| title.as_str())
            .to_owned()
    };
    let misplaced: Vec<String> = ours
        .iter()
        .zip(&fixture.order)
        .enumerate()
        .filter(|(_, (ours, theirs))| *ours != theirs)
        .take(20)
        .map(|(index, (ours, theirs))| {
            format!(
                "#{index}: Axum {:?} ({ours}), Next {:?} ({theirs})",
                title_of(ours),
                title_of(theirs)
            )
        })
        .collect();
    assert!(
        misplaced.is_empty(),
        "ICU {}: {} of {} positions differ, first ones:\n{}",
        fixture.icu,
        ours.iter()
            .zip(&fixture.order)
            .filter(|(a, b)| *a != b)
            .count(),
        ours.len(),
        misplaced.join("\n")
    );
}
