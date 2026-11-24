// Runs vectors.capture.ts with the repository's aliases, so it imports the
// real lib/meme-embedding-runtime.server.ts:
//
//   npx vitest run --config server/parity/embeddings/vitest.config.mts
//
// It needs the pinned model in .local/embedding-models
// (`node scripts/prepare-meme-embedding-model.mjs`, which downloads it from
// huggingface.co at the pinned revision and checks every file). The root
// vitest.config.mts includes only *.test.ts(x); this file is never part of
// the app's test run, nor of CI.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../..", import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: "node",
    include: ["server/parity/embeddings/*.capture.ts"],
    testTimeout: 600_000,
    // The real module imports "server-only", which throws outside React's
    // server condition.
    alias: { "server-only": fileURLToPath(new URL("./server-only.mjs", import.meta.url)) },
  },
  resolve: { alias: { "@": root } },
});
