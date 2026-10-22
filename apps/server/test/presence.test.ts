import assert from 'node:assert/strict';
import test from 'node:test';
import { io, type Socket } from 'socket.io-client';
import type { BoardPresence, ClientToServer, ServerToClient } from '@ts/shared';
import { createGameServer } from '../src/server';
import { validPointer } from '../src/presence';

test('presence rejects forged identities, invalid coordinates and unsupported fields',()=>{
  const good={x:.5,y:0,kind:'mouse',phase:'move'};
  assert.ok(validPointer(good));assert.ok(validPointer(null));
  for(const value of [undefined,[],{}, {...good,x:NaN},{...good,x:Infinity},{...good,x:-.01},{...good,y:1.01},{...good,side:'US'},{...good,roomId:'other'},{...good,kind:'keyboard'},{...good,phase:'click'}])assert.equal(validPointer(value),false);
});

test('presence is opponent-only, ephemeral, rate limited and cleared on disconnect/restart',{timeout:10000},async t=>{
  const server=createGameServer();
  await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));
  const address=server.http.address();assert.ok(address&&typeof address==='object');
  const clients:Socket<ServerToClient,ClientToServer>[]=[];
  const connect=async()=>{const s:Socket<ServerToClient,ClientToServer>=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});clients.push(s);await new Promise<void>(resolve=>s.on('connect',resolve));return s;};
  t.after(async()=>{clients.forEach(s=>s.disconnect());await new Promise<void>(resolve=>server.io.close(()=>resolve()));});
  const a=await connect(),b=await connect(),outsider=await connect();
  const events:BoardPresence[]=[],own:BoardPresence[]=[],foreign:BoardPresence[]=[];
  a.on('pointer',p=>own.push(p));b.on('pointer',p=>events.push(p));outsider.on('pointer',p=>foreign.push(p));
  const created=await a.emitWithAck('create',{});assert.ok(created.ok);
  const session=created.data;const joined=await b.emitWithAck('join',{roomId:session.roomId});assert.ok(joined.ok);
  await outsider.emitWithAck('create',{});
  const pointer={x:.25,y:.75,kind:'touch' as const,phase:'down' as const};
  a.emit('pointer',pointer);
  await a.emitWithAck('seat',{side:'USSR'});await b.emitWithAck('seat',{side:'US'});await a.emitWithAck('start',{});
  assert.ok(events.every(p=>p.pointer===null),'lobby pointer packets must not be relayed');
  const revision=server.store.snapshot(session.roomId,server.store.members(session.roomId)[0].key).revision;
  // An acknowledged operation is a transport barrier for all previous presence packets.
  events.length=0;own.length=0;foreign.length=0;
  a.emit('pointer',pointer);await a.emitWithAck('start',{});
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.deepEqual(events,[{roomId:session.roomId,side:'USSR',pointer}]);assert.equal(own.length,0);assert.equal(foreign.length,0);
  events.length=0;
  a.emit('pointer',null);await a.emitWithAck('start',{});await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(events.at(-1)?.pointer,null);
  events.length=0;
  for(let i=0;i<200;i++)a.emit('pointer',pointer);
  await a.emitWithAck('start',{});await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(events.length>0&&events.length<100);
  assert.equal(server.store.snapshot(session.roomId,server.store.members(session.roomId)[0].key).revision,revision);
  events.length=0;a.disconnect();await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(events.some(p=>p.side==='USSR'&&p.pointer===null));
  const restored=await connect();assert.ok((await restored.emitWithAck('join',session)).ok);
  events.length=0;
  await restored.emitWithAck('restart',{expectedRevision:revision});await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(events.some(p=>p.pointer===null));
  events.length=0;restored.emit('pointer',pointer);await restored.emitWithAck('seat',{side:'USSR'});await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(events.every(p=>p.pointer===null));
});
