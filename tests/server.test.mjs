import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
test('admin-only uploads and entry CRUD persist across server restarts',async()=>{
 const localFile='.integration-data.json';let child,asset;
 const base='http://127.0.0.1:5198';let cookie='';
 async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'5198',ADMIN_PASSWORD:'test-admin-only',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',LOCAL_DATA_FILE:localFile},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Test server startup timeout')),30000);child.stdout.on('data',data=>{if(data.toString().includes('Judging Studio:')){clearTimeout(timer);resolve();}});child.once('exit',code=>{clearTimeout(timer);reject(Error('Test server exited '+code));});});}
 async function stop(){if(child&&!child.killed){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}}
 async function request(route,body){const r=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();return {r,data};}
 try{
  if(fs.existsSync(localFile))fs.unlinkSync(localFile);
  await start();assert.equal((await request('admin/students',{operation:'delete',id:'1'})).r.status,401);
  let login=await request('admin/login',{password:'test-admin-only'});assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];
  let invalid=await fetch(base+'/api/admin/upload',{method:'POST',headers:{Cookie:cookie},body:'not an image'});assert.equal(invalid.status,400);
  const upload=await fetch(base+'/api/admin/upload',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/pdf'},body:fs.readFileSync('public/poster-1.pdf')});assert.equal(upload.status,200);asset=await upload.json();
  const initial=(await request('state')).data.students.length;
  const details={name:'Integration test student',course:'Test course',roll:'TEST-5198',assets:[asset]};
  assert.equal((await request('admin/students',{operation:'add',student:details})).r.status,200);
  let state=(await request('state')).data;assert.equal(state.students.length,initial+1);let entry=state.students.find(s=>s.roll===details.roll);assert.ok(entry);
  assert.equal((await request('admin/students',{operation:'add',student:details})).r.status,400);
  assert.equal((await request('admin/students',{operation:'update',student:{...entry,name:'Updated test'}})).r.status,200);
  await stop();await start();cookie='';state=(await request('state')).data;assert.equal(state.students.find(s=>s.id===entry.id).name,'Updated test');
  login=await request('admin/login',{password:'test-admin-only'});cookie=login.r.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('admin/students',{operation:'delete',id:entry.id})).r.status,200);
  assert.equal((await request('state')).data.students.length,initial);
  assert.ok(JSON.parse(fs.readFileSync(localFile)).archivedStudents.some(s=>s.id===entry.id));
 }finally{await stop();if(fs.existsSync(localFile))fs.unlinkSync(localFile);if(fs.existsSync(localFile+'.tmp'))fs.unlinkSync(localFile+'.tmp');if(asset?.url.startsWith('/uploads/'))fs.unlinkSync('public'+asset.url);}
});
