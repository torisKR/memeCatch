/**
 * Human-facing titles can use different quotation marks, separators, and
 * whitespace for the same meme. Imports must treat those variants as one
 * record so a collection pass cannot add a disguised duplicate.
 */
export function memeTitleKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}
