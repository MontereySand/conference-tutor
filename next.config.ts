import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  cacheComponents: false,
  partialPrefetching: false,
  serverExternalPackages: ["@opentelemetry/sdk-node", "@opentelemetry/auto-instrumentations-node"],
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
