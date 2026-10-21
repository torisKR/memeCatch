/**
 * Render stored editorial text as one inert Markdown line.
 *
 * Publication feeds must not let a title, summary, usage example, or source
 * label open a new heading/link/HTML block. URLs are handled separately by
 * callers and must never pass through this text helper.
 */
export function publicationMarkdownText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/([\\`*_{}\[\]()#+!|])/gu, "\\$1");
}
