export function normalizePathname(pathname: string): string {
  return pathname === "/index" ? "/" : pathname;
}
