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
  assert.deepEqual(parseAction({type:'RELOCATE_INFLUENCE',from:'syria',to:'angola'}),{type:'RELOCATE_INFLUENCE',from:'syria',to:'angola'});
  assert.throws(()=>parseAction({type:'RELOCATE_INFLUENCE',from:'syria',to:'not-a-country'}));
  assert.throws(()=>parseAction({type:'RELOCATE_INFLUENCE',from:'syria',to:'angola',amount:99}));
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

test('undo restores influence, keeps revisions monotonic and deduplicates retries',()=>{
  const {store,a}=joined(),before=store.snapshot(a.roomId,'USSR').view;
  const act=(id:string,revision:number,action:unknown)=>store.execute(a.roomId,'USSR','a',{id,expectedRevision:revision,action});
  act('place',0,{type:'PLACE_SETUP',country:'poland'});
  assert.equal(store.snapshot(a.roomId,'USSR').canUndo,true);
  assert.equal(store.snapshot(a.roomId,'US').canUndo,false);
  const undo={id:'undo',expectedRevision:1,action:{type:'UNDO'}};
  assert.equal(store.execute(a.roomId,'USSR','a',undo),2);
  assert.deepEqual(store.snapshot(a.roomId,'USSR').view,before);
  assert.equal(store.snapshot(a.roomId,'USSR').undoVersion,1);
  assert.equal(store.execute(a.roomId,'USSR','a',undo),2);
  assert.throws(()=>act('stale',1,{type:'PLACE_SETUP',country:'poland'}),/局面已更新/);
  assert.throws(()=>act('empty',2,{type:'UNDO'}),/只能撤销/);
  assert.throws(()=>parseAction({type:'UNDO',state:{}}),/不支持的字段/);
});

test('undo works after handoff but cannot cross an opponent action',()=>{
  const {store,a}=joined();let revision=0;
  const act=(side:'US'|'USSR',action:unknown)=>{revision=store.execute(a.roomId,side,side==='USSR'?'a':'b',{id:'request_'+revision,expectedRevision:revision,action});};
  for(let i=0;i<6;i++)act('USSR',{type:'PLACE_SETUP',country:'poland'});
  assert.equal((store.snapshot(a.roomId,'USSR').view as PlayerView).phase.kind,'SETUP_PLACEMENT');
  act('USSR',{type:'UNDO'});
  const phase=(store.snapshot(a.roomId,'USSR').view as PlayerView).phase;
  assert.ok('side' in phase);assert.equal(phase.side,'USSR');
  act('USSR',{type:'PLACE_SETUP',country:'poland'});
  act('US',{type:'PLACE_SETUP',country:'france'});
  assert.equal(store.snapshot(a.roomId,'USSR').canUndo,false);
  assert.throws(()=>act('USSR',{type:'UNDO'}),/只能撤销/);
  act('US',{type:'UNDO'});
  assert.equal(store.snapshot(a.roomId,'USSR').canUndo,false);
});

test('undoing a headline restores the card and hides it from the opponent',()=>{
  const {store,a}=joined();let revision=0;
  const act=(side:'US'|'USSR',action:unknown)=>{revision=store.execute(a.roomId,side,side==='USSR'?'a':'b',{id:'card_'+revision,expectedRevision:revision,action});};
  for(let i=0;i<6;i++)act('USSR',{type:'PLACE_SETUP',country:'poland'});
  for(let i=0;i<7;i++)act('US',{type:'PLACE_SETUP',country:'france'});
  const before=store.snapshot(a.roomId,'USSR').view as PlayerView;
  act('USSR',{type:'SELECT_HEADLINE',card:before.hands.USSR.find(id=>id!==32)!});
  act('USSR',{type:'UNDO'});
  assert.deepEqual(store.snapshot(a.roomId,'USSR').view,before);
  assert.deepEqual((store.snapshot(a.roomId,'US').view as PlayerView).hands.USSR,[]);
});

test('country minus only undoes the latest placement in that country and never another move',()=>{
  const {store,a}=joined();let revision=0;
  const act=(action:unknown)=>{revision=store.execute(a.roomId,'USSR','a',{id:'minus_'+revision,expectedRevision:revision,action});};
  act({type:'PLACE_SETUP',country:'poland'});
  assert.deepEqual(store.snapshot(a.roomId,'USSR').undoPlacement,{country:'poland',side:'USSR'});
  assert.equal(store.snapshot(a.roomId,'US').undoPlacement,undefined);
  act({type:'PLACE_SETUP',country:'east_germany'});
  const before=store.snapshot(a.roomId,'USSR');
  assert.throws(()=>act({type:'UNDO_PLACEMENT',country:'poland'}),/最近刚放置/);
  assert.deepEqual(store.snapshot(a.roomId,'USSR'),before);
  act({type:'UNDO_PLACEMENT',country:'east_germany'});
  assert.deepEqual(store.snapshot(a.roomId,'USSR').undoPlacement,{country:'poland',side:'USSR'});
  act({type:'UNDO_PLACEMENT',country:'poland'});
  assert.equal((store.snapshot(a.roomId,'USSR').view as PlayerView).influence.poland.USSR,0);
  assert.equal(store.snapshot(a.roomId,'USSR').undoPlacement,undefined);
});
