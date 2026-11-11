/** HMAC and operator-bearer secret for analytics, view counts, and embedding probes. */
export function signingSecret(): string | null {
  const value = process.env.MEMECATCH_SIGNING_SECRET?.trim();
  return value || null;
}
