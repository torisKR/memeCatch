/**
 * Accept only same-origin relative destinations.
 * Decode a few layers before checking so encoded slashes/backslashes cannot
 * change meaning after the value crosses a framework or browser boundary.
 */
const APP_ORIGIN = "https://catchmeme.com";

export function safeNext(raw: unknown): string {
  const candidate = typeof raw === "string" ? raw : "/";
  if (candidate.length > 2048 || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return "/";
  }

  let decoded = candidate;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return "/";
    }
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) {
    return "/";
  }

  try {
    const resolved = new URL(candidate, APP_ORIGIN);
    if (resolved.origin !== APP_ORIGIN) return "/";
    // URL normalization can turn a seemingly safe `/..//host` into a
    // protocol-relative pathname. Never hand that form to a redirect API.
    if (resolved.pathname.startsWith("//") || resolved.pathname.includes("\\")) {
      return "/";
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}` || "/";
  } catch {
    return "/";
  }
}
