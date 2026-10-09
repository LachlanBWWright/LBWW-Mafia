import { describe, expect, test } from "vitest";
import { createJsonFixtureHandler, jsonFixture } from "./api-fixtures";

describe("API test fixtures", () => {
  test("creates JSON responses with predictable headers", async () => {
    const response = jsonFixture({ body: { ok: true }, status: 201 });
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test("routes by pathname and returns a useful missing-route response", async () => {
    const fetchFixture = createJsonFixtureHandler({
      "/api/profile": { body: { name: "Mira" } },
    });
    await expect((await fetchFixture("http://app.test/api/profile")).json()).resolves.toEqual({
      name: "Mira",
    });
    const missing = await fetchFixture("http://app.test/api/unknown");
    expect(missing.status).toBe(404);
  });
});
