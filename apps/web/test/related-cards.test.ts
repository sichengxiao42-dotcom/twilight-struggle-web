import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_BY_ID, canEvent, createGame } from '@ts/game-core';
import { CARD_RELATIONS, relatedCards } from '../src/cardRelations';

test('rule references are valid, unique and available from either card',()=>{
  const pairs=new Set<string>();
  for(const relation of CARD_RELATIONS){
    assert.ok(CARD_BY_ID.has(relation.from));assert.ok(CARD_BY_ID.has(relation.to));
    const pair=[relation.from,relation.to].sort((a,b)=>a-b).join(':');
    assert.ok(!pairs.has(pair));pairs.add(pair);
    assert.ok(relatedCards(relation.from).some(r=>r.id===relation.to));
    assert.ok(relatedCards(relation.to).some(r=>r.id===relation.from));
  }
  assert.deepEqual(relatedCards(999),[]);
});
test('Warsaw and Marshall unlock NATO only after an event actually resolves',()=>{
  const s=createGame(1);
  assert.ok(relatedCards(16).some(r=>r.id===21));
  assert.equal(canEvent(s,21,'US'),false);
  s.effects.warsaw=true;assert.equal(canEvent(s,21,'US'),true);
  delete s.effects.warsaw;s.effects.marshall=true;assert.equal(canEvent(s,21,'US'),true);
});
