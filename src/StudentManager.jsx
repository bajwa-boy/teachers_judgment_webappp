import React,{useState,useRef} from 'react';
import {Plus,Upload,Trash2,Pencil,Check,Users} from 'lucide-react';
import {api} from './api';
const empty=()=>({name:'',course:'',roll:''});
export default function StudentManager({data,scores,onChanged}){
 const [form,setForm]=useState(empty),[editing,setEditing]=useState(null),[files,setFiles]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
 const fileRef=useRef(),formRef=useRef();
 function reset(){setForm(empty());setEditing(null);setFiles([]);if(fileRef.current)fileRef.current.value='';}
 async function save(e){e.preventDefault();setError('');setNotice('');setBusy(true);try{
  if(data.students.some(s=>s.id!==editing&&s.roll.trim().toLowerCase()===form.roll.trim().toLowerCase()))throw Error('This roll number already has an entry.');
  const assets=[];
  if(!editing){if(!files.length||files.length>6)throw Error('Choose one to six PDF, PNG or JPEG posters.');if(files.some(f=>f.size>15*1024*1024))throw Error('Each poster must be 15 MB or smaller.');
   for(const file of files){const r=await fetch('/api/admin/upload',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});const asset=await r.json();if(!r.ok)throw Error(asset.error||'Upload failed.');assets.push(asset);}
  }
  await api('admin/students',{operation:editing?'update':'add',student:{...form,...(editing?{id:editing}:{assets})}});
  await onChanged();setNotice(editing?'Student details updated.':'Entry added. Every judge will see this student.');reset();
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 async function remove(student){const count=data.judges.filter(j=>scores[j.id]?.[student.id]).length;
  if(!confirm(`Remove ${student.name} (${student.roll||'roll pending'}) from this event?\n\n${count} saved evaluation(s) will be excluded from results and kept in the archive. Other entries stay unchanged. If all remaining evaluations are complete, final results will publish and lock.`))return;
  setBusy(true);setError('');setNotice('');try{await api('admin/students',{operation:'delete',id:student.id});await onChanged();if(editing===student.id)reset();setNotice('Entry removed from the event. Existing scores are archived.');}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const list=data.students.filter(s=>(s.name+' '+s.course+' '+s.roll).toLowerCase().includes(search.toLowerCase()));
 return <section className="panel student-manager"><div className="section-heading"><div><h2>Student entries</h2><p>{data.students.length} entries · Every judge evaluates every student</p></div><span className="count-pill"><Users size={14}/> {data.students.length} students</span></div>
 {error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="student-notice" role="status"><Check size={16}/>{notice}</div>}
 {!data.finalized?<form ref={formRef} className="student-form" onSubmit={save}><h3>{editing?'Edit student details':'Add a student'}</h3><div className="student-fields">{[['name','Student name',100],['course','Course / year',120],['roll','Roll number',40]].map(([key,label,max])=><label key={key}>{label}<input required maxLength={max} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} disabled={busy}/></label>)}</div>
 {!editing&&<label className="upload-field"><span><Upload size={17}/> Poster files</span><input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" multiple required onChange={e=>setFiles(Array.from(e.target.files))} disabled={busy}/><small>PDF, PNG or JPEG · Maximum 6 files · 15 MB each</small>{files.length>0&&<small>{files.map(f=>f.name).join(', ')}</small>}</label>}
 <div className="student-form-actions"><button className="primary" disabled={busy}>{busy?'Saving entry…':editing?'Save details':'Add student & posters'}<Plus size={17}/></button>{editing&&<button className="secondary" type="button" disabled={busy} onClick={reset}>Cancel edit</button>}</div></form>:<p className="locked-note">Final results are published. Student entries are now locked.</p>}
 <label className="student-search">Find an entry<input type="search" placeholder="Search name, roll number or course" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <div className="student-roster">{list.map(s=><article key={s.id} className="student-row"><div><strong>{s.name}</strong><small>{s.course} · {s.roll||'Roll number pending'}</small><span>{s.assets.length} poster file(s) · {data.judges.filter(j=>scores[j.id]?.[s.id]).length}/{data.judges.length} judges evaluated</span></div><div className="student-row-actions"><a className="secondary" href={s.assets[0].url} target="_blank" rel="noreferrer">View poster</a>{!data.finalized&&<><button className="secondary" disabled={busy} aria-label={`Edit ${s.name}`} onClick={()=>{setEditing(s.id);setForm({name:s.name,course:s.course,roll:s.roll});setError('');setNotice('');formRef.current?.scrollIntoView({behavior:'smooth'});}}><Pencil size={15}/> Edit</button><button className="delete-entry" disabled={busy||data.students.length<=1} aria-label={`Delete ${s.name}`} onClick={()=>remove(s)}><Trash2 size={15}/> Delete</button></>}</div></article>)}{!list.length&&<p className="locked-note">No matching students.</p>}</div></section>;
}
