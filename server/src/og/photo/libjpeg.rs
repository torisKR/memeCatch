//! What libjpeg (libjpeg-turbo, mozjpeg) does after entropy decoding, with
//! its default settings: `jpeg_idct_islow` (`jidctint.c`), the "fancy"
//! upsamplers of `jdsample.c` (triangle filters for 2×1, 1×2 and 2×2
//! chroma, plain replication for other integral ratios), the context rows
//! `jdmainct.c` gives them (the first and last rows repeated), and
//! `ycc_rgb_convert` with the fixed-point tables of `jdcolor.c`.
//!
//! librsvg in the sharp beside Next decodes an SVG's embedded JPEG through
//! it, so an untrimmed photo is painted from these pixels.

const ZIGZAG: [usize; 64] = [
    0, 1, 5, 6, 14, 15, 27, 28, 2, 4, 7, 13, 16, 26, 29, 42, 3, 8, 12, 17, 25, 30, 41, 43, 9, 11,
    18, 24, 31, 40, 44, 53, 10, 19, 23, 32, 39, 45, 52, 54, 20, 22, 33, 38, 46, 51, 55, 60, 21, 34,
    37, 47, 50, 56, 59, 61, 35, 36, 48, 49, 57, 58, 62, 63,
];

const CONST_BITS: u32 = 13;
const PASS1_BITS: u32 = 2;
const FIX_0_298631336: i64 = 2446;
const FIX_0_390180644: i64 = 3196;
const FIX_0_541196100: i64 = 4433;
const FIX_0_765366865: i64 = 6270;
const FIX_0_899976223: i64 = 7373;
const FIX_1_175875602: i64 = 9633;
const FIX_1_501321110: i64 = 12299;
const FIX_1_847759065: i64 = 15137;
const FIX_1_961570560: i64 = 16069;
const FIX_2_053119869: i64 = 16819;
const FIX_2_562915447: i64 = 20995;
const FIX_3_072711026: i64 = 25172;

fn descale(value: i64, bits: u32) -> i64 {
    (value + (1 << (bits - 1))) >> bits
}

/// `IDCT_range_limit(cinfo)[value & RANGE_MASK]`: the post-IDCT table,
/// which wraps far out-of-range values as libjpeg does.
fn range_limit(value: i64) -> u8 {
    let index = (value & 1023) as i32;
    match index {
        0..=127 => (index + 128) as u8,
        128..=511 => 255,
        512..=895 => 0,
        _ => (index - 896) as u8,
    }
}

/// The even and odd halves of one 1-D pass, before descaling: the eight
/// outputs in order 0..7.
fn rotate(input: [i64; 8]) -> [i64; 8] {
    let (z2, z3) = (input[2], input[6]);
    let z1 = (z2 + z3) * FIX_0_541196100;
    let tmp2 = z1 + z3 * -FIX_1_847759065;
    let tmp3 = z1 + z2 * FIX_0_765366865;
    let tmp0 = (input[0] + input[4]) << CONST_BITS;
    let tmp1 = (input[0] - input[4]) << CONST_BITS;
    let (tmp10, tmp13, tmp11, tmp12) = (tmp0 + tmp3, tmp0 - tmp3, tmp1 + tmp2, tmp1 - tmp2);

    let (mut t0, mut t1, mut t2, mut t3) = (input[7], input[5], input[3], input[1]);
    let (z1, z2, z3, z4) = (t0 + t3, t1 + t2, t0 + t2, t1 + t3);
    let z5 = (z3 + z4) * FIX_1_175875602;
    t0 *= FIX_0_298631336;
    t1 *= FIX_2_053119869;
    t2 *= FIX_3_072711026;
    t3 *= FIX_1_501321110;
    let (z1, z2) = (z1 * -FIX_0_899976223, z2 * -FIX_2_562915447);
    let (z3, z4) = (z3 * -FIX_1_961570560 + z5, z4 * -FIX_0_390180644 + z5);
    t0 += z1 + z3;
    t1 += z2 + z4;
    t2 += z2 + z3;
    t3 += z1 + z4;
    [
        tmp10 + t3,
        tmp11 + t2,
        tmp12 + t1,
        tmp13 + t0,
        tmp13 - t0,
        tmp12 - t1,
        tmp11 - t2,
        tmp10 - t3,
    ]
}

/// `jpeg_idct_islow` of one block: zigzag coefficients (stored as `JCOEF`),
/// the quantization table in natural order, 8×8 samples out.
pub fn islow(zig: &[i32; 64], quant: &[u16; 64], out: &mut [u8; 64]) {
    let mut coef = [0i64; 64];
    for (natural, slot) in coef.iter_mut().enumerate() {
        let value = zig[ZIGZAG[natural]] as i16;
        *slot = i64::from(value) * i64::from(quant[natural]);
    }
    let mut work = [0i64; 64];
    for column in 0..8 {
        let input: [i64; 8] = std::array::from_fn(|row| coef[row * 8 + column]);
        if input[1..].iter().all(|v| *v == 0) {
            let dc = input[0] << PASS1_BITS;
            for row in 0..8 {
                work[row * 8 + column] = dc;
            }
            continue;
        }
        let outputs = rotate(input);
        for (row, value) in outputs.iter().enumerate() {
            work[row * 8 + column] = descale(*value, CONST_BITS - PASS1_BITS);
        }
    }
    for row in 0..8 {
        let input: [i64; 8] = std::array::from_fn(|i| work[row * 8 + i]);
        if input[1..].iter().all(|v| *v == 0) {
            let value = range_limit(descale(input[0], PASS1_BITS + 3));
            out[row * 8..row * 8 + 8].fill(value);
            continue;
        }
        let outputs = rotate(input);
        for (column, value) in outputs.iter().enumerate() {
            out[row * 8 + column] = range_limit(descale(*value, CONST_BITS + PASS1_BITS + 3));
        }
    }
}

/// One component's decoded samples.
pub struct Plane<'a> {
    pub samples: &'a [u8],
    pub stride: usize,
    /// `downsampled_width` and `downsampled_height`.
    pub width: usize,
    pub height: usize,
    /// Rows the decoder wrote.
    pub rows: usize,
}

impl Plane<'_> {
    /// A sample, the rows past the image repeating its last row and the row
    /// above the first being the first.
    fn at(&self, x: usize, row: isize) -> i32 {
        let last = self.height.min(self.rows).saturating_sub(1) as isize;
        let row = row.clamp(0, last) as usize;
        i32::from(self.samples[row * self.stride + x])
    }
}

/// `h2v1_fancy_upsample` of one row of `width` samples into `out`.
fn fancy_row(input: &[i32], out: &mut Vec<i32>) {
    let width = input.len();
    out.push(input[0]);
    out.push((input[0] * 3 + input[1.min(width - 1)] + 2) >> 2);
    for x in 1..width.saturating_sub(1) {
        let value = input[x] * 3;
        out.push((value + input[x - 1] + 1) >> 2);
        out.push((value + input[x + 1] + 2) >> 2);
    }
    if width > 1 {
        out.push((input[width - 1] * 3 + input[width - 2] + 1) >> 2);
        out.push(input[width - 1]);
    }
}

/// `h2v2_fancy_upsample` for one output row: `sums` are `this * 3 + near`.
fn fancy_sums(sums: &[i32], out: &mut Vec<i32>) {
    let width = sums.len();
    out.push((sums[0] * 4 + 8) >> 4);
    out.push((sums[0] * 3 + sums[1.min(width - 1)] + 7) >> 4);
    for x in 1..width.saturating_sub(1) {
        out.push((sums[x] * 3 + sums[x - 1] + 8) >> 4);
        out.push((sums[x] * 3 + sums[x + 1] + 7) >> 4);
    }
    if width > 1 {
        out.push((sums[width - 1] * 3 + sums[width - 2] + 8) >> 4);
        out.push((sums[width - 1] * 4 + 7) >> 4);
    }
}

/// The component at full resolution, `size.0 × size.1` samples.
pub fn upsample(plane: &Plane<'_>, ratio: (usize, usize), size: (usize, usize)) -> Vec<u8> {
    let (width, height) = size;
    let mut full = Vec::with_capacity(width * height);
    let mut row_out: Vec<i32> = Vec::with_capacity(width + 2);
    for y in 0..height {
        row_out.clear();
        let source = (y / ratio.1) as isize;
        let row = |r: isize| -> Vec<i32> { (0..plane.width).map(|x| plane.at(x, r)).collect() };
        match ratio {
            (1, 1) => row_out.extend(row(source)),
            (2, 1) if plane.width > 2 => fancy_row(&row(source), &mut row_out),
            (1, 2) | (2, 2) => {
                let below = y % 2 == 1;
                let near = row(if below { source + 1 } else { source - 1 });
                let sums: Vec<i32> = row(source)
                    .iter()
                    .zip(&near)
                    .map(|(a, b)| a * 3 + b)
                    .collect();
                if ratio.0 == 2 && plane.width > 2 {
                    fancy_sums(&sums, &mut row_out);
                } else if ratio.0 == 2 {
                    let plain = row(source);
                    row_out.extend(plain.iter().flat_map(|v| [*v, *v]));
                } else {
                    let bias = if below { 2 } else { 1 };
                    row_out.extend(sums.iter().map(|s| (s + bias) >> 2));
                }
            }
            (h, _) => row_out.extend(row(source).iter().flat_map(|v| std::iter::repeat_n(*v, h))),
        }
        row_out.resize(width.max(row_out.len()), 0);
        full.extend(row_out[..width].iter().map(|v| *v as u8));
    }
    full
}

/// `ycc_rgb_convert` (or gray to RGB), opaque RGBA.
pub fn to_rgba(planes: &[Vec<u8>], width: usize, height: usize) -> Vec<u8> {
    const HALF: i64 = 1 << 15;
    let fix = |x: f64| (x * 65536.0 + 0.5) as i64;
    let (cr_r, cb_b, cr_g, cb_g) = (fix(1.40200), fix(1.77200), fix(0.71414), fix(0.34414));
    let clamp = |v: i64| v.clamp(0, 255) as u8;
    let mut rgba = vec![255u8; width * height * 4];
    for index in 0..width * height {
        let y = i64::from(planes[0][index]);
        let (r, g, b) = if planes.len() == 3 {
            let cb = i64::from(planes[1][index]) - 128;
            let cr = i64::from(planes[2][index]) - 128;
            let green = (-cb_g * cb + HALF + -cr_g * cr) >> 16;
            (
                clamp(y + ((cr_r * cr + HALF) >> 16)),
                clamp(y + green),
                clamp(y + ((cb_b * cb + HALF) >> 16)),
            )
        } else {
            let y = y as u8;
            (y, y, y)
        };
        rgba[index * 4..index * 4 + 3].copy_from_slice(&[r, g, b]);
    }
    rgba
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_flat_block_decodes_to_its_dc_level() {
        let mut zig = [0i32; 64];
        zig[0] = 8;
        let mut out = [0u8; 64];
        islow(&zig, &[16; 64], &mut out);
        // 8 × 16 = 128 → 128 / 8 = 16 above the centre.
        assert!(out.iter().all(|v| *v == 144));
    }

    #[test]
    fn the_range_limit_clamps_and_wraps_as_libjpegs_table() {
        assert_eq!(range_limit(-128), 0);
        assert_eq!(range_limit(-1), 127);
        assert_eq!(range_limit(127), 255);
        assert_eq!(range_limit(300), 255);
        assert_eq!(range_limit(-300), 0);
    }
}
