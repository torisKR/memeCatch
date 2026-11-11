import {
  memeArtObjectName,
  memeArtPrompt,
  memeArtPublicPath,
  type StoredArtExtension,
} from "@/lib/meme-poster";

/**
 * Offline poster backfill. Pages, routes, and cron handlers must not import
 * this module. Image generation stays in the batch script.
 */

const GROK_IMAGE_URL = "https://api.x.ai/v1/images/generations";
const GROK_IMAGE_MODEL = "grok-imagine-image-2.0";

export type MemeArtJob = {
  shortId: string;
  title: string;
  meaning: string;
  concept?: string | null;
};

export type MemeArtProvider = {
  generate(prompt: string): Promise<Uint8Array>;
};

export type MemeArtUpload = {
  key: string;
  bytes: Uint8Array;
  contentType: string;
};

export function imageExtension(bytes: Uint8Array): StoredArtExtension {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return "png";
}

export function artContentType(extension: StoredArtExtension): string {
  if (extension === "jpg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

export function grokImageProvider(
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): MemeArtProvider {
  const key = apiKey?.trim() ?? "";
  return {
    async generate(prompt: string) {
      if (!key) throw new Error("GROK_IMAGE_API_KEY is empty");
      const response = await fetchImpl(GROK_IMAGE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROK_IMAGE_MODEL,
          prompt,
          n: 1,
          aspect_ratio: "4:3",
          response_format: "b64_json",
        }),
      });
      if (!response.ok) throw new Error(`Grok image request failed (${response.status})`);
      const payload = (await response.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const image = payload.data?.[0];
      if (image?.b64_json) return Uint8Array.from(Buffer.from(image.b64_json, "base64"));
      if (image?.url) {
        const downloaded = await fetchImpl(image.url);
        if (!downloaded.ok) throw new Error(`Grok image download failed (${downloaded.status})`);
        return new Uint8Array(await downloaded.arrayBuffer());
      }
      throw new Error("Grok image response had no image");
    },
  };
}

export async function backfillMemeArt(input: {
  memes: readonly MemeArtJob[];
  provider: MemeArtProvider;
  upload: (object: MemeArtUpload) => Promise<void>;
  writeArt: (row: { shortId: string; artUrl: string }) => Promise<void>;
}): Promise<{ written: string[]; failed: Array<{ shortId: string; error: string }> }> {
  const written: string[] = [];
  const failed: Array<{ shortId: string; error: string }> = [];
  for (const meme of input.memes) {
    try {
      const bytes = await input.provider.generate(memeArtPrompt(meme));
      const extension = imageExtension(bytes);
      const artUrl = memeArtPublicPath(meme.shortId, extension);
      await input.upload({
        key: `meme-art/${memeArtObjectName(meme.shortId, extension)}`,
        bytes,
        contentType: artContentType(extension),
      });
      await input.writeArt({ shortId: meme.shortId, artUrl });
      written.push(artUrl);
    } catch (error) {
      failed.push({
        shortId: meme.shortId,
        error: error instanceof Error ? error.message : "art backfill failed",
      });
    }
  }
  return { written, failed };
}
