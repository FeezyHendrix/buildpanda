import { fileURLToPath } from "node:url";
import path from "node:path";

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runs as a Node server (next start). No static export.
  trailingSlash: true,
  outputFileTracingRoot: monorepoRoot,
  // Use Next's responsive image optimization for product screenshots.
  // SVG logos automatically bypass the optimizer.
};

export default nextConfig;
