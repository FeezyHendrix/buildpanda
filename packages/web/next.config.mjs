import { fileURLToPath } from "node:url";
import path from "node:path";

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runs as a Node server (next start). No static export.
  trailingSlash: true,
  outputFileTracingRoot: monorepoRoot,
  images: {
    // Logo is an SVG; keep optimization off so next/image serves it directly.
    unoptimized: true,
  },
};

export default nextConfig;
