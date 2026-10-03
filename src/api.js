export async function api(path,body){
 let r;
 try{r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),...(body===undefined?{}:{body:JSON.stringify(body)})});}
 catch(e){throw Error(e.name==='TimeoutError'?'Connection timed out. Your entered marks are still available; retry saving.':'Connection failed. Check your internet and try again.');}
 const data=await r.json();if(!r.ok){const error=Error(data.error||'Could not save. Please try again.');error.status=r.status;throw error;}return data;
}
