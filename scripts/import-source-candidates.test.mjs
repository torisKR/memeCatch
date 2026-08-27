import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const importer = new URL("./import-source-candidates.mjs", import.meta.url);

async function runImporter({ dryRun = false, duplicateInput = false, linkInserted = true }) {
  const requests = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      requests.push({ method: request.method, url: request.url, headers: request.headers, body });
      let result = [];
      if (request.method === "POST" && request.url?.startsWith("/rest/v1/media_sources")) {
        result = [{ id: "source-1" }];
      } else if (request.method === "POST" && request.url === "/rest/v1/meme_media") {
        result = linkInserted ? [{ meme_id: "meme-1", source_id: "source-1" }] : [];
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(result));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  const directory = await mkdtemp(join(tmpdir(), "memecatch-import-test-"));
  const input = join(directory, "candidates.jsonl");
  const seed = JSON.stringify({
    meme_id: "meme-1",
    source_url: "https://www.tiktok.com/@creator/video/1234567890123456789",
    oembed_title: "Luna title",
    oembed_author_name: "Luna creator",
  });
  await writeFile(input, duplicateInput ? `${seed}\n${seed}\n` : `${seed}\n`);

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [importer.pathname, input, ...(dryRun ? ["--dry-run"] : [])],
      {
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
          SUPABASE_SERVICE_ROLE_KEY: "test-key",
        },
      },
    );
    return {
      requests,
      stats: JSON.parse(stdout.trim().split("\n").at(-1)),
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

const dry = await runImporter({ dryRun: true, duplicateInput: true });
assert.deepEqual(dry.stats, {
  dryRun: true,
  rows: 2,
  valid: 1,
  noMeme: 0,
  badUrl: 0,
  linked: 0,
  dupMedia: 1,
});
assert.equal(dry.requests.some((request) => request.method === "POST"), false);

const inserted = await runImporter({ linkInserted: true });
assert.equal(inserted.stats.linked, 1);
assert.equal(inserted.stats.dupMedia, 0);
const insertedLink = inserted.requests.find((request) => request.url === "/rest/v1/meme_media");
assert.match(insertedLink.headers.prefer, /return=representation/);
assert.deepEqual(JSON.parse(insertedLink.body), {
  meme_id: "meme-1",
  source_id: "source-1",
  source_role: "usage_example",
  rights_basis: "unknown",
  review_state: "pending",
  reviewer_note: null,
});
const insertedSource = inserted.requests.find((request) =>
  request.url?.startsWith("/rest/v1/media_sources"),
);
assert.equal(JSON.parse(insertedSource.body).title, "Luna title");
assert.equal(JSON.parse(insertedSource.body).channel_name, "Luna creator");

const duplicate = await runImporter({ linkInserted: false });
assert.equal(duplicate.stats.linked, 0);
assert.equal(duplicate.stats.dupMedia, 1);

console.log("source candidate importer dry-run, insert, and duplicate accounting OK");
