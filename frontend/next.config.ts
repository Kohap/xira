import type { NextConfig } from "next";

const onVercel = process.env.VERCEL === "1";

const apiOrigin = (() => {
  const url =
    process.env.NEXT_PUBLIC_API_URL || "https://xira-api-production.up.railway.app";
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
})();

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' ${apiOrigin}`,
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  ];

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  ...(onVercel
    ? {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: securityHeaders,
            },
          ];
        },
      }
    : {
        output: "export" as const,
        basePath: "/xira" as const,
      }),
};

export default nextConfig;