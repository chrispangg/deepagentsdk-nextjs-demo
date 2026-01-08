import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile deepagentsdk since it's distributed as TypeScript source
  transpilePackages: ["deepagentsdk"],

  webpack: (config, { isServer }) => {
    // Only process server-side config for deepagentsdk
    if (isServer) {
      // Handle .js extensions that actually resolve to .ts files
      config.resolve.extensionAlias = {
        ".js": [".ts", ".tsx", ".js", ".jsx"],
        ".mjs": [".mts", ".mjs"],
        ".cjs": [".cts", ".cjs"],
      };
    }

    return config;
  },
};

export default nextConfig;
