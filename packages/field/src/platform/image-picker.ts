import { pickFiles } from './picker';
export const UIImagePickerPreferredAssetRepresentationMode={Compatible:'compatible'};
export const requestCameraPermissionsAsync=async()=>({granted:true});
export const requestMediaLibraryPermissionsAsync=async()=>({granted:true});
export type ImagePickerAsset={uri:string;fileName:string;mimeType:string;fileSize:number;width:number;height:number;type:'image'|'video';duration?:number};
async function describe(file:File):Promise<ImagePickerAsset>{const uri=URL.createObjectURL(file);const base={uri,fileName:file.name,mimeType:file.type,fileSize:file.size};try{
 if(file.type.startsWith('video/')){const size=await new Promise<{width:number;height:number;duration:number}>((resolve,reject)=>{const video=document.createElement('video');video.preload='metadata';video.onloadedmetadata=()=>{resolve({width:video.videoWidth,height:video.videoHeight,duration:video.duration*1000});video.removeAttribute('src');video.load();};video.onerror=()=>reject(new Error('This video could not be opened. Choose another file.'));video.src=uri;});return {...base,...size,type:'video'};}
 const size=await new Promise<{width:number;height:number}>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error('This image could not be opened. Choose another file.'));image.src=uri;});return {...base,...size,type:'image'};
 }catch(error){URL.revokeObjectURL(uri);throw error;}}
async function pick(options:{allowsMultipleSelection?:boolean;selectionLimit?:number;mediaTypes?:string[];quality?:number;preferredAssetRepresentationMode?:string},camera=false){const files=await pickFiles({accept:options.mediaTypes?.includes('videos')?'image/*,video/*':'image/*',multiple:options.allowsMultipleSelection,camera});const assets=await Promise.all(files.slice(0,options.selectionLimit??files.length).map(describe));return{canceled:!assets.length,assets};}
export const launchCameraAsync=(options:Parameters<typeof pick>[0])=>pick(options,true);
export const launchImageLibraryAsync=(options:Parameters<typeof pick>[0])=>pick(options);
