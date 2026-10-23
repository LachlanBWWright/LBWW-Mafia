import { createHash } from "node:crypto";
import { equal, random } from "./oauth.mjs";

export const isLoopback = (address) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Browser origins are checked before access issuance; LAN clients also require approval on this computer. */
export function createAccess({ now = Date.now } = {}) {
  const pending = new Map(); const sessions = new Map();
  function prune() {
    for (const [id, item] of pending) if (item.expiresAt < now()) pending.delete(id);
    for (const [id, item] of sessions) if (item.expiresAt < now()) sessions.delete(id);
  }
  return {
    start(challenge, origin, address) {
      prune();
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge ?? "") || pending.size >= 32 || (!isLoopback(address) && [...pending.values()].some((item) => item.address === address))) return null;
      const id = random();
      pending.set(id, { challenge, origin, address, approved: isLoopback(address), csrf: random(), expiresAt: now() + 180_000 });
      return { id, needsApproval: !isLoopback(address) };
    },
    approval(id) {
      prune();
      const item = pending.get(id);
      if (!item) return null;
      return `<!doctype html><meta charset="utf-8"><title>Connect Mafia</title><h1>Connect Mafia to this computer?</h1><p>Allow ${escapeHtml(item.origin)} on ${escapeHtml(item.address)} to control AI characters using the ChatGPT account you connect here?</p><form method="post" action="/approve"><input type="hidden" name="id" value="${id}"><input type="hidden" name="csrf" value="${item.csrf}"><button>Allow connection</button></form>`;
    },
    approve(id, csrf) {
      prune(); const item = pending.get(id);
      if (!item || !equal(item.csrf, csrf)) return false;
      item.approved = true; return true;
    },
    finish(id, verifier, origin, address) {
      prune(); const item = pending.get(id);
      if (!item || item.origin !== origin || item.address !== address || typeof verifier !== "string" || verifier.length > 128 ||
          !equal(createHash("sha256").update(verifier).digest("base64url"), item.challenge)) return null;
      if (!item.approved) return { pending: true };
      pending.delete(id);
      const token = random(); sessions.set(token, { origin, address, expiresAt: now() + 8 * 60 * 60_000 });
      return { token };
    },
    verify(token, origin, address) {
      prune(); const session = sessions.get(token);
      return Boolean(session && session.origin === origin && session.address === address);
    },
    clear() { sessions.clear(); pending.clear(); },
  };
}
