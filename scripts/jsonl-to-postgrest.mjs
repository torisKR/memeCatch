#!/usr/bin/env node
// raw JSONL → PostgREST bulk insert용 JSON 배열 (service_role로 POST, RLS 우회)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeMemeCategory } from "./normalize-meme-category.mjs";
const [inDir, outFile] = process.argv.slice(2);
const MED = new Set(["image","video","audio","text","embed"]);
const SAF = new Set(["green","yellow","gray","red"]);
const DIF = new Set(["beginner","normal","deep"]);
const SEN = new Set(["funny","ironic","controversial","negative","wholesome"]);
const seen = new Set();
const rows = [];
// placeholder: DB 기본 now()로 대체됨
for (const f of readdirSync(inDir).filter((f) => f.endsWith(".jsonl")).sort())
  for (const line of readFileSync(join(inDir, f), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || !t.startsWith("{")) continue;
    let m; try { m = JSON.parse(t); } catch { continue; }
    const title = String(m.title ?? "").trim();
    const summary = String(m.summary ?? m.content ?? m.description ?? "").trim();
    const description = String(m.description ?? summary ?? "").trim();
    if (!title || !summary) continue;
    const k = title.replace(/\s+/g, "").toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    const dateYear = Number(String(m.date ?? "").match(/(20\d{2})/)?.[1] ?? "0");
    const year = Math.min(2026, Math.max(1980, Number(m.year) || dateYear || 2020));
    const safety = SAF.has(m.safety_level) ? m.safety_level : "yellow";
    const life = year >= 2025 ? "active" : year >= 2023 ? "cooling" : "archived";
    const aliases = Array.isArray(m.aliases) ? m.aliases : [];
    const caution = m.caution ?? null;
    const usageNote = m.usage_note ?? null;
    rows.push({
      title,
      slug: title.replace(/\s+/g, "-").replaceAll("'", "").slice(0, 60),
      aliases,
      summary,
      description,
      origin: m.origin ?? "",
      usage_note: usageNote,
      caution,
      safety_level: safety,
      lifecycle_status: life,
      moderation_status: "approved",
      category: normalizeMemeCategory(m),
      media_type: MED.has(m.media_type) ? m.media_type : "image",
      difficulty: DIF.has(m.difficulty) ? m.difficulty : "normal",
      sentiment: SEN.has(m.sentiment) ? m.sentiment : "funny",
      origin_year: year,
      usage_context: m.usage_note
        ? { work: safety, friends: "green", family: safety, sns: safety }
        : {},
      published_at: new Date().toISOString(),
    });
  }
writeFileSync(outFile, JSON.stringify(rows));
console.log(`rows=${rows.length}`);
