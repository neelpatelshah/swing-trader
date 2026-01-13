import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@swing-trader/contracts"],
};

export default nextConfig;
