import { createHash } from 'node:crypto';
import { readFile,writeFile,readdir,stat } from 'node:fs/promises';
import { brotliCompressSync,gzipSync } from 'node:zlib';
import { resolve,relative,join,extname } from 'node:path';
const root=resolve(import.meta.dirname,'..');const dist=join(root,'dist');
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(entry=>entry.isDirectory()?files(join(dir,entry.name)):join(dir,entry.name)))).flat();}
const paths=(await files(dist)).filter(file=>!file.includes('/.vite/')&&!file.endsWith('/sw.js')&&!/\.(br|gz)$/.test(file)).sort();
const template=await readFile(join(root,'web/sw.js'),'utf8');
const hash=createHash('sha256').update(template);for(const file of paths){hash.update(relative(dist,file));hash.update(await readFile(file));}
const version=`react-${hash.digest('hex').slice(0,12)}`;
const precache=['/',...paths.filter(file=>!file.endsWith('/index.html')).map(file=>'/'+relative(dist,file))];
await writeFile(join(dist,'sw.js'),template.replace('__BUILD_ID__',version).replace('__PRECACHE__',JSON.stringify(precache)));
console.log(`Field PWA ${version}: ${precache.length} offline assets, ${Math.round((await Promise.all(paths.map(file=>stat(file)))).reduce((sum,file)=>sum+file.size,0)/1024)} KB`);

for(const file of paths){if(!['.js','.mjs','.css','.html','.json','.svg','.webmanifest'].includes(extname(file)))continue;const bytes=await readFile(file);if(bytes.length<1024)continue;await Promise.all([writeFile(file+'.br',brotliCompressSync(bytes)),writeFile(file+'.gz',gzipSync(bytes))]);}
