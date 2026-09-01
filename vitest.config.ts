import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./desktop/ui/tests/setup.ts"],
    include: ["desktop/ui/tests/**/*.test.tsx", "desktop/ui/tests/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./desktop/ui"),
    },
  },
});
