// Run production handlers, API wrappers and SQLite repositories. Only HTTP and
// native filesystem/platform boundaries are adapted for the Node test process.
import '../rbac/loader.mjs';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
const source = new URL('../../src/', import.meta.url);
const fixture = new URL('./transport.mjs', import.meta.url).href;
const code = (text) => ({ url: `data:text/javascript,${encodeURIComponent(text)}`, shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
  const path = specifier.startsWith('@/') ? new URL(specifier.slice(2), source).pathname : specifier.startsWith('.') ? new URL(specifier, context.parentURL).pathname : '';
  if (/\/src\/api\/client(?:\.ts)?$/.test(path)) return { url: fixture, shortCircuit: true };
  if (/\/src\/lib\/auth-client(?:\.ts)?$/.test(path)) return code('export const API_BASE_URL="http://fixture"; export const authClient={getCookie:()=>"fixture"};');
  if (path.endsWith('.json')) return code(`const data = ${readFileSync(path, 'utf8')}; export default data; export const colors = data.colors;`);
  if (specifier === 'react-native') return code('export const Platform={OS:"ios"};');
  if (specifier === '@react-native-community/netinfo') return code('export default {fetch:async()=>({isConnected:true,isInternetReachable:true})};');
  if (specifier === 'expo-file-system') return { url: new URL('./filesystem.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === 'expo-file-system/legacy') return code('export const FileSystemUploadType={MULTIPART:1}; export const uploadAsync=async()=>({status:201,body:JSON.stringify({id:"file-uploaded"})});');
  return next(specifier, context);
} });
