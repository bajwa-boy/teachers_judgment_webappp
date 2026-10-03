import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {initialState} from '../logic.mjs';
import {csvCell} from '../src/csv.js';
test('CSV treats formula-like names as text',()=>{assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('A "name"'),'"A ""name"""');});
test('multi-device judging, edits, release, completion, ties and locks through HTTP',async()=>{
 const file='.integration-judging.json',base='http://127.0.0.1:5197';const students=JSON.parse(fs.readFileSync('students.json')).slice(0,3);fs.writeFileSync(file,JSON.stringify({...initialState(),students}));
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'5197',ADMIN_PASSWORD:'test-admin-only',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',LOCAL_DATA_FILE:file},stdio:['ignore','pipe','pipe']});
 async function call(route,body,cookie,origin){const r=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],data:await r.json()};}
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),30000);child.stdout.on('data',b=>{if(b.toString().includes('Judging Studio:')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Unexpected server exit'));});});
  assert.equal((await call('admin/state')).status,401);
  assert.equal((await call('admin/login',{password:'wrong'})).status,401);
  const admin=(await call('admin/login',{password:'test-admin-only'})).cookie;
  assert.equal((await call('admin/add',{name:'Injected'},admin,'https://example.com')).status,403);
  assert.equal((await call('score',{id:'girdhar',student:'1',marks:[1,2,3,4,5,6,7]})).status,400);
  const race=await Promise.all([call('claim',{id:'girdhar'}),call('claim',{id:'girdhar'})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,400]);let girdhar=race.find(r=>r.status===200).cookie;
  assert.equal((await call('claim',{id:'aarti'},girdhar)).status,400);
  assert.equal((await call('score',{id:'girdhar',student:'1',marks:[21,20,15,15,10,10,10]},girdhar)).status,400);
  assert.equal((await call('score',{id:'girdhar',student:'1',marks:[20,20,15,15,10,10,10]},girdhar)).status,200);
  assert.equal((await call('admin/release',{id:'girdhar'},admin)).status,200);
  assert.equal((await call('score',{id:'girdhar',student:'2',marks:[20,20,15,15,10,10,10]},girdhar)).status,400);
  girdhar=(await call('claim',{id:'girdhar'})).cookie;
  assert.equal((await call('state',undefined,girdhar)).data.scores['1'][0],20);
  const aarti=(await call('claim',{id:'aarti'})).cookie,kavleen=(await call('claim',{id:'kavleen'})).cookie;
  const cookies={girdhar,aarti,kavleen};
  for(const id of ['girdhar','aarti','kavleen'])for(const [i,s] of students.entries()){
   const marks=i===2?[10,10,10,10,10,10,10]:[20,20,15,15,10,10,10];
   const response=await call('score',{id,student:s.id,marks},cookies[id]);assert.equal(response.status,200);if(!(id==='kavleen'&&i===2))assert.equal(response.data.finalized,false);
  }
  const final=(await call('state',undefined,girdhar)).data;assert.equal(final.finalized,true);assert.deepEqual(final.results.map(s=>s.rank),[1,1,3]);assert.equal(final.results[0].average,100);assert.equal(final.results[0].total,300);
  const exportResponse=await fetch(base+'/api/admin/export',{headers:{Cookie:admin}});assert.equal(exportResponse.status,200);assert.match(exportResponse.headers.get('content-disposition'),/attachment/);const csv=await exportResponse.text();assert.equal(csv.split('\r\n').length,10);assert.match(csv,/Dr. Girdhar Gopal/);assert.match(csv,/Dr. Aarti Arora/);assert.match(csv,/Ms. Kavleen Bharej/);assert.equal((await fetch(base+'/api/admin/export')).status,401);
  assert.equal((await call('score',{id:'girdhar',student:'1',marks:[1,2,3,4,5,6,7]},girdhar)).status,400);
  assert.equal((await call('admin/add',{name:'Late judge'},admin)).status,400);
  assert.equal((await call('admin/students',{operation:'delete',id:'1'},admin)).status,400);
  for(let i=0;i<5;i++)await call('admin/login',{password:'bad'});
  assert.equal((await call('admin/login',{password:'test-admin-only'})).status,429);
 }finally{await new Promise(resolve=>{child.once('exit',resolve);child.kill();});for(const p of [file,file+'.tmp'])if(fs.existsSync(p))fs.unlinkSync(p);}
});
