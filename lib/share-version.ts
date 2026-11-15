import { createHash } from "node:crypto";

/**
 * Share-card `?v` values are decimal integers.
 *
 * A catalog row uses UTC epoch milliseconds (`Date#getTime`, which does not
 * depend on the server timezone). node-pg returns `timestamptz` as a `Date`;
 * ISO strings are accepted too, parsed with `Date.parse` so milliseconds stay.
 * The published value is the newest of the Korean row, the translation, and
 * the representative image's `created_at` when that image is used.
 *
 * When a representative image URL is included, that integer is XOR-mixed
 * (via BigInt, so the full millisecond value survives) with the first 6 bytes
 * of sha256(url). A URL change moves `?v` even if the clocks do not. The
 * result is still a decimal integer and is identical under any `TZ`.
 *
 * Curated memes have no row clock and no site-hosted photo. Their `?v` is the
 * same decimal shape: the first 6 bytes of
 * sha256(title, summary, origin year, category, image URL), read as an
 * integer. It changes when the visible copy or the image URL changes.
 */
export type ShareTimestamp = Date | string | number;

const DECIMAL_VERSION = /^\d{1,16}$/;

export function shareVersionMillis(value: ShareTimestamp): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  if (DECIMAL_VERSION.test(value)) {
    const ms = Number(value);
    return Number.isSafeInteger(ms) ? ms : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** First 6 bytes of sha256(url). 48 bits, inside Number.MAX_SAFE_INTEGER. */
export function imageUrlMix(url: string): number {
  return createHash("sha256").update(url).digest().readUIntBE(0, 6);
}

export function shareCacheVersion(input: {
  timestamps: Array<ShareTimestamp | null | undefined>;
  imageUrl?: string | null;
}): string {
  const times = input.timestamps
    .map((value) => (value == null || value === "" ? null : shareVersionMillis(value)))
    .filter((value): value is number => value != null);
  const time = times.length > 0 ? Math.max(...times) : 0;
  const mix = input.imageUrl ? imageUrlMix(input.imageUrl) : 0;
  return (BigInt(time) ^ BigInt(mix)).toString(10);
}

export function curatedShareVersion(
  meme: {
    title: string;
    summary: string;
    origin_year: number | null;
    category: string;
  },
  imageUrl?: string | null,
): string {
  const digest = createHash("sha256")
    .update(
      [meme.title, meme.summary, String(meme.origin_year ?? ""), meme.category, imageUrl ?? ""].join(
        "\n",
      ),
    )
    .digest();
  return String(digest.readUIntBE(0, 6));
}
