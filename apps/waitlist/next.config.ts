import type { NextConfig } from "next";

const config: NextConfig = {
  // Static export: pages are served as Workers static assets, which are free and unlimited,
  // so page views never consume the 100k/day Worker request budget.
  output: "export",
  transpilePackages: ["@matr/ui", "@matr/types", "@matr/api-client"],
  images: { unoptimized: true },
};

export default config;
