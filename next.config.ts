import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "172.20.10.3", "192.168.*"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 480, 640, 768, 1024, 1280, 1536],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
