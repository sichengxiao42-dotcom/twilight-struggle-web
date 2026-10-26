import assert from 'node:assert/strict';
import test from 'node:test';
import { apply, createGame, viewFor, type GameState } from '../src/index';

test('setup placement records one public strike when the side confirms the end, not before',()=>{
  let state:GameState={...createGame(42),manualEnd:true};
  for(let i=0;i<4;i++)state=apply(state,'USSR',{type:'PLACE_SETUP',country:'poland'});
  for(let i=0;i<2;i++)state=apply(state,'USSR',{type:'PLACE_SETUP',country:'hungary'});
  assert.equal(state.strike,undefined,'no arrows while the player is still placing or confirming');
  state=apply(state,'USSR',{type:'END_ACTION'});
  assert.equal(state.strike!.id,1);
  assert.deepEqual(new Map(state.strike!.arrows.map(a=>[a.country,a])),new Map([['poland',{side:'USSR',country:'poland',amount:4}],['hungary',{side:'USSR',country:'hungary',amount:2}]]));
  // Both players receive the same public strike; the private baseline never leaves the server.
  assert.deepEqual(viewFor(state,'US').strike,state.strike);assert.deepEqual(viewFor(state,'USSR').strike,state.strike);
  assert.ok(!('strikeBase' in viewFor(state,'US')));
  for(let i=0;i<7;i++)state=apply(state,'US',{type:'PLACE_SETUP',country:'france'});
  state=apply(state,'US',{type:'END_ACTION'});
  assert.deepEqual(state.strike,{id:2,arrows:[{side:'US',country:'france',amount:7}]});
});

test('influence placed with OPS during an action round becomes a strike when the round ends',()=>{
  const state:GameState={...createGame(42),manualEnd:true};
  state.phase={kind:'ACTION_ROUND',side:'USSR',round:1};state.strikeBase=structuredClone(state.influence);
  state.phase={kind:'OPS',side:'USSR',round:1,mode:'INFLUENCE',remaining:2,ops:2,eligible:['poland','east_germany']};
  state.tasks=[{kind:'FINISH_ACTION',side:'USSR',round:1}];
  let next=apply(state,'USSR',{type:'TARGET',country:'poland'});
  next=apply(next,'USSR',{type:'TARGET',country:'east_germany'});
  assert.equal(next.phase.kind,'CONFIRM_END');assert.equal(next.strike,undefined);
  next=apply(next,'USSR',{type:'END_ACTION'});
  assert.deepEqual(next.strike,{id:1,arrows:[{side:'USSR',country:'east_germany',amount:1},{side:'USSR',country:'poland',amount:1}]});
});
