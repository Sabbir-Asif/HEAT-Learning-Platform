import path from "node:path";
import type { NextConfig } from "next";

const partial = process.env.SPIKE_MODE !== "dynamic";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: partial,
  partialPrefetching: partial,
  ...(partial ? {} : { experimental: { useCache: true } }),
  distDir: partial ? ".next/partial" : ".next/dynamic",
  outputFileTracingRoot: path.join(__dirname, "../../../.."),
  transpilePackages: ["@heat/ui"],
};

export default nextConfig;
