/**
 * Accept only same-origin relative destinations.
 * Decode a few layers before checking so encoded slashes/backslashes cannot
 * change meaning after the value crosses a framework or browser boundary.
 */
const APP_ORIGIN = "https://catchmeme.com";

/**
 * 인증을 마친 뒤 돌아갈 곳이 될 수 없는 경로들.
 * 헤더 로그인 버튼은 현재 경로를 next에 담는데(components/auth-menu.tsx),
 * /login에서 누르면 next=/login이 되어 로그인 후 다시 로그인 화면으로
 * 돌아온다. 목적지를 정하는 단일 관문에서 한 번만 막는다.
 */
const AUTH_ROUTES = ["/login", "/auth", "/forgot-password", "/reset-password"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

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
    if (isAuthRoute(resolved.pathname)) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}` || "/";
  } catch {
    return "/";
  }
}
