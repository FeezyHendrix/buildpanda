import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(process.argv[2]??fileURLToPath(new URL('./dist',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.ico':'image/x-icon','.ttf':'font/ttf','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
async function send(req,res,file){
 const bytes=await readFile(file);res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');
 res.setHeader('Cache-Control',relative(root,file).startsWith('assets/')?'public, max-age=31536000, immutable':'no-cache');
 res.setHeader('Vary','Accept-Encoding');
 const accept=String(req.headers['accept-encoding']??'');
 for(const [token,suffix] of [['br','.br'],['gzip','.gz']]){
  const match=accept.split(',').map(value=>value.trim()).find(value=>value.split(';')[0]===token);
  if(!match||/;\s*q=0(?:\.0*)?$/.test(match))continue;
  try{const compressed=await readFile(file+suffix);res.setHeader('Content-Encoding',token);res.end(req.method==='HEAD'?undefined:compressed);return;}catch{/* Use the original when no compressed sibling exists. */}
 }
 res.end(req.method==='HEAD'?undefined:bytes);
}
const server=createServer(async(req,res)=>{
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 let path;
 try{path=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 const file=resolve(root,'.'+path);if(relative(root,file).startsWith('..')){res.writeHead(404);res.end();return;}
 try{await send(req,res,path==='/'?join(root,'index.html'):file);}catch{
  if(!extname(path)&&!path.startsWith('/assets/')){try{await send(req,res,join(root,'index.html'));return;}catch{/* The build is missing. */}}
  res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');
 }
});
server.listen(Number(process.env.PORT??8080),'0.0.0.0',()=>process.stdout.write(`BuildPanda Field on :${process.env.PORT??8080}\n`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close());
