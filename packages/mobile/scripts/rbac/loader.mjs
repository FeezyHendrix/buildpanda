// Node runs the production policies/repositories; only native UUID generation is adapted.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const source = new URL('../../src/', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'expo-crypto') return { url: 'data:text/javascript,export%20%7BrandomUUID%7D%20from%20%22node%3Acrypto%22', shortCircuit: true };
  const local = specifier.startsWith('@/') ? new URL(specifier.slice(2), source) : specifier.startsWith('.') ? new URL(specifier, context.parentURL) : null;
  if (local?.protocol === 'file:') for (const extension of ['.ts', '.tsx', '/index.ts']) {
    const candidate = fileURLToPath(local) + extension;
    if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
  }
  return next(specifier, context);
} });
