export const user={id:'u1',name:'Site crew',email:'crew@example.com'};
export const scope={userId:'u1',organizationId:'o1',projectId:'p1',buildingId:'b1'};
export const allGrants={project:['view'],rfis:['view','create','manage','respond'],documents:['view','upload','markup'],buildings:['view'],stages:['view'],schedule:['view'],tasks:['view','viewAll','add'],updates:['view','post'],finances:['viewCosts','viewAllExpenses','manage'],materials:['view','request','approve','manage'],messages:['view','send'],comments:['post'],'change-requests':['view','manage']};
export async function fixture(browser,base){
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];const requests=[];const posts=[];let grants=structuredClone(allGrants);let accessFailure=false;let created=[];let networkOffline=false;let healthFailed=false;
 if(process.env.FIELD_DEBUG)page.on('console',message=>{if(['error','warning'].includes(message.type()))console.log('BROWSER',message.text());});
 if(process.env.FIELD_DEBUG){page.on('requestfailed',r=>console.log('FAILED REQUEST',r.url(),r.failure()));page.on('worker',worker=>console.log('WORKER',worker.url()));}
 page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(({user,scope})=>{if(!localStorage.getItem('buildpanda_session_user'))localStorage.setItem('buildpanda_session_user',JSON.stringify(user));if(!localStorage.getItem('buildpanda_field_scope'))localStorage.setItem('buildpanda_field_scope',JSON.stringify(scope));},{user,scope});
 await context.route('https://api.staging.buildpanda.io/**',async route=>{
  if(networkOffline){await route.abort('internetdisconnected');return;}const request=route.request();const path=new URL(request.url()).pathname;requests.push({path,method:request.method()});let body=[];let status=200;
  if(path==='/healthz'&&healthFailed){await route.abort();return;}
  if(path==='/crypto/payload-key')status=404;
  if(path.includes('get-session'))body={user:{...user,emailVerified:true,createdAt:new Date(),updatedAt:new Date()},session:{id:'s1',userId:user.id,activeOrganizationId:scope.organizationId,expiresAt:new Date(Date.now()+86400000)}};
  if(path==='/projects/p1/access'){if(accessFailure){await route.abort();return;}body={...scope,relationship:'member',permissions:grants,workspacePermissions:{messages:['view','send']},capabilities:{canViewInternalRfis:true}};}
  if(path==='/projects/p1')body={id:'p1',name:'Field fixture',organizationId:'o1',status:'Active'};
  if(path.endsWith('/buildings'))body=[{id:'b1',name:'Block A'}];
  if(path==='/projects')body=[{id:'p1',name:'Field fixture'}];
  if(path==='/projects/p1/rfis'){
   if(request.method()==='POST'){const data=request.postDataJSON();posts.push(data);const row={...data,id:`rfi-${posts.length}`,number:posts.length,visibility:'internal',status:'Open',officialResponse:null,officialResponseHtml:null,officialRespondedByName:null,officialRespondedAt:null};created.push(row);body=row;}else body=created;
  }
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Cross-Origin-Resource-Policy':'cross-origin'}});
 });
 return{context,page,errors,requests,posts,failHealth:value=>{healthFailed=value;},setOffline:async(value)=>{networkOffline=value;await context.setOffline(value);},setGrants:next=>{grants=next;},failAccess:()=>{accessFailure=true;}};
}
