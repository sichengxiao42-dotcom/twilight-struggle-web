import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServer, Reply, ServerToClient } from '@ts/shared';
import { RoomStore } from './rooms';
import { createHttpHandler } from './static';
export function createGameServer(store=new RoomStore(),options:{webRoot?:string}={}) {
  const http=createServer(createHttpHandler(options.webRoot));
  const allowed=(process.env.ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);
  const io=new Server<ClientToServer,ServerToClient>(http,{maxHttpBufferSize:16384,cors:{origin:allowed.length?allowed:true}});
  const broadcast=(roomId:string)=>{for(const member of store.members(roomId))io.to(member.clientId).emit('state',store.snapshot(roomId,member.key));};
  io.on('connection',socket=>{
    let joined:{roomId:string;key:string}|null=null;
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
        if(result.replaced){io.to(result.replaced).emit('error','此身份已在另一连接恢复，当前连接已退出');io.sockets.sockets.get(result.replaced)?.disconnect(true);}
        ack({ok:true,data:result.session});broadcast(joined.roomId);
      }catch(e){fail(ack,e);}
    });
    // Lobby: choose, switch or leave a side, then start once both sides are taken.
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
    socket.on('action',(request,ack)=>{
      try{
        if(!joined)throw new Error('请先加入房间');
        const revision=store.execute(joined.roomId,joined.key,socket.id,request);
        if(typeof ack==='function')ack({ok:true,data:{revision}} satisfies Reply<{revision:number}>);
        broadcast(joined.roomId);
      }catch(e){fail(ack,e);if(joined)socket.emit('state',store.snapshot(joined.roomId,joined.key));}
    });
    socket.on('disconnect',()=>{if(joined){store.disconnect(joined.roomId,joined.key,socket.id);broadcast(joined.roomId);}});
  });
  return {http,io,store};
}
