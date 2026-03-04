import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  outputFileTracingRoot: path.join(__dirname),
  reactStrictMode: false,
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["@grpc/grpc-js", "@grpc/proto-loader"],
  webpack: (config, { dev }) => {
    // Avoid casing mismatch on Windows (Imagify vs imagify)
    config.resolve = config.resolve || {};
    config.resolve.symlinks = true;
    // Use memory cache in dev to avoid ENOENT pack.gz filesystem errors on Windows
    if (dev && config.cache) {
      config.cache = { type: "memory" as const };
    }
    return config;
  },
};

export default nextConfig;
