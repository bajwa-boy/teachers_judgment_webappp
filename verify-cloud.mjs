import fs from 'node:fs';
import crypto from 'node:crypto';
process.loadEnvFile('.env');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw Error('Supabase credentials missing.');
const headers={apikey:key,...(key.startsWith('ey')?{Authorization:'Bearer '+key}:{})};
async function request(route,options={}){const r=await fetch(url+route,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`Supabase request failed (${r.status}).`);return r;}
const before=await (await request('/rest/v1/rpc/judging_read',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
if(!before.students?.length)throw Error('Roster missing.');
const student=before.students.find(s=>s.roll&&s.course&&s.name);
if(!before.finalized&&student){
 const after=await (await request('/rest/v1/rpc/judging_mutate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:{type:'student-update',student:{id:student.id,name:student.name,course:student.course,roll:student.roll}}})})).json();
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Unexpected state difference after unchanged metadata write.');
 console.log('PASS: Supabase read/write function, identical metadata preserved.');
}
const filename='qa-'+crypto.randomUUID()+'.pdf',bytes=fs.readFileSync('public/poster-1.pdf');let uploaded=false;
try{
 await request('/storage/v1/object/posters/'+filename,{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes});uploaded=true;
 const publicResponse=await fetch(url+'/storage/v1/object/public/posters/'+filename,{signal:AbortSignal.timeout(20000)});
 if(!publicResponse.ok||!Buffer.from(await publicResponse.arrayBuffer()).equals(bytes))throw Error('Public poster download did not match upload.');
 console.log('PASS: Cloud PDF upload and public download match.');
}finally{if(uploaded){await request('/storage/v1/object/posters',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[filename]})});console.log('PASS: Temporary cloud test file removed.');}}
console.log(`Live event: ${before.students.length} students, ${before.judges.length} judges. No test scores or entries added.`);
