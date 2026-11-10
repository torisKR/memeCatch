type EnvSource = Readonly<Record<string, string | undefined>>;

function trimmed(value: string | undefined): string | undefined {
  const sha = value?.trim();
  return sha || undefined;
}

/**
 * On Vercel the per-deployment platform SHA wins, including over a stale
 * project RELEASE_SHA. Off Vercel, Workers use RELEASE_SHA. The Worker
 * fills a missing header from version metadata in `releaseShaForWorker`.
 */
export function releaseShaFromEnv(env: EnvSource = process.env): string | undefined {
  if (env.VERCEL) return trimmed(env.VERCEL_GIT_COMMIT_SHA);
  return trimmed(env.RELEASE_SHA) || trimmed(env.VERCEL_GIT_COMMIT_SHA);
}
