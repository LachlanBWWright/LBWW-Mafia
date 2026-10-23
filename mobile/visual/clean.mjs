import { rm } from "node:fs/promises";
import path from "node:path";

await rm(path.resolve("visual/screenshots"), { recursive: true, force: true });
