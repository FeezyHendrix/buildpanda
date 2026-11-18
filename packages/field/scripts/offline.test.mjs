import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fixture} from './browser-fixture.mjs';
const base=process.env.FIELD_PRODUCTION_URL??'http://localhost:5184';
test('installed React PWA reopens queued work offline, syncs once and rejects expired access',{timeout:60000},async()=>{
 const browser=await chromium.launch();const f=await fixture(browser,base);try{
  await f.page.goto(base+'/tools/rfis');await f.page.getByRole('heading',{name:'RFIs',exact:true}).waitFor();
  await f.page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await f.page.getByRole('button',{name:'New RFI',exact:true}).click();await f.page.getByLabel('Subject',{exact:true}).fill('Offline restart regression');await f.page.locator('[contenteditable=true]').fill('Keep this field record after a cold start.');
  await f.setOffline(true);await f.page.getByRole('button',{name:'Raise RFI',exact:true}).click();await f.page.getByText('Offline restart regression',{exact:true}).waitFor();assert.equal(f.posts.length,0);
  await f.page.reload();await f.page.getByText('Offline restart regression',{exact:true}).waitFor({timeout:8000});await f.page.getByRole('button',{name:'Waiting to upload. 1 waiting.',exact:true}).waitFor();assert.equal(f.posts.length,0);
  await f.setOffline(false);await f.page.getByRole('button',{name:'All changes synced',exact:true}).waitFor();assert.equal(f.posts.length,1);assert.equal(f.posts[0].subject,'Offline restart regression');
  await f.page.evaluate(()=>{const key='buildpanda_project_access_v1';const snapshot=JSON.parse(localStorage.getItem(key));snapshot.verifiedAt=Date.now()-25*60*60*1000;localStorage.setItem(key,JSON.stringify(snapshot));});
  await f.setOffline(true);await f.page.reload();await f.page.getByText(/Connect to verify your project permissions/).waitFor();assert.equal(await f.page.getByText('Offline restart regression',{exact:true}).count(),0);assert.deepEqual(f.errors,[]);
 }catch(error){console.error('WORKERS',f.page.workers().map(w=>w.url()));console.error('Offline failure',await f.page.locator('body').innerText(),f.errors,await f.page.evaluate(()=>({isolated:crossOriginIsolated,online:navigator.onLine,snapshot:localStorage.getItem('buildpanda_project_access_v1'),html:document.getElementById('root').innerHTML})));await f.page.screenshot({path:'/tmp/buildpanda-field-offline-failure.png'});throw error;}finally{await f.context.close();await browser.close();}
});
