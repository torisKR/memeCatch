export const SOURCE_INGESTION_ERROR_CODES = [
  "invalid_url",
  "missing_meme",
  "provider_transient",
  "provider_uncertain",
  "metadata_mismatch",
  "db_failure",
] as const;

export type SourceIngestionErrorCode =
  (typeof SOURCE_INGESTION_ERROR_CODES)[number];

export type SourceIngestionFailure = {
  readonly code: SourceIngestionErrorCode;
  readonly retryable: boolean;
};

export function sourceIngestionFailure(
  code: SourceIngestionErrorCode,
): SourceIngestionFailure {
  switch (code) {
    case "provider_transient":
    case "db_failure":
      return { code, retryable: true };
    case "invalid_url":
    case "missing_meme":
    case "provider_uncertain":
    case "metadata_mismatch":
      return { code, retryable: false };
  }
}
