import fs from 'node:fs';
import crypto from 'node:crypto';
process.loadEnvFile('.env');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw Error('Supabase credentials missing.');
const headers={apikey:key,...(key.startsWith('ey')?{Authorization:'Bearer '+key}:{})};
async function request(route,options={}){const r=await fetch(url+route,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`Supabase request failed (${r.status}).`);return r;}
const filename='qa-'+crypto.randomUUID()+'.pdf',bytes=fs.readFileSync('public/poster-1.pdf');let uploaded=false;
try{
 const signed=await (await request('/storage/v1/object/upload/sign/posters/'+filename,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();const upload=await fetch(url+'/storage/v1'+signed.url,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:bytes});if(!upload.ok)throw Error('Signed upload failed: '+upload.status);uploaded=true;
 const publicResponse=await fetch(url+'/storage/v1/object/public/posters/'+filename,{signal:AbortSignal.timeout(20000)});
 if(!publicResponse.ok||!Buffer.from(await publicResponse.arrayBuffer()).equals(bytes))throw Error('Public poster download did not match upload.');
 console.log('PASS: Cloud PDF upload and public download match.');
}finally{if(uploaded){await request('/storage/v1/object/posters',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[filename]})});console.log('PASS: Temporary cloud test file removed.');}}
