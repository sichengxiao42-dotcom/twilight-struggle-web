import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardPreview, createGame } from '../src';

test('opening preview contains only an independent static board, with no shuffled deck or dealt hands',()=>{
  const preview=createBoardPreview();
  assert.deepEqual(preview.hands,{USSR:[],US:[]});
  assert.deepEqual(preview.deck,[]);assert.equal(preview.rngCalls,0);assert.deepEqual(preview.log,[]);
  assert.deepEqual(preview.influence,createGame(42).influence);
  preview.influence.poland.USSR=99;
  assert.equal(createBoardPreview().influence.poland.USSR,0);
  assert.equal(createGame(42).hands.USSR.length,8);assert.equal(createGame(42).hands.US.length,8);
});
