/**
 * Accept only same-origin relative destinations.
 * Decode a few layers before checking so encoded slashes/backslashes cannot
 * change meaning after the value crosses a framework or browser boundary.
 */
const APP_ORIGIN = "https://catchmeme.com";
const AUTH_RETURN_QUERY_MAX_Q = 200;
const AUTH_RETURN_QUERY_MAX_NAME = 100;
const AUTH_RETURN_QUERY_KEYS = ["focus", "q", "status", "origin"] as const;
const AUTH_RETURN_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTH_RETURN_STATUS_VALUES = new Set([
  "pending",
  "fact_checking",
  "rights_checking",
  "approved",
  "limited",
  "rejected",
]);

export type AuthReturnSearch =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

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

function asSearchParams(search: AuthReturnSearch | undefined): URLSearchParams {
  if (!search) return new URLSearchParams();
  if (search instanceof URLSearchParams) return search;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }
  return params;
}

function isAllowedAuthReturnValue(key: string, value: string): boolean {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return false;
  if (key === "focus") return value === "unsourced";
  if (key === "q") return value.length <= AUTH_RETURN_QUERY_MAX_Q;
  if (key === "name") return value.length <= AUTH_RETURN_QUERY_MAX_NAME;
  if (key === "status") return AUTH_RETURN_STATUS_VALUES.has(value);
  if (key === "origin") return value === "house_original";
  return false;
}

/**
 * Keep only allowlisted query keys on a login `next` path.
 * Unknown keys, duplicates, and invalid values are dropped so the return
 * URL cannot carry open-ended user input into `/login?next=`.
 */
export function withAllowlistedSearch(
  pathname: string,
  search?: AuthReturnSearch,
): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("?")) {
    return pathname;
  }
  const params = asSearchParams(search);
  const kept = new URLSearchParams();
  const keys = pathname === "/submit"
    ? ["name"]
    : pathname === "/admin/sources"
      ? ["memeId"]
      : pathname === "/products/new"
        ? ["edit"]
      : AUTH_RETURN_QUERY_KEYS;
  for (const key of keys) {
    const values = params.getAll(key);
    if (values.length !== 1) continue;
    if (pathname === "/admin/sources" && key === "memeId") {
      if (AUTH_RETURN_UUID_RE.test(values[0])) kept.set(key, values[0].toLowerCase());
      continue;
    }
    if (pathname === "/products/new" && key === "edit") {
      if (AUTH_RETURN_UUID_RE.test(values[0])) kept.set(key, values[0].toLowerCase());
      continue;
    }
    if (!isAllowedAuthReturnValue(key, values[0])) continue;
    kept.set(key, values[0]);
  }
  const query = kept.toString();
  return query ? `${pathname}?${query}` : pathname;
}
