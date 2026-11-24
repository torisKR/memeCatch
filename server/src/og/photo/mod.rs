//! The share card's photo (`prepareSharePhoto` in `lib/meme-share-photo.ts`):
//! PNG or JPEG only, black bars trimmed from the four edges, at least 400px
//! on the shorter side after the trim. Then painted as Satori places it
//! (`share_card::PhotoBox`) and as librsvg draws it.
//!
//! Bounded, since the bytes come from storage: at most `MAX_BYTES` (the
//! TypeScript's own cap), at most `MAX_SIDE` on a side and `MAX_PIXELS` in
//! all. A photo past the side or pixel cap, or one this decoder does not
//! read (a progressive JPEG, restart markers, an odd sampling), is
//! `Prepared::Unsupported`: the card is drawn without it.

mod jpeg;
mod libjpeg;
mod png;

use resvg::tiny_skia::{self, IntSize, Pixmap};

use crate::og::share_card::PhotoBox;

/// `MAX_SHARE_PHOTO_BYTES`.
pub const MAX_BYTES: usize = 8_000_000;
/// `MIN_SHARE_PHOTO_SIDE`.
const MIN_SIDE: usize = 400;
/// The decode budget: at most 1920×1080 pixels (YouTube's largest still is
/// 1280×720, card art 1200×900), at most 4096 on a side. A render then
/// holds at most about 45 MB (`og` gives the sum).
pub const MAX_SIDE: usize = 4096;
pub const MAX_PIXELS: usize = 1920 * 1080;
const NEAR_BLACK_LUMA: f64 = 16.0;
const BLACK_SHARE: f64 = 0.98;
const NOISE_SHARE: f64 = 0.8;
const NOISE_LIMIT: usize = 3;
const EDGE_CAP: f64 = 0.35;
const EDGE_MARGIN: usize = 2;
const BAND_STD: f64 = 1.5;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Mime {
    Png,
    Jpeg,
}

/// An RGBA image, not premultiplied.
#[derive(Clone, Debug, PartialEq)]
pub struct Raster {
    pub width: usize,
    pub height: usize,
    pub rgba: Vec<u8>,
}

#[derive(Debug, PartialEq)]
pub enum Prepared {
    /// No photo: the title-only card.
    None,
    Photo(Raster),
    /// A photo this renderer does not decode: the title-only card.
    Unsupported(&'static str),
}

fn u16_be(bytes: &[u8], at: usize) -> usize {
    (usize::from(bytes.get(at).copied().unwrap_or(0)) << 8)
        | usize::from(bytes.get(at + 1).copied().unwrap_or(0))
}

/// `jpegSize`.
fn jpeg_size(bytes: &[u8]) -> Option<(usize, usize)> {
    let mut offset = 2;
    while offset + 8 < bytes.len() {
        if bytes[offset] != 0xff {
            return None;
        }
        let marker = bytes[offset + 1];
        if marker == 0xd8 || marker == 0x01 {
            offset += 2;
            continue;
        }
        if marker == 0xd9 || marker == 0xda {
            return None;
        }
        let length = u16_be(bytes, offset + 2);
        if length < 2 {
            return None;
        }
        if (0xc0..=0xcf).contains(&marker) && ![0xc4, 0xc8, 0xcc].contains(&marker) {
            return Some((u16_be(bytes, offset + 7), u16_be(bytes, offset + 5)));
        }
        offset += 2 + length;
    }
    None
}

/// `imageSize`: `(width, height, type)`.
fn image_size(bytes: &[u8]) -> Option<(usize, usize, Mime)> {
    if bytes.len() >= 24 && bytes[..4] == [0x89, 0x50, 0x4e, 0x47] {
        let at = |i: usize| u32::from_be_bytes(bytes[i..i + 4].try_into().unwrap()) as usize;
        return Some((at(16), at(20), Mime::Png));
    }
    if bytes.len() >= 4 && bytes[0] == 0xff && bytes[1] == 0xd8 {
        return jpeg_size(bytes).map(|(w, h)| (w, h, Mime::Jpeg));
    }
    None
}

/// The app's own decode of a PNG or JPEG (`rasterOf`), for the tests.
pub fn app_decode(bytes: &[u8]) -> Option<Raster> {
    let (_, _, mime) = image_size(bytes)?;
    app_raster(bytes, mime)
}

/// The photo as librsvg would paint it untrimmed, for the tests.
pub fn painted_decode(bytes: &[u8]) -> Result<Raster, &'static str> {
    let (_, _, mime) = image_size(bytes).ok_or("not a PNG or JPEG")?;
    painted(bytes, mime)
}

/// `rasterOf`: the app's own decoders.
fn app_raster(bytes: &[u8], mime: Mime) -> Option<Raster> {
    match mime {
        Mime::Png => png::app_raster(bytes, MAX_PIXELS).map(|(width, height, rgba)| Raster {
            width,
            height,
            rgba,
        }),
        Mime::Jpeg => {
            let coefficients = jpeg::coefficients(bytes)?;
            let rgba = coefficients.app_raster()?;
            Some(Raster {
                width: coefficients.width,
                height: coefficients.height,
                rgba,
            })
        }
    }
}

/// `lineStat`: dark pixels and the luma's standard deviation.
fn line_stat(raster: &Raster, length: usize, index_at: impl Fn(usize) -> usize) -> (usize, f64) {
    let (mut dark, mut sum, mut sum_sq) = (0usize, 0.0f64, 0.0f64);
    for offset in 0..length {
        let i = index_at(offset);
        let p = &raster.rgba[i..i + 3];
        let luma = 0.299 * f64::from(p[0]) + 0.587 * f64::from(p[1]) + 0.114 * f64::from(p[2]);
        sum += luma;
        sum_sq += luma * luma;
        if luma <= NEAR_BLACK_LUMA {
            dark += 1;
        }
    }
    let n = length as f64;
    let mean = if length > 0 { sum / n } else { 0.0 };
    let variance = if length > 0 {
        sum_sq / n - mean * mean
    } else {
        0.0
    };
    (dark, variance.max(0.0).sqrt())
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Trim {
    Amount(usize),
    OverCap,
}

/// `trimAmount`.
fn trim_amount(run: usize, dimension: usize) -> Trim {
    if run < 1 {
        return Trim::Amount(0);
    }
    let amount = run + EDGE_MARGIN;
    if amount as f64 > dimension as f64 * EDGE_CAP {
        Trim::OverCap
    } else {
        Trim::Amount(amount)
    }
}

/// `sideTrim`: the rows or columns to drop on one side, `None` to reject.
fn side_trim(
    dimension: usize,
    length: usize,
    stat_at: impl Fn(usize) -> (usize, f64),
) -> Option<usize> {
    let black = |dark: usize| dark as f64 >= length as f64 * BLACK_SHARE;
    let mut stats: Vec<(usize, f64)> = Vec::new();
    let (mut noise, mut last_strict) = (0usize, None);
    for line in 0..dimension {
        let stat = stat_at(line);
        if black(stat.0) {
            stats.push(stat);
            last_strict = Some(stats.len() - 1);
            continue;
        }
        if stat.0 as f64 >= length as f64 * NOISE_SHARE && noise < NOISE_LIMIT {
            stats.push(stat);
            noise += 1;
            continue;
        }
        break;
    }
    let strict_run = stats.iter().take_while(|s| black(s.0)).count();
    let Trim::Amount(strict) = trim_amount(strict_run, dimension) else {
        return None;
    };
    let Some(last) = last_strict else {
        return Some(strict);
    };
    let band = last + 1;
    let deviation: f64 = stats[..band].iter().map(|s| s.1).sum();
    if deviation / band as f64 > BAND_STD {
        return Some(strict);
    }
    match trim_amount(band, dimension) {
        Trim::Amount(extended) if extended > strict => Some(extended),
        _ => Some(strict),
    }
}

/// `trimLetterbox` on the app's raster: `(top, bottom, left, right)`,
/// `None` to reject the photo.
fn edges(raster: &Raster) -> Option<(usize, usize, usize, usize)> {
    let (w, h) = (raster.width, raster.height);
    let top = side_trim(h, w, |line| line_stat(raster, w, |x| (line * w + x) * 4))?;
    let bottom = side_trim(h, w, |line| {
        line_stat(raster, w, |x| ((h - 1 - line) * w + x) * 4)
    })?;
    let left = side_trim(w, h, |line| line_stat(raster, h, |y| (y * w + line) * 4))?;
    let right = side_trim(w, h, |line| {
        line_stat(raster, h, |y| (y * w + (w - 1 - line)) * 4)
    })?;
    Some((top, bottom, left, right))
}

fn crop(
    raster: &Raster,
    (top, bottom, left, right): (usize, usize, usize, usize),
) -> Option<Raster> {
    let width = raster.width.checked_sub(left + right).filter(|w| *w >= 1)?;
    let height = raster
        .height
        .checked_sub(top + bottom)
        .filter(|h| *h >= 1)?;
    let mut rgba = Vec::with_capacity(width * height * 4);
    for y in 0..height {
        let start = ((y + top) * raster.width + left) * 4;
        rgba.extend_from_slice(&raster.rgba[start..start + width * 4]);
    }
    Some(Raster {
        width,
        height,
        rgba,
    })
}

/// The untrimmed photo as librsvg decodes it.
fn painted(bytes: &[u8], mime: Mime) -> Result<Raster, &'static str> {
    match mime {
        Mime::Png => png::full_raster(bytes, MAX_PIXELS * 4)
            .map(|(width, height, rgba)| Raster {
                width,
                height,
                rgba,
            })
            .ok_or("a PNG the port does not decode"),
        Mime::Jpeg => {
            let coefficients =
                jpeg::coefficients(bytes).ok_or("a JPEG the port does not decode")?;
            let rgba = coefficients
                .libjpeg_raster()
                .ok_or("a JPEG layout the port does not decode")?;
            Ok(Raster {
                width: coefficients.width,
                height: coefficients.height,
                rgba,
            })
        }
    }
}

/// `prepareSharePhoto(bytes)`.
pub fn prepare(bytes: &[u8]) -> Prepared {
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Prepared::None;
    }
    let Some((width, height, mime)) = image_size(bytes) else {
        return Prepared::None;
    };
    if width > MAX_SIDE || height > MAX_SIDE || width.saturating_mul(height) > MAX_PIXELS {
        return Prepared::Unsupported("a photo over the decode budget");
    }
    // A JPEG is entropy-decoded once, for the trim and for the painting.
    let decoded = (mime == Mime::Jpeg)
        .then(|| jpeg::coefficients(bytes))
        .flatten();
    let raster = match (&decoded, mime) {
        (Some(coefficients), _) => coefficients.app_raster().map(|rgba| Raster {
            width: coefficients.width,
            height: coefficients.height,
            rgba,
        }),
        (None, Mime::Jpeg) => None,
        (None, Mime::Png) => app_raster(bytes, mime),
    }
    .filter(|r| r.width == width && r.height == height);
    let trimmed = match &raster {
        None => None,
        Some(raster) => match edges(raster) {
            None => return Prepared::None,
            Some((0, 0, 0, 0)) => None,
            Some(sides) => crop(raster, sides),
        },
    };
    let (w, h) = trimmed
        .as_ref()
        .map_or((width, height), |r| (r.width, r.height));
    if w.min(h) < MIN_SIDE {
        return Prepared::None;
    }
    drop(raster);
    let painted = match (trimmed, decoded) {
        (Some(raster), _) => Ok(raster),
        (None, Some(coefficients)) => libjpeg_painted(&coefficients),
        (None, None) if mime == Mime::Jpeg => Err("a JPEG the port does not decode"),
        (None, None) => painted(bytes, mime),
    };
    match painted {
        Ok(raster) => Prepared::Photo(raster),
        Err(reason) => Prepared::Unsupported(reason),
    }
}

fn libjpeg_painted(coefficients: &jpeg::Coefficients) -> Result<Raster, &'static str> {
    let rgba = coefficients
        .libjpeg_raster()
        .ok_or("a JPEG layout the port does not decode")?;
    Ok(Raster {
        width: coefficients.width,
        height: coefficients.height,
        rgba,
    })
}

/// pixman's bilinear weight bits (`BILINEAR_INTERPOLATION_BITS`).
const WEIGHT_BITS: u32 = 7;
const FIXED_ONE: i64 = 1 << 16;

/// A double as pixman's 16.16 fixed point, rounded.
fn fixed(value: f64) -> i64 {
    (value * 65536.0).round() as i64
}

/// `pixman_fixed_to_bilinear_weight`, widened to 8 bits as
/// `bilinear_interpolation` widens it.
fn weight(value: i64) -> u32 {
    let bits = ((value >> (16 - WEIGHT_BITS)) & ((1 << WEIGHT_BITS) - 1)) as u32;
    bits << (8 - WEIGHT_BITS)
}

/// One channel of `bilinear_interpolation`: the four corners weighted in
/// 1/65536ths, truncated.
fn blend(corners: [u32; 4], dx: u32, dy: u32) -> u8 {
    let [tl, tr, bl, br] = corners;
    let sum =
        tl * (256 - dx) * (256 - dy) + tr * dx * (256 - dy) + bl * (256 - dx) * dy + br * dx * dy;
    (sum >> 16) as u8
}

/// Paints the photo, black under it, into a 1200×630 pixmap: the ground the
/// rest of the card (`share_card::svg` with `photo`) is drawn over.
///
/// As librsvg paints an `<image>`: its `image-rendering:
/// auto` is cairo's `GOOD` filter, which for these scales (no more than
/// 1.35× smaller) is pixman's bilinear filter with padded edges: each pixel
/// centre mapped through the inverse placement in 16.16 fixed point, the
/// four source pixels around it weighted with 7-bit weights.
pub fn ground(photo: &Raster) -> Option<Pixmap> {
    let size = IntSize::from_wh(1200, 630)?;
    let mut card = Pixmap::new(size.width(), size.height())?;
    let placed = PhotoBox::cover(photo.width as f64, photo.height as f64);
    let (sx, sy) = (
        photo.width as f64 / placed.width,
        photo.height as f64 / placed.height,
    );
    let (step_x, step_y) = (fixed(sx), fixed(sy));
    // cairo makes the fixed-point transform exact at the centre of what is
    // drawn (`_cairo_matrix_to_pixman_matrix`): (600, 315) here.
    let (origin_x, origin_y) = (
        fixed((600.0 - placed.x) * sx) - step_x * 600,
        fixed((315.0 - placed.y) * sy) - step_y * 315,
    );
    let premultiplied: Vec<[u8; 4]> = photo
        .rgba
        .chunks_exact(4)
        .map(|p| {
            let c = tiny_skia::ColorU8::from_rgba(p[0], p[1], p[2], p[3]).premultiply();
            [c.red(), c.green(), c.blue(), c.alpha()]
        })
        .collect();
    let (w, h) = (photo.width as i64, photo.height as i64);
    let at = |x: i64, y: i64| premultiplied[(y.clamp(0, h - 1) * w + x.clamp(0, w - 1)) as usize];
    let pixels = card.pixels_mut();
    for y in 0..630i64 {
        let v = origin_y + ((step_y * (y * FIXED_ONE + FIXED_ONE / 2) + FIXED_ONE / 2) >> 16)
            - FIXED_ONE / 2;
        let (y1, dy) = (v >> 16, weight(v));
        for x in 0..1200i64 {
            let u = origin_x + ((step_x * (x * FIXED_ONE + FIXED_ONE / 2) + FIXED_ONE / 2) >> 16)
                - FIXED_ONE / 2;
            let (x1, dx) = (u >> 16, weight(u));
            let corners = [
                at(x1, y1),
                at(x1 + 1, y1),
                at(x1, y1 + 1),
                at(x1 + 1, y1 + 1),
            ];
            let channel = |i: usize| blend(corners.map(|corner| u32::from(corner[i])), dx, dy);
            // Over black: the colour stays, the alpha becomes opaque.
            let (r, g, b) = (channel(0), channel(1), channel(2));
            pixels[(y * 1200 + x) as usize] =
                tiny_skia::PremultipliedColorU8::from_rgba(r, g, b, 255)?;
        }
    }
    Some(card)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raster(width: usize, height: usize, black_rows: usize) -> Raster {
        let mut rgba = vec![200u8; width * height * 4];
        for y in 0..black_rows {
            for x in 0..width {
                rgba[(y * width + x) * 4..(y * width + x) * 4 + 3].fill(0);
            }
        }
        Raster {
            width,
            height,
            rgba,
        }
    }

    #[test]
    fn black_rows_and_the_margin_are_trimmed_and_a_tall_bar_rejects() {
        assert_eq!(edges(&raster(500, 500, 10)), Some((12, 0, 0, 0)));
        assert_eq!(edges(&raster(500, 500, 200)), None);
        assert_eq!(edges(&raster(500, 500, 0)), Some((0, 0, 0, 0)));
    }

    #[test]
    fn a_size_is_read_from_the_header() {
        let mut png = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&640u32.to_be_bytes());
        png.extend_from_slice(&480u32.to_be_bytes());
        assert_eq!(image_size(&png), Some((640, 480, Mime::Png)));
        assert_eq!(prepare(&[]), Prepared::None);
    }
}
