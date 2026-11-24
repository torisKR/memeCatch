//! `{ pooling: "mean", normalize: true }` of transformers.js 3.8.1
//! (`mean_pooling` and `Tensor.normalize` in `src/utils/tensor.js`), with
//! its float handling: sums in doubles, every stored value a `Float32Array`
//! element, and `tolist()` widening those to doubles.

/// `MEME_VECTOR_DIMENSIONS` of lib/meme-vectors.ts.
pub const DIMENSIONS: usize = 384;

/// Mean over the tokens of `hidden` (`tokens` rows of `width` floats, every
/// token attended), then L2 normalization; the values as `tolist()` gives
/// them.
pub fn mean_pool_normalize(hidden: &[f32], tokens: usize, width: usize) -> Vec<f64> {
    // mean_pooling: `sum += value * attn` in a double, `sum / count` stored
    // into a Float32Array.
    let pooled: Vec<f32> = (0..width)
        .map(|k| {
            let sum: f64 = (0..tokens).map(|j| f64::from(hidden[j * width + k])).sum();
            (sum / tokens as f64) as f32
        })
        .collect();
    // norm(2, -1): `reduce_helper` accumulates `a + b ** 2` into a
    // Float32Array element, so each partial sum is rounded to a float; then
    // `** (1 / 2)`, stored as a float too.
    let mut squares = 0.0f32;
    for value in &pooled {
        squares = (f64::from(squares) + f64::from(*value).powi(2)) as f32;
    }
    let norm = f64::from(squares).sqrt() as f32;
    pooled
        .iter()
        .map(|value| f64::from((f64::from(*value) / f64::from(norm)) as f32))
        .collect()
}

/// `isMemeVector` of lib/meme-vectors.ts: 384 finite numbers whose
/// `Math.hypot` is within 0.99 and 1.01.
pub fn is_meme_vector(values: &[f64]) -> bool {
    if values.len() != DIMENSIONS || !values.iter().all(|value| value.is_finite()) {
        return false;
    }
    let norm = values.iter().map(|value| value * value).sum::<f64>().sqrt();
    (0.99..=1.01).contains(&norm)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn averages_the_tokens_then_scales_to_unit_length() {
        // Two tokens of width 2: the mean is (2, 0), normalized (1, 0).
        assert_eq!(
            mean_pool_normalize(&[1.0, 1.0, 3.0, -1.0], 2, 2),
            vec![1.0, 0.0]
        );
        let values = mean_pool_normalize(&[3.0, 4.0], 1, 2);
        assert_eq!(values, vec![f64::from(0.6f32), f64::from(0.8f32)]);
    }

    #[test]
    fn a_meme_vector_has_384_finite_values_of_unit_length() {
        let mut unit = vec![0.0; DIMENSIONS];
        unit[0] = 1.0;
        assert!(is_meme_vector(&unit));
        unit[0] = 1.02;
        assert!(!is_meme_vector(&unit));
        unit[0] = f64::NAN;
        assert!(!is_meme_vector(&unit));
        assert!(!is_meme_vector(&[1.0]));
    }
}
