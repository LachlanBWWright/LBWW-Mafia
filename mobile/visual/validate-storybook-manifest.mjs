import { readFile } from "node:fs/promises";
import { storybookStories } from "./storybook-stories.mjs";

const sourceFiles = new Set(
  storybookStories.map((story) => story.sourceFile ?? "ui.stories.tsx"),
);
const exportsInSource = [];
for (const sourceFile of sourceFiles) {
  const source = await readFile(
    new URL(`../stories/${sourceFile}`, import.meta.url),
    "utf8",
  );
  exportsInSource.push(
    ...[...source.matchAll(/export const (\w+)\s*:/g)].map(
      (match) => `${sourceFile}:${match[1]}`,
    ),
  );
}
const key = (story) =>
  `${story.sourceFile ?? "ui.stories.tsx"}:${story.exportName}`;
const manifestExports = new Set(storybookStories.map(key));
const missing = exportsInSource.filter((name) => !manifestExports.has(name));
const unknown = storybookStories.filter(
  (story) => !exportsInSource.includes(key(story)),
);

if (missing.length || unknown.length) {
  throw new Error(
    `Mobile Storybook manifest drift. Missing: ${missing.join(", ") || "none"}; unknown: ${unknown.map((story) => story.exportName).join(", ") || "none"}`,
  );
}

console.log(
  `Mobile Storybook manifest validated: ${storybookStories.length} stories.`,
);
