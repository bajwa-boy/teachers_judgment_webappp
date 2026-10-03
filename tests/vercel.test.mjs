import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const env={...process.env,VERCEL:'1',ADMIN_PASSWORD:'serverless-test-password',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'fake-secret'};
async function instance(port){const code=`import http from 'node:http';import {initialState} from './logic.mjs';globalThis.fetch=async(url)=>Response.json(String(url).includes('/upload/sign/')?{url:'/object/upload/sign/posters/test.pdf?token=test'}:{...initialState(),students:[{id:'one',name:'Student',roll:'1',course:'BCA',assets:[]}]});const {default:handler}=await import('./api/index.mjs');http.createServer(handler).listen(${port},'127.0.0.1',()=>console.log('ready'));`;const child=spawn(process.execPath,['--input-type=module','-e',code],{env,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',()=>{clearTimeout(timer);resolve();});child.once('exit',()=>{clearTimeout(timer);reject(Error('Unexpected exit'));});});return child;}
async function stop(child){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
test('Vercel rewrite routes API and signed admin session survives a different instance',async()=>{
 let first=await instance(5193),second;
 async function call(port,route,body,cookie){return fetch('http://127.0.0.1:'+port+'/api/index?route='+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
 try{const state=await call(5193,'state');assert.equal(state.status,200);assert.equal((await state.json()).mode,'cloud');
 const login=await call(5193,'admin/login',{password:env.ADMIN_PASSWORD});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/Secure/);
 await stop(first);first=null;second=await instance(5192);
 assert.equal((await call(5192,'admin/state',undefined,cookie)).status,200);
 assert.equal((await call(5192,'admin/state',undefined,cookie+'x')).status,401);
 assert.equal((await call(5192,'admin/upload-url',{type:'pdf',size:500})).status,401);
 const upload=await call(5192,'admin/upload-url',{type:'pdf',size:500},cookie);assert.equal(upload.status,200);const data=await upload.json();assert.equal(data.direct,true);assert.match(data.uploadUrl,/object\/upload\/sign/);assert.equal(data.asset.type,'pdf');
 assert.equal((await call(5192,'admin/upload-url',{type:'pdf',size:16*1024*1024},cookie)).status,400);
 }finally{if(first)await stop(first);if(second)await stop(second);}
});
