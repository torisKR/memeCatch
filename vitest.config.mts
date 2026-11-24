import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const disableNativeWebStorageFlag = [
  "--no-webstorage",
  "--no-experimental-webstorage",
].find((flag) => process.allowedNodeEnvironmentFlags.has(flag));

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: [
      ...configDefaults.exclude,
      ".local/**",
      ".pnpm-store/**",
      ".worktrees/**",
      ".claude/worktrees/**",
    ],
    clearMocks: true,
    execArgv: "localStorage" in globalThis && disableNativeWebStorageFlag
      ? [disableNativeWebStorageFlag]
      : [],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
