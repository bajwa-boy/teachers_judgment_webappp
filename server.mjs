import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {initialState,mutate,ranking} from './logic.mjs';
import {csvCell} from './src/csv.js';
import {criteria} from './logic.mjs';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const students=JSON.parse(fs.readFileSync(new URL('./students.json',import.meta.url),'utf8'));
const cloud=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY);
const production=process.argv.includes('--production')||process.env.VERCEL==='1';

const adminPassword=process.env.ADMIN_PASSWORD||crypto.randomBytes(12).toString('hex');
if(!production&&!process.env.ADMIN_PASSWORD)console.log('Local preview admin password:',adminPassword);
const localFile=process.env.LOCAL_DATA_FILE||'.local-data.json';
let local=fs.existsSync(localFile)?JSON.parse(fs.readFileSync(localFile,'utf8')):initialState();
const attempts=new Map();let queue=Promise.resolve();
async function db(name,body){const key=process.env.SUPABASE_SECRET_KEY;const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,...(key.startsWith('ey')?{Authorization:`Bearer ${key}`} : {}),'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Database request failed. Check connection and Supabase setup.');return r.json();}
async function read(){if(cloud){let s=await db('judging_read',{});if(!s)throw Error('Run the Supabase database setup first.');if(!s.students)s=await db('judging_mutate',{action:{type:'bootstrap-students',students}});return s;}local.students??=structuredClone(students);return structuredClone(local);}
async function write(action){if(cloud)return db('judging_mutate',{action});const run=queue.then(()=>{if(action.type==='reset-preview')fs.writeFileSync('.preview-backup.json',JSON.stringify(local));const next=action.type==='reset-preview'?initialState():mutate(structuredClone(local),action,students);fs.writeFileSync(localFile+'.tmp',JSON.stringify(next));fs.renameSync(localFile+'.tmp',localFile);local=next;return structuredClone(local);});queue=run.catch(()=>{});return run;}
function cookie(req,name){return req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);}
function signSession(){const payload=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');return payload+'.'+crypto.createHmac('sha256',adminPassword).update(payload).digest('base64url');}
function validAdmin(token){try{const [payload,signature,...rest]=(token||'').split('.');if(rest.length||!payload||!signature)return false;const expected=crypto.createHmac('sha256',adminPassword).update(payload).digest();const actual=Buffer.from(signature,'base64url');return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)&&JSON.parse(Buffer.from(payload,'base64url').toString()).exp>Date.now();}catch{return false;}}
async function upload(req){
 const state=await read();if(state.finalized)throw Error('Final results are locked.');
 let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>15*1024*1024)throw Error('Each poster must be 15 MB or smaller.');chunks.push(chunk);}
 const buffer=Buffer.concat(chunks);
 const ext=buffer.subarray(0,5).toString()==='%PDF-'?'pdf':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':buffer[0]===255&&buffer[1]===216&&buffer[2]===255?'jpg':null;
 if(!ext)throw Error('Only PDF, PNG and JPEG posters are supported.');
 const filename=crypto.randomUUID()+'.'+ext;
 if(cloud){const key=process.env.SUPABASE_SECRET_KEY;const r=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/posters/${filename}`,{method:'POST',headers:{apikey:key,...(key.startsWith('ey')?{Authorization:`Bearer ${key}`} : {}),'Content-Type':ext==='pdf'?'application/pdf':ext==='png'?'image/png':'image/jpeg'},body:buffer});if(!r.ok)throw Error('Poster upload failed. Run the student-management SQL update and check Storage setup.');return {url:`${process.env.SUPABASE_URL}/storage/v1/object/public/posters/${filename}`,type:ext};}
 fs.mkdirSync('public/uploads',{recursive:true});fs.writeFileSync('public/uploads/'+filename,buffer);return {url:'/uploads/'+filename,type:ext};
}
function publicState(state,token){const roster=state.students||students;const judge=state.judges.find(j=>j.token===token);const scores=judge?Object.fromEntries(roster.filter(s=>state.scores[judge.id]?.[s.id]).map(s=>[s.id,state.scores[judge.id][s.id]])):{};return {mode:cloud?'cloud':'preview',students:roster,judges:state.judges.map(j=>({id:j.id,name:j.name,occupied:Boolean(j.token),done:roster.filter(s=>state.scores[j.id]?.[s.id]).length})),judge:judge?{id:judge.id,name:judge.name}:null,scores,finalized:state.finalized,results:state.finalized?ranking(state,roster):null};}
let vite=null;
export async function handler(req,res){const url=new URL(req.url,'http://localhost');const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};const secure=production?'; Secure':'';
try{
if(url.pathname.startsWith('/api/')){
 if(production&&(!cloud||!process.env.ADMIN_PASSWORD))return json(503,{error:'Server setup incomplete. Add SUPABASE_URL, SUPABASE_SECRET_KEY and ADMIN_PASSWORD in Vercel, then redeploy.'});
 if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'Request origin rejected.'});
 if(url.pathname==='/api/admin/upload'&&req.method==='POST'){
  if(!(validAdmin(cookie(req,'admin_session'))))return json(401,{error:'Admin access required.'});
  return json(200,await upload(req));
 }
 let body={};if(req.method==='POST'){if(req.body!==undefined){const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(raw.length>10000)throw Error('Request too large.');body=JSON.parse(raw||'{}');}else {let raw='';for await(const c of req){raw+=c;if(raw.length>10000)throw Error('Request too large.');}body=JSON.parse(raw||'{}');}const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)return json(403,{error:'Request origin rejected.'});}
 if(url.pathname==='/api/admin/upload-url'&&req.method==='POST'){
 if(!validAdmin(cookie(req,'admin_session')))return json(401,{error:'Admin access required.'});
 if(!cloud)return json(200,{direct:false});
 if((await read()).finalized)throw Error('Final results are locked.');
 const type=body.type;if(!['pdf','png','jpg'].includes(type)||!Number.isInteger(body.size)||body.size<=0||body.size>15*1024*1024)throw Error('Choose a PDF, PNG or JPEG of 15 MB or smaller.');
 const filename=crypto.randomUUID()+'.'+type,key=process.env.SUPABASE_SECRET_KEY;
 const r=await fetch(process.env.SUPABASE_URL+'/storage/v1/object/upload/sign/posters/'+filename,{method:'POST',headers:{apikey:key,...(key.startsWith('ey')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},body:'{}'});
 if(!r.ok)throw Error('Could not prepare poster upload. Check Supabase Storage setup.');
 const signed=await r.json();return json(200,{direct:true,uploadUrl:process.env.SUPABASE_URL+'/storage/v1'+signed.url,asset:{url:process.env.SUPABASE_URL+'/storage/v1/object/public/posters/'+filename,type}});
 }
 const token=cookie(req,'judge_session');const adminToken=cookie(req,'admin_session');const isAdmin=validAdmin(adminToken);
 if(url.pathname==='/api/state'&&req.method==='GET')return json(200,publicState(await read(),token));
 if(url.pathname==='/api/claim'&&req.method==='POST'){const session=token||crypto.randomBytes(32).toString('hex');const state=await read();if(state.judges.some(j=>j.token===session&&j.id!==body.id))throw Error('This device already has a judge session.');const next=await write({type:'claim',id:body.id,token:session});res.setHeader('Set-Cookie',`judge_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure}`);return json(200,publicState(next,session));}
 if(url.pathname==='/api/score'&&req.method==='POST')return json(200,publicState(await write({type:'score',id:body.id,student:body.student,marks:body.marks,token}),token));
 if(url.pathname==='/api/admin/login'&&req.method==='POST'){const ip=process.env.VERCEL==='1'?req.headers['x-forwarded-for']?.split(',')[0].trim():req.socket.remoteAddress;const a=attempts.get(ip)||{count:0,until:0};if(a.until>Date.now())return json(429,{error:'Too many attempts. Try again in a minute.'});if(typeof body.password!=='string'||body.password.length!==adminPassword.length||!crypto.timingSafeEqual(Buffer.from(body.password),Buffer.from(adminPassword))){a.count++;if(a.count>=5){a.until=Date.now()+60000;a.count=0;}attempts.set(ip,a);return json(401,{error:'Incorrect admin password.'});}attempts.delete(ip);const t=signSession();res.setHeader('Set-Cookie',`admin_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);return json(200,{ok:true});}
 if(url.pathname.startsWith('/api/admin/')){if(!isAdmin)return json(401,{error:'Admin access required.'});
 if(url.pathname==='/api/admin/export'&&req.method==='GET'){
  const s=await read(),roster=s.students||students;
  const rows=[['Student','Course','Roll','Judge',...criteria.map(c=>c[0]),'Total'],...roster.flatMap(student=>s.judges.map(j=>{const marks=s.scores[j.id]?.[student.id];return [student.name,student.course,student.roll,j.name,...(marks||Array(7).fill('')),marks?marks.reduce((a,b)=>a+b,0):''];}))];
  res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="sd-college-judging-scores.csv"','Cache-Control':'no-store'});
  return res.end('\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'));
 }
 if(url.pathname==='/api/admin/students'&&req.method==='POST'){
  const operation=body.operation;let action;
  if(operation==='delete')action={type:'student-delete',id:body.id,deletedAt:new Date().toISOString()};
  else if(operation==='add'||operation==='update'){
   const s=body.student||{};const assets=s.assets;
   if(operation==='add'&&(!Array.isArray(assets)||assets.some(a=>!['pdf','png','jpg'].includes(a.type)||typeof a.url!=='string'||!(cloud?a.url.startsWith(`${process.env.SUPABASE_URL}/storage/v1/object/public/posters/`):/^\/uploads\/[a-f0-9-]+\.(pdf|png|jpg)$/.test(a.url)))))throw Error('Upload valid poster files first.');
   action={type:'student-'+operation,student:{id:operation==='add'?crypto.randomUUID():s.id,name:s.name,course:s.course,roll:s.roll,...(operation==='add'?{assets}:{})}};
  }else throw Error('Unknown student operation.');
  mutate(structuredClone(await read()),action,students);
  if(operation==='add'&&cloud){for(const asset of action.student.assets){const r=await fetch(asset.url);if(!r.ok)throw Error('Poster upload is incomplete. Try again.');let size=0,head=Buffer.alloc(0);for await(const chunk of r.body){size+=chunk.length;if(size>15*1024*1024){await r.body.cancel().catch(()=>{});throw Error('Each poster must be 15 MB or smaller.');}if(head.length<8)head=Buffer.concat([head,Buffer.from(chunk)]).subarray(0,8);}const type=head.subarray(0,5).toString()==='%PDF-'?'pdf':head.equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':head[0]===255&&head[1]===216&&head[2]===255?'jpg':null;if(type!==asset.type)throw Error('Poster file contents do not match PDF, PNG or JPEG.');}}

  await write(action);return json(200,{ok:true});
 }
 if(url.pathname==='/api/admin/state'&&req.method==='GET'){const s=await read();return json(200,{...publicState(s,token),allScores:s.scores});}if(url.pathname==='/api/admin/add'&&req.method==='POST'){await write({type:'add',name:body.name,id:crypto.randomUUID()});return json(200,{ok:true});}if(url.pathname==='/api/admin/release'&&req.method==='POST'){await write({type:'release',id:body.id});return json(200,{ok:true});}if(url.pathname==='/api/admin/reset-preview'&&req.method==='POST'&&!cloud){await write({type:'reset-preview'});return json(200,{ok:true});}}
 return json(404,{error:'Not found.'});
}
if(vite)return vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});
const filename=path.resolve('dist','.'+decodeURIComponent(url.pathname));const root=path.resolve('dist');if(!filename.startsWith(root+path.sep)&&filename!==root){res.writeHead(403);return res.end();}const file=fs.existsSync(filename)&&fs.statSync(filename).isFile()?filename:path.join(root,'index.html');const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.mjs':'text/javascript'})[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
}catch(e){json(400,{error:e.message});}}
const server=http.createServer(handler);
server.on('error',async error=>{
 if(error.code==='EADDRINUSE')console.error(`Port ${process.env.PORT||5173} is already in use. The app is already running; open its existing link, or stop that terminal with Ctrl+C before starting it again.`);
 else console.error(error.message);
 await vite?.close();
 process.exit(1);
});
if(process.env.VERCEL!=='1'){
if(!production)vite=await (await import('vite')).createServer({server:{middlewareMode:true,hmr:{server}},appType:'spa'});
server.listen(Number(process.env.PORT||5173),'0.0.0.0',()=>console.log(`Judging Studio: http://localhost:${process.env.PORT||5173} (${cloud?'Supabase':'local preview'})`));

}
