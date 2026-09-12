import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const empty = path.join(path.dirname(fileURLToPath(import.meta.url)), "lib/empty-module.ts");

const optional = {
  "@react-native-async-storage/async-storage": empty,
  "pino-pretty": empty,
  lokijs: empty,
  encoding: empty,
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm": false,
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core/client": false,
      "@x402/svm/exact/client": false,
      ...optional,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  turbopack: {
    resolveAlias: optional,
  },
};

export default nextConfig;
