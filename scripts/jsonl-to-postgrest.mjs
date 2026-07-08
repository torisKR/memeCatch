#!/usr/bin/env node
// raw JSONL → PostgREST bulk insert용 JSON 배열 (service_role로 POST, RLS 우회)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [inDir, outFile] = process.argv.slice(2);
const CAT = new Set(["phrase","dance","song","image","comment","challenge"]);
const MED = new Set(["image","video","audio","text","embed"]);
const SAF = new Set(["green","yellow","gray","red"]);
const DIF = new Set(["beginner","normal","deep"]);
const SEN = new Set(["funny","ironic","controversial","negative","wholesome"]);
const seen = new Set();
const rows = [];
const nowIso = new Date(0).toISOString(); // placeholder; DB default now() 대신 서버가 채우도록 생략 가능
for (const f of readdirSync(inDir).filter((f) => f.endsWith(".jsonl")).sort())
  for (const line of readFileSync(join(inDir, f), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || !t.startsWith("{")) continue;
    let m; try { m = JSON.parse(t); } catch { continue; }
    if (!m.title || !m.summary) continue;
    const k = String(m.title).replace(/\s+/g, "").toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    const year = Math.min(2026, Math.max(1980, Number(m.year) || 2020));
    const safety = SAF.has(m.safety_level) ? m.safety_level : "yellow";
    const life = year >= 2025 ? "active" : year >= 2023 ? "cooling" : "archived";
    rows.push({
      title: m.title,
      slug: String(m.title).trim().replace(/\s+/g, "-").replaceAll("'", "").slice(0, 60),
      aliases: Array.isArray(m.aliases) ? m.aliases : [],
      summary: m.summary,
      description: m.description ?? "",
      origin: m.origin ?? "",
      usage_note: m.usage_note ?? null,
      caution: m.caution ?? null,
      safety_level: safety,
      lifecycle_status: life,
      moderation_status: "approved",
      category: CAT.has(m.category) ? m.category : (m.media_type === "video" ? "challenge" : "image"),
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
