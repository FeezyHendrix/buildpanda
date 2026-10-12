import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  { ignores: [".next/**", "out/**", "next-env.d.ts", ".agents/**", ".claude/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // This app lives in a monorepo; point the pages check at its own app directory.
  { settings: { next: { rootDir: dirname(fileURLToPath(import.meta.url)) } } },
];

export default eslintConfig;
