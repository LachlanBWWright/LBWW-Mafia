/** Supplies only the saved-presets query in the isolated custom-lobby stories. */
export function installEmptyPresetStoryFixture() {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, "https://storybook.example.test");
    const procedures = url.pathname.replace("/api/trpc/", "").split(",");
    if (
      (init?.method ?? (input instanceof Request ? input.method : "GET")) ===
        "GET" &&
      url.pathname.startsWith("/api/trpc/") &&
      procedures.every((procedure) => procedure === "features.presets")
    ) {
      const result = { result: { data: { json: [] } } };
      return Promise.resolve(
        Response.json(
          url.searchParams.get("batch") === "1"
            ? procedures.map(() => result)
            : result,
        ),
      );
    }
    return original(input, init);
  };
  return () => {
    globalThis.fetch = original;
  };
}
