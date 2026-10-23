import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";

export function createStore(directory) {
  const path = join(directory, "chatgpt-plan.json");
  const hostPath = join(directory, "chatgpt-host-id");
  async function prepare() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
  }
  return {
    path,
    async hostId() {
      await prepare();
      try { return (await readFile(hostPath, "utf8")).trim(); }
      catch (error) {
        if (error.code !== "ENOENT") throw error;
        const id = `urn:uuid:${randomUUID()}`;
        await writeFile(hostPath, id, { mode: 0o600, flag: "wx" });
        return id;
      }
    },
    async load() {
      try {
        const saved = JSON.parse(await readFile(path, "utf8"));
        if (!saved || typeof saved.clientId !== "string" || !/^oaiapp_[A-Za-z0-9_-]+$/.test(saved.clientId))
          throw new Error("Invalid saved ChatGPT registration.");
        return saved;
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async save(value) {
      await prepare();
      const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
      await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx" });
      await rename(temporary, path);
    },
  };
}
