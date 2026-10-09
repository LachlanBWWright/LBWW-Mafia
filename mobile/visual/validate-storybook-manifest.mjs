import { readFile } from "node:fs/promises";
import { storybookStories } from "./storybook-stories.mjs";

const source = await readFile(new URL("../stories/ui.stories.tsx", import.meta.url), "utf8");
const exportsInSource = [...source.matchAll(/export const (\w+)\s*:/g)].map((match) => match[1]);
const manifestExports = new Set(storybookStories.map((story) => story.exportName));
const missing = exportsInSource.filter((name) => !manifestExports.has(name));
const unknown = storybookStories.filter((story) => !exportsInSource.includes(story.exportName));

if (missing.length || unknown.length) {
  throw new Error(
    `Mobile Storybook manifest drift. Missing: ${missing.join(", ") || "none"}; unknown: ${unknown.map((story) => story.exportName).join(", ") || "none"}`,
  );
}

console.log(`Mobile Storybook manifest validated: ${storybookStories.length} stories.`);
