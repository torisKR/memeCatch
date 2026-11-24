//! Baseline JPEG, decoded twice over one entropy decoder:
//!
//! - `app_raster`: `decodeBaselineJpeg` of `lib/jpeg-decode.ts` exactly
//!   (its float IDCT, samples truncated into an `Int16Array`, chroma by
//!   nearest sample, its float colour conversion). The share card decides
//!   letterbox trimming on these pixels and, when it trims, paints them.
//! - `libjpeg_raster`: what librsvg paints for an untrimmed JPEG
//!   (`libjpeg.rs`).
//!
//! The parser accepts what the TypeScript accepts (SOF0, 8-bit, one or three
//! components) and stops at the first scan, as it does. The caller has
//! already capped the byte length and the dimensions.

use super::libjpeg;

const ZIGZAG: [usize; 64] = [
    0, 1, 5, 6, 14, 15, 27, 28, 2, 4, 7, 13, 16, 26, 29, 42, 3, 8, 12, 17, 25, 30, 41, 43, 9, 11,
    18, 24, 31, 40, 44, 53, 10, 19, 23, 32, 39, 45, 52, 54, 20, 22, 33, 38, 46, 51, 55, 60, 21, 34,
    37, 47, 50, 56, 59, 61, 35, 36, 48, 49, 57, 58, 62, 63,
];

/// A Huffman table as canonical codes: per length, the first code, how many
/// codes and where their symbols start. It decodes valid streams as the
/// app's tree does.
#[derive(Default, Clone)]
struct Huffman {
    first: [u32; 17],
    count: [u32; 17],
    start: [usize; 17],
    symbols: Vec<u8>,
}

impl Huffman {
    /// `huffman(counts, symbols)`.
    fn new(counts: &[u8; 16], symbols: &[u8]) -> Self {
        let mut table = Self {
            symbols: symbols.to_vec(),
            ..Self::default()
        };
        let (mut code, mut index) = (0u32, 0usize);
        for (offset, count) in counts.iter().enumerate() {
            let length = offset + 1;
            table.first[length] = code;
            table.count[length] = u32::from(*count);
            table.start[length] = index;
            code += u32::from(*count);
            index += usize::from(*count);
            code <<= 1;
        }
        table
    }

    /// `decodeSymbol`: `None` at the end of the data or for no code.
    fn decode(&self, bits: &mut Bits) -> Option<u8> {
        let mut code = 0u32;
        for length in 1..=16 {
            code = (code << 1) | bits.read(1)?;
            let offset = code.wrapping_sub(self.first[length]);
            if code >= self.first[length] && offset < self.count[length] {
                let index = self.start[length] + offset as usize;
                return Some(self.symbols.get(index).copied().unwrap_or(0));
            }
        }
        None
    }
}

/// `Bits`: MSB first, a stuffed `FF 00` read as `FF`, any other marker the end.
struct Bits<'a> {
    data: &'a [u8],
    index: usize,
    bit: u32,
    current: u8,
}

impl Bits<'_> {
    fn read(&mut self, count: u32) -> Option<u32> {
        let mut value = 0u32;
        for _ in 0..count {
            if self.bit == 0 {
                self.current = *self.data.get(self.index)?;
                self.index += 1;
                if self.current == 0xff {
                    if self.data.get(self.index).copied().unwrap_or(0) != 0 {
                        return None;
                    }
                    self.index += 1;
                }
                self.bit = 8;
            }
            self.bit -= 1;
            value = (value << 1) | ((u32::from(self.current) >> self.bit) & 1);
        }
        Some(value)
    }
}

/// `receive(bits, category)`: a failed read is 0.
fn receive(bits: &mut Bits, category: u8) -> i32 {
    if category == 0 {
        return 0;
    }
    let Some(extra) = bits.read(u32::from(category)) else {
        return 0;
    };
    let (extra, threshold) = (i64::from(extra), 1i64 << (category - 1));
    let value = if extra < threshold {
        extra - (1i64 << category) + 1
    } else {
        extra
    };
    value as i32
}

#[derive(Clone, Copy)]
struct Component {
    id: u8,
    h: usize,
    v: usize,
    quant: usize,
}

/// One component's samples: `(stride, rows, samples)`.
type Samples<T> = (usize, usize, Vec<T>);

/// The first scan decoded, each block through both IDCTs as it is read, so
/// no coefficient is kept: the app's samples and libjpeg's.
pub struct Coefficients {
    pub width: usize,
    pub height: usize,
    components: Vec<Component>,
    app: Vec<Samples<i16>>,
    libjpeg: Vec<Samples<u8>>,
    max_h: usize,
    max_v: usize,
    /// Whether the scan names every frame component.
    full_scan: bool,
}

#[derive(Default)]
struct Header {
    width: usize,
    height: usize,
    components: Vec<Component>,
    quant: Vec<Option<[u16; 64]>>,
    dc: Vec<Option<Huffman>>,
    ac: Vec<Option<Huffman>>,
    scan: Vec<(usize, Huffman, Huffman)>,
    scan_offset: usize,
}

fn byte(bytes: &[u8], at: usize) -> u8 {
    bytes.get(at).copied().unwrap_or(0)
}

impl Header {
    /// A DQT segment.
    fn quant_tables(&mut self, bytes: &[u8], start: usize, end: usize) -> Option<()> {
        let mut cursor = start;
        while cursor < end {
            let info = byte(bytes, cursor);
            cursor += 1;
            if info & 0xf0 != 0 {
                return None;
            }
            let mut table = [1u16; 64];
            for (index, slot) in ZIGZAG.iter().enumerate() {
                table[index] = bytes.get(cursor + slot).map_or(1, |b| u16::from(*b));
            }
            self.quant[usize::from(info & 0x0f)] = Some(table);
            cursor += 64;
        }
        Some(())
    }

    /// A DHT segment.
    fn huffman_tables(&mut self, bytes: &[u8], start: usize, end: usize) -> Option<()> {
        let mut cursor = start;
        while cursor < end {
            let info = byte(bytes, cursor);
            cursor += 1;
            let mut counts = [0u8; 16];
            for (index, count) in counts.iter_mut().enumerate() {
                *count = byte(bytes, cursor + index);
            }
            cursor += 16;
            let total: usize = counts.iter().map(|c| usize::from(*c)).sum();
            let symbols: Vec<u8> = (0..total).map(|i| byte(bytes, cursor + i)).collect();
            cursor += total;
            let tree = Some(Huffman::new(&counts, &symbols));
            let id = usize::from(info & 0x0f);
            match info >> 4 {
                0 => self.dc[id] = tree,
                1 => self.ac[id] = tree,
                _ => return None,
            }
        }
        Some(())
    }

    /// SOF0.
    fn frame(&mut self, bytes: &[u8], start: usize) -> Option<()> {
        let at = |i: usize| usize::from(byte(bytes, start + i));
        self.height = (at(1) << 8) | at(2);
        self.width = (at(3) << 8) | at(4);
        let count = at(5);
        if at(0) != 8 || (count != 1 && count != 3) || self.width < 1 || self.height < 1 {
            return None;
        }
        self.components = (0..count)
            .map(|index| {
                let base = 6 + index * 3;
                Component {
                    id: at(base) as u8,
                    h: at(base + 1) >> 4,
                    v: at(base + 1) & 0x0f,
                    quant: at(base + 2),
                }
            })
            .collect();
        Some(())
    }

    /// SOS: the components and tables of the scan.
    fn scan(&mut self, bytes: &[u8], start: usize, end: usize) -> Option<()> {
        let count = usize::from(byte(bytes, start));
        for index in 0..count {
            let id = byte(bytes, start + 1 + index * 2);
            let tables = byte(bytes, start + 2 + index * 2);
            let component = self.components.iter().position(|c| c.id == id)?;
            let dc = self.dc[usize::from(tables >> 4)].clone()?;
            let ac = self.ac[usize::from(tables & 0x0f)].clone()?;
            self.scan.push((component, dc, ac));
        }
        let spec = start + 1 + count * 2;
        if byte(bytes, spec) != 0 || byte(bytes, spec + 1) != 63 || byte(bytes, spec + 2) != 0 {
            return None;
        }
        self.scan_offset = end;
        Some(())
    }
}

/// The marker walk of `decodeBaselineJpeg` up to the first scan.
fn header(bytes: &[u8]) -> Option<Header> {
    if bytes.len() < 4 || bytes[0] != 0xff || bytes[1] != 0xd8 {
        return None;
    }
    let mut header = Header {
        quant: vec![None; 16],
        dc: vec![None; 16],
        ac: vec![None; 16],
        ..Header::default()
    };
    let mut offset = 2;
    while offset + 3 < bytes.len() {
        if bytes[offset] != 0xff {
            return None;
        }
        while bytes.get(offset) == Some(&0xff) {
            offset += 1;
        }
        let marker = byte(bytes, offset);
        offset += 1;
        if marker == 0xd9 {
            break;
        }
        if marker == 0xd8 || (0xd0..=0xd7).contains(&marker) {
            continue;
        }
        let length = (usize::from(byte(bytes, offset)) << 8) | usize::from(byte(bytes, offset + 1));
        if length < 2 || offset + length > bytes.len() {
            return None;
        }
        let (start, end) = (offset + 2, offset + length);
        match marker {
            0xdb => header.quant_tables(bytes, start, end)?,
            0xc4 => header.huffman_tables(bytes, start, end)?,
            0xc0 => header.frame(bytes, start)?,
            0xc1..=0xcf => return None,
            0xda => {
                header.scan(bytes, start, end)?;
                return Some(header);
            }
            _ => {}
        }
        offset = end;
    }
    None
}

/// `decodeBlock` without the IDCT: the coefficients in zigzag order.
fn block(bits: &mut Bits, dc: &Huffman, ac: &Huffman, previous: i32) -> Option<[i32; 64]> {
    let category = dc.decode(bits)?;
    let mut zig = [0i32; 64];
    zig[0] = previous.wrapping_add(receive(bits, category));
    let mut index = 1;
    while index < 64 {
        let symbol = ac.decode(bits)?;
        if symbol == 0 {
            break;
        }
        if symbol == 0xf0 {
            index += 16;
            continue;
        }
        index += usize::from(symbol >> 4);
        let value = receive(bits, symbol & 0x0f);
        if index < 64 {
            zig[index] = value;
        }
        index += 1;
    }
    Some(zig)
}

/// Writes one 8×8 block into a plane at block `(bx, by)`.
fn put<T: Copy>(plane: &mut Samples<T>, bx: usize, by: usize, block: &[T; 64]) {
    let stride = plane.0;
    for y in 0..8 {
        let row = (by * 8 + y) * stride + bx * 8;
        plane.2[row..row + 8].copy_from_slice(&block[y * 8..y * 8 + 8]);
    }
}

/// Decodes the first scan; `None` where `decodeBaselineJpeg` returns null.
pub fn coefficients(bytes: &[u8]) -> Option<Coefficients> {
    let header = header(bytes)?;
    let max_h = header.components.iter().map(|c| c.h).max()?;
    let max_v = header.components.iter().map(|c| c.v).max()?;
    if !(1..=4).contains(&max_h) || !(1..=4).contains(&max_v) {
        return None;
    }
    let mcu_cols = header.width.div_ceil(8 * max_h);
    let mcu_rows = header.height.div_ceil(8 * max_v);
    let sizes: Vec<(usize, usize)> = header
        .components
        .iter()
        .map(|c| (mcu_cols * c.h * 8, mcu_rows * c.v * 8))
        .collect();
    let mut app: Vec<Samples<i16>> = sizes
        .iter()
        .map(|(w, h)| (*w, *h, vec![0; w * h]))
        .collect();
    let mut libjpeg: Vec<Samples<u8>> = sizes
        .iter()
        .map(|(w, h)| (*w, *h, vec![0; w * h]))
        .collect();
    let cos = cosines();
    let mut bits = Bits {
        data: &bytes[header.scan_offset..],
        index: 0,
        bit: 0,
        current: 0,
    };
    let mut previous = vec![0i32; header.components.len()];
    let (mut float_block, mut int_block) = ([0i16; 64], [0u8; 64]);
    for mcu_y in 0..mcu_rows {
        for mcu_x in 0..mcu_cols {
            for (component, dc, ac) in &header.scan {
                let c = header.components[*component];
                let quant = header.quant.get(c.quant)?.as_ref()?;
                for by in 0..c.v {
                    for bx in 0..c.h {
                        let zig = block(&mut bits, dc, ac, previous[*component])?;
                        previous[*component] = zig[0];
                        app_block(&zig, quant, &cos, &mut float_block);
                        libjpeg::islow(&zig, quant, &mut int_block);
                        let (x, y) = (mcu_x * c.h + bx, mcu_y * c.v + by);
                        put(&mut app[*component], x, y, &float_block);
                        put(&mut libjpeg[*component], x, y, &int_block);
                    }
                }
            }
        }
    }
    Some(Coefficients {
        full_scan: header.scan.len() == header.components.len(),
        width: header.width,
        height: header.height,
        components: header.components,
        app,
        libjpeg,
        max_h,
        max_v,
    })
}

/// The app's dequantization and IDCT of one block.
fn app_block(zig: &[i32; 64], quant: &[u16; 64], cos: &[[f64; 8]; 8], out: &mut [i16; 64]) {
    let mut natural = [0.0f64; 64];
    for index in 0..64 {
        natural[index] = f64::from(zig[ZIGZAG[index]]) * f64::from(quant[index]);
    }
    app_idct(&natural, cos, out);
}

/// The app's `COS[u][x]`.
fn cosines() -> [[f64; 8]; 8] {
    let mut table = [[0.0; 8]; 8];
    for (u, row) in table.iter_mut().enumerate() {
        for (x, value) in row.iter_mut().enumerate() {
            *value = (((2 * x + 1) * u) as f64 * std::f64::consts::PI / 16.0).cos();
        }
    }
    table
}

/// `ToInt16`: truncation, then wrapping into 16 bits.
fn to_int16(value: f64) -> i16 {
    if !value.is_finite() {
        return 0;
    }
    (value.trunc() as i64).rem_euclid(65536) as u16 as i16
}

/// `idct(natural)` stored into an `Int16Array`. A zero coefficient adds
/// nothing to any of its sums, so it is skipped.
fn app_idct(natural: &[f64; 64], cos: &[[f64; 8]; 8], out: &mut [i16; 64]) {
    let terms: Vec<(usize, usize, f64)> = (0..64)
        .filter(|i| natural[*i] != 0.0)
        .map(|i| (i % 8, i / 8, natural[i]))
        .collect();
    for y in 0..8 {
        for x in 0..8 {
            let mut sum = 0.0f64;
            for &(u, v, coeff) in &terms {
                let cu = if u == 0 {
                    1.0 / std::f64::consts::SQRT_2
                } else {
                    1.0
                };
                let cv = if v == 0 {
                    1.0 / std::f64::consts::SQRT_2
                } else {
                    1.0
                };
                sum += cu * cv * coeff * cos[u][x] * cos[v][y];
            }
            out[y * 8 + x] = to_int16(0.25 * sum);
        }
    }
}

/// `clampByte`: `Math.round` of the value in range.
fn clamp_byte(value: f64) -> u8 {
    if value < 0.0 {
        0
    } else if value > 255.0 {
        255
    } else {
        (value + 0.5).floor() as u8
    }
}

impl Coefficients {
    /// The sample of a component at an image pixel, as the app picks it.
    fn app_sample(&self, plane: &Samples<i16>, index: usize, x: usize, y: usize) -> f64 {
        let c = self.components[index];
        let (sx, sy) = (
            self.max_h as f64 / c.h as f64,
            self.max_v as f64 / c.v as f64,
        );
        let (px, py) = (
            (x as f64 / sx).floor() as usize,
            (y as f64 / sy).floor() as usize,
        );
        f64::from(plane.2.get(py * plane.0 + px).copied().unwrap_or(0)) + 128.0
    }

    /// `decodeBaselineJpeg`'s RGBA.
    pub fn app_raster(&self) -> Option<Vec<u8>> {
        let planes = &self.app;
        let (width, height) = (self.width, self.height);
        let color = self.components.len() == 3;
        let mut rgba = vec![0u8; width * height * 4];
        for y in 0..height {
            for x in 0..width {
                let luma = self.app_sample(&planes[0], 0, x, y);
                let (mut r, mut g, mut b) = (luma, luma, luma);
                if color {
                    let cb = self.app_sample(&planes[1], 1, x, y);
                    let cr = self.app_sample(&planes[2], 2, x, y);
                    r = luma + 1.402 * (cr - 128.0);
                    g = luma - 0.344136 * (cb - 128.0) - 0.714136 * (cr - 128.0);
                    b = luma + 1.772 * (cb - 128.0);
                }
                let pixel = (y * width + x) * 4;
                rgba[pixel..pixel + 4].copy_from_slice(&[
                    clamp_byte(r),
                    clamp_byte(g),
                    clamp_byte(b),
                    255,
                ]);
            }
        }
        Some(rgba)
    }

    /// Whether `libjpeg_raster` decodes this file as libjpeg would: one
    /// interleaved scan of every component, integral sampling ratios, an
    /// unsubsampled single component.
    fn libjpeg_supported(&self) -> bool {
        self.full_scan
            && self.components.iter().all(|c| {
                c.h > 0
                    && c.v > 0
                    && self.max_h.is_multiple_of(c.h)
                    && self.max_v.is_multiple_of(c.v)
            })
            && (self.components.len() == 3 || (self.max_h == 1 && self.max_v == 1))
    }

    /// The RGBA libjpeg decodes; `None` for a shape not ported.
    pub fn libjpeg_raster(&self) -> Option<Vec<u8>> {
        if !self.libjpeg_supported() {
            return None;
        }
        let full: Vec<Vec<u8>> = self
            .components
            .iter()
            .zip(&self.libjpeg)
            .map(|(c, (stride, rows, samples))| {
                let plane = libjpeg::Plane {
                    samples,
                    stride: *stride,
                    width: (self.width * c.h).div_ceil(self.max_h),
                    height: (self.height * c.v).div_ceil(self.max_v),
                    rows: *rows,
                };
                libjpeg::upsample(
                    &plane,
                    (self.max_h / c.h, self.max_v / c.v),
                    (self.width, self.height),
                )
            })
            .collect();
        Some(libjpeg::to_rgba(&full, self.width, self.height))
    }
}
