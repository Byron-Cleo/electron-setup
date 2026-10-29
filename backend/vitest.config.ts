import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    globals: false,
    // tests/setup.ts wipes orders/shifts/menus in beforeEach, so test files must not
    // run in parallel against the same database or they delete each other's fixtures.
    fileParallelism: false,
  },
});
