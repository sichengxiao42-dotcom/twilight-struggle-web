import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, Reply, RoomSnapshot, SeatChoice, ServerToClient, Session } from '@ts/shared';
import type { Action, GameState, PlayerView } from '@ts/game-core';
type Snapshot=Omit<RoomSnapshot,'view'>&{view:PlayerView|null};
const KEY='twilight-room-session';
function saved():Session|null {
  try {const s=JSON.parse(sessionStorage.getItem(KEY)??'null');return s&&typeof s.roomId==='string'&&typeof s.token==='string'?{roomId:s.roomId,token:s.token}:null;}catch{return null;}
}
/** UI-only placeholder fields contain no secrets and are never sent back as state. */
export function displayState(v:PlayerView):GameState {
  return {...v,mode:'STANDARD',phase:v.phase.kind==='WAITING'?{kind:'HEADLINE',side:v.phase.side}:v.phase,
    seed:0,rngCalls:0,tasks:v.currentAction?[{kind:'FINISH_ACTION',...v.currentAction}]:[],deck:[],actionStartInfluence:null,phasingSide:'USSR',noradPending:false};
}
type Ack<T>=(timeout:Error|null,reply:Reply<T>)=>void;
export function useOnline() {
  const socket=useRef<Socket<ServerToClient,ClientToServer>|null>(null);
  const identity=useRef<Session|null>(null);
  const pending=useRef<{id:string;expectedRevision:number;action:Action|{type:'UNDO'}|{type:'UNDO_PLACEMENT';country:string}}|null>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [hasPending,setHasPending]=useState(false);
  const sendPending=useRef<()=>void>(()=>{});
  const remember=(s:Session)=>{identity.current=s;setSession(s);try{sessionStorage.setItem(KEY,JSON.stringify(s));}catch{/* Session still works until refresh. */}};
  const joined:Ack<Session>=(timeout,reply)=>{
    setBusy(false);if(timeout||!reply?.ok){setError(timeout?'创建/加入超时，请重试':!reply?.ok?reply?.error??'加入失败':'加入失败');return;}
    remember(reply.data);setReady(true);setError('');
  };
  useEffect(()=>{
    const client:Socket<ServerToClient,ClientToServer>=io(import.meta.env.VITE_SERVER_URL||undefined,{autoConnect:false,reconnection:true});
    socket.current=client;
    const restore=(s:Session)=>{
      setBusy(true);
      client.timeout(8000).emit('join',s,(timeout:Error|null,reply:Reply<Session>)=>{
        setBusy(false);
        if(timeout||!reply?.ok){setReady(false);setError(timeout?'恢复房间超时，正在等待连接':!reply.ok?reply.error:'恢复失败');return;}
        remember(reply.data);setReady(true);setError('');if(pending.current)sendPending.current();
      });
    };
    const prior=saved();
    // An invite link (#room=…) enters the room lobby on first connect; a saved session in this tab takes precedence.
    const inviteRoom=new URLSearchParams(location.hash.slice(1)).get('room')?.trim().toUpperCase();
    let autoJoin=!prior&&inviteRoom?{roomId:inviteRoom}:null;
    client.on('connect',()=>{
      if(identity.current)restore(identity.current);
      else if(autoJoin){const request=autoJoin;autoJoin=null;setBusy(true);client.timeout(8000).emit('join',request,joined);}
    });
    client.on('disconnect',()=>{setReady(false);setBusy(false);});
    client.on('connect_error',()=>{setReady(false);setBusy(false);setError('无法连接游戏服务器，请确认服务已启动；连接将自动重试。');});
    client.on('error',message=>{setError(message);setReady(false);});
    client.on('state',incoming=>{if(identity.current?.roomId===incoming.roomId)setSnapshot(incoming as Snapshot);});
    if(prior){remember(prior);client.connect();}
    else if(autoJoin)client.connect();
    return ()=>{client.removeAllListeners();client.disconnect();socket.current=null;};
  },[]);
  sendPending.current=()=>{
    const client=socket.current,request=pending.current;
    if(!client?.connected||!request){setError('尚未连接服务器');return;}
    setBusy(true);
    client.timeout(8000).emit('action',request,(timeout:Error|null,reply:Reply<{revision:number}>)=>{
      setBusy(false);
      if(timeout){setError('操作确认超时，请重试待确认操作；不会重复执行。');return;}
      pending.current=null;setHasPending(false);setError(reply?.ok?'':reply?.error??'操作失败');
    });
  };
  const enter=(roomId?:string)=>{
    if(identity.current){setError('请先返回本地，再加入其他房间');return;}
    const client=socket.current;if(!client)return;
    setBusy(true);setError('');
    client.connect();
    if(roomId)client.timeout(8000).emit('join',{roomId:roomId.trim().toUpperCase()},joined);
    else client.timeout(8000).emit('create',{},joined);
  };
  /** Lobby requests (seat, start) are idempotent, so they are sent directly without the action retry queue. */
  const lobby=(send:(ack:Ack<{revision:number}>)=>void)=>{
    if(!ready||!socket.current?.connected){setError('等待房间连接恢复');return;}
    setBusy(true);
    send((timeout,reply)=>{setBusy(false);setError(timeout?'操作超时，请重试':reply?.ok?'':reply?.error??'操作失败');});
  };
  const seat=(side:SeatChoice)=>lobby(ack=>socket.current!.timeout(8000).emit('seat',{side},ack));
  const start=()=>lobby(ack=>socket.current!.timeout(8000).emit('start',{},ack));
  const send=(action:Action|{type:'UNDO'}|{type:'UNDO_PLACEMENT';country:string})=>{
    if(!ready||!snapshot||!socket.current?.connected){setError('等待房间连接恢复');return;}
    if(pending.current){setError('有待确认操作，请先重试或等待恢复');return;}
    pending.current={id:globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'_'+Math.random().toString(36).slice(2),expectedRevision:snapshot.revision,action};setHasPending(true);sendPending.current();
  };
  const leave=()=>{socket.current?.disconnect();identity.current=null;pending.current=null;setHasPending(false);setSession(null);setSnapshot(null);setReady(false);setBusy(false);setError('');};
  const resume=()=>{const s=saved();if(!s){setError('此标签页没有可恢复的房间');return;}remember(s);socket.current?.connect();};
  return {session,snapshot,ready,busy,error,hasPending,create:()=>enter(),join:(room:string)=>enter(room),seat,start,send,leave,resume,retry:()=>sendPending.current()};
}
