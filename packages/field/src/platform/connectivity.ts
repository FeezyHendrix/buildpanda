import {useSyncExternalStore} from 'react';
type State={isConnected:boolean;isInternetReachable:boolean|null};
type Configuration={reachabilityUrl:string;reachabilityMethod:string;reachabilityRequestTimeout:number;reachabilityLongTimeout?:number;reachabilityShortTimeout?:number;reachabilityTest:(response:Response)=>Promise<boolean>};
let state:State={isConnected:navigator.onLine,isInternetReachable:navigator.onLine?null:false};
let config:Configuration={reachabilityUrl:'',reachabilityMethod:'GET',reachabilityRequestTimeout:10000,reachabilityTest:async response=>response.ok};
const listeners=new Set<()=>void>();
let pending:Promise<State>|undefined;let controller:AbortController|undefined;let timer:ReturnType<typeof setTimeout>|undefined;let generation=0;
function publish(next:State){if(next.isConnected===state.isConnected&&next.isInternetReachable===state.isInternetReachable)return;state=next;for(const listener of listeners)listener();}
function schedule(){clearTimeout(timer);if(navigator.onLine)timer=setTimeout(()=>{void refresh();},state.isInternetReachable?config.reachabilityLongTimeout??60000:config.reachabilityShortTimeout??5000);}
async function refresh():Promise<State>{
 if(pending)return pending;
 clearTimeout(timer);
 if(!navigator.onLine){publish({isConnected:false,isInternetReachable:false});return state;}
 if(!state.isConnected)publish({isConnected:true,isInternetReachable:null});
 const attempt=generation;const abort=new AbortController();controller=abort;
 const request=(async()=>{await Promise.resolve();const timeout=setTimeout(()=>abort.abort(),config.reachabilityRequestTimeout);
  try{const response=await fetch(config.reachabilityUrl,{method:config.reachabilityMethod,cache:'no-store',signal:abort.signal});const reachable=await config.reachabilityTest(response);if(attempt===generation)publish({isConnected:navigator.onLine,isInternetReachable:reachable&&navigator.onLine});}
  catch{if(attempt===generation)publish({isConnected:navigator.onLine,isInternetReachable:false});}
  finally{clearTimeout(timeout);if(attempt===generation){pending=undefined;controller=undefined;schedule();}}
  return state;
 })();pending=request;return request;
}
function changed(){generation++;controller?.abort();pending=undefined;void refresh();}
for(const event of ['online','offline'])window.addEventListener(event,changed);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh();});
export const useNetInfo=()=>useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>state);
export default{
 configure(options:Configuration&Record<string,unknown>){config=options;void refresh();},
 fetch:async()=>pending??state,
 refresh,
 addEventListener(listener:(state:State)=>void){const update=()=>listener(state);listeners.add(update);update();return()=>{listeners.delete(update);};},
};
