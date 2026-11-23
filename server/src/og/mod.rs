//! Open Graph images drawn as `next/og` draws them: Satori 0.25 lays the
//! card out and writes an SVG with every glyph as a path, then (sharp being
//! installed beside Next) libvips rasterizes it to PNG.
//!
//! Here each card builds the same SVG geometry by hand (`default_card`,
//! `quiz_card`), with text from `font` and `text`, and resvg rasterizes it.
//! The rasterizers differ only in anti-aliasing at edges; `server/parity/og.mjs`
//! compares the pixels with a stated tolerance.
//!
//! Rendering is CPU work: it runs on the blocking pool, at most
//! `MAX_RENDERS` at a time, so image requests cannot starve the server.

pub mod default_card;
pub mod font;
pub mod quiz_card;
pub mod text;

use std::sync::Arc;

use resvg::{tiny_skia, usvg};
use tokio::sync::Semaphore;

/// Renders at once. Each holds a 1200×630 RGBA pixmap (3 MB) and the parsed
/// tree; the container has 256 MB and a third of a CPU.
const MAX_RENDERS: usize = 2;

#[derive(Clone)]
pub struct Renderer {
    permits: Arc<Semaphore>,
}

impl Default for Renderer {
    fn default() -> Self {
        Self {
            permits: Arc::new(Semaphore::new(MAX_RENDERS)),
        }
    }
}

impl Renderer {
    /// The PNG of `svg`, built on the blocking pool once a permit is free.
    pub async fn png(&self, svg: String) -> Result<Vec<u8>, String> {
        let _permit = self
            .permits
            .acquire()
            .await
            .map_err(|error| error.to_string())?;
        tokio::task::spawn_blocking(move || rasterize(&svg))
            .await
            .map_err(|error| error.to_string())?
    }
}

/// resvg's PNG of `svg` at its own size.
pub fn rasterize(svg: &str) -> Result<Vec<u8>, String> {
    let tree = usvg::Tree::from_str(svg, &usvg::Options::default()).map_err(|e| e.to_string())?;
    let size = tree.size().to_int_size();
    let mut pixmap = tiny_skia::Pixmap::new(size.width(), size.height()).ok_or("an empty image")?;
    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());
    pixmap.encode_png().map_err(|error| error.to_string())
}

/// Yoga's `roundValueToPixelGrid` at scale 1: half rounds up.
pub fn pixel(value: f64) -> f64 {
    let fraction = value.rem_euclid(1.0);
    if fraction < 1e-4 {
        value - fraction
    } else if 1.0 - fraction < 1e-4 {
        value - fraction + 1.0
    } else {
        value - fraction + if fraction >= 0.5 - 1e-4 { 1.0 } else { 0.0 }
    }
}

/// Satori's path for a box with one corner radius, already clamped.
pub fn rounded_rect(x: f64, y: f64, width: f64, height: f64, radius: f64) -> String {
    let r = radius;
    let (h, v) = (width - 2.0 * r, height - 2.0 * r);
    format!(
        "M{},{y} h{h} a{r},{r} 0 0 1 {r},{r} v{v} a{r},{r} 0 0 1 -{r},{r} h-{h} a{r},{r} 0 0 1 -{r},-{r} v-{v} a{r},{r} 0 0 1 {r},-{r}",
        x + r
    )
}

/// The opening of every card.
pub fn svg_open(width: u32, height: u32) -> String {
    format!(
        r#"<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn halves_round_up_as_yoga_rounds_them() {
        assert_eq!(pixel(60.5), 61.0);
        assert_eq!(pixel(60.49), 60.0);
        assert_eq!(pixel(196.0), 196.0);
        assert_eq!(pixel(2.99999), 3.0);
    }

    #[test]
    fn the_rounded_box_is_written_as_satori_writes_it() {
        assert_eq!(
            rounded_rect(459.0, 196.0, 56.0, 56.0, 16.0),
            "M475,196 h24 a16,16 0 0 1 16,16 v24 a16,16 0 0 1 -16,16 h-24 a16,16 0 0 1 -16,-16 v-24 a16,16 0 0 1 16,-16"
        );
    }
}

#[cfg(test)]
mod font_checks {
    use super::font::Font;
    use super::{default_card, quiz_card};

    /// opentype.js substitutes only `liga` and `rlig` in Latin text (and the
    /// Arabic forms, never painted here); `font.rs` applies neither.
    fn assert_covered(font: &Font, texts: &[&str]) {
        for text in texts {
            for c in text.chars() {
                assert!(font.has_glyph(c), "no glyph for {c:?} in {text:?}");
            }
        }
        assert!(!font.has_gsub_feature(b"liga") && !font.has_gsub_feature(b"rlig"));
    }

    #[test]
    fn every_painted_character_has_a_glyph_and_no_ligature_applies() {
        for (locale, lines) in default_card::LOCALES {
            let font = Font::new(default_card::font_bytes(locale).unwrap());
            assert_covered(&font, lines);
            assert_covered(&font, &["MemeCatch"]);
        }
        let quiz = Font::new(quiz_card::FONT);
        assert_covered(
            &quiz,
            &[
                "밈캐치 밈력고사",
                "전체 요즘 밈 추억 밈 모드",
                "친구의 밈력은",
                "0123456789/ ",
                "밈장인 밈잘알 밈러 밈뉴비 밈세계 입문 환영",
                "같은 문제로 내 점수 이겨보기",
                "catchmeme.com",
            ],
        );
    }
}
