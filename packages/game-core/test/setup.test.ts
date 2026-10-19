import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CARDS, COUNTRIES, coupResult, controller, createGame, isRegionRestrictedByDefcon, placementCost, vpWinner,
} from '../src/index';

test('createGame deals 8 cards each and keeps China card out of the deck', () => {
  const state = createGame(42);
  assert.equal(state.hands.USSR.length, 8);
  assert.equal(state.hands.US.length, 8);
  const all = [...state.hands.USSR, ...state.hands.US, ...state.deck];
  assert.equal(new Set(all).size, all.length);
  assert.ok(!all.includes(6));
  assert.equal(state.chinaCard.holder, 'USSR');
  assert.equal(state.defcon, 5);
});

test('same seed produces the same deal', () => {
  assert.deepEqual(createGame(7).hands, createGame(7).hands);
  assert.notDeepEqual(createGame(7).hands, createGame(8).hands);
});

test('initial influence: UK and North Korea are controlled', () => {
  const state = createGame(1);
  assert.equal(controller(state, 'uk'), 'US');
  assert.equal(controller(state, 'north_korea'), 'USSR');
  assert.equal(controller(state, 'iran'), null);
  assert.equal(placementCost(state, 'uk', 'USSR'), 2);
  assert.equal(placementCost(state, 'iran', 'USSR'), 1);
});

test('map data has 29 battleground countries and unique ids', () => {
  assert.equal(COUNTRIES.filter((c) => c.battleground).length, 29);
  assert.equal(new Set(COUNTRIES.map((c) => c.id)).size, COUNTRIES.length);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
});

test('DEFCON, coup and VP helpers', () => {
  assert.equal(isRegionRestrictedByDefcon(5, 'EUROPE'), false);
  assert.equal(isRegionRestrictedByDefcon(4, 'EUROPE'), true);
  assert.equal(isRegionRestrictedByDefcon(3, 'ASIA'), true);
  assert.equal(isRegionRestrictedByDefcon(2, 'AFRICA'), false);
  assert.equal(coupResult(6, 3, 2), 5);
  assert.equal(coupResult(1, 1, 3), 0);
  assert.equal(vpWinner(20), 'US');
  assert.equal(vpWinner(-20), 'USSR');
  assert.equal(vpWinner(5), null);
});
