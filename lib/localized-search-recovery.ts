export type LocalizedSearchRecoveryStatus = "active" | "coverage-empty" | "unavailable";

export function shouldOfferLocalizedSearchRecovery({
  query,
  resultCount,
  localizedResultCount,
  localizedStatus,
}: {
  query: string;
  resultCount: number;
  localizedResultCount: number;
  localizedStatus: LocalizedSearchRecoveryStatus;
}): boolean {
  return (
    query.length > 0 &&
    resultCount > 0 &&
    localizedResultCount === 0 &&
    localizedStatus === "coverage-empty"
  );
}
