import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { storybookStories } from "./storybook-stories.mjs";

const mobileRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.resolve(mobileRoot, "visual", "storybook-screenshots");
const staticRoot = path.resolve(mobileRoot, "visual", "storybook-dist");
const port = Number(process.env.STORYBOOK_PORT ?? 6011);

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: mobileRoot,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

await rm(outputRoot, { recursive: true, force: true });
await rm(staticRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await run("node", ["visual/validate-storybook-manifest.mjs"]);
// Export the normal app entry and select the story capture with the query
// parameter. Expo's Storybook entrypoint is device-oriented and has no web
// root in headless export mode.
await run("pnpm", [
  "exec",
  "expo",
  "export",
  "--platform",
  "web",
  "--output-dir",
  staticRoot,
]);

const server = spawn(
  "pnpm",
  ["exec", "http-server", staticRoot, "-p", String(port), "-c-1"],
  {
    cwd: mobileRoot,
    stdio: "inherit",
  },
);
try {
  await waitForServer(`http://127.0.0.1:${port}`);
  const playwrightArgs = [
    "exec",
    "playwright",
    "test",
    "-c",
    "visual/storybook-playwright.config.ts",
  ];
  if (process.env.STORYBOOK_TEST_WORKERS)
    playwrightArgs.push("--workers", process.env.STORYBOOK_TEST_WORKERS);
  if (process.env.STORYBOOK_TEST_GREP)
    playwrightArgs.push("--grep", process.env.STORYBOOK_TEST_GREP);
  if (process.env.STORYBOOK_UPDATE_SNAPSHOTS === "true") {
    playwrightArgs.push("--update-snapshots");
  }
  await run("pnpm", playwrightArgs, {
    STORYBOOK_BASE_URL: `http://127.0.0.1:${port}`,
  });
  await run("node", ["visual/validate-storybook-manifest.mjs"]);
  if (!process.env.STORYBOOK_TEST_GREP)
    await run("node", ["visual/check-storybook-screenshot-coverage.mjs"]);
} finally {
  server.kill("SIGTERM");
}
console.log(`Mobile Storybook screenshots: ${outputRoot}`);
