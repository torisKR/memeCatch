import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  candidateMatchesSnapshot,
  candidateSnapshot,
  localizedSlug,
  loadProjectEnv,
  normalizeTranslation,
  parseArgs,
  parseEnvFile,
  persistTranslationIfCurrent,
  shouldTranslate,
  sourceForTranslation,
} from "./translate-memes.mjs";

assert.deepEqual(parseArgs(["--locale=en"]), {
  locale: "en",
  limit: 20,
  status: "missing",
  memeStatuses: ["approved", "limited"],
  dryRun: false,
  help: false,
});
assert.deepEqual(parseArgs(["--", "--locale=en", "--limit=1", "--dry-run"]), {
  locale: "en",
  limit: 1,
  status: "missing",
  memeStatuses: ["approved", "limited"],
  dryRun: true,
  help: false,
});
assert.deepEqual(
  parseArgs([
    "--locale",
    "zh-tw",
    "--limit",
    "3",
    "--status=stale",
    "--meme-status=approved",
    "--dry-run",
  ]),
  {
    locale: "zh-tw",
    limit: 3,
    status: "stale",
    memeStatuses: ["approved"],
    dryRun: true,
    help: false,
  },
);
assert.throws(() => parseArgs(["--locale=ko"]), /--locale must be one of/);
assert.throws(() => parseArgs(["--locale=en", "--limit=0"]), /--limit/);
assert.throws(() => parseArgs(["--locale=en", "--status=pending"]), /--status/);

assert.deepEqual(
  parseEnvFile(`
    # comment
    PLAIN=value
    export QUOTED="hello world"
    SINGLE='literal # value'
    INLINE=kept # removed comment
  `),
  {
    PLAIN: "value",
    QUOTED: "hello world",
    SINGLE: "literal # value",
    INLINE: "kept",
  },
);

const envTarget = { ANTHROPIC_API_KEY: "from-shell" };
const envFiles = new Map([
  [
    "/project/.env.local",
    "SUPABASE_SERVICE_ROLE_KEY=from-local\nNEXT_PUBLIC_SUPABASE_URL=https://local.example",
  ],
  [
    "/project/.env",
    "ANTHROPIC_API_KEY=from-env\nNEXT_PUBLIC_SUPABASE_URL=https://env.example",
  ],
]);
assert.deepEqual(
  loadProjectEnv({
    cwd: "/project",
    target: envTarget,
    readFile(path) {
      if (envFiles.has(path)) return envFiles.get(path);
      const error = new Error("not found");
      error.code = "ENOENT";
      throw error;
    },
  }),
  [".env.local", ".env"],
);
assert.deepEqual(envTarget, {
  ANTHROPIC_API_KEY: "from-shell",
  SUPABASE_SERVICE_ROLE_KEY: "from-local",
  NEXT_PUBLIC_SUPABASE_URL: "https://local.example",
});

assert.equal(localizedSlug("  킹받네! Meaning & Origin  ", "fallback"), "킹받네-meaning-origin");
assert.equal(localizedSlug("!!!", "fallback"), "fallback");

const base = {
  updated_at: "2026-07-28T00:00:00.000Z",
  meme_translations: [],
};
assert.equal(shouldTranslate(base, "en", "missing"), true);
assert.equal(shouldTranslate(base, "en", "stale"), false);
assert.equal(
  shouldTranslate(
    {
      ...base,
      meme_translations: [
        {
          locale: "en",
          status: "reviewed",
          source_updated_at: "2026-07-27T00:00:00.000Z",
        },
      ],
    },
    "en",
    "stale",
  ),
  true,
);

const selectedTranslation = {
  locale: "en",
  status: "machine",
  source_updated_at: base.updated_at,
  updated_at: "2026-07-28T00:01:00.000Z",
};
const selectedMeme = {
  id: "meme-1",
  slug: "source-slug",
  updated_at: base.updated_at,
  meme_translations: [selectedTranslation],
};
const selectedSnapshot = candidateSnapshot(selectedMeme, "en");
assert.deepEqual(selectedSnapshot, {
  sourceUpdatedAt: base.updated_at,
  translation: {
    updatedAt: selectedTranslation.updated_at,
    status: "machine",
    sourceUpdatedAt: base.updated_at,
  },
});
assert.equal(candidateMatchesSnapshot(selectedMeme, "en", selectedSnapshot), true);
assert.equal(
  candidateMatchesSnapshot(
    {
      ...selectedMeme,
      meme_translations: [
        {
          ...selectedTranslation,
          status: "reviewed",
          updated_at: "2026-07-28T00:02:00.000Z",
        },
      ],
    },
    "en",
    selectedSnapshot,
  ),
  false,
  "a review completed while the provider ran must invalidate the candidate",
);
assert.equal(
  candidateMatchesSnapshot(
    { ...selectedMeme, updated_at: "2026-07-28T00:03:00.000Z" },
    "en",
    selectedSnapshot,
  ),
  false,
  "a changed Korean source must invalidate the candidate",
);

const missingSnapshot = candidateSnapshot(
  { ...selectedMeme, meme_translations: [] },
  "en",
);
assert.equal(
  candidateMatchesSnapshot(selectedMeme, "en", missingSnapshot),
  false,
  "a translation missing at selection must still be missing before insert",
);

const normalized = normalizeTranslation({
  title: " King-bat-ne (킹받네) ",
  summary: " Playfully infuriating. ",
  description: " Explanation. ",
  origin: " Unknown. ",
  usage_note: " ",
  caution: " Use with friends. ",
  aliases: [" king-bat-ne ", "king-bat-ne", ""],
  usage_examples: [
    { situation: " Chat ", text: " This is so king-bat-ne. " },
    { situation: "", text: "invalid" },
  ],
});
assert.deepEqual(normalized.aliases, ["king-bat-ne"]);
assert.equal(normalized.usage_note, null);
assert.deepEqual(normalized.usage_examples, [
  { situation: "Chat", text: "This is so king-bat-ne." },
]);

assert.deepEqual(
  sourceForTranslation({
    title: "원문",
    aliases: null,
    summary: "요약",
    description: "설명",
    origin: "유래",
    usage_note: null,
    caution: null,
    usage_examples: null,
  }),
  {
    title: "원문",
    aliases: [],
    summary: "요약",
    description: "설명",
    origin: "유래",
    usage_note: "",
    caution: "",
    usage_examples: [],
  },
);

const generatedTranslation = {
  title: "Localized title",
  summary: "Localized summary",
  description: "Localized description",
  origin: "Localized origin",
  usage_note: null,
  caution: null,
  aliases: [],
  usage_examples: [],
};

function updateClient(result) {
  const state = { operation: null, payload: null, filters: [] };
  const builder = {
    update(payload) {
      state.operation = "update";
      state.payload = payload;
      return builder;
    },
    eq(column, value) {
      state.filters.push([column, value]);
      return builder;
    },
    select() {
      return builder;
    },
    async maybeSingle() {
      return result;
    },
  };
  return {
    state,
    client: {
      from(table) {
        assert.equal(table, "meme_translations");
        return builder;
      },
    },
  };
}

const conditionalUpdate = updateClient({ data: { meme_id: selectedMeme.id }, error: null });
assert.equal(
  await persistTranslationIfCurrent({
    supabase: conditionalUpdate.client,
    candidate: { meme: selectedMeme, snapshot: selectedSnapshot },
    locale: "en",
    translation: generatedTranslation,
    model: "test-model",
    translatedAt: "2026-07-28T00:04:00.000Z",
  }),
  true,
);
assert.deepEqual(conditionalUpdate.state.filters, [
  ["meme_id", selectedMeme.id],
  ["locale", "en"],
  ["updated_at", selectedTranslation.updated_at],
  ["status", selectedTranslation.status],
  ["source_updated_at", selectedTranslation.source_updated_at],
]);
assert.equal(conditionalUpdate.state.payload.status, "machine");
assert.equal(conditionalUpdate.state.payload.reviewed_at, null);

const lostConditionalUpdate = updateClient({ data: null, error: null });
assert.equal(
  await persistTranslationIfCurrent({
    supabase: lostConditionalUpdate.client,
    candidate: { meme: selectedMeme, snapshot: selectedSnapshot },
    locale: "en",
    translation: generatedTranslation,
    model: "test-model",
    translatedAt: "2026-07-28T00:04:00.000Z",
  }),
  false,
  "a review in the final write window must win the conditional update",
);

const duplicateInsertClient = {
  from(table) {
    assert.equal(table, "meme_translations");
    return {
      async insert() {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      },
    };
  },
};
assert.equal(
  await persistTranslationIfCurrent({
    supabase: duplicateInsertClient,
    candidate: { meme: selectedMeme, snapshot: missingSnapshot },
    locale: "en",
    translation: generatedTranslation,
    model: "test-model",
    translatedAt: "2026-07-28T00:04:00.000Z",
  }),
  false,
  "a concurrently inserted translation must not be overwritten",
);

const source = readFileSync(new URL("./translate-memes.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^\n]*(?:apiKey|serviceRoleKey)/);
assert.match(source, /\["\.env\.local", "\.env"\]/);
assert.match(source, /hasOwnProperty\.call\(target, key\)/);
assert.match(source, /source_updated_at: snapshot\.sourceUpdatedAt/);
assert.match(source, /status: "machine"/);
assert.doesNotMatch(source, /\.upsert\(/);

console.log("translate-memes batch safeguards OK");
