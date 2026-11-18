import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fixture,allGrants} from './browser-fixture.mjs';
const base=process.env.FIELD_TEST_URL??'http://localhost:5183';let browser;
before(async()=>{browser=await chromium.launch();});after(async()=>{await browser?.close();});
async function ready(page){await page.getByRole('heading',{name:'RFIs',exact:true}).waitFor();}
async function refresh(page){await page.evaluate(async()=>{await(await import('/scripts/browser-entry.ts')).refreshProjectAccess();});}
test('Field UI queues a rich RFI offline and reconnects without duplicate writes',async()=>{
 const f=await fixture(browser,base);try{
  await f.page.goto(base+'/tools/rfis');await ready(f.page);await f.page.evaluate(()=>import('/scripts/browser-entry.ts'));await f.page.getByRole('button',{name:'New RFI',exact:true}).click();
  await f.page.getByLabel('Subject',{exact:true}).fill('Clarify beam reinforcement');const editor=f.page.locator('[contenteditable=true]');await editor.fill('Confirm lap length before casting.');
  await f.setOffline(true);await f.page.getByRole('button',{name:'Raise RFI',exact:true}).click();await f.page.getByText('Clarify beam reinforcement',{exact:true}).waitFor();assert.equal(f.posts.length,0);
  const queued=await f.page.evaluate(async()=>{const {openDb}=await import('/scripts/browser-entry.ts');const db=await openDb('u1');return db.$client.getAllSync('select * from outbox');});assert.equal(queued.length,1);
  await f.setOffline(false);await f.page.waitForFunction(async()=>{const {openDb}=await import('/scripts/browser-entry.ts');const db=await openDb('u1');return db.$client.getAllSync('select * from outbox').length===0;});
  await f.page.waitForFunction(async()=>{const {openDb}=await import('/scripts/browser-entry.ts');const db=await openDb('u1');return db.$client.getAllSync('select * from rfis').some(row=>row.id==='rfi-1');});assert.equal(f.posts.length,1);assert.equal(f.posts[0].subject,'Clarify beam reinforcement');assert.match(f.posts[0].questionHtml,/<p>Confirm lap length before casting\.<\/p>/);
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('read-only, denied deep links, unknown access and revocation hide protected data',async()=>{
 const f=await fixture(browser,base);try{
  f.setGrants({...allGrants,rfis:['view']});await f.page.goto(base+'/tools/rfis');await ready(f.page);assert.equal(await f.page.getByRole('button',{name:'New RFI',exact:true}).count(),0);
  await f.page.goto(base+'/tools/rfis/new');await f.page.getByText('You do not have permission to open this view.').waitFor();assert.equal(await f.page.getByLabel('Subject',{exact:true}).count(),0);
  f.setGrants(allGrants);await refresh(f.page);await f.page.getByLabel('Subject',{exact:true}).waitFor();
  f.setGrants({...allGrants,rfis:[]});await refresh(f.page);await f.page.getByText('You do not have permission to open this view.').waitFor();assert.equal(await f.page.getByLabel('Subject',{exact:true}).count(),0);
  const result=await f.page.evaluate(async()=>{const {openDb}=await import('/scripts/browser-entry.ts');const {rfisRepository}=await import('/scripts/browser-entry.ts');const db=await openDb('u1');try{await rfisRepository.createLocal(db,'p1',{subject:'Forbidden',question:'Cannot queue this'});return false;}catch(error){return error.name==='AccessDeniedError';}});assert.equal(result,true);
  await f.page.evaluate(async()=>{const {projectAccess}=await import('/scripts/browser-entry.ts');projectAccess.invalidate('unknown');});assert.equal(await f.page.getByLabel('Subject',{exact:true}).count(),0);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('downloaded plans render with a real PDF worker and respect the selected scope',async()=>{
 const f=await fixture(browser,base);try{
  await f.page.goto(base+'/tools/rfis');await ready(f.page);
  const document=makePdf();
  const uri=await f.page.evaluate(async bytes=>{const {cacheVersionBytes,projectAccess}=await import('/scripts/browser-entry.ts');return cacheVersionBytes(projectAccess.getState().scope,'version-1',new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));},[...document]);
  await f.page.goto(base+'/tools/documents/view?'+new URLSearchParams({uri,name:'Site plan.pdf'}));await f.page.waitForFunction(()=>{const canvas=document.querySelector('canvas');if(!canvas)return false;const pixel=canvas.getContext('2d').getImageData(canvas.width/4,canvas.height*3/4,1,1).data;return pixel[2]>200&&pixel[0]<100;});
  assert.ok(f.page.workers().some(worker=>worker.url().includes('pdf.worker')),'PDF parsing uses a separate browser worker');
  await f.page.evaluate(async()=>{const {projectAccess}=await import('/scripts/browser-entry.ts');projectAccess.setScope({userId:'u1',organizationId:'o1',projectId:'other-project'});});
  assert.equal(await f.page.locator('canvas').count(),0);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
function makePdf(){
 const stream='0 0 1 rg 10 10 160 100 re f\n';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 140] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}endstream`];let file='%PDF-1.4\n';const offsets=[0];objects.forEach((body,index)=>{offsets.push(file.length);file+=`${index+1} 0 obj\n${body}\nendobj\n`;});const start=file.length;file+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return new TextEncoder().encode(file);
}
test('conversation files require online membership even with a cached project snapshot',async()=>{
 const f=await fixture(browser,base);try{
  f.setGrants({...allGrants,documents:[]});await f.page.goto(base+'/tools/rfis');await ready(f.page);
  const result=await f.page.evaluate(async()=>{const {cacheFileById,readCachedFileDataUrl}=await import('/scripts/browser-entry.ts');const uri=await cacheFileById('file-message','attachment.txt','messages');const data=await readCachedFileDataUrl(uri);return{uri,data};});assert.match(result.data,/^data:/);
  await f.setOffline(true);const denied=await f.page.evaluate(async uri=>{try{await(await import('/scripts/browser-entry.ts')).readCachedFileDataUrl(uri);return false;}catch(error){return error.name==='AccessDeniedError';}},result.uri);assert.equal(denied,true);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('Field Tools detects backend recovery while the browser stays connected to Wi-Fi',async()=>{
 const f=await fixture(browser,base);try{
  await f.page.goto(base+'/tools/rfis');await ready(f.page);f.failHealth(true);await f.page.evaluate(async()=>{await(await import('/scripts/browser-entry.ts')).netInfo.refresh();});
  await f.page.goto(base+'/tools');await f.page.getByText('Offline — saved on this device',{exact:true}).waitFor();f.failHealth(false);await f.page.getByText('Back online',{exact:true}).waitFor({timeout:12000});assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('recorder controls pause, resume, release the microphone and hand audio to review',async()=>{
 const f=await fixture(browser,base);try{
  await f.page.addInitScript(()=>{
   window.liveMicTracks=0;
   navigator.mediaDevices.getUserMedia=async()=>{window.liveMicTracks++;let stopped=false;return{getTracks:()=>[{stop(){if(!stopped){stopped=true;window.liveMicTracks--;}}}]};};
   window.AudioContext=class{resume(){return Promise.resolve();}close(){return Promise.resolve();}createAnalyser(){return{fftSize:256,getByteTimeDomainData(values){values.fill(128);}};}createMediaStreamSource(){return{connect(){}};}};
   window.MediaRecorder=class{static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';start(){this.state='recording';}pause(){this.state='paused';}resume(){this.state='recording';}stop(){this.state='inactive';setTimeout(()=>{this.ondataavailable?.({data:new Blob(['fixture audio'],{type:this.mimeType})});this.onstop?.();},0);}};
  });
  await f.page.goto(base+'/tools');
  await f.page.getByRole('button',{name:'Capture a site record',exact:true}).click();
  await f.page.getByText('Listening…',{exact:true}).waitFor();
  await f.page.getByRole('button',{name:'Pause',exact:true}).click();await f.page.getByText('Paused',{exact:true}).waitFor();
  await f.page.getByRole('button',{name:'Resume',exact:true}).click();await f.page.getByText('Listening…',{exact:true}).waitFor();
  await f.page.getByRole('button',{name:'Finish and review',exact:true}).waitFor();
  await f.page.getByRole('button',{name:'Cancel recording',exact:true}).click();assert.equal(await f.page.locator('dialog[open]').count(),0);assert.equal(await f.page.evaluate(()=>window.liveMicTracks),0);
  await f.page.getByRole('button',{name:'Capture a site record',exact:true}).click();await f.page.getByText('Listening…',{exact:true}).waitFor();
  await f.page.getByRole('button',{name:'Finish and review',exact:true}).click();await f.page.waitForURL('**/capture?**');assert.equal(await f.page.evaluate(()=>window.liveMicTracks),0);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('offline rich text keeps image originals and canonical references in the queued form',async()=>{
 const f=await fixture(browser,base);try{
  await f.page.goto(base+'/tools/rfis');await ready(f.page);await f.page.getByRole('button',{name:'New RFI',exact:true}).click();await f.page.getByLabel('Subject',{exact:true}).fill('Site photo');await f.page.locator('[contenteditable=true]').fill('Check this beam.');await f.page.evaluate(()=>import('/scripts/browser-entry.ts'));await f.setOffline(true);
  await f.page.locator('input[type=file]').setInputFiles({name:'site.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=','base64')});
  await f.page.locator('[contenteditable=true] img[data-file-id]').waitFor();await f.page.getByRole('button',{name:'Raise RFI',exact:true}).click();await f.page.getByText('Site photo',{exact:true}).waitFor();
  const saved=await f.page.evaluate(async()=>{const {openDb}=await import('/scripts/browser-entry.ts');const db=await openDb('u1');const row=db.$client.getAllSync('select question_html from rfis')[0];const id=row.question_html.match(/data-file-id="([^"]+)"/)[1];const data=await new Promise((resolve,reject)=>{const request=indexedDB.open('buildpanda-content-images-v1',1);request.onsuccess=()=>{const db=request.result;const read=db.transaction('images').objectStore('images').getAll();read.onsuccess=()=>{db.close();resolve(read.result.find(image=>image.id===id));};read.onerror=()=>reject(read.error);};request.onerror=()=>reject(request.error);});return{html:row.question_html,image:data};});
  assert.match(saved.html,/data-file-id="local_image_/);assert.doesNotMatch(saved.html,/src="(?:blob:|data:)/);assert.match(saved.image.dataUrl,/^data:image\/png;base64,/);assert.equal(f.posts.length,0);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
