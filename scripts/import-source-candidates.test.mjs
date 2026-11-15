import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const importer = new URL("./import-source-candidates.mjs", import.meta.url);

/** Recording stand-in for lib/db/admin.ts, swapped in by a resolve hook. */
const FAKE_ADMIN = `
import { appendFileSync } from "node:fs";
export function createAdminClient() {
  return {
    from(table) {
      const call = { table, ops: [] };
      const chain = new Proxy({}, {
        get(_, name) {
          if (name === "then") {
            return (resolve, reject) => {
              appendFileSync(process.env.FAKE_DB_LOG, JSON.stringify(call) + "\\n");
              const write = ["insert", "upsert"].includes(call.ops[0]?.[0]);
              let data = [];
              if (write && table === "media_sources") data = [{ id: "source-1" }];
              if (write && table === "meme_media") {
                data = process.env.FAKE_LINK_INSERTED === "1" ? [{ meme_id: "meme-1", source_id: "source-1" }] : [];
              }
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            };
          }
          return (...args) => { call.ops.push([name, ...args]); return chain; };
        },
      });
      return chain;
    },
  };
}
`;

async function runImporter({ dryRun = false, duplicateInput = false, linkInserted = true }) {
  const directory = await mkdtemp(join(tmpdir(), "memecatch-import-test-"));
  const fakeAdmin = join(directory, "fake-admin.mjs");
  const hooks = join(directory, "hooks.mjs");
  const register = join(directory, "register.mjs");
  const log = join(directory, "db.log");
  await writeFile(fakeAdmin, FAKE_ADMIN);
  await writeFile(hooks, `export async function resolve(specifier, context, next) {
  if (specifier.endsWith("lib/db/admin.ts")) return { url: ${JSON.stringify(pathToFileURL(fakeAdmin).href)}, shortCircuit: true };
  return next(specifier, context);
}\n`);
  await writeFile(register, `import { register } from "node:module";\nregister(${JSON.stringify(pathToFileURL(hooks).href)});\n`);
  await writeFile(log, "");

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
      ["--import", register, importer.pathname, input, ...(dryRun ? ["--dry-run"] : [])],
      {
        env: {
          ...process.env,
          DATABASE_URL: "postgres://fake.invalid/memecatch",
          FAKE_DB_LOG: log,
          FAKE_LINK_INSERTED: linkInserted ? "1" : "0",
        },
      },
    );
    const calls = (await readFile(log, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
    return { calls, stats: JSON.parse(stdout.trim().split("\n").at(-1)) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const isWrite = (call) => ["insert", "upsert"].includes(call.ops[0]?.[0]);

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
assert.equal(dry.calls.some(isWrite), false);

const inserted = await runImporter({ linkInserted: true });
assert.equal(inserted.stats.linked, 1);
assert.equal(inserted.stats.dupMedia, 0);
const insertedLink = inserted.calls.find((call) => call.table === "meme_media" && isWrite(call));
assert.ok(insertedLink.ops.some(([name]) => name === "select"), "link insert returns the inserted row");
assert.deepEqual(insertedLink.ops[0][1], {
  meme_id: "meme-1",
  source_id: "source-1",
  source_role: "usage_example",
  rights_basis: "unknown",
  review_state: "pending",
  reviewer_note: null,
});
const insertedSource = inserted.calls.find((call) => call.table === "media_sources" && isWrite(call));
assert.equal(insertedSource.ops[0][2].onConflict, "canonical_url");
assert.equal(insertedSource.ops[0][1].title, "Luna title");
assert.equal(insertedSource.ops[0][1].channel_name, "Luna creator");

const duplicate = await runImporter({ linkInserted: false });
assert.equal(duplicate.stats.linked, 0);
assert.equal(duplicate.stats.dupMedia, 1);

console.log("source candidate importer dry-run, insert, and duplicate accounting OK");
