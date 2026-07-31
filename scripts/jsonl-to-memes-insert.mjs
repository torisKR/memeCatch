import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeMemeCategory } from "./normalize-meme-category.mjs";
import { memeTitleKey } from "./meme-title-key.mjs";

const [inDir, outDir, batchArg] = process.argv.slice(2);
const BATCH = Number(batchArg ?? 300);
const MED = new Set(["image", "video", "audio", "text", "embed"]);
const SAF = new Set(["green", "yellow", "gray", "red"]);
const DIF = new Set(["beginner", "normal", "deep"]);
const SEN = new Set(["funny", "ironic", "controversial", "negative", "wholesome"]);

const q = (s) =>
  s == null || s === "" ? "null" : `'${String(s).replaceAll("'", "''")}'`;
const arr = (a) =>
  !a || !a.length ? "'{}'" : `array[${a.map(q).join(",")}]`;

const seen = new Set();
const rows = [];

for (const f of readdirSync(inDir).filter((f) => f.endsWith(".jsonl")).sort())
  for (const line of readFileSync(join(inDir, f), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || !t.startsWith("{")) continue;

    let m;
    try {
      m = JSON.parse(t);
    } catch {
      continue;
    }

    const title = String(m.title ?? "").trim();
    const summary = String(m.summary ?? m.content ?? m.description ?? "").trim();
    const description = String(m.description ?? summary ?? "").trim();
    if (!title || !summary) continue;

    const key = memeTitleKey(title);
    if (seen.has(key)) continue;
    seen.add(key);

    const dateYear = Number(String(m.date ?? "").match(/(20\d{2})/)?.[1] || "0");
    const year = Math.min(2026, Math.max(1980, Number(m.year) || dateYear || 2020));
    const category = normalizeMemeCategory(m);
    const media = MED.has(m.media_type) ? m.media_type : "image";
    const safety = SAF.has(m.safety_level) ? m.safety_level : "yellow";
    const difficulty = DIF.has(m.difficulty) ? m.difficulty : "normal";
    const sentiment = SEN.has(m.sentiment) ? m.sentiment : "funny";
    const lifecycle = year >= 2025 ? "active" : year >= 2023 ? "cooling" : "archived";
    const slug = title.replace(/\s+/g, "-").replaceAll("'", "").slice(0, 60);
    const aliases = Array.isArray(m.aliases) ? m.aliases : [];
    const usageNote = m.usage_note ?? null;
    const caution = m.caution ?? null;
    const usageContext = usageNote
      ? `jsonb_build_object('work',${q(safety)},'friends','green','family',${q(safety)},'sns',${q(safety)})`
      : "'{}'::jsonb";

    rows.push(
      `(${q(title)},${q(slug)},${arr(aliases)},${q(summary)},${q(
        description
      )},${q(m.origin ?? "")},${q(usageNote)},${q(caution)},${q(safety)},${q(
        lifecycle
      )},${q(category)},${q(media)},${q(difficulty)},${q(sentiment)},${year},${usageContext})`
    );
  }

mkdirSync(outDir, { recursive: true });
let idx = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  idx++;
  const chunk = rows.slice(i, i + BATCH);
  writeFileSync(
    join(outDir, `memes-${String(idx).padStart(2, "0")}.sql`),
    `insert into memes (title,slug,aliases,summary,description,origin,usage_note,caution,safety_level,lifecycle_status,category,media_type,difficulty,sentiment,origin_year,usage_context,moderation_status,published_at)\nselect v.* , 'approved'::moderation_status, now() from (values\n${chunk.join(",\n")}\n) as v(title,slug,aliases,summary,description,origin,usage_note,caution,safety_level,lifecycle_status,category,media_type,difficulty,sentiment,origin_year,usage_context)\non conflict (slug) do nothing;\n`
  );
}
console.log(`rows=${rows.length} files=${idx}`);
