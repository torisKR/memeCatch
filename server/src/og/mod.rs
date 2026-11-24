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
pub mod export_card;
pub mod font;
pub mod jpeg_encode;
pub mod photo;
pub mod quiz_card;
pub mod satori;
pub mod share_card;
pub mod share_fonts;
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

/// What a share card came to.
pub enum ShareImage {
    Image {
        body: Vec<u8>,
        content_type: &'static str,
        /// Whether a photo was painted (`x-share-photo`).
        photo: bool,
    },
    /// Next draws this one.
    Next(String),
    /// The render threw: the default card is sent.
    Failed,
}

impl Renderer {
    /// The PNG of an export card, laid out and drawn on the blocking pool.
    pub async fn export(&self, card: export_card::ExportCard) -> Option<Result<Vec<u8>, String>> {
        self.blocking(move || rasterize(&card.svg())).await
    }

    /// `f` on the blocking pool once a permit is free.
    async fn blocking<T: Send + 'static>(
        &self,
        f: impl FnOnce() -> T + Send + 'static,
    ) -> Option<T> {
        let _permit = self.permits.acquire().await.ok()?;
        tokio::task::spawn_blocking(f).await.ok()
    }

    /// `prepareSharePhoto(bytes)`.
    pub async fn prepare(&self, bytes: Vec<u8>) -> photo::Prepared {
        self.blocking(move || photo::prepare(&bytes))
            .await
            .unwrap_or(photo::Prepared::None)
    }

    /// `renderMemeShareCard` and `fitShareCardBytes`.
    pub async fn share(
        &self,
        card: share_card::ShareCard,
        photo: Option<photo::Raster>,
    ) -> ShareImage {
        self.blocking(move || share_image(&card, photo.as_ref()))
            .await
            .unwrap_or(ShareImage::Failed)
    }
}

fn share_image(card: &share_card::ShareCard, photo: Option<&photo::Raster>) -> ShareImage {
    let svg = match share_card::svg(card, photo.is_some()) {
        Ok(svg) => svg,
        Err(unsupported) => return ShareImage::Next(format!("{unsupported:?}")),
    };
    let Ok(tree) = usvg::Tree::from_str(&svg, &usvg::Options::default()) else {
        return ShareImage::Failed;
    };
    let pixmap = match photo {
        Some(raster) => photo::ground(raster),
        None => tiny_skia::Pixmap::new(1200, 630),
    };
    let Some(mut pixmap) = pixmap else {
        return ShareImage::Failed;
    };
    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());
    let rgba: Vec<u8> = pixmap
        .pixels()
        .iter()
        .flat_map(|pixel| {
            let color = pixel.demultiply();
            [color.red(), color.green(), color.blue(), color.alpha()]
        })
        .collect();
    let Some(png) = vips_png(&rgba) else {
        return ShareImage::Failed;
    };
    let painted = photo.is_some();
    if png.len() <= jpeg_encode::BYTE_LIMIT {
        return ShareImage::Image {
            body: png,
            content_type: "image/png",
            photo: painted,
        };
    }
    let image = jpeg_encode::Image {
        width: 1200,
        height: 630,
        rgba: &rgba,
    };
    match jpeg_encode::fit(&image) {
        jpeg_encode::Fitted::Jpeg(body) => ShareImage::Image {
            body,
            content_type: "image/jpeg",
            photo: painted,
        },
        jpeg_encode::Fitted::Png => ShareImage::Image {
            body: png,
            content_type: "image/png",
            photo: painted,
        },
        jpeg_encode::Fitted::Failed => ShareImage::Failed,
    }
}

/// The card as a PNG the way sharp's `png()` writes one (no row filter,
/// deflate level 6): its length decides whether the card goes as JPEG
/// (`fitShareCardBytes`), so it should be close to the length Next's is.
fn vips_png(rgba: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut encoder = ::png::Encoder::new(&mut out, 1200, 630);
    encoder.set_color(::png::ColorType::Rgba);
    encoder.set_depth(::png::BitDepth::Eight);
    encoder.set_filter(::png::Filter::NoFilter);
    encoder.set_deflate_compression(::png::DeflateCompression::Level(6));
    let mut writer = encoder.write_header().ok()?;
    writer.write_image_data(rgba).ok()?;
    writer.finish().ok()?;
    Some(out)
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
    // `${-0}` is "0" in JavaScript.
    let back = |value: f64| {
        if value == 0.0 {
            "0".to_owned()
        } else {
            format!("-{value}")
        }
    };
    let (left, up) = (back(h), back(v));
    format!(
        "M{},{y} h{h} a{r},{r} 0 0 1 {r},{r} v{v} a{r},{r} 0 0 1 -{r},{r} h{left} a{r},{r} 0 0 1 -{r},-{r} v{up} a{r},{r} 0 0 1 {r},-{r}",
        x + r
    )
}

/// A Yoga node's place: Yoga rounds each node's offset from its parent on
/// its own (`roundValueToPixelGrid`) and Satori adds the rounded offsets up;
/// sizes are rounded from the unrounded edges.
#[derive(Clone, Copy, Debug, Default)]
pub struct At {
    x: f64,
    y: f64,
    pub left: f64,
    pub top: f64,
}

impl At {
    pub fn child(self, dx: f64, dy: f64) -> Self {
        Self {
            x: self.x + dx,
            y: self.y + dy,
            left: self.left + pixel(dx),
            top: self.top + pixel(dy),
        }
    }

    /// `(x, y, width, height)` of a box of this size here.
    pub fn rect(self, width: f64, height: f64) -> (f64, f64, f64, f64) {
        (
            self.left,
            self.top,
            pixel(self.x + width) - pixel(self.x),
            pixel(self.y + height) - pixel(self.y),
        )
    }
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
