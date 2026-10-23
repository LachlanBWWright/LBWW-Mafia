import {
  _electron as electron,
  expect,
} from "../nextjs/node_modules/@playwright/test/index.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const directory = await mkdtemp(join(tmpdir(), "mafia-electron-smoke-"));
let instance;
try {
  const origin = process.env.STORYBOOK_BASE_URL ?? "http://127.0.0.1:16206";
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  instance = await electron.launch({
    ...(process.env.MAFIA_DESKTOP_EXECUTABLE ? { executablePath: process.env.MAFIA_DESKTOP_EXECUTABLE, args: [] } : {
      args: [fileURLToPath(new URL("./main.mjs", import.meta.url))],
    }),
    env: {
      ...environment,
      XDG_CONFIG_HOME: directory,
      MAFIA_DESKTOP_APP_URL: origin,
      MAFIA_DESKTOP_SOCKET_URL: "http://127.0.0.1:1999",
    },
  });
  const page = await instance.firstWindow();
  await page.goto(
    `${origin}/iframe.html?id=features-ai-characters--browser-unavailable&viewMode=story`,
  );
  await expect(
    page.getByRole("button", { name: "Add AI characters", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Add AI characters", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeVisible();
  const status = await page.evaluate(() =>
    window.mafiaDesktop.chatGPT("status"),
  );
  if (status.connected || JSON.stringify(status).includes("accessToken"))
    throw new Error("Unexpected credentials in isolated desktop status.");
  const keys = await page.evaluate(() => Object.keys(window.mafiaDesktop));
  expect(keys).toEqual(["chatGPT"]);
  const rejected = await page.evaluate(async () => {
    try {
      await window.mafiaDesktop.chatGPT("generate", { input: "unauthorized" });
      return false;
    } catch {
      return true;
    }
  });
  expect(rejected).toBe(true);
  console.log(
    "Electron smoke passed: isolated native bridge, disabled browser flow replaced by native setup, no credentials exposed.",
  );
} finally {
  await instance?.close();
  await rm(directory, { recursive: true, force: true });
}
