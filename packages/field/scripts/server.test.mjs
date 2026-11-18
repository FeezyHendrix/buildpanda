import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
test('production host serves isolated SPA routes and real asset errors',async()=>{
 const child=spawn(process.execPath,['web-server.mjs'],{cwd:root,env:{...process.env,PORT:'5187'},stdio:['ignore','pipe','pipe']});
 try{
  await once(child.stdout,'data');const origin='http://localhost:5187';
  const navigation=await fetch(origin+'/tools/rfis');assert.equal(navigation.status,200);assert.match(await navigation.text(),/BuildPanda Field Tools/);assert.equal(navigation.headers.get('cross-origin-embedder-policy'),'require-corp');assert.equal(navigation.headers.get('cross-origin-opener-policy'),'same-origin');
  assert.equal((await fetch(origin+'/assets/missing.js')).status,404);assert.equal((await fetch(origin+'/%ZZ')).status,400);assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
  const worker=await fetch(origin+'/sw.js');assert.match(worker.headers.get('content-type'),/javascript/);assert.equal(worker.headers.get('cache-control'),'no-cache');
  const name=(await readdir(resolve(root,'dist/assets'))).find(name=>name.endsWith('.js'));
  const asset=await fetch(origin+'/assets/'+name);assert.match(asset.headers.get('cache-control'),/immutable/);assert.equal(await asset.text(),await readFile(resolve(root,'dist/assets',name),'utf8'));
 }finally{child.kill('SIGTERM');await once(child,'exit');}
});
