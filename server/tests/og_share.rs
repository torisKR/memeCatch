//! The meme share card drawn here (`og::share_card`) against Satori's SVG of
//! the same card through the app's TSX (`tests/fixtures/og/share-*.svg`,
//! written by `parity/og-reference.mjs share share-cases.json`). Both go
//! through resvg, so a difference in a line break, an ellipsis, a font run,
//! a fallback glyph or a box shows as a pixel. A case for which Satori asked
//! next/og for a font or emoji (`share-<case>.json`) must be refused here.

use std::fs;
use std::path::{Path, PathBuf};

use memecatch_server::og::rasterize;
use memecatch_server::og::share_card::{self, Locale, ShareCard, Unsupported};
use resvg::tiny_skia::Pixmap;
use serde_json::Value;

fn dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/og")
}

fn cases() -> Vec<Value> {
    let text = fs::read_to_string(dir().join("share-cases.json")).expect("share-cases.json");
    serde_json::from_str::<Value>(&text)
        .unwrap()
        .as_array()
        .unwrap()
        .clone()
}

fn card(case: &Value) -> ShareCard {
    let blank = |v: &Value| {
        v.as_str()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
    };
    ShareCard {
        locale: Locale::parse(case["locale"].as_str().unwrap()).unwrap(),
        title: case["title"].as_str().unwrap().trim().to_owned(),
        summary: blank(&case["summary"]),
        year: case["year"].as_i64(),
        category: case["category"].as_str().map(str::to_owned),
    }
}

fn pixels(svg: &str) -> Vec<u8> {
    Pixmap::decode_png(&rasterize(svg).expect("renders"))
        .unwrap()
        .data()
        .to_vec()
}

#[test]
fn every_title_card_paints_the_pixels_of_satoris_svg() {
    let mut differing = Vec::new();
    let mut checked = 0;
    for case in cases() {
        let name = case["name"].as_str().unwrap();
        let meta: Value = serde_json::from_str(
            &fs::read_to_string(dir().join(format!("share-{name}.json"))).unwrap(),
        )
        .unwrap();
        let ours = share_card::svg(&card(&case), false);
        if !meta["assets"].as_array().unwrap().is_empty() {
            assert!(
                matches!(ours, Err(Unsupported::Missing(_))),
                "{name}: Satori asked for {}, ours {ours:?}",
                meta["assets"]
            );
            continue;
        }
        let satori = fs::read_to_string(dir().join(format!("share-{name}.svg"))).unwrap();
        let ours = ours.unwrap_or_else(|e| panic!("{name}: {e:?}"));
        checked += 1;
        if pixels(&ours) != pixels(&satori) {
            differing.push(name.to_owned());
        }
    }
    assert!(checked >= 20, "{checked} cases");
    assert!(differing.is_empty(), "differ from Satori: {differing:?}");
}

/// A card with a photo: Satori places the photo where `PhotoBox::cover`
/// does (its pixels are held to the app in `og_photo.rs`), and everything
/// drawn over it paints the same pixels.
#[test]
fn every_photo_card_places_the_photo_and_paints_the_rest_as_satori() {
    use memecatch_server::og::photo::{self, Prepared};
    use memecatch_server::og::share_card::PhotoBox;
    let text = fs::read_to_string(dir().join("share-photo-cases.json")).unwrap();
    let cases: Vec<Value> = serde_json::from_str(&text).unwrap();
    assert_eq!(cases.len(), 7);
    for case in cases {
        let name = case["name"].as_str().unwrap();
        let satori =
            fs::read_to_string(dir().join(format!("{name}.svg").replace("photo-", "share-photo-")))
                .unwrap();
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join(case["photo"].as_str().unwrap());
        let Prepared::Photo(raster) = photo::prepare(&fs::read(&path).unwrap()) else {
            panic!("{name}: no photo");
        };
        let image = satori
            .split("<image ")
            .nth(1)
            .and_then(|rest| rest.split("/>").next())
            .expect("an image");
        let attr = |key: &str| -> f64 {
            image
                .split(&format!(" {key}=\""))
                .nth(1)
                .or_else(|| image.strip_prefix(&format!("{key}=\"")))
                .unwrap()
                .split('"')
                .next()
                .unwrap()
                .parse()
                .unwrap()
        };
        let placed = PhotoBox::cover(raster.width as f64, raster.height as f64);
        assert_eq!(
            (attr("x"), attr("y"), attr("width"), attr("height")),
            (placed.x, placed.y, placed.width, placed.height),
            "{name}"
        );
        let theirs_svg = satori
            .replacen(
                r##"<rect x="0" y="0" width="1200" height="630" fill="#000000"/>"##,
                "",
                1,
            )
            .replace(&format!("<image {image}/>"), "");
        let paint = |svg: &str| {
            let tree = resvg::usvg::Tree::from_str(svg, &resvg::usvg::Options::default()).unwrap();
            let mut pixmap = photo::ground(&raster).unwrap();
            resvg::render(
                &tree,
                resvg::tiny_skia::Transform::default(),
                &mut pixmap.as_mut(),
            );
            pixmap.data().to_vec()
        };
        let ours = share_card::svg(&card(&case), true).unwrap();
        assert!(
            paint(&ours) == paint(&theirs_svg),
            "{name}: differs from Satori"
        );
    }
}
