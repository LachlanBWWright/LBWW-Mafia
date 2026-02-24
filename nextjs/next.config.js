/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.modules = [
      ...(config.resolve.modules ?? []),
      new URL("node_modules", import.meta.url).pathname,
    ];
    return config;
  },
};

export default config;
