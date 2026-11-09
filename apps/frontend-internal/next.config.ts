import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@heat/ui", "@heat/api-client", "@heat/contracts"],
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }];
  },
};

export default nextConfig;
