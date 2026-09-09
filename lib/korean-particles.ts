const HANGUL_SYLLABLE = /[가-힣]/;

/** Last Hangul syllable has a batchim (받침) when (code − 0xAC00) % 28 ≠ 0. */
export function lastHangulHasBatchim(text: string): boolean {
  const chars = [...text].filter((char) => HANGUL_SYLLABLE.test(char));
  if (chars.length === 0) return false;
  const code = chars[chars.length - 1]!.charCodeAt(0) - 0xAC00;
  return code >= 0 && code <= 11_171 && code % 28 !== 0;
}

export type KoreanParticlePair = "이/가" | "을/를" | "은/는";

export function withKoreanParticle(
  word: string,
  particle: KoreanParticlePair,
): string {
  const batchim = lastHangulHasBatchim(word);
  const ending =
    particle === "이/가"
      ? batchim
        ? "이"
        : "가"
      : particle === "을/를"
        ? batchim
          ? "을"
          : "를"
        : batchim
          ? "은"
          : "는";
  return `${word}${ending}`;
}
