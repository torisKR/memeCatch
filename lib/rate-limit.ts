/**
 * 초경량 in-memory rate limiter — 슬라이딩 윈도(Map 기반).
 *
 * 주의: 이 저장소는 서버리스 **인스턴스 로컬**이다. Vercel 등에서 인스턴스가
 * 여러 개 뜨면 각자 별도 카운터를 가지므로 완벽한 분산 rate limit이 아니며,
 * 콜드 스타트 시 카운터가 초기화된다. 목적은 정확한 쿼터 집행이 아니라
 * 단일 인스턴스로 몰리는 남용(스크립트 연타·크롤러)의 억제(best-effort)다.
 * 정밀한 전역 제한이 필요해지면 Upstash/Redis 등 외부 저장소로 교체할 것.
 */

type Bucket = {
  /** 윈도 안의 요청 타임스탬프(ms), 오래된 순 */
  hits: number[];
  /** GC가 만료 판단에 쓰는 윈도 길이(ms) */
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

/** 주기적 GC — 매 요청마다 전체 순회하지 않도록 간격을 두고 만료 버킷을 청소 */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const cutoff = now - bucket.windowMs;
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * key에 대해 windowMs 동안 limit회를 초과하면 거부한다.
 * 거부 시 Retry-After 헤더에 쓸 수 있는 대기 시간(초)을 함께 반환.
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const cutoff = now - windowMs;
  const bucket = buckets.get(key);
  const hits = bucket ? bucket.hits.filter((t) => t > cutoff) : [];

  if (hits.length >= limit) {
    // 가장 오래된 요청이 윈도를 벗어나는 시점까지 대기
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    buckets.set(key, { hits, windowMs });
    return { ok: false, retryAfterSec };
  }

  hits.push(now);
  buckets.set(key, { hits, windowMs });
  return { ok: true };
}

/**
 * 클라이언트 IP 추출 — x-forwarded-for 첫 항목(프록시 체인의 원 클라이언트)
 * 우선, 없으면 x-real-ip. 둘 다 없으면 "unknown"(로컬 dev 등)으로 묶는다.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
