import fs from 'node:fs';
import {initialState} from './logic.mjs';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
if(process.env.SUPABASE_URL)throw Error('Preview reset is only available without Supabase configured.');
if(fs.existsSync('.local-data.json'))fs.copyFileSync('.local-data.json','.preview-backup.json');
fs.writeFileSync('.local-data.json',JSON.stringify(initialState()));
console.log('Local preview reset. Previous trial data copied to .preview-backup.json.');
