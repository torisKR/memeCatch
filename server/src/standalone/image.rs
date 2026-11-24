//! `/_next/image`: the image optimizer the pages' `srcset`s name (the
//! checks and messages of next/dist/server/image-optimizer.js, with its
//! default settings), for the files of `public/`.
//!
//! `url`, `w` and `q` are checked; the image is resized to `w` (never
//! enlarged) and sent as WebP when `Accept` names it, else in its own format
//! at quality `q`, with `Vary: Accept`, the file's own `max-age` but at
//! least four hours, an ETag of the bytes, `Content-Disposition: attachment`
//! and the sandboxing CSP.
//!
//! GIF, icon, BMP, AVIF and animated files are sent unchanged (a still GIF
//! or an AVIF would need a C decoder). A local URL that is not a public file
//! is a 400.
//!
//! The server has 256 MB: an image of more than `MAX_PIXELS` is sent as it
//! is, decoding is bounded by `MAX_DECODE_BYTES`, and
//! one image is worked at a time, off the async threads. At the cap the work
//! holds about 100 MB (8-bit pixels, a 16-bit premultiplied copy, the
//! result). Results are kept for an hour, up to `CACHE_BYTES`.

use std::io::Cursor;
use std::sync::{Arc, LazyLock};
use std::time::Duration;

use axum::body::Body;
use axum::http::header::{
    ACCEPT, CACHE_CONTROL, CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_SECURITY_POLICY,
    CONTENT_TYPE, ETAG, IF_NONE_MATCH, VARY,
};
use axum::http::{HeaderMap, HeaderValue, StatusCode, Uri};
use axum::response::Response;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use percent_encoding::percent_decode_str;
use sha2::{Digest, Sha256};
use tokio::sync::Semaphore;

use crate::AppState;
use crate::pages::cache::Freshness;
use crate::pages::cache::Keyed;

/// `deviceSizes` and `imageSizes`, the optimizer's defaults.
const WIDTHS: [u32; 15] = [
    640, 750, 828, 1080, 1200, 1920, 2048, 3840, 32, 48, 64, 96, 128, 256, 384,
];
/// `qualities`, the optimizer's default.
const QUALITIES: [u32; 1] = [75];
/// `minimumCacheTTL`, the optimizer's default (four hours).
const MINIMUM_MAX_AGE: u64 = 14_400;
const MAX_URL_LENGTH: usize = 3072;
const IMAGE_CSP: &str = "script-src 'none'; frame-src 'none'; sandbox;";
const NOT_AN_IMAGE: &str = "The requested resource isn't a valid image.";
// 8 megapixels; the largest public image has 4.3.
const MAX_PIXELS: u64 = 8_000_000;
const MAX_DECODE_BYTES: u64 = 40 * 1024 * 1024;
const MAX_JOBS: usize = 1;
const CACHE_TTL: Duration = Duration::from_secs(3600);
const CACHE_BYTES: usize = 16 * 1024 * 1024;

type CacheKey = (String, u32, u32, &'static str);

static JOBS: LazyLock<Semaphore> = LazyLock::new(|| Semaphore::new(MAX_JOBS));
static CACHE: LazyLock<Keyed<CacheKey, Arc<Optimized>>> = LazyLock::new(|| {
    // A resized image depends on its source only: no edit expires it.
    let never = Freshness::default();
    Keyed::new(CACHE_TTL, CACHE_BYTES, |image| image.bytes.len(), &never)
});

struct Optimized {
    bytes: Vec<u8>,
    content_type: &'static str,
    etag: String,
}

struct Wanted {
    path: String,
    width: u32,
    quality: u32,
}

pub async fn serve(state: &AppState, uri: &Uri, headers: &HeaderMap) -> Response {
    let accept = headers
        .get(ACCEPT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let wanted = match parse(uri.query().unwrap_or_default()) {
        Ok(wanted) => wanted,
        Err(message) => return error(state, message),
    };
    let file = match &state.public_files {
        Some(files) => files.load(&wanted.path).await,
        None => None,
    };
    let Some(file) = file else {
        return error(state, NOT_AN_IMAGE.to_owned());
    };
    let max_age = max_age(file.cache_control).max(MINIMUM_MAX_AGE);
    let Some(source) = detect(&file.bytes) else {
        return error(state, NOT_AN_IMAGE.to_owned());
    };
    if source == "image/svg+xml" {
        let message = "\"url\" parameter is valid but image type is not allowed";
        return error(state, message.to_owned());
    }
    let unchanged = || Optimized {
        etag: URL_SAFE_NO_PAD.encode(file.etag.as_bytes()),
        bytes: file.bytes.clone(),
        content_type: source,
    };
    let kept = is_animated(&file.bytes)
        || matches!(
            source,
            "image/x-icon" | "image/bmp" | "image/avif" | "image/gif"
        );
    // A client that does not name WebP gets the source's own type, or JPEG
    // for a WebP source.
    let target = match (accepts_webp(accept), source) {
        (true, _) => "image/webp",
        (false, "image/webp") => "image/jpeg",
        (false, other) => other,
    };
    let image = if kept {
        Arc::new(unchanged())
    } else {
        let key = (wanted.path.clone(), wanted.width, wanted.quality, target);
        if let Some(hit) = CACHE.get(&key) {
            hit
        } else {
            let made = optimize(file.bytes.clone(), source, target, &wanted).await;
            let made = Arc::new(made.unwrap_or_else(|error| {
                // A file that cannot be resized is sent as it is.
                tracing::warn!(path = wanted.path, %error, "image not optimized");
                unchanged()
            }));
            CACHE.insert(key, made.clone());
            made
        }
    };
    respond(state, &wanted.path, &image, max_age, headers)
}

/// `ImageOptimizerCache.validateParams`, with its messages.
fn parse(query: &str) -> Result<Wanted, String> {
    let pairs: Vec<(String, String)> = url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect();
    let one = |name: &str| {
        let values: Vec<&str> = pairs
            .iter()
            .filter(|(key, _)| key == name)
            .map(|(_, value)| value.as_str())
            .collect();
        match values.as_slice() {
            [] | [""] => Ok(None),
            [value] => Ok(Some(*value)),
            _ => Err(format!(
                "\"{name}\" parameter {}cannot be an array",
                label(name)
            )),
        }
    };
    let url = one("url")?.ok_or_else(|| "\"url\" parameter is required".to_owned())?;
    if url.len() > MAX_URL_LENGTH {
        return Err("\"url\" parameter is too long".to_owned());
    }
    if url.starts_with("//") {
        return Err("\"url\" parameter cannot be a protocol-relative URL (//)".to_owned());
    }
    if !url.starts_with('/') {
        // No `remotePatterns`: an absolute URL is never allowed.
        let message = match url::Url::parse(url) {
            Ok(parsed) if matches!(parsed.scheme(), "http" | "https") => "is not allowed",
            _ => "is invalid",
        };
        return Err(format!("\"url\" parameter {message}"));
    }
    let path_only = url.split(['?', '#']).next().unwrap_or(url);
    let path = percent_decode_str(path_only)
        .decode_utf8_lossy()
        .into_owned();
    if path.starts_with("/_next/image") {
        return Err("\"url\" parameter cannot be recursive".to_owned());
    }
    let width = one("w")?.ok_or_else(|| "\"w\" parameter (width) is required".to_owned())?;
    let quality = one("q")?.ok_or_else(|| "\"q\" parameter (quality) is required".to_owned())?;
    let width = digits(width)
        .filter(|width| *width > 0)
        .ok_or_else(|| "\"w\" parameter (width) must be an integer greater than 0".to_owned())?;
    if !WIDTHS.contains(&width) {
        return Err(format!("\"w\" parameter (width) of {width} is not allowed"));
    }
    let quality = digits(quality)
        .filter(|quality| (1..=100).contains(quality))
        .ok_or_else(|| {
            "\"q\" parameter (quality) must be an integer between 1 and 100".to_owned()
        })?;
    if !QUALITIES.contains(&quality) {
        return Err(format!(
            "\"q\" parameter (quality) of {quality} is not allowed"
        ));
    }
    Ok(Wanted {
        path,
        width,
        quality,
    })
}

fn label(name: &str) -> &'static str {
    match name {
        "w" => "(width) ",
        "q" => "(quality) ",
        _ => "",
    }
}

fn digits(text: &str) -> Option<u32> {
    if !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    // A long run of digits is a large number, never an allowed one.
    text.parse().ok().or(Some(u32::MAX))
}

/// `getSupportedMimeType(['image/webp'], accept)`: WebP when the header
/// names it with a weight above zero.
fn accepts_webp(accept: &str) -> bool {
    accept.split(',').any(|entry| {
        let mut parts = entry.split(';').map(str::trim);
        let named = parts
            .next()
            .is_some_and(|kind| kind.eq_ignore_ascii_case("image/webp"));
        let weight = parts
            .find_map(|param| param.strip_prefix("q="))
            .map_or(1.0, |q| q.parse::<f32>().unwrap_or(0.0));
        named && weight > 0.0
    })
}

/// `max-age` of the file's `Cache-Control`.
fn max_age(cache_control: &str) -> u64 {
    cache_control
        .split(',')
        .find_map(|directive| directive.trim().strip_prefix("max-age="))
        .and_then(|seconds| seconds.parse().ok())
        .unwrap_or(0)
}

/// `detectContentType`: the type from the first bytes.
fn detect(bytes: &[u8]) -> Option<&'static str> {
    let starts = |prefix: &[u8]| bytes.starts_with(prefix);
    if starts(&[0xff, 0xd8, 0xff]) {
        Some("image/jpeg")
    } else if starts(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if starts(b"GIF8") {
        Some("image/gif")
    } else if starts(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some("image/webp")
    } else if bytes.get(4..12) == Some(b"ftypavif") {
        Some("image/avif")
    } else if starts(&[0, 0, 1, 0]) {
        Some("image/x-icon")
    } else if starts(b"BM") {
        Some("image/bmp")
    } else if starts(b"<?xml") || starts(b"<svg") {
        Some("image/svg+xml")
    } else {
        None
    }
}

/// An animated PNG or WebP: sent unchanged.
fn is_animated(bytes: &[u8]) -> bool {
    if bytes.starts_with(b"\x89PNG") {
        return bytes.windows(4).any(|window| window == b"acTL");
    }
    let webp_extended = bytes.get(8..12) == Some(b"WEBP") && bytes.get(12..16) == Some(b"VP8X");
    webp_extended && bytes.get(20).is_some_and(|flags| flags & 0b10 != 0)
}

async fn optimize(
    bytes: Vec<u8>,
    source: &'static str,
    target: &'static str,
    wanted: &Wanted,
) -> Result<Optimized, String> {
    let (width, quality) = (wanted.width, wanted.quality);
    let _permit = JOBS.acquire().await.map_err(|error| error.to_string())?;
    let encoded =
        tokio::task::spawn_blocking(move || encode(&bytes, source, target, width, quality))
            .await
            .map_err(|error| error.to_string())??;
    Ok(Optimized {
        etag: URL_SAFE_NO_PAD.encode(Sha256::digest(&encoded)),
        bytes: encoded,
        content_type: target,
    })
}

fn decode(bytes: &[u8], source: &str) -> Result<DynamicImage, String> {
    let format = match source {
        "image/png" => ImageFormat::Png,
        "image/jpeg" => ImageFormat::Jpeg,
        "image/webp" => ImageFormat::WebP,
        other => return Err(format!("{other} is not decoded here")),
    };
    let mut limits = Limits::default();
    limits.max_alloc = Some(MAX_DECODE_BYTES);
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    reader.limits(limits);
    let decoder = reader.into_decoder().map_err(|error| error.to_string())?;
    let (width, height) = decoder.dimensions();
    if u64::from(width) * u64::from(height) > MAX_PIXELS {
        return Err(format!("{width}x{height} is over the pixel limit"));
    }
    DynamicImage::from_decoder(decoder).map_err(|error| error.to_string())
}

fn encode(
    bytes: &[u8],
    source: &str,
    target: &str,
    width: u32,
    quality: u32,
) -> Result<Vec<u8>, String> {
    let image = decode(bytes, source)?;
    // sharp's `resize(width, undefined, { withoutEnlargement: true })`.
    let image = if width < image.width() {
        let height = (f64::from(image.height()) * f64::from(width) / f64::from(image.width()))
            .round()
            .max(1.0) as u32;
        resize(&image, width, height)
    } else {
        image
    };
    let mut out = Vec::new();
    match target {
        "image/webp" => {
            out = if image.color().has_alpha() {
                let rgba = image.to_rgba8();
                webp::Encoder::from_rgba(&rgba, rgba.width(), rgba.height())
                    .encode(quality as f32)
                    .to_vec()
            } else {
                let rgb = image.to_rgb8();
                webp::Encoder::from_rgb(&rgb, rgb.width(), rgb.height())
                    .encode(quality as f32)
                    .to_vec()
            };
        }
        "image/jpeg" => {
            let rgb = flatten(&image);
            JpegEncoder::new_with_quality(&mut out, quality as u8)
                .encode_image(&rgb)
                .map_err(|error| error.to_string())?;
        }
        _ => image
            .write_to(&mut Cursor::new(&mut out), ImageFormat::Png)
            .map_err(|error| error.to_string())?,
    }
    Ok(out)
}

/// Lanczos 3, on premultiplied colour when the image has alpha (as libvips
/// does), so the hidden colour of transparent pixels does not bleed into
/// the edges. 16 bits a channel keep the colour of faint pixels.
fn resize(image: &DynamicImage, width: u32, height: u32) -> DynamicImage {
    if !image.color().has_alpha() {
        return image.resize_exact(width, height, FilterType::Lanczos3);
    }
    let mut pixels = image.to_rgba16();
    for pixel in pixels.pixels_mut() {
        let alpha = u32::from(pixel.0[3]);
        for channel in &mut pixel.0[..3] {
            *channel = ((u32::from(*channel) * alpha + 32_767) / 65_535) as u16;
        }
    }
    let mut resized = image::imageops::resize(&pixels, width, height, FilterType::Lanczos3);
    for pixel in resized.pixels_mut() {
        let alpha = u32::from(pixel.0[3]);
        for channel in &mut pixel.0[..3] {
            // A transparent pixel keeps no colour.
            *channel = (u32::from(*channel) * 65_535 + alpha / 2)
                .checked_div(alpha)
                .map_or(0, |value| value.min(65_535) as u16);
        }
    }
    DynamicImage::ImageRgba16(resized).to_rgba8().into()
}

/// JPEG has no alpha: libvips puts the image on black.
fn flatten(image: &DynamicImage) -> DynamicImage {
    if !image.color().has_alpha() {
        return DynamicImage::ImageRgb8(image.to_rgb8());
    }
    let rgba = image.to_rgba8();
    let rgb = image::RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
        let [r, g, b, a] = rgba.get_pixel(x, y).0;
        let over = |c: u8| ((u16::from(c) * u16::from(a) + 127) / 255) as u8;
        image::Rgb([over(r), over(g), over(b)])
    });
    DynamicImage::ImageRgb8(rgb)
}

/// The extension of the download name.
fn extension(content_type: &str) -> &'static str {
    match content_type {
        "image/jpeg" => "jpeg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/avif" => "avif",
        "image/x-icon" => "ico",
        "image/bmp" => "bmp",
        _ => "bin",
    }
}

fn respond(
    state: &AppState,
    path: &str,
    image: &Optimized,
    max_age: u64,
    request: &HeaderMap,
) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_SECURITY_POLICY, HeaderValue::from_static(IMAGE_CSP));
    state.native_headers.apply_config(&mut headers);
    headers.insert(VARY, HeaderValue::from_static("Accept"));
    let name = path.rsplit('/').next().unwrap_or_default();
    let stem = name.rsplit_once('.').map_or(name, |(stem, _)| stem);
    let disposition = format!(
        "attachment; filename=\"{stem}.{}\"",
        extension(image.content_type)
    );
    let cache = format!("public, max-age={max_age}, must-revalidate");
    for (name, value) in [
        (CACHE_CONTROL, cache.as_str()),
        (ETAG, image.etag.as_str()),
        (CONTENT_TYPE, image.content_type),
        (CONTENT_DISPOSITION, disposition.as_str()),
    ] {
        if let Ok(value) = HeaderValue::from_str(value) {
            headers.insert(name, value);
        }
    }
    let fresh = request
        .get(IF_NONE_MATCH)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|wanted| wanted == image.etag);
    let (status, body) = if fresh {
        (StatusCode::NOT_MODIFIED, Body::empty())
    } else {
        headers.insert(CONTENT_LENGTH, HeaderValue::from(image.bytes.len()));
        (StatusCode::OK, Body::from(image.bytes.clone()))
    };
    let mut response = Response::new(body);
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}

/// A 400: the message as the body, and the site's headers.
fn error(state: &AppState, message: String) -> Response {
    let mut headers = HeaderMap::new();
    state.native_headers.apply_config(&mut headers);
    let mut response = Response::new(super::chunked(message));
    *response.status_mut() = StatusCode::BAD_REQUEST;
    *response.headers_mut() = headers;
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(query: &str) -> String {
        parse(query).err().unwrap_or_default()
    }

    #[test]
    fn parameters_are_checked_in_next_order() {
        assert_eq!(message("w=64&q=75"), "\"url\" parameter is required");
        assert_eq!(
            message("url=%2F%2Fx.png&w=64&q=75"),
            "\"url\" parameter cannot be a protocol-relative URL (//)"
        );
        assert_eq!(
            message("url=https%3A%2F%2Fi.ytimg.com%2Fx.jpg&w=64&q=75"),
            "\"url\" parameter is not allowed"
        );
        assert_eq!(
            message("url=%2Fx.png&q=75"),
            "\"w\" parameter (width) is required"
        );
        assert_eq!(
            message("url=%2Fx.png&w=64"),
            "\"q\" parameter (quality) is required"
        );
        assert_eq!(
            message("url=%2Fx.png&w=63&q=75"),
            "\"w\" parameter (width) of 63 is not allowed"
        );
        assert_eq!(
            message("url=%2Fx.png&w=-1&q=75"),
            "\"w\" parameter (width) must be an integer greater than 0"
        );
        assert_eq!(
            message("url=%2Fx.png&w=64&q=80"),
            "\"q\" parameter (quality) of 80 is not allowed"
        );
        assert_eq!(
            message("url=%2Fx.png&w=64&q=0"),
            "\"q\" parameter (quality) must be an integer between 1 and 100"
        );
        assert_eq!(
            message("url=%2Fa&url=%2Fb&w=64&q=75"),
            "\"url\" parameter cannot be an array"
        );
        let ok = parse("url=%2Fimages%2Fa%20b.png%3Fv%3D1&w=640&q=75").unwrap();
        assert_eq!(
            (ok.path.as_str(), ok.width, ok.quality),
            ("/images/a b.png", 640, 75)
        );
    }

    #[test]
    fn webp_is_sent_only_when_named() {
        assert!(accepts_webp("image/avif,image/webp,*/*"));
        assert!(!accepts_webp("*/*"));
        assert!(!accepts_webp("image/webp;q=0"));
        assert!(!accepts_webp(""));
    }

    #[test]
    fn the_image_is_resized_and_never_enlarged() {
        let mut png = Vec::new();
        DynamicImage::new_rgb8(100, 50)
            .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
            .unwrap();
        let smaller = encode(&png, "image/png", "image/png", 64, 75).unwrap();
        let decoded = image::load_from_memory(&smaller).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (64, 32));
        let same = encode(&png, "image/png", "image/webp", 640, 75).unwrap();
        assert_eq!(detect(&same), Some("image/webp"));
        let decoded = image::load_from_memory(&same).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (100, 50));
    }
}
