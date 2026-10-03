import React,{useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/build/pdf.mjs';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {ZoomIn,ZoomOut,ExternalLink,ChevronLeft,ChevronRight} from 'lucide-react';
GlobalWorkerOptions.workerSrc=worker;
function PDF({url}){
 const ref=useRef();
 const [pages,setPages]=useState(1),[page,setPage]=useState(1),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let cancelled=false,render;
  setLoading(true);setError('');
  const task=getDocument({url});
  task.promise.then(async doc=>{
   if(cancelled)return;
   setPages(doc.numPages);
   const p=await doc.getPage(page);
   if(cancelled)return;
   const viewport=p.getViewport({scale:1.6});
   const c=ref.current;c.width=viewport.width;c.height=viewport.height;
   render=p.render({canvasContext:c.getContext('2d'),viewport});
   await render.promise;
   if(!cancelled)setLoading(false);
  }).catch(e=>{
   if(!cancelled){console.error('Poster rendering failed:',e.message);setError('Preview could not load. Open the original poster above.');setLoading(false);}
  });
  return()=>{cancelled=true;render?.cancel();task.destroy();};
 },[url,page]);
 return <>{loading&&<p className="viewer-status">Preparing poster…</p>}{error&&<p className="viewer-status">{error}</p>}<canvas ref={ref} aria-label={`Poster PDF page ${page}`} style={{display:error?'none':'block'}}/>{pages>1&&<div className="page-controls"><button disabled={page===1} onClick={()=>setPage(page-1)}><ChevronLeft size={18}/></button><span>Page {page} of {pages}</span><button disabled={page===pages} onClick={()=>setPage(page+1)}><ChevronRight size={18}/></button></div>}</>;
}
export default function Poster({student}){const [asset,setAsset]=useState(0),[zoom,setZoom]=useState(1);useEffect(()=>{setAsset(0);setZoom(1);},[student.id]);const file=student.assets[asset]||student.assets[0];return <div className="poster-card"><div className="poster-toolbar"><span>POSTER PREVIEW</span><div><button aria-label="Zoom out" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z-.25))}><ZoomOut size={18}/></button><button aria-label="Zoom in" disabled={zoom>=3} onClick={()=>setZoom(z=>Math.min(3,z+.25))}><ZoomIn size={18}/></button><a href={file.url} target="_blank" rel="noreferrer" aria-label="Open original poster"><ExternalLink size={18}/></a></div></div>{student.assets.length>1&&<div className="asset-tabs">{student.assets.map((a,i)=><button key={a.url} className={asset===i?'selected':''} onClick={()=>{setAsset(i);setZoom(1);}}>Poster {i+1}</button>)}</div>}<div className="poster-scroll"><div className="poster-paper" style={{width:`${zoom*100}%`}}>{file.type==='pdf'?<PDF key={file.url} url={file.url}/>:<img src={file.url} alt={`${student.name}'s poster`} onError={e=>{e.currentTarget.alt='Unable to load poster. Please open the original.'}}/>}</div></div><div className="poster-caption"><span>Zoom in to explore the details</span><span>{file.type.toUpperCase()}</span></div></div>;}

