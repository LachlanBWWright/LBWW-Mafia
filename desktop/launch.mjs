import electron from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(
  electron,
  [fileURLToPath(new URL("./main.mjs", import.meta.url))],
  { env: environment, stdio: "inherit" },
);
child.once("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
