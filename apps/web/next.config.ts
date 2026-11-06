import type { NextConfig } from "next";

const config: NextConfig = {
  // Static export: the marketing pages are plain HTML served from Cloudflare (Workers static
  // assets), which keeps them fast, cheap and easy to index. The learner app will need a server
  // runtime later; that is decided when auth starts.
  output: "export",
  transpilePackages: ["@matr/ui"],
  images: { unoptimized: true },
};

export default config;
