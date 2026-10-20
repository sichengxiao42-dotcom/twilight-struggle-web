import assert from 'node:assert/strict';
import test from 'node:test';
import { apply, createGame, viewFor, type GameState } from '../src/index';

test('manual setup waits for confirmation, and cannot accept extra placements',()=>{
  let state:GameState={...createGame(42),manualEnd:true};
  for(let i=0;i<6;i++)state=apply(state,'USSR',{type:'PLACE_SETUP',country:'poland'});
  assert.equal(state.phase.kind,'CONFIRM_END');
  assert.throws(()=>apply(state,'US',{type:'PLACE_SETUP',country:'france'}),/尚未轮到/);
  assert.throws(()=>apply(state,'USSR',{type:'PLACE_SETUP',country:'poland'}),/结束回合/);
  state=apply(state,'USSR',{type:'END_ACTION'});
  assert.equal(state.phase.kind,'SETUP_PLACEMENT');assert.equal('side' in state.phase&&state.phase.side,'US');
});
test('exhausted OPS retain side, round and pending finish until explicit end',()=>{
  const state:GameState={...createGame(42),manualEnd:true};
  state.phase={kind:'OPS',side:'USSR',round:1,mode:'INFLUENCE',remaining:1,ops:1,eligible:['poland']};
  state.tasks=[{kind:'FINISH_ACTION',side:'USSR',round:1}];
  const done=apply(state,'USSR',{type:'TARGET',country:'poland'});
  assert.deepEqual(done.phase,{kind:'CONFIRM_END',side:'USSR',round:1,context:'ACTION'});
  assert.equal(done.influence.poland.USSR,state.influence.poland.USSR+1);
  const ended=apply(done,'USSR',{type:'END_ACTION'});
  assert.deepEqual(ended.phase,{kind:'ACTION_ROUND',side:'US',round:1});
  assert.throws(()=>apply(ended,'US',{type:'END_ACTION'}),/先完成/);
});
test('headline choice remains private until the player confirms ending',()=>{
  const state:GameState={...createGame(42),manualEnd:true};state.phase={kind:'HEADLINE',side:'USSR'};
  const card=state.hands.USSR.find(id=>id!==32)!;
  const chosen=apply(state,'USSR',{type:'SELECT_HEADLINE',card});
  assert.equal(chosen.phase.kind,'CONFIRM_END');assert.ok(chosen.hands.USSR.includes(card));
  const enemy=viewFor(chosen,'US');assert.deepEqual(enemy.phase,{kind:'WAITING',side:'USSR'});
  assert.ok(!('pendingHeadline' in enemy));assert.equal(enemy.headlineCommitted.USSR,false);
  const ended=apply(chosen,'USSR',{type:'END_ACTION'});
  assert.equal(ended.headlines.USSR,card);assert.ok(!ended.hands.USSR.includes(card));
});
