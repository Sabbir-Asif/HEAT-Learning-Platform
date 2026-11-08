import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@heat/ui", "@heat/api-client", "@heat/i18n", "@heat/contracts"],
};

export default withNextIntl(nextConfig);
