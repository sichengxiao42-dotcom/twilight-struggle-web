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

test('each coup records a public clash matching the dice and the influence change',()=>{
  for(let seed=1;seed<=12;seed++){
    const state:GameState={...createGame(seed)};
    state.influence.iran={US:2,USSR:0};
    state.phase={kind:'OPS',side:'USSR',round:1,mode:'COUP',remaining:3,ops:3,eligible:[]};state.tasks=[{kind:'FINISH_ACTION',side:'USSR',round:1}];
    const next=apply(state,'USSR',{type:'TARGET',country:'iran'}),c=next.clash!;
    assert.equal(c.kind,'COUP');if(c.kind!=='COUP')return;
    assert.equal(c.id,1);assert.equal(c.side,'USSR');assert.equal(c.country,'iran');
    assert.equal(c.total,c.roll+3);assert.equal(c.need,4);assert.equal(c.defconDrop,true);
    assert.equal(c.removed+c.added,Math.max(0,c.total-c.need));
    assert.equal(next.influence.iran.US,2-c.removed);assert.equal(next.influence.iran.USSR,c.added);
    assert.deepEqual(viewFor(next,'US').clash,c);
  }
});

test('each realignment records both rolls, modifiers and the winner',()=>{
  let wins=0;
  for(let seed=1;seed<=30;seed++){
    const state:GameState={...createGame(seed)};
    state.influence.angola={US:3,USSR:1};
    state.phase={kind:'OPS',side:'USSR',round:1,mode:'REALIGNMENT',remaining:1,ops:1,eligible:[]};state.tasks=[{kind:'FINISH_ACTION',side:'USSR',round:1}];
    const next=apply(state,'USSR',{type:'TARGET',country:'angola'}),c=next.clash!;
    assert.equal(c.kind,'REALIGN');if(c.kind!=='REALIGN')return;
    const difference=c.rolls[0]+c.modifiers[0]-c.rolls[1]-c.modifiers[1];
    assert.equal(c.winner,difference>0?'USSR':difference<0?'US':null);
    if(c.winner===null)assert.equal(c.removed,0);else wins++;
    const loser=c.winner==='USSR'?'US':'USSR';
    if(c.winner)assert.equal(next.influence.angola[loser],state.influence.angola[loser]-c.removed);
  }
  assert.ok(wins>0);
});
