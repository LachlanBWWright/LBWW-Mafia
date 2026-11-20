import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../cli.mjs", import.meta.url));
test("api-run requires explicit API configuration and never loads subscription credentials", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "mafia-api-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "seats.json");
  await writeFile(
    file,
    JSON.stringify({
      url: "https://game.example",
      room: "room",
      tickets: ["ticket"],
      mode: "per-character",
    }),
  );
  const subscriptionDirectory = join(directory, "subscription");
  const env = {
    ...process.env,
    MAFIA_AI_PROVIDER: "",
    MAFIA_CHATGPT_DATA_DIR: subscriptionDirectory,
  };
  const result = spawnSync(process.execPath, [cli, "api-run", file], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MAFIA_AI_PROVIDER/);
  assert.equal(result.stderr.includes("Continue with ChatGPT"), false);
  await assert.rejects(access(subscriptionDirectory));
});

test("api-run reports file/usage errors without starting a runtime", () => {
  const result = spawnSync(process.execPath, [cli, "api-run"], {
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:.*api-run/);
});
