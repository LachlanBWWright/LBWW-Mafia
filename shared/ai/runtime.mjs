import {
  issuer,
  resource,
  failure,
  hasPlanPermission,
  parseTokens,
  providerFailure,
} from "./protocol.mjs";
import { completedText } from "./inference.mjs";

export function createChatGPTRuntime({
  store,
  request = fetch,
  now = Date.now,
  authorizeClient,
  verifyIdentity,
}) {
  let pending = null;
  let error = null;
  let generation = 0;
  let usagePaused = false;
  let queue = Promise.resolve();
  let controller = new AbortController();
  const serialize = (operation) => {
    const next = queue.then(operation);
    queue = next.catch(() => {});
    return next;
  };
  const checkedGeneration = (expected) => {
    if (generation !== expected)
      throw failure("changed", "The ChatGPT connection changed. Try again.");
  };
  const safeError = (caught) => ({
    code: caught.code ?? "unavailable",
    message: caught.code
      ? caught.message
      : "ChatGPT is temporarily unavailable. Try again.",
  });
  async function tokenRequest(parameters) {
    const response = await request(`${issuer}/api/accounts/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...parameters, resource }),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    if (!response.ok) throw await providerFailure(response);
    return response.json();
  }
  async function activeCredentials() {
    return serialize(async () => {
      const expected = generation;
      const current = await store.load();
      if (!current?.accessToken)
        throw failure(
          "reconnect",
          "Continue with ChatGPT to connect your plan.",
        );
      if (!hasPlanPermission(current))
        throw failure(
          "permission",
          "Enable ChatGPT plan usage to add AI characters.",
        );
      if (usagePaused)
        throw failure(
          "usage-limit",
          "Your ChatGPT plan usage is paused. Check your usage before retrying.",
        );
      if (current.expiresAt > now() + 60_000) return current;
      if (!current.refreshToken)
        throw failure(
          "reconnect",
          "Reconnect your ChatGPT account to continue.",
        );
      try {
        const tokens = parseTokens(
          await tokenRequest({
            grant_type: "refresh_token",
            client_id: current.clientId,
            refresh_token: current.refreshToken,
          }),
          current,
        );
        checkedGeneration(expected);
        const next = {
          ...current,
          ...tokens,
          expiresAt: now() + tokens.expiresIn * 1000,
        };
        await store.save(next);
        if (!hasPlanPermission(next))
          throw failure(
            "permission",
            "Enable ChatGPT plan usage to add AI characters.",
          );
        return next;
      } catch (caught) {
        if (caught.code === "reconnect" && generation === expected)
          await store.save({
            clientId: current.clientId,
            subject: current.subject,
            email: current.email,
          });
        throw caught;
      }
    });
  }
  async function finishSignIn(transaction, registration, expected) {
    try {
      const callback = await transaction.result;
      if (callback.error) throw callback.error;
      await serialize(async () => {
        checkedGeneration(expected);
        // Retain issued registration even if the exchange fails; do not register another agent on retry.
        if (!registration) await store.save({ clientId: callback.clientId });
      });
      const tokens = parseTokens(
        await tokenRequest({
          grant_type: "authorization_code",
          client_id: callback.clientId,
          code: callback.code,
          code_verifier: transaction.verifier,
          redirect_uri: transaction.redirectUri,
        }),
      );
      const identity = await verifyIdentity(
        tokens.idToken,
        callback.clientId,
        transaction.nonce,
        request,
        now(),
      );
      if (registration?.subject && identity.sub !== registration.subject)
        throw failure(
          "identity",
          "Sign in with the previously connected ChatGPT account.",
        );
      await serialize(async () => {
        checkedGeneration(expected);
        await store.save({
          clientId: callback.clientId,
          subject: identity.sub,
          email: typeof identity.email === "string" ? identity.email : null,
          name: typeof identity.name === "string" ? identity.name : null,
          ...tokens,
          expiresAt: now() + tokens.expiresIn * 1000,
        });
        usagePaused = false;
        error = null;
      });
    } catch (caught) {
      if (generation === expected) error = safeError(caught);
    } finally {
      if (generation === expected) pending = null;
    }
  }
  const runtime = {
    credentialPath: store.path,
    async connection() {
      const saved = await store.load();
      return {
        connected: Boolean(saved?.accessToken),
        signingIn: pending !== null,
        email: saved?.email ?? null,
        name: saved?.name ?? null,
        planEnabled: Boolean(saved?.accessToken) && hasPlanPermission(saved),
        usagePaused,
        error,
      };
    },
    async startSignIn() {
      return serialize(async () => {
        if (pending)
          throw failure("busy", "ChatGPT sign-in is already in progress.");
        const expected = generation;
        const registration = await store.load();
        const transaction = await authorizeClient({
          hostId: await store.hostId(),
          registration,
          reconsent:
            Boolean(registration?.accessToken) &&
            !hasPlanPermission(registration),
        });
        if (generation !== expected) transaction.cancel();
        checkedGeneration(expected);
        pending = transaction;
        error = null;
        void finishSignIn(transaction, registration, expected);
        return { authorizationUrl: transaction.authorizationUrl };
      });
    },
    cancelSignIn() {
      generation += 1;
      pending?.cancel();
      pending = null;
    },
    async signOut() {
      generation += 1;
      pending?.cancel();
      pending = null;
      controller.abort();
      controller = new AbortController();
      return serialize(async () => {
        const saved = await store.load();
        if (saved)
          await store.save({
            clientId: saved.clientId,
            subject: saved.subject,
            email: saved.email,
          });
        error = null;
        usagePaused = false;
        if (!saved?.refreshToken)
          return { remoteRevocationConfirmed: !saved?.accessToken };
        try {
          const signal = AbortSignal.timeout(5_000);
          const discovery = await request(
            `${issuer}/.well-known/openid-configuration`,
            { signal, redirect: "error" },
          );
          const metadata = await discovery.json();
          const endpoint = new URL(metadata.revocation_endpoint);
          if (
            !discovery.ok ||
            metadata.issuer !== issuer ||
            endpoint.origin !== issuer ||
            endpoint.username ||
            endpoint.password ||
            endpoint.hash
          )
            return { remoteRevocationConfirmed: false };
          const response = await request(endpoint, {
            method: "POST",
            signal,
            redirect: "error",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              token: saved.refreshToken,
              token_type_hint: "refresh_token",
              client_id: saved.clientId,
            }),
          });
          await response.body?.cancel();
          return { remoteRevocationConfirmed: response.ok };
        } catch {
          return { remoteRevocationConfirmed: false };
        }
      });
    },
    retryUsage() {
      usagePaused = false;
      error = null;
    },
    async models() {
      const expected = generation;
      const signal = controller.signal;
      const current = await activeCredentials();
      checkedGeneration(expected);
      const response = await request(`${resource}/models`, {
        headers: {
          authorization: `Bearer ${current.accessToken}`,
          accept: "application/json",
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
        redirect: "error",
      });
      checkedGeneration(expected);
      if (!response.ok) throw await providerFailure(response);
      const body = await response.json();
      checkedGeneration(expected);
      if (!Array.isArray(body.models))
        throw failure(
          "invalid-models",
          "ChatGPT returned an unexpected model list.",
        );
      return body.models
        .filter(
          (model) =>
            model?.visibility === "list" &&
            typeof model.slug === "string" &&
            model.slug.length > 0 &&
            model.slug.length <= 200,
        )
        .map((model) => ({
          slug: model.slug,
          name:
            typeof model.display_name === "string"
              ? model.display_name
              : model.slug,
        }));
    },
    async generate({ model, instructions, input }) {
      const expected = generation;
      const signal = controller.signal;
      const current = await activeCredentials();
      checkedGeneration(expected);
      const response = await request(`${resource}/responses`, {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${current.accessToken}`,
          "content-type": "application/json",
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
        body: JSON.stringify({
          model,
          instructions,
          input: Array.isArray(input)
            ? input
            : [{ role: "user", content: String(input) }],
          store: false,
          stream: true,
        }),
      });
      checkedGeneration(expected);
      if (!response.ok) {
        const caught = await providerFailure(response);
        checkedGeneration(expected);
        if (caught.code === "usage-limit") {
          usagePaused = true;
          error = safeError(caught);
        }
        throw caught;
      }
      try {
        const text = await completedText(response);
        checkedGeneration(expected);
        return text;
      } catch (caught) {
        if (generation === expected && caught.code === "usage-limit") {
          usagePaused = true;
          error = safeError(caught);
        }
        throw caught;
      }
    },
    close() {
      generation += 1;
      pending?.cancel();
      pending = null;
      controller.abort();
    },
  };
  return runtime;
}
