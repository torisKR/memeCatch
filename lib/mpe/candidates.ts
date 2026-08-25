export const CANDIDATE_SIGNAL_WEIGHTS = {
  text: 0.3,
  visual: 0.25,
  audio: 0.2,
  metadata: 0.15,
  titleHashtags: 0.1,
} as const;

export type CandidateSignal = keyof typeof CANDIDATE_SIGNAL_WEIGHTS;
export type CandidateRelation = "duplicate" | "related" | "derived" | "separate";

type SignalValue = {
  value: number | null | undefined;
  authorized?: boolean;
};

export type CandidateScoreInput = {
  exactDuplicate?: boolean;
  signals: Partial<Record<CandidateSignal, SignalValue>>;
};

export type CandidateScore = {
  score: number;
  relation: CandidateRelation;
  availableSignals: CandidateSignal[];
  contributions: Partial<Record<CandidateSignal, number>>;
};

const WORD_RE = /[\p{Script=Hangul}\p{L}\p{N}]+/gu;

export function normalizeKoreanText(value: string): string {
  return (value.normalize("NFKC").toLocaleLowerCase("ko-KR").match(WORD_RE) ?? []).join(" ");
}

function tokens(value: string): Set<string> {
  return new Set(normalizeKoreanText(value).split(" ").filter(Boolean));
}

function trigrams(value: string): Set<string> {
  const compact = normalizeKoreanText(value).replaceAll(" ", "");
  if (!compact) return new Set();
  if (compact.length < 3) return new Set([compact]);
  return new Set(Array.from({ length: compact.length - 2 }, (_, index) => compact.slice(index, index + 3)));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function dice(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return (2 * intersection) / (left.size + right.size);
}

export function koreanTextSimilarity(left: string, right: string): number {
  if (!normalizeKoreanText(left) || !normalizeKoreanText(right)) return 0;
  return 0.45 * jaccard(tokens(left), tokens(right)) + 0.55 * dice(trigrams(left), trigrams(right));
}

export function deterministicTextEmbedding(value: string, dimensions = 64): number[] {
  const normalized = normalizeKoreanText(value).replaceAll(" ", "");
  const vector = Array<number>(dimensions).fill(0);
  if (!normalized) return vector;
  const features = normalized.length < 3
    ? [normalized]
    : Array.from({ length: normalized.length - 2 }, (_, index) => normalized.slice(index, index + 3));
  for (const feature of features) {
    let hash = 2166136261;
    for (const character of feature) {
      hash ^= character.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16777619);
    }
    vector[(hash >>> 1) % dimensions] += (hash & 1) === 0 ? 1 : -1;
  }
  const norm = Math.hypot(...vector);
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

export function cosineSimilarity(left: number[], right: number[]): number | null {
  if (left.length === 0 || left.length !== right.length) return null;
  const leftNorm = Math.hypot(...left);
  const rightNorm = Math.hypot(...right);
  if (leftNorm === 0 || rightNorm === 0) return null;
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  return Math.max(0, Math.min(1, dot / (leftNorm * rightNorm)));
}

export function perceptualHashSimilarity(left: string, right: string): number | null {
  const normalizedLeft = left.trim().toLowerCase();
  const normalizedRight = right.trim().toLowerCase();
  if (
    normalizedLeft.length === 0 ||
    normalizedLeft.length !== normalizedRight.length ||
    !/^[0-9a-f]+$/.test(normalizedLeft) ||
    !/^[0-9a-f]+$/.test(normalizedRight)
  ) return null;

  let differentBits = 0;
  for (let index = 0; index < normalizedLeft.length; index += 1) {
    const xor = Number.parseInt(normalizedLeft[index], 16) ^ Number.parseInt(normalizedRight[index], 16);
    differentBits += xor.toString(2).replaceAll("0", "").length;
  }
  return 1 - differentBits / (normalizedLeft.length * 4);
}

export function classifyCandidate(score: number): CandidateRelation {
  if (score >= 0.82) return "duplicate";
  if (score >= 0.65) return "related";
  if (score >= 0.45) return "derived";
  return "separate";
}

export function scoreCandidate(input: CandidateScoreInput): CandidateScore {
  if (input.exactDuplicate) {
    return { score: 1, relation: "duplicate", availableSignals: [], contributions: {} };
  }

  const availableSignals = (Object.keys(CANDIDATE_SIGNAL_WEIGHTS) as CandidateSignal[]).filter((signal) => {
    const candidate = input.signals[signal];
    return candidate?.authorized !== false && typeof candidate?.value === "number" && Number.isFinite(candidate.value);
  });
  const totalWeight = availableSignals.reduce((sum, signal) => sum + CANDIDATE_SIGNAL_WEIGHTS[signal], 0);
  const contributions: Partial<Record<CandidateSignal, number>> = {};
  let score = 0;

  for (const signal of availableSignals) {
    const value = Math.min(1, Math.max(0, input.signals[signal]!.value!));
    const contribution = value * CANDIDATE_SIGNAL_WEIGHTS[signal] / totalWeight;
    contributions[signal] = contribution;
    score += contribution;
  }

  return { score, relation: classifyCandidate(score), availableSignals, contributions };
}
