import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  stat,
} from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createProtectedStore } from "./protectedStore.mjs";

async function fixture(t) {
  const { rm } = await import("node:fs/promises");
  const directory = await mkdtemp(join(tmpdir(), "mafia-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const encryption = {
    isEncryptionAvailable: () => true,
    encryptString(value) {
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const bytes = Buffer.concat([cipher.update(value), cipher.final()]);
      return Buffer.concat([cipher.getAuthTag(), bytes]);
    },
    decryptString(bytes) {
      const cipher = createDecipheriv("aes-256-gcm", key, iv);
      cipher.setAuthTag(bytes.subarray(0, 16));
      return Buffer.concat([
        cipher.update(bytes.subarray(16)),
        cipher.final(),
      ]).toString();
    },
  };
  return {
    directory,
    encryption,
    store: createProtectedStore(directory, encryption),
  };
}
const grant = {
  clientId: "oaiapp_test",
  accessToken: "private-access",
  refreshToken: "private-refresh",
};

test("missing credentials remain disconnected even with a locked keychain", async (t) => {
  const f = await fixture(t);
  f.encryption.isEncryptionAvailable = () => false;
  assert.equal(await f.store.load(), null);
  await assert.rejects(f.store.save(grant), { code: "keychain" });
  assert.deepEqual(await readdir(f.directory), []);
});
test("rotation survives a new store instance, tightens directory modes and leaves no temporary files", async (t) => {
  const f = await fixture(t);
  await chmod(f.directory, 0o755);
  await f.store.save(grant);
  const next = { ...grant, accessToken: "rotated" };
  await f.store.save(next);
  assert.deepEqual(
    await createProtectedStore(f.directory, f.encryption).load(),
    next,
  );
  assert.deepEqual(await readdir(f.directory), [basename(f.store.path)]);
  assert.equal((await stat(f.store.path)).mode & 0o777, 0o600);
  assert.equal((await stat(f.directory)).mode & 0o777, 0o700);
});
test("encryption failure preserves existing credentials", async (t) => {
  const f = await fixture(t);
  await f.store.save(grant);
  const bytes = await readFile(f.store.path);
  f.encryption.encryptString = () => {
    throw new Error("keychain locked");
  };
  await assert.rejects(
    f.store.save({ ...grant, accessToken: "new" }),
    /keychain locked/,
  );
  assert.deepEqual(await readFile(f.store.path), bytes);
  assert.deepEqual(await readdir(f.directory), [basename(f.store.path)]);
});
test("rename failure removes the temporary encrypted record", async (t) => {
  const f = await fixture(t);
  await mkdir(f.store.path);
  await assert.rejects(f.store.save(grant));
  assert.deepEqual(await readdir(f.directory), [basename(f.store.path)]);
});
test("corrupted ciphertext and invalid registrations fail closed without deleting evidence", async (t) => {
  const f = await fixture(t);
  const bytes = Buffer.from("corrupted encrypted record");
  await writeFile(f.store.path, bytes);
  await assert.rejects(f.store.load());
  assert.deepEqual(await readFile(f.store.path), bytes);
  await writeFile(
    f.store.path,
    f.encryption.encryptString(
      JSON.stringify({ clientId: "dynamic_agent_client" }),
    ),
  );
  await assert.rejects(f.store.load(), /Invalid ChatGPT registration/);
  await writeFile(f.store.path, f.encryption.encryptString("{invalid"));
  await assert.rejects(f.store.load());
});
