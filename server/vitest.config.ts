import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["../shared/**/*.test.ts", "./**/*.test.ts"],
    exclude: ["**/node_modules/**", "../shared/node_modules/**"],
    coverage: {
      provider: "v8",
      include: [
        "model/**/*.ts",
        "../shared/game/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/testUtils/**",
        "**/*.d.ts",
        "model/**/abstract*.ts",
        "model/**/*Contracts.ts",
        "model/**/*Interface.ts",
        "model/**/*Like.ts",
      ],
      thresholds: { lines: 60, statements: 58, functions: 65, branches: 40 },
    },
  },
  resolve: {
    alias: {
      "@mernmafia/shared": resolve(__dirname, "../shared"),
    },
  },
});
