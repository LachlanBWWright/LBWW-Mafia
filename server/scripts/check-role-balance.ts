import { readFile } from "node:fs/promises";
import { checkRoleBalance, type BalanceObservation } from "../model/rooms/initRoles/balanceCheck.js";

const filename = process.argv[2];
if (!filename) throw new Error("Usage: pnpm --dir server balance:check <observations.json>");
const input: unknown = JSON.parse(await readFile(filename, "utf8"));
if (!Array.isArray(input)) throw new Error("Input must be an array of observations.");
console.log(JSON.stringify({
  method: "Descriptive comparison by player count; not a causal estimate or a recommendation.",
  games: input.length,
  roles: checkRoleBalance(input as BalanceObservation[]),
}, null, 2));
