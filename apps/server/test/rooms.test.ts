import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomStore,parseAction } from '../src/rooms';
import type { PlayerView } from '@ts/game-core';
import type { Side } from '@ts/shared';
/** Two members in the lobby, not seated yet. */
function lobby(coin=()=>0){
  const store=new RoomStore(()=>42,coin),a=store.create('a'),b=store.join(a.session.roomId,'b');
  return {store,roomId:a.session.roomId,a,b};
}
/** USSR = member a, US = member b, game started. */
function joined(){
  const l=lobby(),{store,roomId}=l;
  store.seat(roomId,l.a.key,'a','USSR');store.seat(roomId,l.b.key,'b','US');store.start(roomId,l.a.key,'a');
  const key=(side:Side)=>side==='USSR'?l.a.key:l.b.key,client=(side:Side)=>side==='USSR'?'a':'b';
  return {...l,
    exec:(side:Side,request:unknown)=>store.execute(roomId,key(side),client(side),request),
    snap:(side:Side)=>store.snapshot(roomId,key(side)),
    view:(side:Side)=>store.snapshot(roomId,key(side)).view as PlayerView};
}

test('creating a room asks for no side: members enter the lobby unseated and see no game view',()=>{
  const {store,roomId,a,b}=lobby();
  const snap=store.snapshot(roomId,a.key);
  assert.equal(snap.side,null);assert.equal(snap.view,null);assert.equal(snap.started,false);assert.equal(snap.members,2);
  assert.ok(!JSON.stringify(snap).includes(a.session.token));assert.ok(!JSON.stringify(store.snapshot(roomId,b.key)).includes(b.session.token));
  assert.throws(()=>store.join(roomId,'c'),/房间已满/);
  assert.throws(()=>store.execute(roomId,a.key,'a',{id:'1',expectedRevision:0,action:{type:'PLACE_SETUP',country:'poland'}}),/请先选择阵营/);
});

test('lobby seats: sit, refuse a taken side, switch to the free side, stand up',()=>{
  const {store,roomId,a,b}=lobby();
  store.seat(roomId,a.key,'a','USSR');
  assert.equal(store.snapshot(roomId,a.key).side,'USSR');assert.equal(store.snapshot(roomId,b.key).seats.USSR.occupied,true);
  assert.equal(store.snapshot(roomId,a.key).view,null);
  assert.equal(store.snapshot(roomId,a.key).seats.USSR.mine,true);assert.equal(store.snapshot(roomId,b.key).seats.USSR.mine,false);
  assert.throws(()=>store.seat(roomId,b.key,'b','USSR'),/已有玩家/);
  store.seat(roomId,a.key,'a','US');
  assert.equal(store.snapshot(roomId,a.key).side,'US');assert.equal(store.snapshot(roomId,a.key).seats.USSR.occupied,false);
  store.seat(roomId,b.key,'b','USSR');store.seat(roomId,a.key,'a',null);
  assert.equal(store.snapshot(roomId,a.key).side,null);assert.equal(store.snapshot(roomId,b.key).side,'USSR');
  assert.throws(()=>store.seat(roomId,a.key,'a','China'),/美国或苏联/);
});

test('random assignment seats both members on opposite sides',()=>{
  for(const coin of [()=>0,()=>1]){
    const {store,roomId,a,b}=lobby(coin);store.seat(roomId,a.key,'a','RANDOM');
    const sa=store.snapshot(roomId,a.key).side,sb=store.snapshot(roomId,b.key).side;
    assert.ok(sa&&sb);assert.notEqual(sa,sb);
  }
  const store=new RoomStore(()=>42,()=>1),solo=store.create('s');store.seat(solo.session.roomId,solo.key,'s','RANDOM');
  assert.ok(store.snapshot(solo.session.roomId,solo.key).side);
});

test('the game starts only when both sides are taken, then sides are locked',()=>{
  const {store,roomId,a,b}=lobby();
  assert.throws(()=>store.start(roomId,a.key,'a'),/请先选择阵营/);
  store.seat(roomId,a.key,'a','USSR');
  assert.throws(()=>store.start(roomId,a.key,'a'),/等待另一名玩家/);
  store.seat(roomId,b.key,'b','US');
  assert.throws(()=>store.execute(roomId,a.key,'a',{id:'1',expectedRevision:store.snapshot(roomId,a.key).revision,action:{type:'PLACE_SETUP',country:'poland'}}),/开始对局/);
  store.start(roomId,b.key,'b');
  const snap=store.snapshot(roomId,a.key);
  assert.equal(snap.started,true);assert.equal((snap.view as PlayerView).phase.kind,'SETUP_PLACEMENT');
  assert.throws(()=>store.seat(roomId,a.key,'a','US'),/对局已开始/);
  assert.throws(()=>store.seat(roomId,a.key,'a',null),/对局已开始/);
});

test('server validates side, revision, malformed actions and duplicate request IDs',()=>{
  assert.deepEqual(parseAction({type:'RELOCATE_INFLUENCE',from:'syria',to:'angola'}),{type:'RELOCATE_INFLUENCE',from:'syria',to:'angola'});
  assert.throws(()=>parseAction({type:'RELOCATE_INFLUENCE',from:'syria',to:'not-a-country'}));
  assert.throws(()=>parseAction({type:'RELOCATE_INFLUENCE',from:'syria',to:'angola',amount:99}));
  const {exec,view,snap}=joined(),revision=snap('USSR').revision,request={id:'1',expectedRevision:revision,action:{type:'PLACE_SETUP',country:'poland'}};
  assert.throws(()=>exec('US',request),/尚未轮到/);
  assert.equal(exec('USSR',request),revision+1);
  assert.equal(exec('USSR',request),revision+1);
  assert.equal(view('USSR').influence.poland.USSR,1);
  assert.throws(()=>exec('USSR',{...request,id:'2'}),/局面已更新/);
  assert.throws(()=>exec('USSR',{...request,action:{type:'PLACE_SETUP',country:'east_germany'}}),/已用于/);
  assert.throws(()=>parseAction({type:'PLAY_OPS',card:4,mode:'COUP',side:'US'}));
  assert.throws(()=>parseAction({type:'PLAY_OPS',card:4,mode:'COUP',asiaOnly:'yes'}));
  assert.throws(()=>parseAction({type:'TARGET',country:'not-a-country'}));
  assert.throws(()=>parseAction(null));
});

test('reconnection retains seat and state; stolen tokens and replaced clients cannot act',()=>{
  const {store,roomId,a,exec,snap}=joined(),start=snap('USSR').revision;
  exec('USSR',{id:'1',expectedRevision:start,action:{type:'PLACE_SETUP',country:'poland'}});
  store.disconnect(roomId,a.key,'a');assert.equal(snap('US').seats.USSR.connected,false);
  assert.throws(()=>store.join(roomId,'evil','incorrect'),/恢复身份已失效/);
  const back=store.join(roomId,'a2',a.session.token);assert.equal(back.key,a.key);
  assert.equal(store.snapshot(roomId,a.key).side,'USSR');assert.equal(store.snapshot(roomId,a.key).revision,start+1);
  const result=store.join(roomId,'a3',a.session.token);assert.equal(result.replaced,'a2');
  store.disconnect(roomId,a.key,'a2');assert.equal(snap('US').seats.USSR.connected,true);
  assert.throws(()=>store.execute(roomId,a.key,'a2',{id:'2',expectedRevision:start+1,action:{type:'PLACE_SETUP',country:'poland'}}),/身份无效/);
});

test('separate rooms never share game state or hidden hands',()=>{
  const first=joined(),second=joined();
  first.exec('USSR',{id:'1',expectedRevision:first.snap('USSR').revision,action:{type:'PLACE_SETUP',country:'poland'}});
  assert.equal(second.view('USSR').influence.poland.USSR,0);
  assert.deepEqual(first.view('US').hands.USSR,[]);
});

test('undo restores influence, keeps revisions monotonic and deduplicates retries',()=>{
  const {exec,view,snap}=joined(),before=view('USSR'),start=snap('USSR').revision;
  exec('USSR',{id:'place',expectedRevision:start,action:{type:'PLACE_SETUP',country:'poland'}});
  assert.equal(snap('USSR').canUndo,true);
  assert.equal(snap('US').canUndo,false);
  const undo={id:'undo',expectedRevision:start+1,action:{type:'UNDO'}};
  assert.equal(exec('USSR',undo),start+2);
  assert.deepEqual(view('USSR'),before);
  assert.equal(snap('USSR').undoVersion,1);
  assert.equal(exec('USSR',undo),start+2);
  assert.throws(()=>exec('USSR',{id:'stale',expectedRevision:start+1,action:{type:'PLACE_SETUP',country:'poland'}}),/局面已更新/);
  assert.throws(()=>exec('USSR',{id:'empty',expectedRevision:start+2,action:{type:'UNDO'}}),/只能撤销/);
  assert.throws(()=>parseAction({type:'UNDO',state:{}}),/不支持的字段/);
});

test('finished placement remains undoable until explicit handoff',()=>{
  const j=joined();let revision=j.snap('USSR').revision;
  const act=(side:Side,action:unknown)=>{revision=j.exec(side,{id:'request_'+revision,expectedRevision:revision,action});};
  for(let i=0;i<6;i++)act('USSR',{type:'PLACE_SETUP',country:'poland'});
  assert.equal(j.view('USSR').phase.kind,'CONFIRM_END');
  assert.throws(()=>act('US',{type:'PLACE_SETUP',country:'france'}),/尚未轮到/);
  act('USSR',{type:'UNDO'});
  const phase=j.view('USSR').phase;
  assert.ok('side' in phase);assert.equal(phase.side,'USSR');
  act('USSR',{type:'PLACE_SETUP',country:'poland'});
  act('USSR',{type:'END_ACTION'});
  assert.equal(j.snap('USSR').canUndo,false);
  act('US',{type:'PLACE_SETUP',country:'france'});
  assert.equal(j.snap('USSR').canUndo,false);
  assert.throws(()=>act('USSR',{type:'UNDO'}),/只能撤销/);
  act('US',{type:'UNDO'});
  assert.equal(j.snap('USSR').canUndo,false);
});

test('undoing a headline restores the card and hides it from the opponent',()=>{
  const j=joined();let revision=j.snap('USSR').revision;
  const act=(side:Side,action:unknown)=>{revision=j.exec(side,{id:'card_'+revision,expectedRevision:revision,action});};
  for(let i=0;i<6;i++)act('USSR',{type:'PLACE_SETUP',country:'poland'});
  act('USSR',{type:'END_ACTION'});
  for(let i=0;i<7;i++)act('US',{type:'PLACE_SETUP',country:'france'});
  act('US',{type:'END_ACTION'});
  const before=j.view('USSR');
  act('USSR',{type:'SELECT_HEADLINE',card:before.hands.USSR.find(id=>id!==32)!});
  act('USSR',{type:'UNDO'});
  assert.deepEqual(j.view('USSR'),before);
  assert.deepEqual(j.view('US').hands.USSR,[]);
});

test('country minus only undoes the latest placement in that country and never another move',()=>{
  const j=joined();let revision=j.snap('USSR').revision;
  const act=(action:unknown)=>{revision=j.exec('USSR',{id:'minus_'+revision,expectedRevision:revision,action});};
  act({type:'PLACE_SETUP',country:'poland'});
  assert.deepEqual(j.snap('USSR').undoPlacement,{country:'poland',side:'USSR'});
  assert.equal(j.snap('US').undoPlacement,undefined);
  act({type:'PLACE_SETUP',country:'east_germany'});
  const before=j.snap('USSR');
  assert.throws(()=>act({type:'UNDO_PLACEMENT',country:'poland'}),/最近刚放置/);
  assert.deepEqual(j.snap('USSR'),before);
  act({type:'UNDO_PLACEMENT',country:'east_germany'});
  assert.deepEqual(j.snap('USSR').undoPlacement,{country:'poland',side:'USSR'});
  act({type:'UNDO_PLACEMENT',country:'poland'});
  assert.equal(j.view('USSR').influence.poland.USSR,0);
  assert.equal(j.snap('USSR').undoPlacement,undefined);
});

test('room codes, host-only restart, reconnect identity and close lifecycle',()=>{
  const {store,roomId,a,b}=lobby();assert.match(roomId,/^[A-F0-9]{6}$/);
  assert.equal(store.snapshot(roomId,a.key).isHost,true);
  assert.equal(store.snapshot(roomId,b.key).isHost,false);
  store.seat(roomId,a.key,'a','USSR');store.seat(roomId,b.key,'b','US');store.start(roomId,a.key,'a');
  let revision=store.snapshot(roomId,a.key).revision;
  revision=store.execute(roomId,a.key,'a',{id:'place-before-loss',expectedRevision:revision,action:{type:'PLACE_SETUP',country:'poland'}});
  store.disconnect(roomId,a.key,'a');
  const restored=store.join(roomId.toLowerCase(),'new-a',a.session.token);
  assert.equal(restored.key,a.key);assert.equal(store.snapshot(roomId,a.key).side,'USSR');
  assert.equal(store.snapshot(roomId,a.key).revision,revision);
  assert.throws(()=>store.execute(roomId,a.key,'a',{id:'old-client',expectedRevision:revision,action:{type:'UNDO'}}),/身份无效/);
  assert.throws(()=>store.restart(roomId,b.key,'b',revision),/只有房主/);
  assert.throws(()=>store.restart(roomId,a.key,'new-a',revision-1),/已更新/);
  store.restart(roomId,a.key,'new-a',revision);
  const reset=store.snapshot(roomId,a.key);assert.equal(reset.started,false);assert.equal(reset.canUndo,false);assert.equal(reset.side,'USSR');
  assert.equal(reset.view,null);
  store.start(roomId,a.key,'new-a');assert.equal((store.snapshot(roomId,a.key).view as PlayerView).influence.poland.USSR,0);
  assert.throws(()=>store.close(roomId,b.key,'b'),/只有房主/);
  assert.equal(store.close(roomId,a.key,'new-a').length,2);
  assert.throws(()=>store.join(roomId,'new-b',b.session.token),/不存在/);
});

test('no seed, shuffle, deal or player view exists until both seated players are online and start',()=>{
  let deals=0;const store=new RoomStore(()=>{deals++;return 42+deals;});
  const a=store.create('a'),roomId=a.session.roomId;
  store.seat(roomId,a.key,'a','USSR');assert.equal(deals,0);assert.equal(store.snapshot(roomId,a.key).view,null);
  const b=store.join(roomId,'b');store.seat(roomId,b.key,'b','US');
  assert.equal(deals,0);assert.equal(store.snapshot(roomId,a.key).view,null);assert.equal(store.snapshot(roomId,b.key).view,null);
  store.disconnect(roomId,b.key,'b');
  assert.throws(()=>store.start(roomId,a.key,'a'),/双方在线/);assert.equal(deals,0);
  store.join(roomId,'b2',b.session.token);store.start(roomId,a.key,'a');
  assert.equal(deals,1);
  const av=store.snapshot(roomId,a.key).view as PlayerView,bv=store.snapshot(roomId,b.key).view as PlayerView;
  assert.equal(av.hands.USSR.length,8);assert.equal(bv.hands.US.length,8);
  assert.deepEqual(av.hands.US,[]);assert.deepEqual(bv.hands.USSR,[]);
  store.start(roomId,b.key,'b2');assert.equal(deals,1);assert.deepEqual(store.snapshot(roomId,a.key).view,av);
  store.restart(roomId,a.key,'a',store.snapshot(roomId,a.key).revision);
  assert.equal(deals,1);assert.equal(store.snapshot(roomId,a.key).view,null);
  store.start(roomId,b.key,'b2');assert.equal(deals,2);
});
