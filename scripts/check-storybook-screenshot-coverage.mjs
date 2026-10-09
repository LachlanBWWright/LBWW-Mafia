import { access, readFile } from "node:fs/promises";
import path from "node:path";

const [indexPath, snapshotRoot, ...projects] = process.argv.slice(2);
if (!indexPath || !snapshotRoot || projects.length === 0) {
  throw new Error("Usage: check-storybook-screenshot-coverage.mjs index.json snapshots project...");
}

const index = JSON.parse(await readFile(indexPath, "utf8"));
const stories = Object.values(index.entries ?? {}).filter((entry) => entry.type === "story");
const missing = [];
for (const story of stories) {
  for (const project of projects) {
    const file = path.join(snapshotRoot, project, `${story.id}-${project}-linux.png`);
    try {
      await access(file);
    } catch {
      missing.push(file);
    }
  }
}

if (missing.length) throw new Error(`Missing ${missing.length} Storybook screenshot baseline(s):\n${missing.join("\n")}`);
console.log(`Storybook screenshot coverage validated: ${stories.length} stories × ${projects.length} projects.`);
