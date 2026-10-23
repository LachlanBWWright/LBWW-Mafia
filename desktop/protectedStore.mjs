import {
  chmod,
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createStore } from "../tools/ai-bots/chatgpt/store.mjs";

export function createProtectedStore(directory, encryption) {
  const path = join(directory, "chatgpt-credentials.encrypted");
  const protect = () => {
    if (
      !encryption.isEncryptionAvailable() ||
      encryption.getSelectedStorageBackend?.() === "basic_text"
    )
      throw Object.assign(
        new Error("Unlock your system keychain to connect ChatGPT."),
        { code: "keychain" },
      );
  };
  return {
    path,
    hostId: createStore(directory).hostId,
    async load() {
      let bytes;
      try {
        bytes = await readFile(path);
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
      protect();
      const value = JSON.parse(encryption.decryptString(bytes));
      if (!/^oaiapp_[A-Za-z0-9_-]+$/.test(value?.clientId ?? ""))
        throw new Error("Invalid ChatGPT registration.");
      return value;
    },
    async save(value) {
      protect();
      await mkdir(directory, { mode: 0o700, recursive: true });
      await chmod(directory, 0o700);
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(
          temporary,
          encryption.encryptString(JSON.stringify(value)),
          { mode: 0o600, flag: "wx" },
        );
        await rename(temporary, path);
      } finally {
        await unlink(temporary).catch(() => {});
      }
    },
  };
}
