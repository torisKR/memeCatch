import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { backfillMemeArt, grokImageProvider } from "@/lib/meme-art-backfill";
import { memeArtPrompt } from "@/lib/meme-poster";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

describe("meme art backfill", () => {
  it("uses the poster prompt, uploads the bytes, and writes the art field", async () => {
    const upload = vi.fn(async () => undefined);
    const writeArt = vi.fn(async () => undefined);
    const prompts: string[] = [];
    const provider = {
      generate: vi.fn(async (prompt: string) => {
        prompts.push(prompt);
        return png;
      }),
    };

    const result = await backfillMemeArt({
      memes: [{
        shortId: "jkm2022k",
        title: "중꺾마",
        meaning: "중요한 건 꺾이지 않는 마음",
        concept: "an unbroken heart",
      }],
      provider,
      upload,
      writeArt,
    });

    const prompt = prompts[0];
    expect(prompt).toBe(memeArtPrompt({
      title: "중꺾마",
      meaning: "중요한 건 꺾이지 않는 마음",
      concept: "an unbroken heart",
    }));
    expect(prompt).toContain("Abstract symbolic illustration for the Korean meme '중꺾마'");
    expect(prompt).toContain("Single central object representing an unbroken heart");
    expect(prompt).toContain("No text, no letters, no logos, no real people, no faces of public figures.");
    expect(upload).toHaveBeenCalledWith({
      key: "meme-art/jkm2022k.png",
      bytes: png,
      contentType: "image/png",
    });
    expect(writeArt).toHaveBeenCalledWith({
      shortId: "jkm2022k",
      artUrl: "/api/media/meme-art/jkm2022k.png",
    });
    expect(result.written).toEqual(["/api/media/meme-art/jkm2022k.png"]);
    expect(result.failed).toEqual([]);
  });

  it("refuses to call Grok when the API key is empty", async () => {
    const fetchImpl = vi.fn();
    await expect(grokImageProvider("", fetchImpl).generate("poster")).rejects.toThrow(
      /GROK_IMAGE_API_KEY is empty/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks Grok for a 4:3 image and does not put the key in the body", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [{ b64_json: Buffer.from(png).toString("base64") }],
    }), { status: 200 }));

    const bytes = await grokImageProvider("test-key", fetchImpl).generate("a heart");

    expect(bytes[0]).toBe(0x89);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.x.ai/v1/images/generations");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "grok-imagine-image-2.0",
      prompt: "a heart",
      aspect_ratio: "4:3",
      response_format: "b64_json",
    });
    expect(JSON.stringify(body)).not.toContain("test-key");
  });

  it("is not imported by a page, route, or cron", () => {
    const root = process.cwd();
    const files = sourceFiles(root, ["app", "components", "proxy.ts"]);
    const offenders = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes("meme-art-backfill") || text.includes("backfill-meme-art");
    });
    expect(offenders).toEqual([]);
  });
});

function sourceFiles(root: string, entries: string[]): string[] {
  const found: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry);
    const info = statSync(path);
    if (info.isFile()) {
      found.push(path);
      continue;
    }
    for (const name of readdirSync(path)) {
      if (name === "node_modules" || name === ".next") continue;
      const child = join(path, name);
      const childInfo = statSync(child);
      if (childInfo.isDirectory()) found.push(...sourceFiles(root, [child.slice(root.length + 1)]));
      else if (/\.(ts|tsx|mjs|js)$/.test(name)) found.push(child);
    }
  }
  return found;
}
