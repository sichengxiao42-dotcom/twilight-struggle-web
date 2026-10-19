import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, viewFor } from '../src/index';
test('player view never includes deck order, seed, RNG, action snapshot or task continuations',()=>{
  const s=createGame(2311523);s.tasks=[{kind:'EVENT',card:27,actor:'US',phasing:'USSR'}];
  const v=viewFor(s,'US');
  for(const key of ['seed','rngCalls','tasks','deck','actionStartInfluence','phasingSide','noradPending'])assert.ok(!(key in v));
  assert.deepEqual(v.hands.US,s.hands.US);assert.deepEqual(v.hands.USSR,[]);assert.equal(v.handCounts.USSR,8);assert.equal(v.deckCount,22);
  assert.ok(!JSON.stringify(v).includes('2311523'));
  v.hands.US.pop();assert.equal(s.hands.US.length,8);
});
test('private event choices and reveal cards are visible only to deciding side',()=>{
  const s=createGame(1);s.phase={kind:'DECISION',side:'US',decision:{kind:'REVEAL',prompt:'Private',cards:[27,25]}};
  assert.equal(viewFor(s,'US').phase.kind,'DECISION');assert.deepEqual(viewFor(s,'USSR').phase,{kind:'WAITING',side:'US'});
  s.phase={kind:'DECISION',side:'US',decision:{kind:'CHOICE',prompt:'Blockade',event:10,actor:'USSR',phasing:'USSR',options:[{id:'27',label:'secret card'}]}};
  assert.ok(!JSON.stringify(viewFor(s,'USSR')).includes('secret card'));
});
test('committed headline is hidden from opponent except the space privilege',()=>{
  const s=createGame(1);s.phase={kind:'HEADLINE',side:'US'};s.headlines.USSR=31;
  assert.equal(viewFor(s,'US').headlines.USSR,undefined);assert.equal(viewFor(s,'USSR').headlines.USSR,31);
  assert.equal(viewFor(s,'US').headlineCommitted.USSR,true);
  s.space.US=4;assert.equal(viewFor(s,'US').headlines.USSR,31);
  s.space.USSR=4;assert.equal(viewFor(s,'US').headlines.USSR,undefined);
});
test('CIA exposes only the appropriate hand to US and expires when effect ends',()=>{
  const s=createGame(1);s.effects.cia=true;
  assert.deepEqual(viewFor(s,'US').hands.USSR,s.hands.USSR);assert.deepEqual(viewFor(s,'USSR').hands.US,[]);
  delete s.effects.cia;assert.deepEqual(viewFor(s,'US').hands.USSR,[]);
});
