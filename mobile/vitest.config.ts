import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "../shared"),
  test: {
    include: [
      "communication/**/*.test.ts",
      "game/**/*.test.ts",
      "trpc/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**"],
  },
  resolve: {
    alias: {
      "@mernmafia/shared": resolve(__dirname, "../shared"),
    },
  },
});
