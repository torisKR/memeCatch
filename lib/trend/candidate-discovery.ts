import { normalizeRadarHashtag } from "@/lib/trend/radar";

export type CandidateDiscoverySignal = {
  id: string;
  platform: string;
  platformContentId: string;
  creatorKey?: string;
  querySeed?: string;
  hashtags?: readonly string[];
  publishedAt?: string;
  observedAt: string;
};

export type DiscoveredTrendCandidate = {
  normalizedPhrase: string;
  displayName: string;
  signalIds: string[];
  platforms: string[];
  firstDiscoveredAt: string;
  earliestPublishedAt: string | null;
  observedContentCount: number;
  observedCreatorCount: number;
};

export function discoverTrendCandidates(input: {
  signals: readonly CandidateDiscoverySignal[];
  knownNames: readonly string[];
  minimumObservedContent?: number;
}): DiscoveredTrendCandidate[] {
  const minimumObservedContent = Math.max(2, input.minimumObservedContent ?? 2);
  const known = new Set(input.knownNames.map(normalizeRadarHashtag).filter(Boolean));
  const grouped = new Map<string, CandidateDiscoverySignal[]>();

  for (const signal of input.signals) {
    const querySeed = normalizeRadarHashtag(signal.querySeed ?? "");
    for (const rawHashtag of signal.hashtags ?? []) {
      const phrase = normalizeRadarHashtag(rawHashtag);
      if (!phrase || phrase.length < 2 || phrase === querySeed || known.has(phrase)) continue;
      const rows = grouped.get(phrase) ?? [];
      rows.push(signal);
      grouped.set(phrase, rows);
    }
  }

  return [...grouped.entries()].flatMap(([phrase, rows]) => {
    const uniqueRows = [
      ...new Map(
        rows.map((row) => [`${row.platform}:${row.platformContentId}`, row]),
      ).values(),
    ];
    if (uniqueRows.length < minimumObservedContent) return [];
    const firstDiscoveredAt = uniqueRows.map((row) => row.observedAt).sort()[0];
    const published = uniqueRows.flatMap((row) => row.publishedAt ? [row.publishedAt] : []).sort();
    return [{
      normalizedPhrase: phrase,
      displayName: rawDisplayName(rows, phrase),
      signalIds: uniqueRows.map((row) => row.id),
      platforms: [...new Set(uniqueRows.map((row) => row.platform))].sort(),
      firstDiscoveredAt,
      earliestPublishedAt: published[0] ?? null,
      observedContentCount: uniqueRows.length,
      observedCreatorCount: new Set(
        uniqueRows.flatMap((row) => row.creatorKey ? [row.creatorKey] : []),
      ).size,
    }];
  }).sort((left, right) =>
    right.observedContentCount - left.observedContentCount ||
    left.normalizedPhrase.localeCompare(right.normalizedPhrase, "ko"),
  );
}

function rawDisplayName(rows: readonly CandidateDiscoverySignal[], fallback: string): string {
  for (const row of rows) {
    const match = row.hashtags?.find((value) => normalizeRadarHashtag(value) === fallback);
    if (match) return match.replace(/^#+/u, "").trim();
  }
  return fallback;
}
