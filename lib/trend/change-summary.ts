export type TrendSummaryPoint = {
  date: string;
  trend_score: number;
  views: number;
  reactions: number;
  saves: number;
};

export type TrendChangeSummary = {
  days: 30 | 90;
  direction: "up" | "down" | "flat" | "insufficient";
  confidence: "high" | "medium" | "low" | "insufficient";
  sampleCount: number;
  coveragePercent: number;
  lastObservedAt: string | null;
  from: string | null;
  to: string | null;
  startScore: number | null;
  endScore: number | null;
  views: number;
  reactions: number;
  saves: number;
};

export function buildTrendChangeSummaries(
  input: readonly TrendSummaryPoint[],
): TrendChangeSummary[] {
  const series = [...input]
    .filter((point) => Number.isFinite(Date.parse(`${point.date}T00:00:00Z`)))
    .sort((left, right) => left.date.localeCompare(right.date));
  const endDate = series.at(-1)?.date;

  return ([30, 90] as const).map((days) => {
    const cutoff = endDate ? new Date(`${endDate}T00:00:00Z`) : null;
    cutoff?.setUTCDate(cutoff.getUTCDate() - days + 1);
    const points = cutoff
      ? series.filter((point) => point.date >= cutoff.toISOString().slice(0, 10))
      : [];
    const first = points[0];
    const last = points.at(-1);
    const delta = first && last ? last.trend_score - first.trend_score : null;
    const coveragePercent = Math.min(100, Math.round((points.length / days) * 100));
    const confidence = points.length < 2
      ? "insufficient"
      : coveragePercent >= 80
        ? "high"
        : coveragePercent >= 40
          ? "medium"
          : "low";

    return {
      days,
      direction: points.length < 2 ? "insufficient" : delta! > 0 ? "up" : delta! < 0 ? "down" : "flat",
      confidence,
      sampleCount: points.length,
      coveragePercent,
      lastObservedAt: last?.date ?? null,
      from: first?.date ?? null,
      to: last?.date ?? null,
      startScore: first?.trend_score ?? null,
      endScore: last?.trend_score ?? null,
      views: points.reduce((sum, point) => sum + point.views, 0),
      reactions: points.reduce((sum, point) => sum + point.reactions, 0),
      saves: points.reduce((sum, point) => sum + point.saves, 0),
    };
  });
}
