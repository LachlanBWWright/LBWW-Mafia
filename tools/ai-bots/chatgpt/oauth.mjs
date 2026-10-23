import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { issuer, resource, scopes, failure } from "./protocol.mjs";

export const random = () => randomBytes(32).toString("base64url");
export function equal(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authorize({ hostId, registration, reconsent = false, timeoutMs = 180_000 }) {
  const state = random(); const nonce = random(); const verifier = random();
  const clientId = registration?.clientId ?? "dynamic_agent_client";
  let resolveCallback;
  const result = new Promise((resolve) => { resolveCallback = resolve; });
  let timer;
  let settled = false;
  const finish = (value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    server.close();
    resolveCallback(value);
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Security-Policy", "default-src 'none'");
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    if (request.method !== "GET" || url.pathname !== "/auth/callback" ||
        ["state", "code", "client_id", "error"].some((key) => url.searchParams.getAll(key).length > 1) ||
        !equal(url.searchParams.get("state"), state)) {
      // An unrelated request must not cancel the user's real sign-in attempt.
      response.writeHead(400).end("Invalid sign-in callback.");
      return;
    }
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const returnedClient = url.searchParams.get("client_id");
    const issued = clientId === "dynamic_agent_client" ? returnedClient : clientId;
    if (error || !code || code.length > 4096 || !/^oaiapp_[A-Za-z0-9_-]+$/.test(issued ?? "") ||
        (returnedClient !== null && returnedClient !== issued)) {
      response.writeHead(400).end("Sign-in was not completed. Return to Mafia.");
      finish({ error: failure("cancelled", "ChatGPT sign-in was cancelled or could not be completed.") });
      return;
    }
    response.writeHead(200).end("Return to Mafia to finish connecting ChatGPT.");
    finish({ code, clientId: issued });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const redirectUri = `http://127.0.0.1:${server.address().port}/auth/callback`;
  timer = setTimeout(() => finish({ error: failure("expired", "ChatGPT sign-in expired. Try again.") }), timeoutMs);
  const parameters = new URLSearchParams({
    client_id: clientId, ext_agent_host_id: hostId, redirect_uri: redirectUri, response_type: "code", scope: scopes,
    resource, state, nonce, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  if (reconsent) parameters.set("prompt", "consent");
  if (clientId === "dynamic_agent_client") parameters.set("agent_name_hint", "LBWW Mafia");
  if (registration?.idToken) parameters.set("id_token_hint", registration.idToken);
  if (registration?.email) parameters.set("login_hint", registration.email);
  return { authorizationUrl: `${issuer}/api/accounts/authorize?${parameters}`, redirectUri, nonce, verifier, result,
    cancel: () => finish({ error: failure("cancelled", "ChatGPT sign-in was cancelled.") }) };
}
