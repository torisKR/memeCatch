//! PNG, read twice:
//!
//! - `app_raster`: `decodePng` of `lib/png-raster.ts` (8-bit RGB or RGBA
//!   only, a row the data runs out in left as zeros). The share card trims
//!   on these pixels and paints them when it trims. `decodePng` ignored
//!   interlacing and read an Adam7 image's passes as rows (R10-B2); here
//!   each pass is unfiltered on its own and its pixels put in place (D3-5).
//! - `full_raster`: any PNG, as Next's rasterizer reads an embedded PNG
//!   (palette, grey and 16-bit expanded to 8-bit RGBA).
//!
//! Inflating is bounded: no more than the rows need.

use std::io::Cursor;

const SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

fn u32_at(data: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_be_bytes(
        data.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

struct Chunks {
    width: usize,
    height: usize,
    channels: usize,
    interlaced: bool,
    idat: Vec<u8>,
}

/// The chunk walk of `decodePng`.
fn chunks(png: &[u8]) -> Option<Chunks> {
    if png.get(..8) != Some(&SIGNATURE[..]) {
        return None;
    }
    let (mut pos, mut width, mut height, mut color) = (8usize, 0usize, 0usize, 6u8);
    let mut interlaced = false;
    let mut idat = Vec::new();
    while pos + 8 <= png.len() {
        let length = u32_at(png, pos)? as usize;
        let kind = &png[pos + 4..pos + 8];
        let end = pos.saturating_add(8).saturating_add(length).min(png.len());
        let data = &png[pos + 8..end];
        match kind {
            b"IHDR" => {
                width = u32_at(data, 0)? as usize;
                height = u32_at(data, 4)? as usize;
                color = data.get(9).copied().unwrap_or(6);
                interlaced = data.get(12) == Some(&1);
                if data.get(8) != Some(&8) {
                    return None;
                }
            }
            b"IDAT" => idat.extend_from_slice(data),
            b"IEND" => break,
            _ => {}
        }
        pos = pos.saturating_add(12).saturating_add(length);
    }
    let channels = match color {
        6 => 4,
        2 => 3,
        _ => return None,
    };
    (width > 0 && height > 0).then_some(Chunks {
        width,
        height,
        channels,
        interlaced,
        idat,
    })
}

/// A pass of the image: its first pixel and its steps. A plain image is one
/// pass of every pixel.
type Pass = (usize, usize, usize, usize);

const PLAIN: [Pass; 1] = [(0, 0, 1, 1)];
const ADAM7: [Pass; 7] = [
    (0, 0, 8, 8),
    (4, 0, 8, 8),
    (0, 4, 4, 8),
    (2, 0, 4, 4),
    (0, 2, 2, 4),
    (1, 0, 2, 2),
    (0, 1, 1, 2),
];

/// A pass's width and height in pixels; an empty pass has no rows.
fn pass_size((x0, y0, dx, dy): Pass, width: usize, height: usize) -> (usize, usize) {
    (
        width.saturating_sub(x0).div_ceil(dx),
        height.saturating_sub(y0).div_ceil(dy),
    )
}

/// `inflateSync`, but no further than `needed` bytes: the rows never read
/// more.
fn inflate(data: &[u8], needed: usize) -> Option<Vec<u8>> {
    use fdeflate::BoundedDecompressionError::{DecompressionError, OutputTooLarge};
    match fdeflate::decompress_to_vec_bounded(data, needed) {
        Ok(raw) => Some(raw),
        Err(OutputTooLarge { partial_output }) => Some(partial_output),
        Err(DecompressionError { .. }) => None,
    }
}

/// One row unfiltered in place. `previous` is the row above.
fn unfilter(filter: u8, row: &mut [u8], previous: &[u8], channels: usize) -> Option<()> {
    for index in 0..row.len() {
        let left = if index >= channels {
            u32::from(row[index - channels])
        } else {
            0
        };
        let up = u32::from(previous[index]);
        let up_left = if index >= channels {
            u32::from(previous[index - channels])
        } else {
            0
        };
        let add = match filter {
            0 => 0,
            1 => left,
            2 => up,
            3 => (left + up) / 2,
            4 => {
                let estimate = (left + up) as i64 - up_left as i64;
                let (pa, pb, pc) = (
                    (estimate - left as i64).abs(),
                    (estimate - up as i64).abs(),
                    (estimate - up_left as i64).abs(),
                );
                if pa <= pb && pa <= pc {
                    left
                } else if pb <= pc {
                    up
                } else {
                    up_left
                }
            }
            _ => return None,
        };
        row[index] = ((u32::from(row[index]) + add) & 255) as u8;
    }
    Some(())
}

/// `decodePng(png)`: `(width, height, rgba)`, `None` where it throws.
pub fn app_raster(png: &[u8], max_pixels: usize) -> Option<(usize, usize, Vec<u8>)> {
    let Chunks {
        width,
        height,
        channels,
        interlaced,
        idat,
    } = chunks(png)?;
    if width.checked_mul(height)? > max_pixels {
        return None;
    }
    let passes: &[Pass] = if interlaced { &ADAM7 } else { &PLAIN };
    let needed = passes
        .iter()
        .map(|pass| match pass_size(*pass, width, height) {
            (0, _) | (_, 0) => 0,
            (columns, rows) => (columns * channels + 1) * rows,
        })
        .sum();
    let raw = inflate(&idat, needed)?;
    let mut rgba = vec![0u8; width * height * 4];
    let mut offset = 0;
    for &pass @ (x0, y0, dx, dy) in passes {
        let (columns, rows) = pass_size(pass, width, height);
        if columns == 0 {
            continue;
        }
        let stride = columns * channels;
        // Each pass starts with no row above.
        let mut previous = vec![0u8; stride];
        for r in 0..rows {
            let filter = raw.get(offset).copied().unwrap_or(0);
            offset += 1;
            let start = offset.min(raw.len());
            let mut row = raw[start..(offset + stride).min(raw.len())].to_vec();
            offset += stride;
            unfilter(filter, &mut row, &previous, channels)?;
            for c in 0..columns {
                let (x, y) = (x0 + c * dx, y0 + r * dy);
                let (source, dest) = (c * channels, (y * width + x) * 4);
                let at = |i: usize| row.get(source + i).copied().unwrap_or(0);
                let alpha = if channels == 4 {
                    row.get(source + 3).copied().unwrap_or(255)
                } else {
                    255
                };
                rgba[dest..dest + 4].copy_from_slice(&[at(0), at(1), at(2), alpha]);
            }
            previous = row;
            previous.resize(stride, 0);
        }
    }
    Some((width, height, rgba))
}

/// Any PNG as 8-bit RGBA, for painting.
pub fn full_raster(png: &[u8], max_bytes: usize) -> Option<(usize, usize, Vec<u8>)> {
    let mut decoder =
        png::Decoder::new_with_limits(Cursor::new(png), png::Limits { bytes: max_bytes });
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = decoder.read_info().ok()?;
    let mut buffer = vec![0u8; reader.output_buffer_size()?];
    let info = reader.next_frame(&mut buffer).ok()?;
    let (width, height) = (info.width as usize, info.height as usize);
    let pixels = &buffer[..info.buffer_size()];
    let rgba: Vec<u8> = match info.color_type {
        png::ColorType::Rgba => pixels.to_vec(),
        png::ColorType::Rgb => pixels
            .chunks_exact(3)
            .flat_map(|p| [p[0], p[1], p[2], 255])
            .collect(),
        png::ColorType::GrayscaleAlpha => pixels
            .chunks_exact(2)
            .flat_map(|p| [p[0], p[0], p[0], p[1]])
            .collect(),
        png::ColorType::Grayscale => pixels.iter().flat_map(|v| [*v, *v, *v, 255]).collect(),
        png::ColorType::Indexed => return None,
    };
    (rgba.len() == width * height * 4).then_some((width, height, rgba))
}
