import { createPublicKey, verify } from "node:crypto";
import { issuer, failure } from "../../../shared/ai/protocol.mjs";
export * from "../../../shared/ai/protocol.mjs";

export async function verifyIdentity(
  idToken,
  clientId,
  nonce,
  request,
  now = Date.now(),
) {
  if (typeof idToken !== "string" || idToken.length > 32_000)
    throw failure(
      "invalid-identity",
      "ChatGPT identity could not be verified.",
    );
  const parts = idToken.split(".");
  if (parts.length !== 3)
    throw failure(
      "invalid-identity",
      "ChatGPT identity could not be verified.",
    );
  const [head, payload, signature] = parts;
  const header = JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const algorithms = {
    RS256: "RSA-SHA256",
    RS384: "RSA-SHA384",
    RS512: "RSA-SHA512",
  };
  if (!Object.hasOwn(algorithms, header.alg) || typeof header.kid !== "string")
    throw failure(
      "invalid-identity",
      "ChatGPT identity could not be verified.",
    );
  const response = await request(`${issuer}/.well-known/jwks.json`, {
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok)
    throw failure("unavailable", "ChatGPT identity could not be verified.");
  const jwks = await response.json();
  const jwk = jwks.keys?.find(
    (key) =>
      key.kid === header.kid &&
      key.kty === "RSA" &&
      (!key.alg || key.alg === header.alg) &&
      (!key.use || key.use === "sig"),
  );
  const audience =
    claims.aud === clientId ||
    (Array.isArray(claims.aud) && claims.aud.includes(clientId));
  if (
    !jwk ||
    !verify(
      algorithms[header.alg],
      Buffer.from(`${head}.${payload}`),
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(signature, "base64url"),
    ) ||
    claims.iss !== issuer ||
    !audience ||
    (Array.isArray(claims.aud) &&
      claims.aud.length > 1 &&
      claims.azp !== clientId) ||
    (claims.azp !== undefined && claims.azp !== clientId) ||
    !Number.isFinite(claims.exp) ||
    claims.exp * 1000 <= now ||
    !Number.isFinite(claims.iat) ||
    claims.iat * 1000 > now + 60_000 ||
    (claims.nbf !== undefined &&
      (!Number.isFinite(claims.nbf) || claims.nbf * 1000 > now + 60_000)) ||
    claims.nonce !== nonce ||
    typeof claims.sub !== "string" ||
    !claims.sub
  )
    throw failure(
      "invalid-identity",
      "ChatGPT identity could not be verified.",
    );
  return claims;
}
