import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, createGame, type GameState } from '@ts/game-core';
import { cardAction, cardChoices } from '../src/cardPlay';

function actionState():GameState {
  const state=createGame(1);state.phase={kind:'ACTION_ROUND',side:'USSR',round:1};
  state.hands.USSR=[1,17,19,13,33,32,49];return state;
}
test('inspection in setup and waiting phases exposes no playable actions or state changes',()=>{
  const state=createGame(1),before=structuredClone(state);
  assert.deepEqual(cardChoices(state,'USSR',33),[]);
  state.phase={kind:'ACTION_ROUND',side:'US',round:1};
  assert.deepEqual(cardChoices(state,'USSR',33),[]);
  state.phase=before.phase;assert.deepEqual(state,before);
});
test('headline choices allow opponent cards but explain the UN restriction',()=>{
  const state=actionState();state.phase={kind:'HEADLINE',side:'USSR'};
  assert.equal(cardChoices(state,'USSR',19)[0].id,'HEADLINE');
  assert.equal(cardChoices(state,'USSR',17)[0].reason,undefined);
  assert.match(cardChoices(state,'USSR',32)[0].reason!,/不能作为头条/);
});
test('opponent cards explain event prohibition, and space accounts for modified OPS and attempts',()=>{
  const state=actionState();
  assert.match(cardChoices(state,'USSR',19).find(c=>c.id==='EVENT')!.reason!,/对方事件/);
  assert.match(cardChoices(state,'USSR',19).find(c=>c.id==='SPACE')!.reason!,/至少 2 OPS/);
  state.effects.purge.USSR=true;
  assert.match(cardChoices(state,'USSR',17).find(c=>c.id==='INFLUENCE')!.detail,/2 行动点/);
  assert.equal(cardChoices(state,'USSR',17).find(c=>c.id==='SPACE')!.reason,undefined);
  state.spaceAttempts.USSR=1;
  assert.match(cardChoices(state,'USSR',17).find(c=>c.id==='SPACE')!.reason!,/次数已用完/);
});
test('scoring and trap affordances match the engine, including mandatory discards',()=>{
  const state=actionState();
  assert.deepEqual(cardChoices(state,'USSR',1).map(c=>c.id),['EVENT']);
  state.effects.bearTrap=true;
  assert.match(cardChoices(state,'USSR',1)[0].reason!,/至少 2 OPS/);
  assert.equal(cardChoices(state,'USSR',17)[0].id,'TRAP_DISCARD');
  assert.equal(cardChoices(state,'USSR',17)[0].reason,undefined);
  state.hands.USSR=[1,19];
  assert.equal(cardChoices(state,'USSR',1)[0].id,'EVENT');
  assert.equal(cardChoices(state,'USSR',1)[0].reason,undefined);
});
test('China, Missile Envy and Cuban Missile Crisis have explicit safeguards',()=>{
  const state=actionState();
  assert.match(cardChoices(state,'USSR',6).find(c=>c.id==='EVENT')!.reason!,/中国牌/);
  state.effects.cmc='USSR';
  assert.match(cardChoices(state,'USSR',33).find(c=>c.id==='COUP')!.reason!,/古巴导弹危机/);
  state.effects.missileEnvy='USSR';
  assert.ok(cardChoices(state,'USSR',33).every(c=>c.reason));
  assert.equal(cardChoices(state,'USSR',49).find(c=>c.id==='INFLUENCE')!.reason,undefined);
  assert.match(cardChoices(state,'USSR',49).find(c=>c.id==='EVENT')!.reason!,/导弹嫉妒/);
});
test('Grain Sales uses the same chooser while only exposing the drawn card',()=>{
  const state=actionState();state.phase={kind:'SUBPLAY',side:'US',card:19};
  assert.deepEqual(cardChoices(state,'US',33),[]);
  assert.equal(cardChoices(state,'US',19).find(c=>c.id==='EVENT')!.reason,undefined);
  assert.equal(cardAction(19,'COUP',{order:'AFTER',region:'NONE'}).type,'PLAY_OPS');
});
test('choosing a use is read-only; only the explicit confirmed action consumes a card',()=>{
  const state=actionState(),before=structuredClone(state);
  const choice=cardChoices(state,'USSR',33).find(c=>c.id==='INFLUENCE')!;
  assert.equal(choice.reason,undefined);assert.deepEqual(state,before);
  const action=cardAction(33,choice.id,{order:'AFTER',region:'NONE'});
  const next=apply(state,'USSR',action);
  assert.equal(next.hands.USSR.includes(33),false);assert.equal(state.hands.USSR.includes(33),true);
  assert.equal(next.phase.kind,'OPS');
  assert.deepEqual(cardAction(6,'INFLUENCE',{order:'BEFORE',region:'ASIA'}),{type:'PLAY_OPS',card:6,mode:'INFLUENCE',order:'BEFORE',asiaOnly:true,seaOnly:false});
});
