#!/usr/bin/env node
/**
 * Promote curated careet.net slang/abbreviation candidates into the local
 * abbreviation dictionary under data/dictionary/abbreviations.jsonl.
 *
 * Only keeps rows that look like real terms with usable definitions, and
 * dedupes against the existing dictionary + meme catalog via memeTitleKey.
 *
 * Usage:
 *   node scripts/import-careet-to-abbreviation-dictionary.mjs \
 *     data/memes/collected/careet-slang-candidates-2026-07-16.jsonl \
 *     data/dictionary/abbreviations.jsonl
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { memeTitleKey } from "./meme-title-key.mjs";

const NOISE_TERM =
  /(?:이란|이란\b|줄임말|모음|사전|프로젝트|라이브$|VS|해독|콘텐츠|인터뷰|브랜드)/i;
const BAD_DEFINITION =
  /멤버십 구간|목차에 포함된|줄임말 모음|^가 아니라|careet\.net \d+|공개 정의는 후속/;

function loadJsonl(path) {
  if (!existsSync(resolve(path))) return [];
  return readFileSync(resolve(path), "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function cleanDefinition(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^✓\s*/, "")
    .trim()
    .slice(0, 500);
}

function isAbbreviationLike(term, definition, category) {
  if (category === "abbreviation") return true;
  if (category === "slang") return true;
  if (/줄임말|의 줄임|줄여/.test(definition)) return true;
  // Compact coined terms (2–6 Hangul/Latin syllables) often act as 줄임말.
  if (/^[가-힣A-Za-z0-9]{2,8}$/.test(term) && definition.length >= 12) return true;
  return false;
}

function shouldKeep(row) {
  const term = String(row.term ?? row.title ?? "").trim();
  const definition = cleanDefinition(row.definition);
  const category = String(row.category ?? "abbreviation");
  if (!term || term.length < 2 || term.length > 40) return null;
  if (NOISE_TERM.test(term)) return null;
  if (!definition || definition.length < 10) return null;
  if (BAD_DEFINITION.test(definition)) return null;
  if (!isAbbreviationLike(term, definition, category)) {
    // Allow curated trendy words from careet dictionary free tier / solid slang.
    if (!["slang", "phrase", "meme"].includes(category)) return null;
    if (definition.length < 20) return null;
  }
  // Drop truncated garbage defs.
  if (/…\s*$|\.\.\.\s*$/.test(definition) && definition.length < 40) return null;
  if (definition.endsWith("의") || definition.endsWith("는") || definition.endsWith("과")) return null;

  const kind =
    category === "abbreviation" || /줄임말|의 줄임|줄여/.test(definition)
      ? "abbreviation"
      : category === "slang"
        ? "slang"
        : "trendy_word";

  return {
    term,
    aliases: Array.isArray(row.aliases) ? row.aliases.filter(Boolean) : [],
    expansion: kind === "abbreviation" ? inferExpansion(term, definition) : null,
    definition,
    kind,
    source: "careet.net",
    source_url: typeof row.source_url === "string" ? row.source_url : null,
    origin_year: Number.isInteger(row.origin_year) ? row.origin_year : null,
    review_status: "needs_human_review",
    imported_at: new Date().toISOString(),
  };
}

function inferExpansion(term, definition) {
  const match =
    definition.match(/[‘'"]([^‘'"]{2,40})[’'"]의 줄임말/) ||
    definition.match(/^([가-힣A-Za-z0-9 ·]{2,40})의 줄임말/);
  if (!match) return null;
  const expansion = match[1].replace(/\s+/g, " ").trim();
  if (!expansion || expansion.length < 2 || memeTitleKey(expansion) === memeTitleKey(term)) return null;
  if (/신조어|처럼|사용되는|줄임말로/.test(expansion)) return null;
  return expansion.slice(0, 80);
}

async function main() {
  const [inputPath, outputPath, ...args] = process.argv.slice(2);
  const catalogArg = args.find((arg) => arg.startsWith("--catalog="))?.slice(10) ?? "data/memes/verified,data/memes/raw";
  if (!inputPath || !outputPath) {
    console.error(
      "usage: node scripts/import-careet-to-abbreviation-dictionary.mjs <careet.jsonl> <abbreviations.jsonl> [--catalog=data/memes/verified,data/memes/raw]",
    );
    process.exitCode = 2;
    return;
  }

  const existing = loadJsonl(outputPath);
  const keys = new Set(
    existing.flatMap((row) => [memeTitleKey(row.term), ...(row.aliases ?? []).map(memeTitleKey)].filter(Boolean)),
  );

  const { readdirSync, statSync } = await import("node:fs");
  const { join, extname } = await import("node:path");
  function walkCatalog(path) {
    const absolute = resolve(path);
    if (!existsSync(absolute)) return;
    if (statSync(absolute).isFile()) {
      if (extname(absolute) === ".jsonl") {
        for (const row of loadJsonl(absolute)) {
          for (const name of [row.title, row.term, ...(row.aliases ?? [])]) {
            const key = memeTitleKey(name);
            if (key) keys.add(key);
          }
        }
      }
      return;
    }
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      walkCatalog(join(absolute, entry.name));
    }
  }
  for (const catalogPath of catalogArg.split(",").map((part) => part.trim()).filter(Boolean)) {
    walkCatalog(catalogPath);
  }

  const incoming = loadJsonl(inputPath);
  const added = [];
  let skipped = 0;
  for (const row of incoming) {
    const normalized = shouldKeep(row);
    if (!normalized) {
      skipped += 1;
      continue;
    }
    const key = memeTitleKey(normalized.term);
    if (!key || keys.has(key)) {
      skipped += 1;
      continue;
    }
    keys.add(key);
    added.push(normalized);
  }

  // Seed free careet Dictionary entries that may not be in the candidate file cleanly.
  const dictionarySeeds = [
    {
      term: "이타백",
      aliases: ["ita bag"],
      expansion: null,
      definition: "좋아하는 캐릭터나 연예인의 굿즈(배지, 인형, 아크릴 스탠드 등)를 가방 겉면에 가득 장식한 가방을 뜻하는 말",
      kind: "trendy_word",
      source: "careet.net",
      source_url: "https://www.careet.net/Dictionary",
      origin_year: null,
      review_status: "needs_human_review",
      imported_at: new Date().toISOString(),
    },
    {
      term: "클린걸",
      aliases: ["clean girl"],
      expansion: null,
      definition: "자연스럽고 건강한 아름다움을 추구하는 트렌드. 미니멀한 스타일과 자기관리를 중시하며, 정신적·육체적 웰빙을 지향하는 것이 특징.",
      kind: "trendy_word",
      source: "careet.net",
      source_url: "https://www.careet.net/Dictionary",
      origin_year: null,
      review_status: "needs_human_review",
      imported_at: new Date().toISOString(),
    },
    {
      term: "감옥에~서 누가 돌아왔~게",
      aliases: ["감옥에서 누가 돌아왔게"],
      expansion: null,
      definition: "크리에이터 ‘팔리아치’의 유행어. ‘안심귀가 통화 서비스’ 상황극에서 나온 대사로, 상대방을 겁 주기 위한 과장된 억양과 대사가 인기 포인트.",
      kind: "trendy_word",
      source: "careet.net",
      source_url: "https://www.careet.net/Dictionary",
      origin_year: null,
      review_status: "needs_human_review",
      imported_at: new Date().toISOString(),
    },
  ];
  for (const seed of dictionarySeeds) {
    const key = memeTitleKey(seed.term);
    if (!key || keys.has(key)) continue;
    keys.add(key);
    added.push(seed);
  }

  const merged = [...existing, ...added].sort((a, b) => String(a.term).localeCompare(String(b.term), "ko"));
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(resolve(outputPath), `${merged.map((row) => JSON.stringify(row)).join("\n")}${merged.length ? "\n" : ""}`);
  process.stderr.write(
    `${JSON.stringify({
      incoming: incoming.length,
      skipped,
      added: added.length,
      dictionary_total: merged.length,
      abbreviations: merged.filter((row) => row.kind === "abbreviation").length,
      slang: merged.filter((row) => row.kind === "slang").length,
      trendy_words: merged.filter((row) => row.kind === "trendy_word").length,
    })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
