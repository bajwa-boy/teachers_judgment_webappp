import fs from 'node:fs';
import {initialState} from './logic.mjs';
const students=JSON.parse(fs.readFileSync('students.json')).slice(0,3);
const state={...initialState(),students};
for(const id of ['aarti','kavleen'])state.scores[id]=Object.fromEntries(students.map((s,i)=>[s.id,i===2?[10,10,10,10,10,10,10]:[20,20,15,15,10,10,10]]));
fs.writeFileSync('.browser-qa.json',JSON.stringify(state));
Object.assign(process.env,{PORT:'5195',ADMIN_PASSWORD:'browser-qa-password',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',LOCAL_DATA_FILE:'.browser-qa.json'});
await import('./server.mjs');
