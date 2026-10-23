import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      "../mobile/lib/chatGPTAuthorization.test.ts",
      "../mobile/lib/chatGPTRuntime.test.ts",
      "game/nativeChatGPTConnection.test.ts",
    ],
    coverage: {
      provider: "v8",
      allowExternal: true,
      include: [
        "**/mobile/lib/chatGPTAuthorization.ts",
        "**/mobile/lib/chatGPTRuntime.native.ts",
        "**/game/nativeChatGPTConnection.ts",
      ],
      reporter: ["text", "json-summary"],
      reportsDirectory: "../mobile/coverage/chatgpt",
      thresholds: {
        perFile: true,
        lines: 95,
        statements: 95,
        functions: 90,
        branches: 90,
      },
    },
  },
});
