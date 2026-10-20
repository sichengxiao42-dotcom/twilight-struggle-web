import assert from 'node:assert/strict';
import { test } from 'node:test';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient, RoomSnapshot, Session, Side } from '@ts/shared';
import { CARD_BY_ID, type Action, type PlayerView } from '@ts/game-core';
import { createGameServer } from '../src/server';
import { RoomStore } from '../src/rooms';
type Snapshot=Omit<RoomSnapshot,'view'>&{view:PlayerView|null};
class Client {
  socket:Socket<ServerToClient,ClientToServer>;last?:Snapshot;
  constructor(url:string){this.socket=io(url,{autoConnect:false,transports:['websocket'],reconnection:false});this.socket.on('state',s=>{this.last=s as Snapshot;});}
  async connect(){await new Promise<void>((resolve,reject)=>{this.socket.once('connect',resolve);this.socket.once('connect_error',reject);this.socket.connect();});}
  async wait(predicate:(s:Snapshot)=>boolean){
    if(this.last&&predicate(this.last))return this.last;
    return new Promise<Snapshot>((resolve,reject)=>{const timer=setTimeout(()=>{this.socket.off('state',check);reject(new Error('state timeout'));},3000);const check=(s:RoomSnapshot)=>{if(predicate(s as Snapshot)){clearTimeout(timer);this.socket.off('state',check);resolve(s as Snapshot);}};this.socket.on('state',check);});
  }
  async create(){const r=await this.socket.timeout(3000).emitWithAck('create',{});assert.ok(r.ok,r.ok?'':r.error);return r.data;}
  async join(session:Pick<Session,'roomId'>&{token?:string}){return this.socket.timeout(3000).emitWithAck('join',session);}
  async seat(side:Side|'RANDOM'|null){return this.socket.timeout(3000).emitWithAck('seat',{side});}
  async start(){return this.socket.timeout(3000).emitWithAck('start',{});}
  async act(action:Action,id:string,revision=this.last!.revision){return this.socket.timeout(3000).emitWithAck('action',{id,expectedRevision:revision,action});}
}
test('real Socket.IO clients: lobby seats, separate views, full early-war flow, duplicates and token reconnection', {timeout:20000},async t=>{
  const server=createGameServer(new RoomStore(()=>42));
  await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));
  const addr=server.http.address();assert.ok(addr&&typeof addr==='object');const url='http://127.0.0.1:'+addr.port;
  const a=new Client(url),b=new Client(url),intruder=new Client(url),reconnected=new Client(url);
  t.after(async()=>{for(const c of [a,b,intruder,reconnected])c.socket.disconnect();await new Promise<void>(resolve=>server.io.close(()=>resolve()));});
  await Promise.all([a.connect(),b.connect(),intruder.connect()]);
  // Lobby: create without a side, the guest joins, both choose sides, then start.
  const session=await a.create();await a.wait(s=>s.members===1&&s.side===null&&s.view===null);
  assert.ok((await b.join({roomId:session.roomId})).ok);
  assert.equal((await intruder.join({roomId:session.roomId})).ok,false);
  assert.ok((await a.seat('USSR')).ok);
  assert.equal((await b.seat('USSR')).ok,false);
  assert.ok((await b.seat('US')).ok);
  await Promise.all([a.wait(s=>s.side==='USSR'&&s.seats.US.occupied),b.wait(s=>s.side==='US'&&s.seats.USSR.occupied)]);
  assert.deepEqual(a.last?.view,null);assert.deepEqual(b.last?.view,null);
  assert.equal((await a.act({type:'PLACE_SETUP',country:'poland'},'early',a.last!.revision)).ok,false);
  assert.ok((await b.start()).ok);
  await Promise.all([a.wait(s=>s.started),b.wait(s=>s.started)]);
  assert.equal((await a.seat('US')).ok,false);
  const r0=a.last!.revision;
  assert.equal(a.last!.view!.hands.USSR.length,8);assert.equal(b.last!.view!.hands.US.length,8);
  assert.deepEqual(a.last!.view!.hands.US,[]);assert.deepEqual(b.last!.view!.hands.USSR,[]);
  assert.equal((await b.act({type:'PLACE_SETUP',country:'france'},'wrong')).ok,false);
  const first=await a.act({type:'PLACE_SETUP',country:'poland'},'first');assert.ok(first.ok);
  await Promise.all([a.wait(s=>s.revision===r0+1),b.wait(s=>s.revision===r0+1)]);
  const again=await a.act({type:'PLACE_SETUP',country:'poland'},'first',r0);assert.ok(again.ok);assert.equal(again.data.revision,r0+1);
  assert.equal((await a.act({type:'PLACE_SETUP',country:'poland'},'stale',r0)).ok,false);
  a.socket.disconnect();await b.wait(s=>!s.seats.USSR.connected);
  await reconnected.connect();assert.equal((await reconnected.join(session)).ok,true);
  await Promise.all([reconnected.wait(s=>s.revision===r0+1&&s.side==='USSR'),b.wait(s=>s.seats.USSR.connected)]);
  const clients:Record<Side,Client>={USSR:reconnected,US:b};
  for(let step=0;step<400;step++){
    const view:PlayerView=b.last!.view!;
    if(view.phase.kind==='GAME_OVER'||view.turn>=4)break;
    assert.ok('side' in view.phase);const side=view.phase.side,client=clients[side],p=client.last!.view!.phase;
    assert.notEqual(p.kind,'WAITING');let action:Action;
    if(p.kind==='CONFIRM_END')action={type:'END_ACTION'};
    else if(p.kind==='SETUP_PLACEMENT')action={type:'PLACE_SETUP',country:side==='USSR'?'poland':'west_germany'};
    else if(p.kind==='HEADLINE')action={type:'SELECT_HEADLINE',card:client.last!.view!.hands[side].find(id=>CARD_BY_ID.get(id)!.scoring)??client.last!.view!.hands[side].find(id=>id!==32)!};
    else if(p.kind==='ACTION_ROUND'){
      const id=client.last!.view!.hands[side].find(id=>CARD_BY_ID.get(id)!.scoring)??client.last!.view!.hands[side][0];
      action=id===undefined?{type:'PASS_EMPTY'}:CARD_BY_ID.get(id)!.scoring?{type:'PLAY_EVENT',card:id}:{type:'PLAY_OPS',card:id,mode:'INFLUENCE'};
    }else if(p.kind==='OPS')action={type:'END_OPS'};
    else if(p.kind==='DECISION'){
      const d=p.decision;action={type:'CHOOSE',value:d.kind==='REVEAL'?'confirm':d.kind==='OPS_MODE'?'skip':d.kind==='CHOICE'?d.options[0].id:client.last!.view!.targets[0]??'done'};
    }else throw new Error('unexpected phase '+p.kind);
    const next=client.last!.revision+1;const reply=await client.act(action,'step_'+step);assert.ok(reply.ok,reply.ok?'':reply.error);
    await Promise.all([b.wait(s=>s.revision===next),reconnected.wait(s=>s.revision===next)]);
    assert.deepEqual(b.last!.view!.publicPlays,reconnected.last!.view!.publicPlays);
    for(const c of [b,reconnected]){
      assert.ok(!('seed' in c.last!.view!));assert.ok(!('deck' in c.last!.view!));assert.ok(!('tasks' in c.last!.view!));
      const enemy=c.last!.side==='US'?'USSR':'US';if(!(c.last!.side==='US'&&c.last!.view!.effects.cia)&&!(c.last!.side==='USSR'&&c.last!.view!.effects.aldrich))assert.deepEqual(c.last!.view!.hands[enemy],[]);
    }
  }
  assert.equal(b.last!.view!.turn,4);assert.equal(b.last!.view!.handCounts.US,9);
  const publicHistory=structuredClone(b.last!.view!.publicPlays);
  assert.ok(publicHistory.length>0);assert.ok(publicHistory.every(play=>play.finished));
  await a.connect();assert.ok((await a.join(session)).ok);
  await a.wait(snapshot=>snapshot.revision===b.last!.revision&&snapshot.side==='USSR');
  assert.deepEqual(a.last!.view!.publicPlays,publicHistory);
});

test('socket room management keeps seats on restart and broadcasts close to both members',{timeout:15000},async t=>{
  const server=createGameServer(new RoomStore(()=>42));
  await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));
  const addr=server.http.address();assert.ok(addr&&typeof addr==='object');
  const a=new Client('http://127.0.0.1:'+addr.port),b=new Client('http://127.0.0.1:'+addr.port),restored=new Client('http://127.0.0.1:'+addr.port);
  t.after(async()=>{for(const c of [a,b,restored])c.socket.disconnect();await new Promise<void>(resolve=>server.io.close(()=>resolve()));});
  await Promise.all([a.connect(),b.connect()]);const session=await a.create();
  assert.ok((await b.join({roomId:session.roomId.toLowerCase()})).ok);
  assert.ok((await a.seat('USSR')).ok);assert.ok((await b.seat('US')).ok);assert.ok((await a.start()).ok);
  await Promise.all([a.wait(s=>s.started),b.wait(s=>s.started)]);
  assert.equal((await b.socket.timeout(3000).emitWithAck('restart',{expectedRevision:b.last!.revision})).ok,false);
  a.socket.disconnect();await b.wait(s=>!s.seats.USSR.connected);
  await restored.connect();assert.ok((await restored.join(session)).ok);
  await restored.wait(s=>s.side==='USSR'&&s.started);
  assert.ok((await restored.socket.timeout(3000).emitWithAck('restart',{expectedRevision:restored.last!.revision})).ok);
  await Promise.all([restored.wait(s=>!s.started&&s.side==='USSR'),b.wait(s=>!s.started&&s.side==='US')]);
  assert.deepEqual(restored.last?.view,null);assert.deepEqual(b.last?.view,null);
  assert.equal((await b.socket.timeout(3000).emitWithAck('close',{})).ok,false);
  const closed=(client:Client)=>new Promise<string>(resolve=>client.socket.once('closed',message=>resolve(message.roomId)));
  const notifications=Promise.all([closed(restored),closed(b)]);
  assert.ok((await restored.socket.timeout(3000).emitWithAck('close',{})).ok);
  assert.deepEqual(await notifications,[session.roomId,session.roomId]);
  assert.equal(server.store.members(session.roomId).length,0);
});
