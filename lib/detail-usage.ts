/**
 * The usage region may render a note, examples, or both. The accessible name
 * has to be an id that is actually in the tree for that combination.
 */
export function usageRegionLabelledBy(
  hasNote: boolean,
  hasExamples: boolean,
): "meme-usage" | "usage-examples-title" | null {
  if (hasNote) return "meme-usage";
  if (hasExamples) return "usage-examples-title";
  return null;
}
