#!/usr/bin/env node
/**
 * Precompute localized meme copy with Anthropic and persist it to Supabase.
 *
 * This script is intentionally an offline/service-role batch. Public page
 * requests must only read meme_translations and must never call the provider.
 *
 * Examples:
 *   pnpm translate:memes -- --locale=en --limit=20 --status=missing
 *   pnpm translate:memes -- --locale=ja --limit=50 --status=stale
 *   pnpm translate:memes -- --locale=zh-tw --status=machine --dry-run
 */
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

export const SUPPORTED_TRANSLATION_LOCALES = ["en", "ja", "zh", "zh-tw"];
export const SUPPORTED_SELECTION_STATUSES = [
  "missing",
  "stale",
  "machine",
  "reviewed",
  "all",
];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 1_000;
const PROMPT_VERSION = 1;
const PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-sonnet-5";
const SOURCE_PAGE_SIZE = 200;

const LOCALE_INSTRUCTIONS = {
  en: "natural international English",
  ja: "natural Japanese",
  zh: "natural Simplified Chinese (简体中文)",
  "zh-tw": "natural Traditional Chinese as used in Taiwan (繁體中文)",
};

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "summary",
    "description",
    "origin",
    "usage_note",
    "caution",
    "aliases",
    "usage_examples",
  ],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    description: { type: "string" },
    origin: { type: "string" },
    usage_note: { type: "string" },
    caution: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    usage_examples: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["situation", "text"],
        properties: {
          situation: { type: "string" },
          text: { type: "string" },
        },
      },
    },
  },
};

export function parseEnvFile(source) {
  const parsed = {};
  for (const rawLine of String(source).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    } else {
      // In unquoted values, only a whitespace-prefixed # begins a comment.
      value = value.replace(/\s+#.*$/, "").trim();
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

/**
 * Load project env without ever logging values.
 * Existing process/shell values win, followed by .env.local, then .env.
 * Dependencies are injected in tests so no real env file needs to be mutated.
 */
export function loadProjectEnv({
  cwd = process.cwd(),
  target = process.env,
  readFile = (path) => readFileSync(path, "utf8"),
} = {}) {
  const loaded = [];
  for (const filename of [".env.local", ".env"]) {
    const path = resolve(cwd, filename);
    let source;
    try {
      source = readFile(path);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") continue;
      throw error;
    }
    for (const [key, value] of Object.entries(parseEnvFile(source))) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) target[key] = value;
    }
    loaded.push(filename);
  }
  return loaded;
}

function readOption(argv, index) {
  const arg = argv[index];
  const equals = arg.indexOf("=");
  if (equals !== -1) return { value: arg.slice(equals + 1), consumed: 0 };
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${arg} requires a value`);
  }
  return { value, consumed: 1 };
}

export function parseArgs(argv) {
  const options = {
    locale: null,
    limit: DEFAULT_LIMIT,
    status: "missing",
    memeStatuses: ["approved", "limited"],
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    // `pnpm <script> -- <args>` may preserve the conventional separator.
    if (arg === "--") continue;
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`unknown argument: ${arg}`);

    const name = arg.split("=", 1)[0];
    if (!["--locale", "--limit", "--status", "--meme-status"].includes(name)) {
      throw new Error(`unknown option: ${name}`);
    }
    const { value, consumed } = readOption(argv, index);
    index += consumed;

    if (name === "--locale") options.locale = value.toLowerCase();
    if (name === "--status") options.status = value.toLowerCase();
    if (name === "--limit") options.limit = Number(value);
    if (name === "--meme-status") {
      options.memeStatuses = value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    }
  }

  if (options.help) return options;
  if (!SUPPORTED_TRANSLATION_LOCALES.includes(options.locale)) {
    throw new Error(`--locale must be one of: ${SUPPORTED_TRANSLATION_LOCALES.join(", ")}`);
  }
  if (!SUPPORTED_SELECTION_STATUSES.includes(options.status)) {
    throw new Error(`--status must be one of: ${SUPPORTED_SELECTION_STATUSES.join(", ")}`);
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  const allowedMemeStatuses = new Set(["approved", "limited"]);
  if (
    options.memeStatuses.length === 0 ||
    options.memeStatuses.some((status) => !allowedMemeStatuses.has(status))
  ) {
    throw new Error("--meme-status accepts only approved,limited");
  }
  return options;
}

export function localizedSlug(title, fallback) {
  const slug = String(title ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  return slug || fallback;
}

export function shouldTranslate(meme, locale, selectionStatus) {
  const translation = (meme.meme_translations ?? []).find(
    (candidate) => candidate.locale === locale,
  );
  const versionMismatch =
    translation != null && translation.source_updated_at !== meme.updated_at;

  if (selectionStatus === "all") return true;
  if (selectionStatus === "missing") return translation == null;
  if (selectionStatus === "stale") {
    return translation?.status === "stale" || versionMismatch;
  }
  return translation?.status === selectionStatus;
}

function translationForLocale(meme, locale) {
  return (meme?.meme_translations ?? []).find(
    (translation) => translation.locale === locale,
  );
}

/**
 * Capture both sides of the optimistic concurrency check before contacting the
 * provider. A null translation is significant: it must still be absent when
 * the generated copy is persisted.
 */
export function candidateSnapshot(meme, locale) {
  const translation = translationForLocale(meme, locale);
  return {
    sourceUpdatedAt: meme.updated_at,
    translation:
      translation == null
        ? null
        : {
            updatedAt: translation.updated_at,
            status: translation.status,
            sourceUpdatedAt: translation.source_updated_at,
          },
  };
}

export function candidateMatchesSnapshot(meme, locale, snapshot) {
  if (!meme || meme.updated_at !== snapshot.sourceUpdatedAt) return false;

  const translation = translationForLocale(meme, locale);
  if (snapshot.translation == null || translation == null) {
    return snapshot.translation == null && translation == null;
  }
  return (
    translation.updated_at === snapshot.translation.updatedAt &&
    translation.status === snapshot.translation.status &&
    translation.source_updated_at === snapshot.translation.sourceUpdatedAt
  );
}

export function sourceForTranslation(meme) {
  return {
    title: meme.title,
    aliases: Array.isArray(meme.aliases) ? meme.aliases : [],
    summary: meme.summary,
    description: meme.description,
    origin: meme.origin,
    usage_note: meme.usage_note ?? "",
    caution: meme.caution ?? "",
    usage_examples: Array.isArray(meme.usage_examples) ? meme.usage_examples : [],
  };
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeTranslation(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("provider returned a non-object translation");
  }
  const title = cleanString(raw.title);
  const summary = cleanString(raw.summary);
  if (!title || !summary) throw new Error("provider returned an empty title or summary");

  const aliases = Array.isArray(raw.aliases)
    ? [...new Set(raw.aliases.map(cleanString).filter(Boolean))].slice(0, 30)
    : [];
  const usageExamples = Array.isArray(raw.usage_examples)
    ? raw.usage_examples
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .map((item) => ({
          situation: cleanString(item.situation),
          text: cleanString(item.text),
        }))
        .filter((item) => item.situation && item.text)
        .slice(0, 10)
    : [];

  return {
    title,
    summary,
    description: cleanString(raw.description),
    origin: cleanString(raw.origin),
    usage_note: cleanString(raw.usage_note) || null,
    caution: cleanString(raw.caution) || null,
    aliases,
    usage_examples: usageExamples,
  };
}

function usage() {
  return [
    "Precompute meme translations (never called by page requests).",
    "",
    "Usage:",
    "  pnpm translate:memes -- --locale=en [--limit=20] [--status=missing] [--dry-run]",
    "",
    `Locales: ${SUPPORTED_TRANSLATION_LOCALES.join(", ")}`,
    `Translation selection: ${SUPPORTED_SELECTION_STATUSES.join(", ")}`,
    "Meme publication filter: --meme-status=approved,limited",
  ].join("\n");
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function findCandidates(supabase, options) {
  const candidates = [];
  let from = 0;

  while (candidates.length < options.limit) {
    const { data, error } = await supabase
      .from("memes")
      .select(
        "id,slug,title,aliases,summary,description,origin,usage_note,caution,usage_examples,updated_at,moderation_status,meme_translations(locale,status,source_updated_at,updated_at)",
      )
      .in("moderation_status", options.memeStatuses)
      .eq("meme_translations.locale", options.locale)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + SOURCE_PAGE_SIZE - 1);

    if (error) throw new Error(`candidate query failed: ${error.message}`);
    if (!data?.length) break;
    for (const meme of data) {
      if (shouldTranslate(meme, options.locale, options.status)) {
        candidates.push({
          meme,
          snapshot: candidateSnapshot(meme, options.locale),
        });
        if (candidates.length >= options.limit) break;
      }
    }
    if (data.length < SOURCE_PAGE_SIZE) break;
    from += data.length;
  }
  return candidates;
}

async function requestTranslation({ apiKey, model, locale, meme }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 5_000,
      system:
        "You are a careful localization editor for MemeCatch, a Korean meme dictionary. " +
        `Write every explanatory field in ${LOCALE_INSTRUCTIONS[locale]}. ` +
        "Preserve the original Korean meme name in the title when it helps recognition, and add a natural localized or romanized explanation rather than replacing the cultural term. " +
        "Translate meaning and context, not word-for-word phrasing. Never invent dates, people, sources, URLs, safety claims, or origin facts. Preserve uncertainty from the source. " +
        "Return empty strings or arrays when the source has no corresponding information. Do not add markdown or commentary outside the JSON schema.",
      messages: [
        {
          role: "user",
          content:
            `Target locale: ${locale}\nTranslate this reviewed Korean meme entry:\n` +
            JSON.stringify(sourceForTranslation(meme), null, 2),
        },
      ],
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed with HTTP ${response.status}`);
  }
  const message = await response.json();
  if (message.stop_reason === "refusal") throw new Error("Anthropic refused the translation");
  const text = message.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no structured text block");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Anthropic returned invalid JSON");
  }
  return normalizeTranslation(parsed);
}

async function candidateIsCurrent(supabase, candidate, locale) {
  const { data, error } = await supabase
    .from("memes")
    .select("updated_at,meme_translations(locale,status,source_updated_at,updated_at)")
    .eq("id", candidate.meme.id)
    .eq("meme_translations.locale", locale)
    .maybeSingle();
  if (error) throw new Error(`candidate version check failed: ${error.message}`);
  return candidateMatchesSnapshot(data, locale, candidate.snapshot);
}

export async function persistTranslationIfCurrent({
  supabase,
  candidate,
  locale,
  translation,
  model,
  translatedAt,
}) {
  const { meme, snapshot } = candidate;
  const payload = {
    meme_id: meme.id,
    locale,
    localized_slug: localizedSlug(translation.title, meme.slug),
    ...translation,
    status: "machine",
    source_updated_at: snapshot.sourceUpdatedAt,
    provider: PROVIDER,
    model,
    prompt_version: PROMPT_VERSION,
    translated_at: translatedAt,
    reviewed_at: null,
    reviewed_by: null,
  };

  if (snapshot.translation == null) {
    const { error } = await supabase.from("meme_translations").insert(payload);
    // A target created after the version check is newer work, not a batch failure.
    if (error?.code === "23505") return false;
    if (error) throw new Error(`translation insert failed: ${error.message}`);
    return true;
  }

  const { data, error } = await supabase
    .from("meme_translations")
    .update(payload)
    .eq("meme_id", meme.id)
    .eq("locale", locale)
    .eq("updated_at", snapshot.translation.updatedAt)
    .eq("status", snapshot.translation.status)
    .eq("source_updated_at", snapshot.translation.sourceUpdatedAt)
    .select("meme_id")
    .maybeSingle();
  if (error) throw new Error(`translation update failed: ${error.message}`);
  return data != null;
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return { selected: 0, translated: 0, failed: 0, skipped: 0 };
  }

  loadProjectEnv();
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  // A dry run only inspects the database selection and never contacts Anthropic.
  const apiKey = options.dryRun ? null : requiredEnv("ANTHROPIC_API_KEY");
  const model = process.env.ANTHROPIC_TRANSLATION_MODEL?.trim() || DEFAULT_MODEL;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const candidates = await findCandidates(supabase, options);
  console.log(
    `selected=${candidates.length} locale=${options.locale} status=${options.status} dryRun=${options.dryRun}`,
  );

  let translated = 0;
  let failed = 0;
  let skipped = 0;

  for (const [index, candidate] of candidates.entries()) {
    const { meme } = candidate;
    const label = `[${index + 1}/${candidates.length}] meme=${meme.id}`;
    try {
      if (options.dryRun) {
        console.log(`${label} would translate`);
        skipped += 1;
        continue;
      }

      const translation = await requestTranslation({
        apiKey,
        model,
        locale: options.locale,
        meme,
      });
      if (!(await candidateIsCurrent(supabase, candidate, options.locale))) {
        console.warn(`${label} skipped because the source or translation changed during translation`);
        skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      const persisted = await persistTranslationIfCurrent({
        supabase,
        candidate,
        locale: options.locale,
        translation,
        model,
        translatedAt: now,
      });
      if (!persisted) {
        console.warn(`${label} skipped because the translation changed before it could be saved`);
        skipped += 1;
        continue;
      }
      translated += 1;
      console.log(`${label} translated`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`${label} failed: ${message}`);
    }
  }

  const result = { selected: candidates.length, translated, failed, skipped };
  console.log(Object.entries(result).map(([key, value]) => `${key}=${value}`).join(" "));
  if (failed > 0) process.exitCode = 1;
  return result;
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`translate-memes: ${message}`);
    process.exitCode = 1;
  });
}
