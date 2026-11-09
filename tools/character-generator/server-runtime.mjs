import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MAX_SAVE_BYTES } from './engine/session.mjs';
// JSON import wraps an already-serialized save; escaping can nearly double it.
const MAX_REQUEST_BYTES=2*MAX_SAVE_BYTES+65536;
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json'};
export function createRulesServer(api){
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  const host=req.headers.host??'';
  if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)){res.writeHead(403);res.end('Local access only');return;}
  if(req.headers.origin&&req.headers.origin!=='http://'+host){res.writeHead(403);res.end('Origin rejected');return;}
  const url=new URL(req.url,'http://'+host);
  if(url.pathname==='/api/v1'&&req.method==='POST'){
   const chunks=[];let bytes=0;try{
    for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_REQUEST_BYTES){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
    const body=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
    const result=api(JSON.parse(body));res.writeHead(result.ok?200:400,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
   }catch{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:{code:'INVALID_REQUEST',message:'Invalid JSON request.'}}));}return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end('Method not allowed');return;}
  try{
   const pathname=decodeURIComponent(url.pathname);const relative=pathname==='/'?'index.html':pathname.slice(1);
   const target=path.resolve(root,relative);if(!target.startsWith(root)||!Object.hasOwn(types,path.extname(target))){res.writeHead(404);res.end('Not found');return;}
   const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Not found');}
 });
}
