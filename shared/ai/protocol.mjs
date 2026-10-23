export const issuer = "https://auth.openai.com";
export const resource = "https://api.openai.com/v1";
export const scopes =
  "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
export const planScopes = ["resource.invoke", "chatgpt.tokens.use.direct"];
export const terminalRefreshErrors = new Set([
  "invalid_grant",
  "invalid_refresh_token",
  "token_expired",
  "refresh_token_expired",
  "refresh_token_invalidated",
  "refresh_token_reused",
]);

export function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

export async function providerFailure(response) {
  const body = await response.json().catch(() => null);
  return providerError(body, {
    status: response.status,
    requestId: response.headers.get("x-request-id"),
  });
}

export function providerError(body, { status, requestId } = {}) {
  const code = typeof body?.error === "string" ? body.error : body?.error?.code;
  const diagnostic = {
    status,
    requestId,
    providerCode: code,
    param: body?.error?.param,
    body,
  };
  const result = (code, message) =>
    Object.assign(failure(code, message), diagnostic);
  if (code === "subscription_sharing_usage_limit_exceeded")
    return result(
      "usage-limit",
      "Your ChatGPT plan usage limit has been reached. Check your usage before retrying.",
    );
  if (code === "subscription_sharing_user_not_eligible")
    return result(
      "ineligible",
      "This ChatGPT account is not eligible for plan usage.",
    );
  if (
    code === "subscription_sharing_unsupported_capability" ||
    code === "subscription_sharing_route_not_supported" ||
    code === "invalid_client"
  )
    return result(
      "configuration",
      "This ChatGPT request is not supported. The app configuration needs to be checked.",
    );
  if (status === 401 || terminalRefreshErrors.has(code))
    return result("reconnect", "Reconnect your ChatGPT account to continue.");
  if (
    [
      "chatpass_v2_scope_not_authorized",
      "chatpass_v2_invalid_authorization_context",
    ].includes(code)
  )
    return result("permission", "Authorize ChatGPT plan usage to continue.");
  if (status === 403)
    return result(
      "restricted",
      "ChatGPT could not allow this request. Access may be restricted for this account or region.",
    );
  return result(
    "unavailable",
    "ChatGPT is temporarily unavailable. Try again later.",
  );
}

export const hasPlanPermission = (credentials) =>
  planScopes.every((scope) => credentials?.scopes?.includes(scope));

export function parseTokens(value, previous) {
  if (
    !value ||
    typeof value.access_token !== "string" ||
    !value.access_token ||
    typeof value.token_type !== "string" ||
    value.token_type.toLowerCase() !== "bearer" ||
    !Number.isSafeInteger(value.expires_in) ||
    value.expires_in <= 0 ||
    value.expires_in > 31_536_000 ||
    (value.refresh_token !== undefined &&
      (typeof value.refresh_token !== "string" || !value.refresh_token))
  )
    throw failure(
      "invalid-token",
      "ChatGPT returned an incomplete token response.",
    );
  const granted =
    typeof value.scope === "string"
      ? value.scope.split(/\s+/).filter(Boolean)
      : (previous?.scopes ?? []);
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token ?? previous?.refreshToken ?? null,
    idToken: value.id_token ?? previous?.idToken,
    scopes: granted,
    expiresIn: value.expires_in,
  };
}
