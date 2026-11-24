// Runs plans.capture.ts with the repository's aliases and JSX transform, so it
// can import the real lib/db/plan.ts and components/explore-grid.tsx:
//
//   npx vitest run --config server/parity/db-query/vitest.config.mts
//
// The root vitest.config.mts includes only *.test.ts(x); this file is never
// part of the app's test run.
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../..", import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  test: {
    environment: "node",
    include: ["server/parity/db-query/*.capture.ts"],
  },
  resolve: { alias: { "@": root } },
});
