import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["../shared/**/*.test.ts", "src/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "../shared/node_modules/**",
      "**/*.integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@mernmafia/shared": resolve(__dirname, "../shared"),
      "~": resolve(__dirname, "./src/"),
    },
  },
});
