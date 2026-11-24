import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// The TypeScript and JavaScript that remain: the worker's lib/, the page
// scripts' sources (server/ui), the behaviour scenarios and the db tests.
const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  {
    // As eslint-config-next/typescript had them, which this replaces.
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
  globalIgnores([
    "server/target/**",
    // Node scripts and data are not app sources.
    "scripts/**",
    "data/**",
    ".claude/**",
    // Local package stores and isolated work trees.
    ".pnpm-store/**",
    ".worktrees/**",
    ".local/**",
    ".codex/plugins/**",
    ".omo/**",
    ".omx/**",
  ]),
]);

export default eslintConfig;
