import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["../shared/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@mernmafia/shared": resolve(__dirname, "../shared"),
      "~/": resolve(__dirname, "./src/"),
    },
  },
});
