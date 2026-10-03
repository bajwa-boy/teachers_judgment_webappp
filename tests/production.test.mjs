import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
test('production serves app/assets, protects secrets and sets secure admin cookies',async()=>{
 if(!fs.existsSync('dist/index.html'))throw Error('Run npm run build before the production test.');
 const base='http://127.0.0.1:5196';const child=spawn(process.execPath,['server.mjs','--production'],{env:{...process.env,PORT:'5196',ADMIN_PASSWORD:'production-test-admin',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_SECRET_KEY:'test-not-real'},stdio:['ignore','pipe','pipe']});
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Production startup timed out')),20000);child.stdout.on('data',b=>{if(b.toString().includes('Judging Studio:')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Unexpected production exit'));});});
 const html=await fetch(base+'/admin');assert.equal(html.status,200);assert.match(await html.text(),/<div id="root">/);
 const pdf=await fetch(base+'/poster-1.pdf');assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 const secrets=await fetch(base+'/.env');assert.doesNotMatch(await secrets.text(),/ADMIN_PASSWORD=|SUPABASE_SECRET_KEY=/);
 const traversal=await fetch(base+'/..%2f.env');assert.equal(traversal.status,403);
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'production-test-admin'})});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/Secure/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
 }finally{await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
});
