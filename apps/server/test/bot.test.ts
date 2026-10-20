import assert from 'node:assert/strict';
import test from 'node:test';
import { type PlayerView } from '@ts/game-core';
import { RoomStore } from '../src/rooms';

test('host adds a bot without dealing, switches sides, removes it, and keeps it on restart',()=>{
  const store=new RoomStore(()=>42,()=>0),a=store.create('a'),id=a.session.roomId;
  store.setBot(id,a.key,'a',true);
  let snap=store.snapshot(id,a.key);
  assert.equal(snap.side,'US');assert.equal(snap.members,2);assert.equal(snap.view,null);assert.equal(snap.seats.USSR.bot,true);
  assert.throws(()=>store.join(id,'b'),/房间已满/);
  const revision=snap.revision;
  assert.equal(store.setBot(id,a.key,'a',true),revision,'retry must be idempotent');
  store.seat(id,a.key,'a','RANDOM');snap=store.snapshot(id,a.key);
  assert.equal(snap.side,'US');assert.ok(snap.seats.USSR.bot);
  store.setBot(id,a.key,'a',false);assert.equal(store.snapshot(id,a.key).members,1);
  store.seat(id,a.key,'a','USSR');store.setBot(id,a.key,'a',true);
  store.start(id,a.key,'a');assert.equal(store.snapshot(id,a.key).seats.US.bot,true);
  assert.throws(()=>store.setBot(id,a.key,'a',false),/对局已开始/);
  store.restart(id,a.key,'a',store.snapshot(id,a.key).revision);
  snap=store.snapshot(id,a.key);assert.equal(snap.view,null);assert.equal(snap.seats.US.bot,true);assert.equal(store.botPending(id),false);
});

test('guests cannot manage bots, nor can a bot replace an existing human',()=>{
  const store=new RoomStore(),a=store.create('a'),id=a.session.roomId,b=store.join(id,'b');
  assert.throws(()=>store.setBot(id,b.key,'b',true),/只有房主/);
  assert.throws(()=>store.setBot(id,a.key,'a',true),/已有其他玩家/);
  assert.throws(()=>store.setBot(id,a.key,'a','true'),/无效/);
});

test('bot steps revise public state, hide hands, pause offline and resume with the same identity',()=>{
  const store=new RoomStore(()=>42),a=store.create('a'),id=a.session.roomId;
  store.setBot(id,a.key,'a',true);store.start(id,a.key,'a');
  assert.ok(store.botPending(id));const revision=store.snapshot(id,a.key).revision;
  store.disconnect(id,a.key,'a');assert.equal(store.botPending(id),false);assert.equal(store.stepBot(id),false);
  store.join(id,'back',a.session.token);assert.ok(store.botPending(id));
  let steps=0;while(store.botPending(id)&&steps++<20)store.stepBot(id);
  const snap=store.snapshot(id,a.key),view=snap.view as PlayerView;
  assert.equal(view.phase.kind,'SETUP_PLACEMENT');assert.ok('side' in view.phase&&view.phase.side==='US');
  assert.equal(snap.revision,revision+7);assert.equal(snap.canUndo,false);assert.equal(snap.botError,undefined);
  assert.deepEqual(view.hands.USSR,[]);assert.equal(view.handCounts.USSR,8);
  assert.equal(store.stepBot(id),false,'bot must never take the human turn');
  store.close(id,a.key,'back');assert.equal(store.stepBot(id),false);
});
