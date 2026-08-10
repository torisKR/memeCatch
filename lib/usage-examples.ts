export type UsageExample = { situation: string; text: string };

export const MAX_USAGE_EXAMPLES = 3;
export const MAX_USAGE_EXAMPLE_SITUATION_LENGTH = 120;
export const MAX_USAGE_EXAMPLE_TEXT_LENGTH = 500;

export function parseUsageExamples(value: unknown): UsageExample[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item): UsageExample[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const object = item as Record<string, unknown>;
      const situation = object.situation;
      const text = object.text;
      if (
        typeof situation !== "string" ||
        typeof text !== "string" ||
        situation.trim().length === 0 ||
        text.trim().length === 0 ||
        situation.length > MAX_USAGE_EXAMPLE_SITUATION_LENGTH ||
        text.length > MAX_USAGE_EXAMPLE_TEXT_LENGTH
      ) {
        return [];
      }
      return [{ situation, text }];
    })
    .slice(0, MAX_USAGE_EXAMPLES);
}
