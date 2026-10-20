import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from '@ts/game-core';
import { boardChanges } from '../src/boardChanges';

test('unchanged public state produces no board feedback', () => {
  const state = createGame(1);
  assert.deepEqual(boardChanges(state, structuredClone(state)), []);
});
test('a coup transferring influence reports both sides and the control change', () => {
  const before = createGame(1), after = structuredClone(before);
  before.influence.iran = { US: 3, USSR: 0 };
  after.influence.iran = { US: 0, USSR: 2 };
  const changes = boardChanges(before, after);
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].deltas, [{ side: 'US', amount: -3 }, { side: 'USSR', amount: 2 }]);
  assert.equal(changes[0].control, 'USSR');
  assert.equal(changes[0].controlChanged, true);
  assert.match(changes[0].label, /苏联取得控制/);
});
test('multi-country events retain all changes and explain loss of control', () => {
  const before = createGame(1), after = structuredClone(before);
  after.influence.uk.US = 0;
  after.influence.poland.USSR = 1;
  const changes = boardChanges(before, after);
  assert.equal(changes.length, 2);
  const uk = changes.find(c => c.country === 'uk')!;
  assert.equal(uk.control, null);
  assert.match(uk.label, /恢复无控制/);
  assert.equal(changes.find(c => c.country === 'poland')!.controlChanged, false);
});
