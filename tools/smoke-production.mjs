import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
import { once } from 'node:events';
import { io } from 'socket.io-client';
const root=fileURLToPath(new URL('../',import.meta.url));
const child=spawn(process.execPath,['apps/server/dist/index.js'],{cwd:root,env:{...process.env,PORT:'0',NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});
const clients=[];
try{
  const port=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(new Error('Production server startup timed out')),10000);
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('Production server exited: '+code));});
    child.stderr.on('data',chunk=>process.stderr.write(chunk));
    child.stdout.on('data',chunk=>{output+=String(chunk);const match=output.match(/server listening on :(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  });
  const origin='http://127.0.0.1:'+port;
  const home=await fetch(origin);if(home.status!==200)throw new Error('HTML failed: '+home.status);
  const html=await home.text(),assets=[...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(m=>m[1]);
  if(assets.length<2)throw new Error('Built HTML lacks JavaScript/CSS');
  for(const path of assets){const response=await fetch(origin+path);if(response.status!==200)throw new Error('Asset failed: '+path);await response.arrayBuffer();}
  const health=await fetch(origin+'/health').then(r=>r.json());if(!health.ok)throw new Error('Health check failed');
  const deep=await fetch(origin+'/room/check',{headers:{accept:'text/html'}});if(await deep.text()!==html)throw new Error('SPA navigation failed');
  const manifest=JSON.parse(await readFile(new URL('../assets/tts-manifest.json',import.meta.url),'utf8'));
  const art=await fetch(origin+Object.values(manifest.sheets)[0].url,{method:'HEAD'});if(art.status!==200||Number(art.headers.get('content-length'))<=0)throw new Error('Chinese card art missing from build');
  for(let i=0;i<2;i++){
    const socket=io(origin,{autoConnect:false,transports:['websocket'],reconnection:false});clients.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();});
  }
  const check=(reply)=>{if(!reply.ok)throw new Error(reply.error);return reply;};
  const created=check(await clients[0].timeout(3000).emitWithAck('create',{}));
  check(await clients[1].timeout(3000).emitWithAck('join',{roomId:created.data.roomId}));
  check(await clients[0].timeout(3000).emitWithAck('seat',{side:'USSR'}));
  check(await clients[1].timeout(3000).emitWithAck('seat',{side:'US'}));
  check(await clients[1].timeout(3000).emitWithAck('start',{}));
  console.log('Production smoke passed: HTML, JavaScript, CSS, Chinese art, health, SPA navigation, and two WebSocket clients through the lobby.');
}finally{
  for(const socket of clients)socket.disconnect();
  if(child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),3000);await ended;clearTimeout(timer);}
}
