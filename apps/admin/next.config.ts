import type { NextConfig } from "next";

const config: NextConfig = {
  // Static export served by the admin Worker behind Cloudflare Access (see wrangler.toml). The
  // portal is a client app over /api/admin/*; there is no server runtime.
  output: "export",
  transpilePackages: ["@matr/ui"],
  images: { unoptimized: true },
};

export default config;
