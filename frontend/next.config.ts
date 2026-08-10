import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/xira",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
