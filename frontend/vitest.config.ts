import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["src/test/**", "src/**/*.test.*", "src/**/*.d.ts", "src/main.tsx", "src/App.tsx"],
      thresholds: {
        statements: 67,
        branches: 62,
        functions: 66,
        lines: 70,
      },
    },
  },
});
