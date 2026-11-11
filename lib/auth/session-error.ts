export function isAuthSessionMissingError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: string }).name === "AuthSessionMissingError",
  );
}
