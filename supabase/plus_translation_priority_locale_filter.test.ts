import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "./migrations/20260810090000_plus_translation_priority_locale_filter.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("locale-scoped Plus translation priority migration", () => {
  it("filters by locale inside the demand CTE before applying the limit", () => {
    expect(migration).toMatch(
      /function public\.list_translation_priority_queue\(\s*p_limit integer,\s*p_locale text\s*\)/i,
    );
    expect(migration).toContain("v_locale text := nullif(lower(btrim(coalesce(p_locale, ''))), '');");
    expect(migration).toMatch(
      /where r\.status in \('requested', 'in_review'\)[\s\S]*and \(v_locale is null or r\.locale = v_locale\)[\s\S]*group by r\.meme_id, r\.locale[\s\S]*limit p_limit/i,
    );
    expect(migration).toMatch(/v_locale not in \('en', 'ja', 'zh', 'zh-tw'\)/i);
  });

  it("keeps the scoped RPC operator-only", () => {
    expect(migration).toMatch(/if not public\.is_operator\(\)[\s\S]*operator_required/i);
    expect(migration).toMatch(/revoke all on function public\.list_translation_priority_queue\(integer, text\)/i);
    expect(migration).toMatch(/grant execute on function public\.list_translation_priority_queue\(integer, text\)[\s\S]*to authenticated/i);
  });
});
