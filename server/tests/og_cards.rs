//! The Open Graph cards drawn here against Satori's own SVG of the same card
//! (`tests/fixtures/og/`, written by `parity/og-reference.mjs` through the
//! app's TSX). Both go through the same rasterizer, so any difference in
//! layout, line, glyph or kerning shows as a pixel.
//!
//! What Next's rasterizer (libvips) adds on top is anti-aliasing only;
//! `parity/og.mjs` measures that against the real Next.

use std::fs;
use std::path::Path;

use memecatch_server::og::{default_card, quiz_card, rasterize};
use resvg::tiny_skia::Pixmap;

fn fixtures() -> Vec<(String, String)> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/og");
    let mut found: Vec<(String, String)> = fs::read_dir(&dir)
        .expect("tests/fixtures/og")
        .map(|entry| entry.expect("an entry").path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "svg"))
        .map(|path| {
            let name = path.file_stem().unwrap().to_string_lossy().into_owned();
            (name, fs::read_to_string(&path).expect("an SVG"))
        })
        .collect();
    found.sort();
    found
}

fn ours(name: &str) -> String {
    if let Some(locale) = name.strip_prefix("default-") {
        return default_card::svg(locale).expect("a default card");
    }
    let token = name.strip_prefix("quiz-").expect("default- or quiz-");
    quiz_card::svg(&quiz_card::decode_token(token).expect("a valid token"))
}

fn pixels(svg: &str) -> Vec<u8> {
    let png = rasterize(svg).expect("renders");
    Pixmap::decode_png(&png).expect("a PNG").data().to_vec()
}

#[test]
fn every_card_paints_the_pixels_of_satoris_svg() {
    let fixtures = fixtures();
    assert_eq!(fixtures.len(), 18, "5 default cards and 13 quiz cards");
    let differing: Vec<&str> = fixtures
        .iter()
        .filter(|(name, satori)| pixels(&ours(name)) != pixels(satori))
        .map(|(name, _)| name.as_str())
        .collect();
    assert!(differing.is_empty(), "differ from Satori: {differing:?}");
}

#[test]
fn the_cards_are_1200_by_630_pngs() {
    let png = rasterize(&default_card::svg("ko").unwrap()).unwrap();
    let pixmap = Pixmap::decode_png(&png).unwrap();
    assert_eq!((pixmap.width(), pixmap.height()), (1200, 630));
    assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
}

/// The embedded files are the app's own: `assets/og-fonts` and
/// `assets/og/ar.png` (copied because the server image only gets `server/`).
#[test]
fn the_embedded_assets_are_the_apps_files() {
    let server = Path::new(env!("CARGO_MANIFEST_DIR"));
    let app = server.parent().unwrap();
    let pairs = [
        ("assets/og/ko.ttf", "assets/og-fonts/ko.ttf"),
        ("assets/og/en.ttf", "assets/og-fonts/en.ttf"),
        ("assets/og/ja.ttf", "assets/og-fonts/ja.ttf"),
        ("assets/og/zh.ttf", "assets/og-fonts/zh.ttf"),
        ("assets/og/zh-tw.ttf", "assets/og-fonts/zh-tw.ttf"),
        ("assets/og/share-ko.otf", "assets/og-fonts/share/ko.otf"),
        ("assets/og/OFL.txt", "assets/og-fonts/OFL.txt"),
        ("assets/og/ar.png", "assets/og/ar.png"),
    ];
    for (copy, original) in pairs {
        let copy_bytes = fs::read(server.join(copy)).expect(copy);
        let original_bytes = fs::read(app.join(original)).expect(original);
        assert!(
            copy_bytes == original_bytes,
            "server/{copy} differs from {original}"
        );
    }
}
