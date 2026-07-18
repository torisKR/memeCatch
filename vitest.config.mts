import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // React 컴포넌트(.tsx) 테스트의 JSX 변환·단일 React 해석용.
  // 없으면 렌더 시 React 훅이 null이 되어 컴포넌트 테스트가 전부 깨진다.
  plugins: [react()],
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [
      ...configDefaults.exclude,
      ".pnpm-store/**",
      ".worktrees/**",
      ".claude/worktrees/**",
    ],
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
