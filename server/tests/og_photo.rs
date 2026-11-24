//! The share card's photo against the TypeScript and libvips
//! (`tests/fixtures/og/photos.json`, written by `parity/og-photo-fixtures.mjs`
//! from the photos in `tests/fixtures/og/photos/`):
//!
//! - the app's decoders give the same RGBA (`decodePng`, `decodeBaselineJpeg`);
//! - `prepare` keeps, trims or drops each photo as `prepareSharePhoto` does,
//!   and a trimmed photo has the app's pixels;
//! - an untrimmed photo is decoded as libvips decodes it, or left out of the
//!   card;
//! - the app's JPEG encoder gives the same bytes.

use std::fs;
use std::path::{Path, PathBuf};

use memecatch_server::og::jpeg_encode::{self, Image};
use memecatch_server::og::photo::{self, Prepared, Raster};
use serde_json::Value;
use sha2::{Digest, Sha256};

fn dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/og")
}

fn fixture() -> Value {
    serde_json::from_str(&fs::read_to_string(dir().join("photos.json")).unwrap()).unwrap()
}

fn sha(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn summary(raster: &Raster) -> (u64, u64, String) {
    (raster.width as u64, raster.height as u64, sha(&raster.rgba))
}

fn expected(value: &Value) -> (u64, u64, String) {
    (
        value["width"].as_u64().unwrap(),
        value["height"].as_u64().unwrap(),
        value["sha"].as_str().unwrap().to_owned(),
    )
}

fn photos() -> Vec<(String, Vec<u8>, Value)> {
    fixture()["photos"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| {
            let name = p["name"].as_str().unwrap().to_owned();
            let bytes = fs::read(dir().join("photos").join(&name)).unwrap();
            (name, bytes, p.clone())
        })
        .collect()
}

#[test]
fn the_apps_decoders_give_the_apps_pixels() {
    for (name, bytes, expected_photo) in photos() {
        let ours = photo::app_decode(&bytes).map(|r| summary(&r));
        let theirs = (!expected_photo["app"].is_null()).then(|| expected(&expected_photo["app"]));
        assert_eq!(ours, theirs, "{name}");
    }
}

#[test]
fn each_photo_is_kept_trimmed_or_dropped_as_the_app_decides() {
    for (name, bytes, theirs) in photos() {
        let prepared = &theirs["prepared"];
        match photo::prepare(&bytes) {
            Prepared::None => assert!(prepared.is_null(), "{name}: dropped, the app keeps it"),
            Prepared::Unsupported(reason) => {
                assert!(
                    !prepared.is_null(),
                    "{name}: handed to Next, the app drops it"
                );
                assert!(
                    prepared["embedded"]["original"].as_bool().unwrap(),
                    "{name}: {reason} on a trimmed photo"
                );
            }
            Prepared::Photo(raster) => {
                assert!(!prepared.is_null(), "{name}: kept, the app drops it");
                let size = (
                    prepared["width"].as_u64().unwrap(),
                    prepared["height"].as_u64().unwrap(),
                );
                assert_eq!((raster.width as u64, raster.height as u64), size, "{name}");
                let embedded = &prepared["embedded"];
                let target = if embedded["original"].as_bool().unwrap() {
                    expected(&theirs["vips"])
                } else {
                    expected(&embedded["app"])
                };
                assert_eq!(summary(&raster), target, "{name}");
            }
        }
    }
}

/// The JPEGs libjpeg decodes here: everything but progressive and restart
/// markers, which are left out of the card.
#[test]
fn untrimmed_jpegs_decode_as_libvips_decodes_them() {
    for (name, bytes, theirs) in photos().into_iter().filter(|(n, _, _)| n.ends_with(".jpg")) {
        match photo::painted_decode(&bytes) {
            Ok(raster) => assert_eq!(summary(&raster), expected(&theirs["vips"]), "{name}"),
            Err(_) => assert!(
                name.contains("progressive") || name.contains("restart"),
                "{name}"
            ),
        }
    }
}

#[test]
fn the_jpeg_encoder_writes_the_apps_bytes() {
    for encoding in fixture()["encodings"].as_array().unwrap() {
        let name = encoding["name"].as_str().unwrap();
        let raster =
            photo::app_decode(&fs::read(dir().join("photos").join(name)).unwrap()).unwrap();
        let image = Image {
            width: raster.width,
            height: raster.height,
            rgba: &raster.rgba,
        };
        let quality = encoding["quality"].as_u64().unwrap() as u32;
        let jpeg = jpeg_encode::encode(&image, quality).expect("encodes");
        assert_eq!(
            (jpeg.len() as u64, sha(&jpeg)),
            (
                encoding["length"].as_u64().unwrap(),
                encoding["sha"].as_str().unwrap().to_owned()
            ),
            "{name} at {quality}"
        );
    }
}

/// An Adam7 PNG is read as the same image written without interlacing
/// (R10-B2, PLAN.md D3-5): `tests/fixtures/og/interlaced/make.py` writes
/// each crop both ways, and Pillow reads the interlaced one back to the crop.
#[test]
fn the_apps_png_decoder_reads_adam7() {
    let interlaced = dir().join("interlaced");
    for name in ["rgb-37x29", "rgba-3x5", "rgba-61x1"] {
        let read = |file: String| {
            let bytes = fs::read(interlaced.join(file)).unwrap();
            photo::app_decode(&bytes).map(|r| summary(&r))
        };
        let plain = read(format!("{name}-plain.png")).expect(name);
        assert_eq!(read(format!("{name}.png")), Some(plain), "{name}");
    }
}
