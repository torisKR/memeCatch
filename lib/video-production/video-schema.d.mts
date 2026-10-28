export type ProducedVideoSchemaMetadata = {
  name: string;
  description: string | null;
  thumbnailUrl: string;
  uploadDate: string;
};
export function producedVideoEmbedUrl(videoId: unknown): string | null;
export function parseProducedVideoMetadata(
  value: unknown,
  videoId: unknown,
  now?: number,
): Readonly<ProducedVideoSchemaMetadata> | null;
