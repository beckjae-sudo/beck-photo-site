import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.86.45",
    "192.168.86.45:3000",
    "localhost:3000",
  ],
};

export default nextConfig;
