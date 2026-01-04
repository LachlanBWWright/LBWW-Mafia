import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import * as fs from "fs";
import * as path from "path";

// Plugin to resolve .js imports to .ts files
function resolveJsToTs(): Plugin {
  return {
    name: "resolve-js-to-ts",
    resolveId(source, importer) {
      // console.log(`ResolveId called for: ${source} from ${importer}`);
      if (source.endsWith(".js") && importer) {
        // Get the directory of the importer
        const importerDir = path.dirname(importer);
        // Resolve the source relative to importer
        const resolved = path.resolve(importerDir, source);
        // Replace .js with .ts
        const tsPath = resolved.replace(/\.js$/, ".ts");

        // Check if the .ts file exists
        if (fs.existsSync(tsPath)) {
          // console.log(`Resolved ${source} to ${tsPath}`);
          return tsPath;
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveJsToTs()],
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "build", "dist", ".git"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "build/",
        "dist/",
        "**/*.{test,spec}.{js,ts}",
        "**/*.config.{js,ts}",
        "coverage/",
      ],
    },
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"],
  },
  esbuild: {
    target: "node18",
  },
});
