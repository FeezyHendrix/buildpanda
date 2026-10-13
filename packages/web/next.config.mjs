import { fileURLToPath } from "node:url";
import path from "node:path";

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runs as a Node server (next start). The old site's URLs, which search
  // engines have indexed, all end in a slash; keep that so they stay canonical.
  trailingSlash: true,
  outputFileTracingRoot: monorepoRoot,
  // Pages the previous site had, sent permanently to where that content
  // lives now so their search ranking carries over instead of hitting a 404.
  async redirects() {
    return [
      { source: "/construction", destination: "/for-owners/", permanent: true },
      { source: "/for-contractors", destination: "/", permanent: true },
      { source: "/terms", destination: "/terms-of-service/", permanent: true },
      { source: "/policies", destination: "/terms-of-service/", permanent: true },
    ];
  },
};

export default nextConfig;
