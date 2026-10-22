import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServer, Reply, ServerToClient } from '@ts/shared';
import { RoomStore } from './rooms';
import { createHttpHandler } from './static';
import { validPointer } from './presence';
export function createGameServer(store=new RoomStore(),options:{webRoot?:string;botDelayMs?:number}={}) {
  const http=createServer(createHttpHandler(options.webRoot));
  const allowed=(process.env.ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);
  const io=new Server<ClientToServer,ServerToClient>(http,{maxHttpBufferSize:16384,cors:{origin:allowed.length?allowed:true}});
  const botTimers=new Map<string,ReturnType<typeof setTimeout>>();
  const broadcast=(roomId:string)=>{
    for(const member of store.members(roomId)) {
      const snapshot=store.snapshot(roomId,member.key);
      io.to(member.clientId).emit('state',snapshot);
      if(!snapshot.started)for(const side of ['US','USSR'] as const)io.to(member.clientId).emit('pointer',{roomId,side,pointer:null});
    }
    if(!store.botPending(roomId)){clearTimeout(botTimers.get(roomId));botTimers.delete(roomId);return;}
    if(botTimers.has(roomId))return;
    const timer=setTimeout(()=>{botTimers.delete(roomId);if(store.stepBot(roomId))broadcast(roomId);},options.botDelayMs??700);
    timer.unref();botTimers.set(roomId,timer);
  };
  http.on('close',()=>{for(const timer of botTimers.values())clearTimeout(timer);botTimers.clear();});
  io.on('connection',socket=>{
    let joined:{roomId:string;key:string}|null=null;
    let pointerTokens=60,pointerTime=Date.now();
    const hidePointer=()=>{
      if(!joined)return;
      try { const peer=store.pointerPeer(joined.roomId,joined.key,socket.id);if(peer?.clientId)io.to(peer.clientId).emit('pointer',{roomId:joined.roomId,side:peer.side,pointer:null}); } catch { /* Stale identity or closed room. */ }
    };
    socket.on('pointer',pointer=>{
      if(!joined||!validPointer(pointer))return;
      const now=Date.now();pointerTokens=Math.min(60,pointerTokens+(now-pointerTime)*.04);pointerTime=now;
      if(pointerTokens<1)return;pointerTokens--;
      try {
        const peer=store.pointerPeer(joined.roomId,joined.key,socket.id);
        if(peer?.clientId)io.to(peer.clientId).volatile.emit('pointer',{roomId:joined.roomId,side:peer.side,pointer});
      } catch { /* Presence cannot change game state or surface a game-action error. */ }
    });
    const fail=(ack:unknown,e:unknown)=>{const error=e instanceof Error?e.message:'操作失败';if(typeof ack==='function')ack({ok:false,error});else socket.emit('error',error);};
    socket.on('create',(_request,ack)=>{
      try{
        if(joined)throw new Error('已加入房间，请先离开当前连接');
        if(typeof ack!=='function')return;
        const result=store.create(socket.id);joined={roomId:result.session.roomId,key:result.key};
        ack({ok:true,data:result.session});broadcast(joined.roomId);
      }catch(e){fail(ack,e);}
    });
    socket.on('join',(request,ack)=>{
      try{
        if(typeof ack!=='function')return;
        if(joined&&joined.roomId!==request?.roomId?.trim?.().toUpperCase())throw new Error('已加入其他房间');
        const result=store.join(request?.roomId,socket.id,request?.token);joined={roomId:result.session.roomId,key:result.key};
        hidePointer();
        if(result.replaced){io.to(result.replaced).emit('error','此身份已在另一连接恢复，当前连接已退出');io.sockets.sockets.get(result.replaced)?.disconnect(true);}
        ack({ok:true,data:result.session});broadcast(joined.roomId);
      }catch(e){fail(ack,e);}
    });
    // Lobby: choose, switch or leave a side, then start once both sides are taken.
    socket.on('bot',(request,ack)=>{
      try{
        if(!joined)throw new Error('请先加入房间');
        const revision=store.setBot(joined.roomId,joined.key,socket.id,request?.enabled);
        if(typeof ack==='function')ack({ok:true,data:{revision}});broadcast(joined.roomId);
      }catch(e){fail(ack,e);}
    });
    socket.on('botRetry',(_request,ack)=>{
      try{
        if(!joined)throw new Error('请先加入房间');
        const revision=store.retryBot(joined.roomId,joined.key,socket.id);
        if(typeof ack==='function')ack({ok:true,data:{revision}});broadcast(joined.roomId);
      }catch(e){fail(ack,e);}
    });
    socket.on('seat',(request,ack)=>{
      try{
        if(!joined)throw new Error('请先加入房间');
        const revision=store.seat(joined.roomId,joined.key,socket.id,request?.side);
        if(typeof ack==='function')ack({ok:true,data:{revision}} satisfies Reply<{revision:number}>);
        broadcast(joined.roomId);
      }catch(e){fail(ack,e);}
    });
    socket.on('start',(_request,ack)=>{
      try{
        if(!joined)throw new Error('请先加入房间');
        const revision=store.start(joined.roomId,joined.key,socket.id);
        if(typeof ack==='function')ack({ok:true,data:{revision}} satisfies Reply<{revision:number}>);
        broadcast(joined.roomId);
      }catch(e){fail(ack,e);}
    });
    socket.on('restart',(request,ack)=>{
      try{if(!joined)throw new Error('请先加入房间');
        const revision=store.restart(joined.roomId,joined.key,socket.id,request?.expectedRevision);
        if(typeof ack==='function')ack({ok:true,data:{revision}});broadcast(joined.roomId);
      }catch(e){fail(ack,e);}
    });
    socket.on('close',(_request,ack)=>{
      try{if(!joined)throw new Error('请先加入房间');
        const roomId=joined.roomId,members=store.close(roomId,joined.key,socket.id);
        clearTimeout(botTimers.get(roomId));botTimers.delete(roomId);
        if(typeof ack==='function')ack({ok:true,data:undefined});
        for(const member of members){io.to(member.clientId).emit('closed',{roomId,reason:'房主已关闭房间'});io.sockets.sockets.get(member.clientId)?.disconnect(true);}
        joined=null;
      }catch(e){fail(ack,e);}
    });
    socket.on('action',(request,ack)=>{
      try{
        if(!joined)throw new Error('请先加入房间');
        const revision=store.execute(joined.roomId,joined.key,socket.id,request);
        if(typeof ack==='function')ack({ok:true,data:{revision}} satisfies Reply<{revision:number}>);
        broadcast(joined.roomId);
      }catch(e){fail(ack,e);if(joined&&store.members(joined.roomId).some(m=>m.clientId===socket.id))socket.emit('state',store.snapshot(joined.roomId,joined.key));}
    });
    socket.on('disconnect',()=>{if(joined){hidePointer();store.disconnect(joined.roomId,joined.key,socket.id);broadcast(joined.roomId);}});
  });
  return {http,io,store};
}
