import type { ReactNode } from "react";

/** Keep each piece on one line when `auto-phrase` is unavailable. */
export function cjkKeepPhrases(
  text: string,
  phrases: readonly string[] | undefined,
  className: string,
): ReactNode {
  if (!phrases || phrases.join("") !== text) return text;
  return phrases.map((phrase, index) => (
    <span className={className} key={`${index}:${phrase}`}>{phrase}</span>
  ));
}
