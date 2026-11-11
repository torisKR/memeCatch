#!/usr/bin/env node
/**
 * Offline poster-art backfill. Do not import this file from a page, route,
 * or cron. Generation runs only when this process is started by hand.
 *
 *   node --experimental-strip-types --import ./scripts/register-ts-paths.mjs \
 *     scripts/backfill-meme-art.mjs --list memes.json
 *
 * memes.json: [{ "shortId", "title", "meaning", "concept"? }]
 * Uploads meme-art/{shortId}.{ext} through the site object store (R2 bucket
 * memecatch-uploads when R2_* is set, otherwise the local object directory).
 * Writes memes.art_url when DATABASE_URL is set. --dry-run prints the prompt
 * and SQL and does not call the provider or the database.
 * GROK_IMAGE_API_KEY stays empty in the repo. This file does not embed it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import pg from "pg";
import { backfillMemeArt, grokImageProvider } from "../lib/meme-art-backfill.ts";
import { memeArtPrompt, memeArtPublicPath } from "../lib/meme-poster.ts";
import { objectStorage } from "../lib/object-storage.ts";

const { values } = parseArgs({
  options: {
    list: { type: "string" },
    out: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const listPath = values.list;
if (!listPath) {
  console.error("Pass --list path/to/memes.json");
  process.exit(1);
}

const memes = JSON.parse(readFileSync(listPath, "utf8"));
if (!Array.isArray(memes)) {
  console.error("--list must be a JSON array");
  process.exit(1);
}

const apiKey = process.env.GROK_IMAGE_API_KEY ?? "";
const dryRun = values["dry-run"] === true;
if (!dryRun && !apiKey.trim()) {
  console.error("GROK_IMAGE_API_KEY is empty. Set it in the environment. The script does not embed a secret.");
  process.exit(1);
}

const statements = [];
if (dryRun) {
  for (const meme of memes) {
    console.log(memeArtPrompt(meme));
    statements.push(artUpdateSql(meme.shortId, memeArtPublicPath(meme.shortId, "png")));
  }
  emitSql(statements, values.out);
  process.exit(0);
}

const storage = objectStorage().from("meme-art");
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const client = databaseUrl ? new pg.Client({ connectionString: databaseUrl }) : null;
if (client) await client.connect();

try {
  const result = await backfillMemeArt({
    memes,
    provider: grokImageProvider(apiKey),
    upload: async ({ key, bytes, contentType }) => {
      const name = key.startsWith("meme-art/") ? key.slice("meme-art/".length) : key;
      const uploaded = await storage.upload(name, bytes, { contentType, upsert: true });
      if (uploaded.error) throw new Error(uploaded.error.message);
    },
    writeArt: async ({ shortId, artUrl }) => {
      if (client) {
        await client.query("update public.memes set art_url = $1 where short_id = $2", [artUrl, shortId]);
      }
      statements.push(artUpdateSql(shortId, artUrl));
    },
  });
  emitSql(statements, values.out);
  if (!databaseUrl) {
    console.error("DATABASE_URL is unset, so the art column was not updated. SQL is above.");
  }
  if (result.failed.length > 0) {
    for (const failure of result.failed) console.error(`${failure.shortId}: ${failure.error}`);
    process.exitCode = 1;
  } else {
    console.log(`wrote ${result.written.length} art field${result.written.length === 1 ? "" : "s"}`);
  }
} finally {
  await client?.end();
}

function artUpdateSql(shortId, artUrl) {
  return `update public.memes set art_url = '${escapeLiteral(artUrl)}' where short_id = '${escapeLiteral(shortId)}';`;
}

function escapeLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function emitSql(lines, out) {
  const text = lines.length > 0 ? `${lines.join("\n")}\n` : "";
  if (out) writeFileSync(out, text);
  else if (!process.env.DATABASE_URL?.trim()) process.stdout.write(text);
}
