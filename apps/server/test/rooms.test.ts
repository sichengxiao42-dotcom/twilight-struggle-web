import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomStore,parseAction } from '../src/rooms';
import type { PlayerView } from '@ts/game-core';
const joined=()=>{const store=new RoomStore(()=>42);const a=store.create('USSR','a').session;const b=store.join(a.roomId,'US','b').session;return {store,a,b};};
test('room waits for a peer, reserves seats, and never exposes tokens in snapshots',()=>{
  const store=new RoomStore(()=>42),a=store.create('USSR','a').session;
  assert.throws(()=>store.execute(a.roomId,'USSR','a',{id:'1',expectedRevision:0,action:{type:'PLACE_SETUP',country:'poland'}}),/等待/);
  assert.throws(()=>store.join(a.roomId,'USSR','thief'),/占用/);
  assert.ok(!JSON.stringify(store.snapshot(a.roomId,'USSR')).includes(a.token));
});
test('server validates side, revision, malformed actions and duplicate request IDs',()=>{
  const {store,a}=joined();const request={id:'1',expectedRevision:0,action:{type:'PLACE_SETUP',country:'poland'}};
  assert.throws(()=>store.execute(a.roomId,'US','b',request),/尚未轮到/);
  assert.equal(store.execute(a.roomId,'USSR','a',request),1);
  assert.equal(store.execute(a.roomId,'USSR','a',request),1);
  assert.equal((store.snapshot(a.roomId,'USSR').view as PlayerView).influence.poland.USSR,1);
  assert.throws(()=>store.execute(a.roomId,'USSR','a',{...request,id:'2'}),/局面已更新/);
  assert.throws(()=>store.execute(a.roomId,'USSR','a',{...request,action:{type:'PLACE_SETUP',country:'east_germany'}}),/已用于/);
  assert.throws(()=>parseAction({type:'PLAY_OPS',card:4,mode:'COUP',side:'US'}));
  assert.throws(()=>parseAction({type:'PLAY_OPS',card:4,mode:'COUP',asiaOnly:'yes'}));
  assert.throws(()=>parseAction({type:'TARGET',country:'not-a-country'}));
  assert.throws(()=>parseAction(null));
});
test('reconnection retains seat and state; stolen tokens and replaced clients cannot act',()=>{
  const {store,a}=joined();store.execute(a.roomId,'USSR','a',{id:'1',expectedRevision:0,action:{type:'PLACE_SETUP',country:'poland'}});
  store.disconnect(a.roomId,'USSR','a');assert.equal(store.snapshot(a.roomId,'US').seats.USSR.connected,false);
  assert.throws(()=>store.join(a.roomId,'USSR','evil','incorrect'));
  store.join(a.roomId,'USSR','a2',a.token);assert.equal(store.snapshot(a.roomId,'USSR').revision,1);
  const result=store.join(a.roomId,'USSR','a3',a.token);assert.equal(result.replaced,'a2');
  store.disconnect(a.roomId,'USSR','a2');assert.equal(store.snapshot(a.roomId,'US').seats.USSR.connected,true);
  assert.throws(()=>store.execute(a.roomId,'USSR','a2',{id:'2',expectedRevision:1,action:{type:'PLACE_SETUP',country:'poland'}}),/身份无效/);
});
test('separate rooms never share game state or hidden hands',()=>{
  const {store,a}=joined();const c=store.create('USSR','c').session;store.join(c.roomId,'US','d');
  store.execute(a.roomId,'USSR','a',{id:'1',expectedRevision:0,action:{type:'PLACE_SETUP',country:'poland'}});
  assert.equal(store.snapshot(c.roomId,'USSR').revision,0);assert.equal((store.snapshot(c.roomId,'USSR').view as PlayerView).influence.poland.USSR,0);
  assert.deepEqual((store.snapshot(a.roomId,'US').view as PlayerView).hands.USSR,[]);
});
