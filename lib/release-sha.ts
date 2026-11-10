/** Build-time release identity. Workers have no Vercel Git SHA, so RELEASE_SHA wins. */
export function releaseShaFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const sha = env.RELEASE_SHA?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim();
  return sha || undefined;
}
