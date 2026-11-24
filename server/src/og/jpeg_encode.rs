//! The app's JPEG encoder (`encodeJpeg` and `fitShareCardBytes` in
//! `lib/jpeg-encode.ts`): baseline 4:2:0, the Annex K tables scaled by the
//! quality, a float DCT. A share card over 1 MB is sent as this JPEG, the
//! first of qualities 75, 60, 45, 30, 20 that fits (KakaoTalk's limit).
//! Ported operation for operation, so the same pixels give the same bytes.

use std::f64::consts::{PI, SQRT_2};
use std::sync::OnceLock;

const ZIGZAG: [usize; 64] = [
    0, 1, 5, 6, 14, 15, 27, 28, 2, 4, 7, 13, 16, 26, 29, 42, 3, 8, 12, 17, 25, 30, 41, 43, 9, 11,
    18, 24, 31, 40, 44, 53, 10, 19, 23, 32, 39, 45, 52, 54, 20, 22, 33, 38, 46, 51, 55, 60, 21, 34,
    37, 47, 50, 56, 59, 61, 35, 36, 48, 49, 57, 58, 62, 63,
];

#[rustfmt::skip]
const QUANT_LUMA: [u32; 64] = [
    16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

#[rustfmt::skip]
const QUANT_CHROMA: [u32; 64] = [
    17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99,
    47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
];

const DC_LUMA_BITS: [u8; 16] = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_CHROMA_BITS: [u8; 16] = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_VAL: [u8; 12] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUMA_BITS: [u8; 16] = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
#[rustfmt::skip]
const AC_LUMA_VAL: [u8; 162] = [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
    0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
    0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
    0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
    0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
    0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
];
const AC_CHROMA_BITS: [u8; 16] = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
#[rustfmt::skip]
const AC_CHROMA_VAL: [u8; 162] = [
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
    0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
    0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
    0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
    0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
    0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
    0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
    0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
    0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
];

/// `SHARE_CARD_BYTE_LIMIT`.
pub const BYTE_LIMIT: usize = 1_000_000;

/// `(code, length)` by symbol.
type Huffman = [(u32, u32); 256];

fn build(counts: &[u8; 16], values: &[u8]) -> Huffman {
    let mut table = [(0u32, 0u32); 256];
    let (mut code, mut index) = (0u32, 0usize);
    for (offset, count) in counts.iter().enumerate() {
        for _ in 0..*count {
            table[usize::from(values.get(index).copied().unwrap_or(0))] = (code, offset as u32 + 1);
            code += 1;
            index += 1;
        }
        code <<= 1;
    }
    table
}

struct Tables {
    dc_y: Huffman,
    dc_c: Huffman,
    ac_y: Huffman,
    ac_c: Huffman,
    cos: [[f64; 8]; 8],
}

fn tables() -> &'static Tables {
    static TABLES: OnceLock<Tables> = OnceLock::new();
    TABLES.get_or_init(|| {
        let mut cos = [[0.0; 8]; 8];
        for (u, row) in cos.iter_mut().enumerate() {
            for (x, value) in row.iter_mut().enumerate() {
                *value = (((2 * x + 1) * u) as f64 * PI / 16.0).cos();
            }
        }
        Tables {
            dc_y: build(&DC_LUMA_BITS, &DC_VAL),
            dc_c: build(&DC_CHROMA_BITS, &DC_VAL),
            ac_y: build(&AC_LUMA_BITS, &AC_LUMA_VAL),
            ac_c: build(&AC_CHROMA_BITS, &AC_CHROMA_VAL),
            cos,
        }
    })
}

/// `Math.round`: ties toward +∞.
fn js_round(value: f64) -> f64 {
    let floor = value.floor();
    if value - floor >= 0.5 {
        floor + 1.0
    } else {
        floor
    }
}

/// `scaleQuant`.
fn scale_quant(base: &[u32; 64], quality: u32) -> [u32; 64] {
    let clamped = quality.clamp(1, 100);
    let scale = if clamped < 50 {
        5000 / clamped
    } else {
        200 - clamped * 2
    };
    base.map(|value| ((value * scale + 50) / 100).clamp(1, 255))
}

/// `BitWriter`: a 32-bit accumulator, `FF` followed by a stuffed `00`.
#[derive(Default)]
struct BitWriter {
    bytes: Vec<u8>,
    bit: u32,
    acc: u32,
}

impl BitWriter {
    fn write(&mut self, code: u32, length: u32) {
        if length == 0 {
            return;
        }
        self.acc = self.acc.wrapping_shl(length) | (code & ((1u32 << length) - 1));
        self.bit += length;
        while self.bit >= 8 {
            self.bit -= 8;
            let byte = ((self.acc as i32) >> self.bit) as u8;
            self.bytes.push(byte);
            if byte == 0xff {
                self.bytes.push(0);
            }
        }
    }

    fn finish(mut self) -> Vec<u8> {
        if self.bit > 0 {
            let fill = (1u32 << (8 - self.bit)) - 1;
            let byte = (self.acc.wrapping_shl(8 - self.bit) | fill) as u8;
            self.bytes.push(byte);
            if byte == 0xff {
                self.bytes.push(0);
            }
        }
        self.bytes
    }
}

/// `dctBlock`: quantized coefficients in zigzag order.
fn dct_block(samples: &[f64; 64], quant: &[u32; 64]) -> [i32; 64] {
    let cos = &tables().cos;
    let mut out = [0i32; 64];
    for v in 0..8 {
        for u in 0..8 {
            let mut sum = 0.0f64;
            for y in 0..8 {
                for x in 0..8 {
                    sum += samples[y * 8 + x] * cos[u][x] * cos[v][y];
                }
            }
            let cu = if u == 0 { 1.0 / SQRT_2 } else { 1.0 };
            let cv = if v == 0 { 1.0 / SQRT_2 } else { 1.0 };
            let coeff = 0.25 * cu * cv * sum;
            let quantized = js_round(coeff / f64::from(quant[v * 8 + u]));
            out[ZIGZAG[v * 8 + u]] = quantized.clamp(-2047.0, 2047.0) as i32;
        }
    }
    out
}

/// `categoryOf`.
fn category(value: i32) -> u32 {
    let abs = value.unsigned_abs();
    if abs == 0 {
        0
    } else {
        32 - abs.leading_zeros()
    }
}

fn extra(value: i32, category: u32) -> u32 {
    if value < 0 {
        (value + (1 << category) - 1) as u32
    } else {
        value as u32
    }
}

/// A symbol the table has, else `None` (the TypeScript throws).
fn code(table: &Huffman, symbol: u32) -> Option<(u32, u32)> {
    table
        .get(symbol as usize)
        .copied()
        .filter(|(_, length)| *length > 0)
}

/// `writeBlock`: returns the block's DC.
fn write_block(
    writer: &mut BitWriter,
    block: &[i32; 64],
    dc: &Huffman,
    ac: &Huffman,
    previous: i32,
) -> Option<i32> {
    let diff = block[0] - previous;
    let dc_category = category(diff);
    let (bits, length) = code(dc, dc_category)?;
    writer.write(bits, length);
    if dc_category > 0 {
        writer.write(extra(diff, dc_category), dc_category);
    }
    let mut zero = 0u32;
    for value in &block[1..] {
        if *value == 0 {
            zero += 1;
            continue;
        }
        while zero >= 16 {
            let (bits, length) = code(ac, 0xf0)?;
            writer.write(bits, length);
            zero -= 16;
        }
        let cat = category(*value);
        let (bits, length) = code(ac, (zero << 4) | cat)?;
        writer.write(bits, length);
        writer.write(extra(*value, cat), cat);
        zero = 0;
    }
    if zero > 0 {
        let (bits, length) = code(ac, 0)?;
        writer.write(bits, length);
    }
    Some(block[0])
}

/// An RGBA image: `(width, height, rgba)`.
pub struct Image<'a> {
    pub width: usize,
    pub height: usize,
    pub rgba: &'a [u8],
}

impl Image<'_> {
    fn rgb(&self, x: usize, y: usize) -> (f64, f64, f64) {
        let index = (y.min(self.height - 1) * self.width + x.min(self.width - 1)) * 4;
        let p = &self.rgba[index..index + 3];
        (f64::from(p[0]), f64::from(p[1]), f64::from(p[2]))
    }

    /// `samplePlane(raster, mcuX, mcuY, "y", blockX, blockY)`.
    fn luma(&self, mcu: (usize, usize), block: (usize, usize)) -> [f64; 64] {
        std::array::from_fn(|i| {
            let (x, y) = (i % 8, i / 8);
            let (r, g, b) = self.rgb(mcu.0 * 16 + block.0 * 8 + x, mcu.1 * 16 + block.1 * 8 + y);
            0.299 * r + 0.587 * g + 0.114 * b - 128.0
        })
    }

    /// `chromaAverage(raster, mcuX, mcuY, channel)`.
    fn chroma(&self, mcu: (usize, usize), blue: bool) -> [f64; 64] {
        std::array::from_fn(|i| {
            let (x, y) = (i % 8, i / 8);
            let mut total = 0.0;
            for dy in 0..2 {
                for dx in 0..2 {
                    let (r, g, b) = self.rgb(mcu.0 * 16 + x * 2 + dx, mcu.1 * 16 + y * 2 + dy);
                    total += if blue {
                        128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b
                    } else {
                        128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b
                    };
                }
            }
            total / 4.0 - 128.0
        })
    }
}

fn marker(bytes: &mut Vec<u8>, id: u8, payload: &[u8]) {
    bytes.extend_from_slice(&[0xff, id]);
    let length = payload.len() + 2;
    bytes.extend_from_slice(&[(length >> 8) as u8, length as u8]);
    bytes.extend_from_slice(payload);
}

fn huffman_segment(class: u8, counts: &[u8; 16], values: &[u8]) -> Vec<u8> {
    [&[class][..], counts, values].concat()
}

fn header(image: &Image, quant_y: &[u32; 64], quant_c: &[u32; 64]) -> Vec<u8> {
    let mut bytes = vec![0xff, 0xd8];
    marker(
        &mut bytes,
        0xe0,
        &[0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    );
    let mut dqt = vec![0u8; 130];
    dqt[65] = 1;
    for index in 0..64 {
        dqt[1 + ZIGZAG[index]] = quant_y[index] as u8;
        dqt[66 + ZIGZAG[index]] = quant_c[index] as u8;
    }
    marker(&mut bytes, 0xdb, &dqt);
    let (h, w) = (image.height as u16, image.width as u16);
    let sof = [
        8,
        (h >> 8) as u8,
        h as u8,
        (w >> 8) as u8,
        w as u8,
        3,
        1,
        0x22,
        0,
        2,
        0x11,
        1,
        3,
        0x11,
        1,
    ];
    marker(&mut bytes, 0xc0, &sof);
    let dht = [
        huffman_segment(0x00, &DC_LUMA_BITS, &DC_VAL),
        huffman_segment(0x10, &AC_LUMA_BITS, &AC_LUMA_VAL),
        huffman_segment(0x01, &DC_CHROMA_BITS, &DC_VAL),
        huffman_segment(0x11, &AC_CHROMA_BITS, &AC_CHROMA_VAL),
    ]
    .concat();
    marker(&mut bytes, 0xc4, &dht);
    marker(
        &mut bytes,
        0xda,
        &[0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00],
    );
    bytes
}

/// `encodeJpeg(raster, quality)`; `None` where it throws.
pub fn encode(image: &Image, quality: u32) -> Option<Vec<u8>> {
    let t = tables();
    let quant_y = scale_quant(&QUANT_LUMA, quality);
    let quant_c = scale_quant(&QUANT_CHROMA, quality);
    let mut bytes = header(image, &quant_y, &quant_c);
    let mut writer = BitWriter::default();
    let (mut dc_y, mut dc_cb, mut dc_cr) = (0, 0, 0);
    for mcu_y in 0..image.height.div_ceil(16) {
        for mcu_x in 0..image.width.div_ceil(16) {
            let mcu = (mcu_x, mcu_y);
            for block in [(0, 0), (1, 0), (0, 1), (1, 1)] {
                let coefficients = dct_block(&image.luma(mcu, block), &quant_y);
                dc_y = write_block(&mut writer, &coefficients, &t.dc_y, &t.ac_y, dc_y)?;
            }
            let cb = dct_block(&image.chroma(mcu, true), &quant_c);
            dc_cb = write_block(&mut writer, &cb, &t.dc_c, &t.ac_c, dc_cb)?;
            let cr = dct_block(&image.chroma(mcu, false), &quant_c);
            dc_cr = write_block(&mut writer, &cr, &t.dc_c, &t.ac_c, dc_cr)?;
        }
    }
    bytes.extend(writer.finish());
    bytes.extend_from_slice(&[0xff, 0xd9]);
    Some(bytes)
}

/// What `fitShareCardBytes` sends for a PNG over the limit.
#[derive(Debug, PartialEq)]
pub enum Fitted {
    Jpeg(Vec<u8>),
    /// Even quality 20 is over the limit: the PNG goes as it is.
    Png,
    /// The encoder threw: the card fails (the default card is sent).
    Failed,
}

/// `fitShareCardBytes`: the first of qualities 75, 60, 45, 30, 20 under the
/// limit.
pub fn fit(image: &Image) -> Fitted {
    for quality in [75, 60, 45, 30, 20] {
        match encode(image, quality) {
            None => return Fitted::Failed,
            Some(jpeg) if jpeg.len() <= BYTE_LIMIT => return Fitted::Jpeg(jpeg),
            Some(_) => {}
        }
    }
    Fitted::Png
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quality_scales_the_tables_as_scale_quant_does() {
        assert_eq!(scale_quant(&QUANT_LUMA, 75)[0], 8);
        assert_eq!(scale_quant(&QUANT_LUMA, 20)[0], 40);
        assert_eq!(category(-5), 3);
        assert_eq!(js_round(-2.5), -2.0);
        assert_eq!(js_round(0.49999999999999994), 0.0);
    }
}
