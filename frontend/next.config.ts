import type { NextConfig } from "next";

const onVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  ...(onVercel
    ? {}
    : {
        output: "export" as const,
        basePath: "/xira" as const,
      }),
};

export default nextConfig;