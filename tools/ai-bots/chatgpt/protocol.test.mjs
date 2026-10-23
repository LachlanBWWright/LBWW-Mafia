import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasPlanPermission,
  parseTokens,
  providerFailure,
  terminalRefreshErrors,
} from "../../../shared/ai/protocol.mjs";
const valid = {
  access_token: "access",
  token_type: "Bearer",
  expires_in: 3600,
  scope: "openid resource.invoke chatgpt.tokens.use.direct",
};

for (const patch of [
  null,
  {},
  { access_token: "" },
  { access_token: 1 },
  { token_type: "api-key" },
  { token_type: null },
  { expires_in: 0 },
  { expires_in: -1 },
  { expires_in: 0.1 },
  { expires_in: Infinity },
  { expires_in: 31_536_001 },
  { refresh_token: "" },
  { refresh_token: null },
])
  test(`rejects malformed token grant ${JSON.stringify(patch)}`, () =>
    assert.throws(
      () =>
        parseTokens(
          patch === null
            ? null
            : {
                ...valid,
                ...patch,
                ...(Object.keys(patch).length === 0
                  ? { access_token: undefined }
                  : {}),
              },
        ),
      { code: "invalid-token" },
    ));

test("refresh inherits only omitted fields and honors explicit grant reductions", () => {
  const previous = {
    accessToken: "old",
    refreshToken: "rotate",
    idToken: "identity",
    scopes: ["resource.invoke", "chatgpt.tokens.use.direct"],
  };
  const refreshed = parseTokens(
    { ...valid, token_type: "bearer", scope: undefined },
    previous,
  );
  assert.equal(refreshed.refreshToken, "rotate");
  assert.equal(refreshed.idToken, "identity");
  assert.equal(hasPlanPermission(refreshed), true);
  assert.equal(
    hasPlanPermission(parseTokens({ ...valid, scope: "openid" }, previous)),
    false,
  );
  assert.equal(
    hasPlanPermission(parseTokens({ ...valid, scope: "" }, previous)),
    false,
  );
  for (const value of [
    undefined,
    {},
    { scopes: [] },
    { scopes: ["resource.invoke"] },
    { scopes: ["chatgpt.tokens.use.direct"] },
  ])
    assert.equal(hasPlanPermission(value), false);
  assert.deepEqual(
    parseTokens({
      ...valid,
      scope: "  resource.invoke\tchatgpt.tokens.use.direct \n",
    }).scopes,
    ["resource.invoke", "chatgpt.tokens.use.direct"],
  );
});

for (const [code, status, expected] of [
  ["subscription_sharing_usage_limit_exceeded", 429, "usage-limit"],
  ["subscription_sharing_user_not_eligible", 403, "ineligible"],
  ["subscription_sharing_usage_unavailable", 503, "unavailable"],
  ["subscription_sharing_user_unavailable", 503, "unavailable"],
  ["subscription_sharing_unsupported_capability", 400, "configuration"],
  ["subscription_sharing_route_not_supported", 403, "configuration"],
  ["invalid_client", 400, "configuration"],
  ["chatpass_v2_scope_not_authorized", 403, "permission"],
  ["chatpass_v2_invalid_authorization_context", 403, "permission"],
  ...[...terminalRefreshErrors].map((code) => [code, 400, "reconnect"]),
])
  test(`provider recovery classifies ${code} without changing billing`, async () => {
    const body = { error: { code, param: "model" } };
    const error = await providerFailure(
      Response.json(body, {
        status,
        headers: { "x-request-id": "request-id" },
      }),
    );
    assert.equal(error.code, expected);
    assert.equal(error.providerCode, code);
    assert.equal(error.requestId, "request-id");
    assert.deepEqual(error.body, body);
  });

test("non-JSON and admission failures retain HTTP context without inventing error codes", async () => {
  const error = await providerFailure(
    new Response("upstream HTML", { status: 503 }),
  );
  assert.equal(error.code, "unavailable");
  assert.equal(error.body, null);
  assert.equal(error.status, 503);
  assert.equal(
    (
      await providerFailure(
        Response.json({ detail: "denied" }, { status: 401 }),
      )
    ).code,
    "reconnect",
  );
  assert.equal(
    (
      await providerFailure(
        Response.json({ detail: "region" }, { status: 403 }),
      )
    ).code,
    "restricted",
  );
});
