import { api } from '../engine/session.mjs';
// The GUI consumes this JSON contract; it does not roll dice or calculate outcomes.
export async function call(request) {
 const endpoint=new URLSearchParams(location.search).get('api');
 if(endpoint==='local'){
  const response=await fetch('/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  let result;
  try { result=await response.json(); }
  catch { throw new Error('The rules API returned an unreadable response. Your previous character was kept.'); }
  if(!response.ok&&result?.ok!==false)throw new Error('Rules API returned HTTP '+response.status+'. Your previous character was kept.');
  return result;
 }
 return api(request);
}
