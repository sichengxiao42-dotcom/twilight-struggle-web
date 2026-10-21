import assert from 'node:assert/strict';
import { test } from 'node:test';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient, RoomSnapshot, Session, Side } from '@ts/shared';
import { activeSide, apply, chooseBotAction, createGame, CARD_BY_ID, type Action, type PlayerView } from '@ts/game-core';
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

test('dice socket flow rejects forged points, deduplicates rolls and restores rolled values on reconnect',{timeout:15000},async t=>{
  const server=createGameServer(new RoomStore(()=>42));
  await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));
  const addr=server.http.address();assert.ok(addr&&typeof addr==='object');const url='http://127.0.0.1:'+addr.port;
  const a=new Client(url),b=new Client(url),back=new Client(url);
  t.after(async()=>{for(const c of [a,b,back])c.socket.disconnect();await new Promise<void>(resolve=>server.io.close(()=>resolve()));});
  await Promise.all([a.connect(),b.connect()]);const first=await a.create();const join=await b.join({roomId:first.roomId});assert.ok(join.ok);
  const sessions={USSR:first,US:join.data},clients={USSR:a,US:b};
  await a.seat('USSR');await b.seat('US');await a.start();await Promise.all([a.wait(s=>s.started),b.wait(s=>s.started)]);
  let reference:ReturnType<typeof createGame>={...createGame(42),manualEnd:true,manualDice:true};
  for(let step=0;step<200&&reference.phase.kind!=='DICE_ROLL';step++){
    const side=activeSide(reference)!,action=chooseBotAction(reference)!;
    assert.ok(action);const revision=clients[side].last!.revision+1;
    const reply=await clients[side].act(action,'prepare_'+step);assert.ok(reply.ok,reply.ok?'':reply.error);
    reference=apply(reference,side,action);
    await Promise.all([a.wait(s=>s.revision===revision),b.wait(s=>s.revision===revision)]);
  }
  assert.equal(reference.phase.kind,'DICE_ROLL');const side=activeSide(reference)!,roller=clients[side],other=clients[side==='US'?'USSR':'US'];
  const revision=roller.last!.revision;
  assert.equal((await other.act({type:'ROLL_DICE'},'wrong_side')).ok,false);
  const forged=await roller.socket.emitWithAck('action',{id:'forged',expectedRevision:revision,action:{type:'ROLL_DICE',value:6}});assert.equal(forged.ok,false);
  const request={id:'one_roll',expectedRevision:revision,action:{type:'ROLL_DICE'}};
  assert.ok((await roller.socket.emitWithAck('action',request)).ok);
  await Promise.all([a.wait(s=>s.revision===revision+1),b.wait(s=>s.revision===revision+1)]);
  const phase=roller.last!.view!.phase;assert.equal(phase.kind,'DICE_ROLL');
  if(phase.kind!=='DICE_ROLL')throw new Error('missing dice phase');
  assert.equal(phase.values.length,1);assert.ok(phase.values[0]>=1&&phase.values[0]<=6);
  const duplicate=await roller.socket.emitWithAck('action',request);assert.ok(duplicate.ok);assert.equal(duplicate.data.revision,revision+1);
  assert.equal(roller.last!.canUndo,false);
  roller.socket.disconnect();await other.wait(s=>!s.seats[side].connected);
  await back.connect();assert.ok((await back.join(sessions[side])).ok);
  const restored=await back.wait(s=>s.revision===revision+1);
  assert.deepEqual(restored.view!.phase,phase);
  for(const key of ['pendingDice','diceReplay','seed','rngCalls'])assert.ok(!(key in restored.view!));
});

test('socket bot plays automatically, keeps its headline secret, and cancels pending work on restart',{timeout:15000},async t=>{
  const server=createGameServer(new RoomStore(()=>42),{botDelayMs:5});
  await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));
  const addr=server.http.address();assert.ok(addr&&typeof addr==='object');
  const a=new Client('http://127.0.0.1:'+addr.port);
  t.after(async()=>{a.socket.disconnect();await new Promise<void>(resolve=>server.io.close(()=>resolve()));});
  await a.connect();await a.create();
  assert.ok((await a.socket.emitWithAck('bot',{enabled:true})).ok);
  await a.wait(s=>Boolean(s.seats.USSR.bot));assert.equal(a.last!.view,null);
  assert.ok((await a.start()).ok);
  await a.wait(s=>s.view?.phase.kind==='SETUP_PLACEMENT'&&s.view.phase.side==='US');
  assert.deepEqual(a.last!.view!.hands.USSR,[]);
  for(let i=0;i<7;i++){
    const revision=a.last!.revision+1;assert.ok((await a.act({type:'PLACE_SETUP',country:'west_germany'},'setup_'+i)).ok);
    await a.wait(s=>s.revision>=revision);
  }
  assert.ok((await a.act({type:'END_ACTION'},'confirm_setup')).ok);
  await a.wait(s=>s.view?.phase.kind==='HEADLINE'&&s.view.phase.side==='US');
  assert.equal(a.last!.view!.headlineCommitted.USSR,true);
  assert.equal(a.last!.view!.headlines.USSR,undefined);
  assert.deepEqual(a.last!.view!.publicPlays,[],'no secret headline in public history');
  const card=a.last!.view!.hands.US.find(id=>CARD_BY_ID.get(id)!.scoring)??a.last!.view!.hands.US.find(id=>id!==32)!;
  let revision=a.last!.revision+1;
  assert.ok((await a.act({type:'SELECT_HEADLINE',card},'headline')).ok);await a.wait(s=>s.revision>=revision);
  assert.ok((await a.act({type:'END_ACTION'},'confirm_headline')).ok);
  await a.wait(s=>Boolean(s.view?.publicPlays.some(p=>p.use!=='HEADLINE'))||Boolean(s.botError)||(s.view?.phase.kind==='DECISION'||s.view?.phase.kind==='DICE_ROLL')&&s.view.phase.side==='US');
  assert.equal(a.last!.botError,undefined);
  revision=a.last!.revision;
  assert.ok((await a.socket.emitWithAck('restart',{expectedRevision:revision})).ok);
  await a.wait(s=>!s.started&&s.revision>revision);
  const stopped=a.last!.revision;
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(a.last!.revision,stopped);assert.equal(a.last!.view,null);
});
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
    if(p.kind==='DICE_ROLL')action={type:p.values.length===p.request.rollers.length?'CONTINUE_DICE':'ROLL_DICE'};
    else if(p.kind==='CONFIRM_END')action={type:'END_ACTION'};
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
