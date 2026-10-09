import { access } from "node:fs/promises";
import path from "node:path";
import { storybookStories } from "./storybook-stories.mjs";

const projects = [
  "small-phone-dark",
  "phone-dark",
  "tablet-dark",
  "small-phone-light",
  "phone-light",
  "tablet-light",
];
const root = path.resolve(import.meta.dirname, "storybook-screenshots.spec.ts-snapshots");
const missing = [];
for (const story of storybookStories) {
  for (const project of projects) {
    const file = path.join(root, project, `${story.name}-${project}-linux.png`);
    try {
      await access(file);
    } catch {
      missing.push(file);
    }
  }
}
if (missing.length) throw new Error(`Missing ${missing.length} mobile Storybook baseline(s):\n${missing.join("\n")}`);
console.log(`Mobile Storybook screenshot coverage validated: ${storybookStories.length} stories × ${projects.length} projects.`);
