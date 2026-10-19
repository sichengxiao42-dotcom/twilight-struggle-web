import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const defaultWebRoot=fileURLToPath(new URL('../../web/dist/',import.meta.url));
const TYPES:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const inside=(root:string,path:string)=>{const r=relative(root,path);return !r.startsWith('..')&&!isAbsolute(r);};
function end(res:ServerResponse,status:number,message:string){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(message);}
async function serve(req:IncomingMessage,res:ServerResponse,webRoot:string){
  res.setHeader('x-content-type-options','nosniff');
  const raw=(req.url??'/').split('?')[0];
  if(raw==='/health'){
    if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('allow','GET, HEAD');end(res,405,'Method not allowed');return;}
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:'{"ok":true}');return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('allow','GET, HEAD');end(res,405,'Method not allowed');return;}
  let pathname:string;
  try{pathname=decodeURIComponent(raw);}catch{end(res,400,'Invalid URL');return;}
  if(pathname.includes('\0')){end(res,400,'Invalid URL');return;}
  const parts=pathname.split(/[\\/]/);
  if(parts.includes('..')){end(res,403,'Forbidden');return;}
  if(parts.some(p=>p.startsWith('.'))){end(res,404,'Not found');return;}
  let root:string;try{root=await realpath(webRoot);}catch{end(res,503,'Frontend unavailable. Run npm run build first.');return;}
  let target=resolve(root,'.'+pathname);
  if(!inside(root,target)){end(res,403,'Forbidden');return;}
  try{
    const info=await stat(target);
    if(info.isDirectory())target=resolve(target,'index.html');
    await stat(target);
  }catch{
    // Only HTML navigation receives SPA fallback; missing scripts/images must remain 404.
    if(!extname(pathname)&&(req.headers.accept??'').includes('text/html')&&!pathname.startsWith('/api/')&&!pathname.startsWith('/socket.io/'))target=resolve(root,'index.html');
    else{end(res,404,'Not found');return;}
  }
  let actual:string;
  try{actual=await realpath(target);}catch{end(res,404,'Not found');return;}
  if(!inside(root,actual)){end(res,403,'Forbidden');return;}
  const info=await stat(actual);if(!info.isFile()){end(res,404,'Not found');return;}
  const tag='W/"'+info.size.toString(16)+'-'+Math.trunc(info.mtimeMs).toString(16)+'"';
  res.setHeader('content-type',TYPES[extname(actual)]??'application/octet-stream');
  res.setHeader('etag',tag);
  res.setHeader('cache-control',extname(actual)==='.html'?'no-cache':/^\/assets\/.*-[\w-]{8,}\.[\w]+$/.test(pathname)?'public, max-age=31536000, immutable':'public, max-age=3600');
  if(req.headers['if-none-match']===tag){res.writeHead(304);res.end();return;}
  res.setHeader('content-length',info.size);res.writeHead(200);
  if(req.method==='HEAD'){res.end();return;}
  const stream=createReadStream(actual);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
export function createHttpHandler(webRoot=defaultWebRoot){
  return (req:IncomingMessage,res:ServerResponse)=>{void serve(req,res,webRoot).catch(()=>{if(res.headersSent)res.destroy();else end(res,500,'Internal server error');});};
}
