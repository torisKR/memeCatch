#!/usr/bin/env node
/**
 * Collect review-only YouTube source candidates for existing meme records.
 *
 * This deliberately does not generate importable meme JSONL. A search result
 * is evidence for a reviewer, not proof that it is the original upload. The
 * output must therefore pass a source-match review before it can be added to
 * meme_sources or meme_contents.
 *
 * Usage:
 *   node scripts/collect-youtube-candidates.mjs data/memes/verified data/memes/collected/youtube-candidates.jsonl --max=120 --per-query=10
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const [inputPath, outputPath, ...args] = process.argv.slice(2);
const maxArg = args.find((arg) => arg.startsWith("--max="));
const perQueryArg = args.find((arg) => arg.startsWith("--per-query="));
const offsetArg = args.find((arg) => arg.startsWith("--offset="));
const yearsArg = args.find((arg) => arg.startsWith("--years="));
const maxPerYearArg = args.find((arg) => arg.startsWith("--max-per-year="));
const formatArg = args.find((arg) => arg.startsWith("--format="));
const delayArg = args.find((arg) => arg.startsWith("--delay="));
const max = Math.max(1, Math.min(500, Number(maxArg?.slice(6) ?? 100)));
const perQuery = Math.max(1, Math.min(20, Number(perQueryArg?.slice(12) ?? 10)));
const offset = Math.max(0, Number(offsetArg?.slice(9) ?? 0));
const requestedYears = new Set(
  (yearsArg?.slice(8) ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2026)
);
const maxPerYear = maxPerYearArg ? Math.max(1, Math.min(50, Number(maxPerYearArg.slice(15)))) : null;
const format = formatArg?.slice(9) ?? "video";
const delayMs = Math.max(500, Math.min(10_000, Number(delayArg?.slice(8) ?? 700)));

if (!inputPath || !outputPath) {
  console.error("usage: node scripts/collect-youtube-candidates.mjs <jsonl-file-or-directory> <output.jsonl> [--max=100] [--per-query=10] [--format=video|shorts]");
  process.exit(2);
}
if (format !== "video" && format !== "shorts") {
  console.error("--format must be either video or shorts");
  process.exit(2);
}

function jsonlFiles(path) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) throw new Error(`input was not found: ${path}`);
  if (statSync(absolute).isFile()) return extname(absolute) === ".jsonl" ? [absolute] : [];
  const entries = readdirSync(absolute, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) return jsonlFiles(entryPath);
    return extname(entry.name) === ".jsonl" ? [entryPath] : [];
  });
}

function readMemes(path) {
  const files = jsonlFiles(path).sort();
  const seen = new Set();
  const rows = [];
  for (const file of files) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const year = Number(row.year);
        const title = String(row.title ?? "").trim();
        const key = title.replace(/\s+/g, "").toLowerCase();
        if (!title || !Number.isInteger(year) || year < 2000 || year > 2026 || seen.has(key)) continue;
        seen.add(key);
        rows.push({ title, year, aliases: Array.isArray(row.aliases) ? row.aliases : [] });
      } catch {
        // Invalid input is ignored: the collection pass must never manufacture a row.
      }
    }
  }
  return rows.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, "ko"));
}

function extractInitialData(html) {
  const marker = "var ytInitialData = ";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("YouTube initial data was not found");
  const jsonStart = start + marker.length;
  const end = html.indexOf(";</script>", jsonStart);
  if (end < 0) throw new Error("YouTube initial data was incomplete");
  return JSON.parse(html.slice(jsonStart, end));
}

function text(value) {
  if (!value) return "";
  if (typeof value.simpleText === "string") return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text ?? "").join("");
  return "";
}

function videoCandidates(data) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.videoRenderer?.videoId) {
      const video = node.videoRenderer;
      found.push({
        videoId: video.videoId,
        videoTitle: text(video.title),
        channel: text(video.ownerText ?? video.longBylineText),
        publishedText: text(video.publishedTimeText),
        length: text(video.lengthText),
      });
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(data);
  const seen = new Set();
  return found.filter((video) => {
    if (seen.has(video.videoId)) return false;
    seen.add(video.videoId);
    return Boolean(video.videoTitle);
  });
}

function shortsCandidates(data) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const short = node.shortsLockupViewModel;
    const endpoint = short?.onTap?.innertubeCommand?.reelWatchEndpoint;
    if (short && endpoint?.videoId) {
      const accessibilityText = String(short.accessibilityText ?? "");
      const videoTitle = accessibilityText.split(",")[0]?.trim() ?? "";
      found.push({
        videoId: endpoint.videoId,
        videoTitle,
        channel: "",
        publishedText: "",
        length: "Shorts",
      });
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(data);
  const seen = new Set();
  return found.filter((video) => {
    if (seen.has(video.videoId)) return false;
    seen.add(video.videoId);
    return Boolean(video.videoTitle);
  });
}

function searchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchCandidates(meme) {
  const query = format === "shorts" ? `${meme.title} shorts` : `${meme.title} 공식`;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(searchUrl(query), {
        headers: {
          "accept-language": "ko-KR,ko;q=0.9",
          "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`YouTube search HTTP ${response.status}`);
      const data = extractInitialData(await response.text());
      const candidates = format === "shorts" ? shortsCandidates(data) : videoCandidates(data);
      return candidates.slice(0, perQuery).map((video) => ({
        meme_title: meme.title,
        origin_year: meme.year,
        aliases: meme.aliases,
        source_platform: format === "shorts" ? "YouTube Shorts" : "YouTube",
        source_url: format === "shorts" ? `https://www.youtube.com/shorts/${video.videoId}` : `https://www.youtube.com/watch?v=${video.videoId}`,
        video_title: video.videoTitle,
        channel: video.channel,
        published_text: video.publishedText,
        duration_text: video.length,
        search_query: query,
        collected_at: new Date().toISOString(),
        review_status: "needs_human_source_match",
        collection_note: "Public search candidate only. Verify that this is the original work or an authorized official upload before publishing.",
      }));
    } catch (error) {
      lastError = error;
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const sourceMemes = readMemes(inputPath).filter((meme) => requestedYears.size === 0 || requestedYears.has(meme.year));
const selectedMemes = maxPerYear
  ? sourceMemes.filter((meme, index, all) => all.findIndex((candidate) => candidate.year === meme.year && candidate.title === meme.title) >= 0)
  : sourceMemes;
const memes = maxPerYear
  ? [...new Set(selectedMemes.map((meme) => meme.year))]
      .sort((a, b) => a - b)
      .flatMap((year) => selectedMemes.filter((meme) => meme.year === year).slice(0, maxPerYear))
      .slice(offset, offset + max)
  : selectedMemes.slice(offset, offset + max);
const results = [];
const errors = [];
for (const [index, meme] of memes.entries()) {
  try {
    results.push(...(await fetchCandidates(meme)));
    process.stderr.write(`collected ${index + 1}/${memes.length}: ${meme.title}\n`);
  } catch (error) {
    errors.push({ title: meme.title, message: error instanceof Error ? error.message : String(error) });
    process.stderr.write(`failed ${index + 1}/${memes.length}: ${meme.title}\n`);
  }
  if (index < memes.length - 1) await sleep(delayMs);
}

const unique = [];
const seen = new Set();
for (const row of results) {
  const key = `${row.meme_title}\u0000${row.source_url}`;
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(row);
  }
}
mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${unique.map((row) => JSON.stringify(row)).join("\n")}\n`);
process.stderr.write(`${JSON.stringify({ offset, queried: memes.length, candidates: unique.length, errors: errors.length })}\n`);
if (errors.length) {
  writeFileSync(resolve(`${outputPath}.errors.json`), `${JSON.stringify(errors, null, 2)}\n`);
}
