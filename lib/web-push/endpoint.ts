const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
] as const;

export function normalizeWebPushEndpoint(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const allowed = PUSH_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !allowed ||
      url.hash
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}
