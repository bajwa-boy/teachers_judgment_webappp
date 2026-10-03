import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
test('all original posters exist and PDF pages can be decoded',async()=>{
 const students=JSON.parse(fs.readFileSync('students.json'));let assets=0;
 for(const s of students)for(const a of s.assets){const bytes=fs.readFileSync('public'+a.url);assets++;assert.ok(bytes.length>100);if(a.type==='pdf'){const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const doc=await task.promise;assert.ok(doc.numPages>0);for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p);const viewport=page.getViewport({scale:1});assert.ok(viewport.width>0&&viewport.height>0);await page.getOperatorList();}await task.destroy();}else if(a.type==='png'){assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0);}else assert.equal(bytes[0],255);}
 assert.equal(assets,19);
});
