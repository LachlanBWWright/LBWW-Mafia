export type JsonFixture = {
  body: unknown;
  status?: number;
  headers?: Record<string, string>;
};

/** Build a fetch-compatible response for Storybook and browser test handlers. */
export function jsonFixture({ body, status = 200, headers = {} }: JsonFixture) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Match URL paths without coupling tests to the host or deployment origin. */
export function createJsonFixtureHandler(
  routes: Record<string, JsonFixture>,
) {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(input.toString(), "http://fixtures.test");
    const fixture = routes[url.pathname];
    return fixture
      ? jsonFixture(fixture)
      : jsonFixture({ body: { error: "fixture route not found" }, status: 404 });
  };
}
