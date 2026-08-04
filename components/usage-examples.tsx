/**
 * "이렇게 써보세요" — 대화 예문 말풍선 섹션.
 * 데이터(memes.usage_examples jsonb 배열, 각 {situation, text})는 에이전트 D가
 * 별도 마이그레이션으로 생성 중 — 컬럼·데이터가 없으면 조용히 null을 반환한다.
 * jsonb라 형태를 신뢰할 수 없으므로 런타임 검증 후 최대 3개만 렌더.
 */

export type UsageExample = { situation: string; text: string };

const MAX_EXAMPLES = 3;

function parseUsageExamples(value: unknown): UsageExample[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is UsageExample => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const o = item as Record<string, unknown>;
      return (
        typeof o.situation === "string" &&
        o.situation.trim().length > 0 &&
        typeof o.text === "string" &&
        o.text.trim().length > 0
      );
    })
    .slice(0, MAX_EXAMPLES);
}

export function UsageExamples({ examples }: { examples?: unknown }) {
  const rows = parseUsageExamples(examples);
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="usage-examples-title"
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 id="usage-examples-title" className="text-lg font-bold">
        이렇게 써보세요
      </h2>
      <ul className="mt-3 space-y-4">
        {rows.map((ex) => (
          <li key={`${ex.situation}:${ex.text}`}>
            {/* 상황 라벨 — 모노 태그칩 */}
            <p className="stat-mono inline-flex w-fit items-center rounded-full border border-border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {ex.situation}
            </p>
            {/* 말풍선 — 왼쪽 위 모서리만 눌러 대화 버블 느낌 */}
            <p className="hover-glow-flame mt-1.5 w-fit max-w-full rounded-2xl rounded-tl-md bg-surface-2 px-4 py-2.5 text-base leading-relaxed">
              {ex.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
