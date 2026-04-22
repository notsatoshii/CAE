import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["165.245.186.254"],
  // WR-05: prevent clickjacking across all routes, especially /floor/popout which carries
  // live session-authenticated telemetry in its own window. Both headers are set for
  // broad browser compatibility: X-Frame-Options for older browsers, CSP frame-ancestors
  // for modern browsers (CSP takes precedence when both are present).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
