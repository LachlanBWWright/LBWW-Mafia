import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["../shared/**/*.test.ts"],
    exclude: ["**/node_modules/**", "../shared/node_modules/**"],
  },
  resolve: {
    alias: {
      "@mernmafia/shared": resolve(__dirname, "../shared"),
    },
  },
});
