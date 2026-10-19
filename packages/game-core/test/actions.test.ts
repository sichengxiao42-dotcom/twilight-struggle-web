import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADJACENCY, COUNTRIES, activeSide, apply, createGame, legalTargets, type GameState } from '../src/index';
function ready(): GameState {
  let s=createGame(42, 'PRACTICE');
  for(let i=0;i<6;i++) s=apply(s,'USSR',{type:'PLACE_SETUP',country:'poland'});
  for(let i=0;i<7;i++) s=apply(s,'US',{type:'PLACE_SETUP',country:'west_germany'});
  return s;
}
test('all board links are valid, symmetric, reachable from a superpower and unique',()=>{
  for(const c of COUNTRIES) {
    assert.ok(ADJACENCY[c.id].length);
    assert.equal(new Set(ADJACENCY[c.id]).size,ADJACENCY[c.id].length);
    for(const n of ADJACENCY[c.id]) assert.ok(ADJACENCY[n].includes(c.id));
  }
  const visited=new Set<string>(), queue=COUNTRIES.filter(c=>c.adjacentTo).map(c=>c.id);
  while(queue.length) {const id=queue.pop()!;if(visited.has(id))continue;visited.add(id);queue.push(...ADJACENCY[id]);}
  assert.equal(visited.size,COUNTRIES.length);
});
test('setup validates region and side, immutable state, then starts USSR action',()=>{
  const original=createGame(42, 'PRACTICE');
  assert.throws(()=>apply(original,'US',{type:'PLACE_SETUP',country:'france'}));
  assert.throws(()=>apply(original,'USSR',{type:'PLACE_SETUP',country:'france'}));
  const next=apply(original,'USSR',{type:'PLACE_SETUP',country:'poland'});
  assert.equal(original.influence.poland.USSR,0);
  assert.equal(next.influence.poland.USSR,1);
  assert.deepEqual(ready().phase,{kind:'ACTION_ROUND',round:1,side:'USSR'});
});
test('placement reach is frozen and costs update after breaking control',()=>{
  let s=ready(); s.hands.USSR=[31];s.influence.iran={US:2,USSR:0};
  s=apply(s,'USSR',{type:'PLAY_OPS',card:31,mode:'INFLUENCE'});
  assert.ok(!legalTargets(s).includes('pakistan'));
  s=apply(s,'USSR',{type:'TARGET',country:'iran'});
  assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,2);
  assert.ok(!legalTargets(s).includes('pakistan'));
  s=apply(s,'USSR',{type:'TARGET',country:'iran'});
  assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,1);
});
test('coups are deterministic, consume card, reduce DEFCON even on failure, add military ops',()=>{
  const original=ready(); original.hands.USSR=[31];
  const started=apply(original,'USSR',{type:'PLAY_OPS',card:31,mode:'COUP'});
  const s=apply(started,'USSR',{type:'TARGET',country:'iran'});
  assert.deepEqual(s,apply(started,'USSR',{type:'TARGET',country:'iran'}));
  assert.equal(s.defcon,4); assert.equal(s.milOps.USSR,4);
  assert.equal(activeSide(s),'US');assert.ok(s.discard.includes(31));assert.equal(original.hands.USSR.length,1);
});
test('DEFCON restricts targets and nuclear war defeats acting side',()=>{
  let s=ready();s.defcon=2;s.hands.USSR=[31];
  s.influence.nigeria.US=1;
  s=apply(s,'USSR',{type:'PLAY_OPS',card:31,mode:'COUP'});
  assert.ok(!legalTargets(s).includes('iran'));
  s=apply(s,'USSR',{type:'TARGET',country:'nigeria'});
  assert.deepEqual(s.phase,{kind:'GAME_OVER',winner:'US',reason:'USSR 引发核战争'});
});
test('realignments consume exactly two RNG calls and one OPS; may end early',()=>{
  let s=ready();s.hands.USSR=[31];
  s=apply(s,'USSR',{type:'PLAY_OPS',card:31,mode:'REALIGNMENT'});
  const calls=s.rngCalls;
  s=apply(s,'USSR',{type:'TARGET',country:'uk'});
  assert.equal(s.rngCalls,calls+2);
  assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,3);
  s=apply(s,'USSR',{type:'END_OPS'});assert.equal(activeSide(s),'US');
});
test('six alternating action rounds finish with military shortfall once',()=>{
  let s=ready();
  for(let i=0;i<12;i++) {
    const side=activeSide(s)!;s.hands[side]=[31];
    s=apply(s,side,{type:'PLAY_OPS',card:31,mode:'INFLUENCE'});
    s=apply(s,side,{type:'END_OPS'});
  }
  assert.equal(s.phase.kind,'M1_COMPLETE');assert.equal(s.vp,0);
  assert.throws(()=>apply(s,'US',{type:'END_OPS'}));
});

test('practice pass is only allowed when no OPS card remains',()=>{
  let s=ready(); assert.throws(()=>apply(s,'USSR',{type:'PASS_PRACTICE'}));
  s.hands.USSR=[1,2,3];s=apply(s,'USSR',{type:'PASS_PRACTICE'});
  assert.equal(activeSide(s),'US');
});
test('board-specific links differ from geographic borders',()=>{
  assert.ok(ADJACENCY.south_korea.includes('taiwan'));
  assert.ok(ADJACENCY.france.includes('algeria'));
  assert.ok(!ADJACENCY.norway.includes('finland'));
  assert.ok(ADJACENCY.romania.includes('bulgaria'));
});
