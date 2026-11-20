import { afterEach, expect, it, vi } from "vitest";
import { installEmptyPresetStoryFixture } from "./presets-story-fixture";
afterEach(() => vi.unstubAllGlobals());
it("provides every batched preset response and restores the original fetch", async () => {
  const original = vi.fn().mockResolvedValue(new Response("real response"));
  vi.stubGlobal("fetch", original);
  const restore = installEmptyPresetStoryFixture();
  const response = await fetch(
    "/api/trpc/features.presets,features.presets?batch=1",
  );
  expect(await response.json()).toEqual([
    { result: { data: { json: [] } } },
    { result: { data: { json: [] } } },
  ]);
  expect(original).not.toHaveBeenCalled();
  await fetch("/api/trpc/features.savePreset", { method: "POST" });
  await fetch("/api/trpc/features.presets,features.campaigns?batch=1");
  expect(original).toHaveBeenCalledTimes(2);
  restore();
  expect(globalThis.fetch).toBe(original);
});
