import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname);
const native = path.resolve(root, "../mobile/src");
function existing(base: string) { return [base,`${base}.ts`,`${base}.tsx`,`${base}.json`,`${base}/index.ts`,`${base}/index.tsx`].find(file=>existsSync(file)&&statSync(file).isFile()); }
function fieldSources(): Plugin {
 return {name:"field-sources",enforce:"pre",resolveId(id, importer) {
   if(id==='expo-sqlite') return path.resolve(root,'node_modules/expo-sqlite/src/SQLiteDatabase.ts');
   if(importer?.includes('expo-sqlite/')) {
    if(id==='./SQLiteDevToolsClient')return '\0sqlite-devtools';
    if(id==='expo')return path.resolve(root,'src/platform/sqlite-events.ts');
    if(id==='react-native')return '\0sqlite-platform';
    if(id==='./ExpoSQLite')return path.resolve(root,'node_modules/expo-sqlite/web/SQLiteModule.ts');
   }
   if(id==='\0sqlite-platform')return id;
   if(/^(react-native(?:$|[-/])|expo(?:$|[-/])|@expo\/|@react-native\/|nativewind)/.test(id))throw new Error(`Native runtime import ${id} from ${importer}. Add a browser implementation.`);
   if(id.startsWith("@/assets/")) return path.resolve(root,"../mobile/assets",id.slice(9));
   if(id.startsWith("@/")) return existing(path.resolve(root,"src",id.slice(2))) ?? existing(path.resolve(native,id.slice(2)));
   if(importer&&(importer.startsWith(native)||importer.startsWith(path.resolve(root,"src")))&&id.startsWith(".")) {
    const base=importer.startsWith(native)?native:path.resolve(root,"src");
    const rel=path.relative(base,path.resolve(path.dirname(importer),id));
    const override=existing(path.resolve(root,"src",rel)); if(override)return override;
    const shared=existing(path.resolve(native,rel));if(shared)return shared;
   }
 },load(id) {
   if(id==='\0sqlite-platform')return 'export const Platform={OS:"web"};';
   if(id==='\0sqlite-devtools')return 'export async function registerDatabaseForDevToolsAsync() {} export async function unregisterDatabaseForDevToolsAsync() {}';
   if(id.endsWith(".sql"))return `export default ${JSON.stringify(readFileSync(id,"utf8"))}`;
 },transform(code,id){
   if(id.split('?')[0]!.endsWith('/expo-sqlite/web/wa-sqlite/wa-sqlite.js')){const footer=code.lastIndexOf(';if(typeof exports===');if(footer<0)throw new Error('SQLite browser factory changed; review its ESM binding.');return code.slice(0,footer)+';export default Module;';}
   if(id.split('?')[0]!.endsWith('/expo-sqlite/web/SQLiteModule.ts'))return code.replace("new Worker(new URL('./worker', window.location.href))", "new Worker(new URL('./worker.ts', import.meta.url), {type:'module'}); worker.addEventListener('error',event=>console.error('SQLite worker failed',event.message))");
   if(id.split('?')[0]!.endsWith('/expo-sqlite/web/worker.ts'))return code.replace("'./wa-sqlite/wa-sqlite.wasm'", "'./wa-sqlite/wa-sqlite.wasm?url'");
 }};
}
export default defineConfig(({command,mode})=>{
 const env=loadEnv(mode,path.resolve(root,'../..'),['VITE_','EXPO_PUBLIC_']);
 const api=process.env.VITE_API_BASE_URL??process.env.EXPO_PUBLIC_API_URL??env.VITE_API_BASE_URL??env.EXPO_PUBLIC_API_URL??(command==='serve'?'http://localhost:3000':undefined);
 if(!api)throw new Error('Set VITE_API_BASE_URL or EXPO_PUBLIC_API_URL before building the Field PWA.');
 const dependencies=Object.keys(JSON.parse(readFileSync(path.resolve(root,'package.json'),'utf8')).dependencies);
 return {
 root,plugins:[fieldSources(),react()],worker:{plugins:()=>[fieldSources()]},
 resolve:{dedupe:dependencies},
 define:{'process.env.EXPO_PUBLIC_API_URL':JSON.stringify(api),'__DEV__':JSON.stringify(command==='serve'),'import.meta.env.VITE_FIELD_SENTRY_DSN':JSON.stringify(process.env.VITE_SENTRY_DSN??process.env.EXPO_PUBLIC_SENTRY_DSN??env.EXPO_PUBLIC_SENTRY_DSN??env.VITE_SENTRY_DSN??''),'import.meta.env.VITE_FIELD_SENTRY_ENVIRONMENT':JSON.stringify(process.env.VITE_SENTRY_ENVIRONMENT??process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT??env.EXPO_PUBLIC_SENTRY_ENVIRONMENT??'production'),'import.meta.env.VITE_FIELD_RELEASE':JSON.stringify(process.env.RAILWAY_GIT_COMMIT_SHA??'')},
 server:{port:5183,headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},
 preview:{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},
 optimizeDeps:{extensions:['.tsx'],noDiscovery:true,include:['react-router-dom','react','react-dom/client','react/jsx-runtime','@tanstack/react-query','better-auth/react','better-auth/client/plugins','@buildpanda/rich-text-editor','htmlparser2','expo-sqlite > await-lock','better-auth > cookie','better-auth > set-cookie-parser'],exclude:['expo-sqlite','drizzle-orm']},
 build:{manifest:true}
 };
});
