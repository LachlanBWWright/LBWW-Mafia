import type {
  Authorization,
  Credentials,
  Identity,
} from "../../shared/ai/runtime.mjs";

export type CallbackModule = {
  start(
    state: string,
  ): Promise<{ ok: boolean; id?: string; redirectUri?: string }>;
  callback(id: string): Promise<{ ok: boolean; url?: string }>;
  stop(id: string): Promise<void>;
  open?(url: string): Promise<{ ok: boolean }>;
  verify(
    input: string,
    signature: string,
    modulus: string,
    exponent: string,
    algorithm: string,
  ): Promise<boolean>;
};
const fail = (message: string) =>
  Object.assign(new Error(message), { code: "authorization" });

export function createNativeAuthorization(ports: {
  native: CallbackModule;
  random(): string;
  challenge(value: string): Promise<string>;
  open(url: string): Promise<void>;
}) {
  return async ({
    hostId,
    registration,
    reconsent,
  }: {
    hostId: string;
    registration: Credentials | null;
    reconsent: boolean;
  }): Promise<Authorization> => {
    const state = ports.random();
    const nonce = ports.random();
    const verifier = ports.random();
    const challenge = await ports.challenge(verifier);
    const listener = await ports.native.start(state);
    if (!listener.ok || !listener.id || !listener.redirectUri)
      throw fail("Could not start ChatGPT sign-in. Try again.");
    const id = listener.id;
    let redirect: URL;
    try {
      redirect = new URL(listener.redirectUri);
    } catch {
      await ports.native.stop(id);
      throw fail("Invalid ChatGPT callback address.");
    }
    if (
      redirect.protocol !== "http:" ||
      redirect.hostname !== "127.0.0.1" ||
      !redirect.port ||
      redirect.pathname !== "/auth/callback" ||
      redirect.username ||
      redirect.password ||
      redirect.search ||
      redirect.hash
    ) {
      await ports.native.stop(id);
      throw fail("Invalid ChatGPT callback address.");
    }
    const clientId = registration?.clientId ?? "dynamic_agent_client";
    const parameters = new URLSearchParams({
      client_id: clientId,
      ext_agent_host_id: hostId,
      response_type: "code",
      redirect_uri: redirect.href,
      scope:
        "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
      resource: "https://api.openai.com/v1",
      state,
      nonce,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    if (!registration) parameters.set("agent_name_hint", "LBWW Mafia");
    if (registration?.idToken)
      parameters.set("id_token_hint", registration.idToken);
    if (registration?.email) parameters.set("login_hint", registration.email);
    if (reconsent) parameters.set("prompt", "consent");
    const authorizationUrl = `https://auth.openai.com/api/accounts/authorize?${parameters}`;
    let cancelled = false;
    const result: Authorization["result"] = (async () => {
      try {
        const pending = ports.native.callback(id);
        void pending.catch(() => {});
        await ports.open(authorizationUrl);
        const callback = await pending;
        if (cancelled || !callback.ok || !callback.url)
          throw fail("ChatGPT sign-in was cancelled or expired.");
        const url = new URL(callback.url);
        if (
          url.origin !== redirect.origin ||
          url.pathname !== redirect.pathname ||
          url.username ||
          url.password ||
          url.hash ||
          ["state", "code", "client_id", "error"].some(
            (key) => url.searchParams.getAll(key).length > 1,
          ) ||
          url.searchParams.get("state") !== state
        )
          throw fail("Invalid ChatGPT sign-in callback.");
        if (url.searchParams.has("error"))
          throw fail("ChatGPT sign-in was cancelled or declined.");
        const code = url.searchParams.get("code");
        const returned = url.searchParams.get("client_id");
        const issued = registration?.clientId ?? returned;
        if (
          !code ||
          code.length > 4096 ||
          !/^oaiapp_[A-Za-z0-9_-]+$/.test(issued ?? "") ||
          (returned !== null && returned !== issued)
        )
          throw fail("ChatGPT registration did not complete.");
        return { code, clientId: issued! };
      } catch (error) {
        return {
          error:
            error instanceof Error ? error : fail("ChatGPT sign-in failed."),
        };
      } finally {
        await ports.native.stop(id);
      }
    })();
    return {
      authorizationUrl,
      redirectUri: redirect.href,
      nonce,
      verifier,
      result,
      cancel: () => {
        cancelled = true;
        void ports.native.stop(id).catch(() => {});
      },
    };
  };
}

function decode(part: string): Record<string, unknown> {
  const data = atob(
    part
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(part.length / 4) * 4, "="),
  );
  return JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(data, (char) => char.charCodeAt(0)),
    ),
  ) as Record<string, unknown>;
}

export function nativeIdentityVerifier(native: CallbackModule) {
  return async (
    token: string,
    clientId: string,
    nonce: string,
    request: typeof fetch,
    now: number,
  ): Promise<Identity> => {
    if (typeof token !== "string" || token.length > 32_000)
      throw fail("ChatGPT identity could not be verified.");
    const [head, payload, signature, extra] = token.split(".");
    if (!head || !payload || !signature || extra !== undefined)
      throw fail("ChatGPT identity could not be verified.");
    const header = decode(head);
    const claims = decode(payload);
    if (
      typeof header.kid !== "string" ||
      typeof header.alg !== "string" ||
      !["RS256", "RS384", "RS512"].includes(header.alg)
    )
      throw fail("Unsupported ChatGPT identity signature.");
    const response = await request(
      "https://auth.openai.com/.well-known/jwks.json",
      { redirect: "error", signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) throw fail("ChatGPT identity could not be verified.");
    const jwks = (await response.json()) as {
      keys?: Array<{
        kid?: string;
        kty?: string;
        use?: string;
        alg?: string;
        n?: string;
        e?: string;
      }>;
    };
    const key = jwks.keys?.find(
      (candidate) =>
        candidate.kid === header.kid &&
        candidate.kty === "RSA" &&
        (!candidate.alg || candidate.alg === header.alg) &&
        (!candidate.use || candidate.use === "sig"),
    );
    const audience =
      claims.aud === clientId ||
      (Array.isArray(claims.aud) && claims.aud.includes(clientId));
    if (
      !key?.n ||
      !key.e ||
      !(await native.verify(
        `${head}.${payload}`,
        signature,
        key.n,
        key.e,
        header.alg,
      )) ||
      claims.iss !== "https://auth.openai.com" ||
      !audience ||
      (Array.isArray(claims.aud) &&
        claims.aud.length > 1 &&
        claims.azp !== clientId) ||
      (claims.azp !== undefined && claims.azp !== clientId) ||
      typeof claims.exp !== "number" ||
      !Number.isFinite(claims.exp) ||
      claims.exp * 1000 <= now ||
      typeof claims.iat !== "number" ||
      !Number.isFinite(claims.iat) ||
      claims.iat * 1000 > now + 60_000 ||
      (claims.nbf !== undefined &&
        (typeof claims.nbf !== "number" ||
          !Number.isFinite(claims.nbf) ||
          claims.nbf * 1000 > now + 60_000)) ||
      claims.nonce !== nonce ||
      typeof claims.sub !== "string" ||
      !claims.sub
    )
      throw fail("ChatGPT identity could not be verified.");
    return { sub: claims.sub, email: claims.email, name: claims.name };
  };
}
