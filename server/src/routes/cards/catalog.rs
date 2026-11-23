//! `lib/meme-collectible-catalog.ts`: the caption and art direction of each
//! of the 1,000 collectible cards. They are editorial data, not database
//! rows, so both servers carry them.
//!
//! `catalog.json` is the subset of `data/meme-cards/catalog-1000.json` the
//! routes send; `server/parity/meme-card-catalog.mjs` writes it. The image is
//! built from `server/src` alone, which is why the copy lives here.

use std::collections::HashMap;
use std::sync::LazyLock;

use serde::Deserialize;

/// What `getMemeCardEditorialCaption` and `getMemeCardArtDirection` return
/// for one card.
#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct CardArt {
    pub caption: String,
    pub motif: String,
    pub symbols: Vec<String>,
    pub composition: String,
}

#[derive(Deserialize)]
struct Entry {
    id: String,
    #[serde(flatten)]
    art: CardArt,
}

static BY_ID: LazyLock<HashMap<String, CardArt>> = LazyLock::new(|| {
    let entries: Vec<Entry> =
        serde_json::from_str(include_str!("catalog.json")).expect("catalog.json parses");
    entries
        .into_iter()
        .map(|entry| (entry.id, entry.art))
        .collect()
});

/// `None` where the TypeScript throws ("Unknown collectible card ..."): an id
/// the catalogue does not hold, or a card with an empty caption.
pub fn card_art(card_id: &str) -> Option<&'static CardArt> {
    BY_ID.get(card_id).filter(|art| !art.caption.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn every_card_id_has_a_caption_and_art() {
        assert_eq!(BY_ID.len(), 1000);
        for number in 1..=1000 {
            let art = card_art(&format!("mc-{number:04}")).expect("a card for every number");
            assert!(!art.motif.is_empty() && !art.composition.is_empty());
            assert_eq!(art.symbols.len(), 3, "mc-{number:04}");
        }
        assert_eq!(card_art("mc-0000"), None);
        assert_eq!(card_art("mc-1001"), None);
    }

    #[test]
    fn first_card_is_the_one_the_typescript_serves() {
        let art = card_art("mc-0001").unwrap();

        assert_eq!(
            art.caption,
            "펜과 사과, 파인애플을 조합하며 리듬을 만드는 짧은 노래"
        );
        assert_eq!(art.motif, "pen-pineapple");
        assert_eq!(art.symbols, ["pen", "apple", "pineapple"]);
        assert_eq!(art.composition, "exchange");
    }

    // The copy against its source, which the Next app imports. Skipped only
    // where the repository around `server/` is missing.
    #[test]
    fn the_copy_matches_the_catalogue_the_next_app_reads() {
        let source = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../data/meme-cards/catalog-1000.json"
        );
        let Ok(text) = std::fs::read_to_string(source) else {
            eprintln!("skipped: {source} is not there");
            return;
        };
        let catalogue: Value = serde_json::from_str(&text).expect("the catalogue parses");
        let cards = catalogue["cards"].as_array().expect("cards");

        assert_eq!(cards.len(), BY_ID.len());
        for card in cards {
            let id = card["id"].as_str().expect("id");
            let art = BY_ID.get(id).unwrap_or_else(|| panic!("{id} is missing"));
            let symbols: Vec<&str> = card["art"]["symbols"]
                .as_array()
                .expect("symbols")
                .iter()
                .map(|symbol| symbol.as_str().expect("symbol"))
                .collect();

            assert_eq!(
                Some(art.caption.as_str()),
                card["cardCaption"].as_str(),
                "{id}"
            );
            assert_eq!(
                Some(art.motif.as_str()),
                card["art"]["motif"].as_str(),
                "{id}"
            );
            assert_eq!(art.symbols, symbols, "{id}");
            assert_eq!(
                Some(art.composition.as_str()),
                card["art"]["composition"].as_str(),
                "{id}"
            );
        }
    }
}
