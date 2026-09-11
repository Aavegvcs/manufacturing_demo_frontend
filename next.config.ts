import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "192.168.1.117",
    "localhost",
    "127.0.0.1",
    "*.ngrok-free.app",
  ],

  // Enable standalone output for Docker
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wtitestbucket.s3.ap-south-1.amazonaws.com" },
      { protocol: "https", hostname: "placehold.co" },
    ],
    // Local, self-authored SVG product illustrations (public/products/aag/*)
    // for the Air Master demo — safe to allow since nothing is user-uploaded.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.BACKEND_URL || "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
