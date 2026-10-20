import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from '@ts/game-core';
import { phaseGuide, type GuideContext } from '../src/StageGuide';

const context: GuideContext = { selected: null, revealed: false, targetCount: 9 };

test('setup guide changes side, region and remaining points on handoff', () => {
  const state = createGame(1);
  assert.deepEqual(phaseGuide(state, context).counter, {value:6,unit:'点影响力'});
  state.phase = { kind: 'SETUP_PLACEMENT', side: 'US', subRegion: 'WESTERN_EUROPE', remaining: 3 };
  const guide = phaseGuide(state, context);
  assert.match(guide.title, /美国.*西欧/);
  assert.deepEqual(guide.counter, {value:3,unit:'点影响力'});
  assert.equal(guide.focus, 'map');
});

test('waiting guidance overrides card selection without revealing its name', () => {
  const state = createGame(1);
  state.phase = { kind: 'HEADLINE', side: 'USSR' };
  const guide = phaseGuide(state, { ...context, selected: 17, revealed: true, blocked: '等待美国处理事件' });
  assert.equal(guide.focus, 'none');
  assert.doesNotMatch(guide.detail, /戴高乐/);
  assert.equal(guide.title, '等待美国处理事件');
});

test('illegal UN headline directs player to choose another card', () => {
  const state = createGame(1);
  state.phase = { kind: 'HEADLINE', side: 'USSR' };
  const guide = phaseGuide(state, { ...context, selected: 32, revealed: true });
  assert.equal(guide.focus, 'hand');
  assert.match(guide.detail, /不能作为头条/);
});

test('OPS with no targets directs player to end the operation instead of the map', () => {
  const state = createGame(1);
  state.phase = { kind: 'OPS', side: 'US', round: 1, mode: 'INFLUENCE', remaining: 1, ops: 2, eligible: [] };
  const guide = phaseGuide(state, { ...context, targetCount: 0 });
  assert.equal(guide.focus, 'actions');
  assert.match(guide.detail, /没有可操作/);
});

test('OPS task separates remaining points from short instructions and expandable rules', () => {
  const state=createGame(1);
  state.phase={kind:'OPS',side:'US',round:1,mode:'INFLUENCE',remaining:3,ops:3,eligible:[]};
  const guide=phaseGuide(state,context);
  assert.equal(guide.title,'轮到美国 · 放置影响力');
  assert.deepEqual(guide.counter,{value:3,unit:'OPS'});
  assert.match(guide.detail,/点击金框国家/);
  assert.doesNotMatch(guide.detail,/2 OPS/);
  assert.match(guide.rule!,/2 OPS/);
  state.phase.mode='COUP';
  const coup=phaseGuide(state,context);
  assert.match(coup.detail,/立即发动政变/);
  assert.match(coup.rule!,/全部行动点/);
  assert.match(coup.actionHint!,/放弃本次政变/);
});

test('secret reveal requires opening own hand before showing decision guidance', () => {
  const state = createGame(1);
  state.phase = { kind: 'DECISION', side: 'US', decision: { kind: 'REVEAL', prompt: '秘密卡牌', cards: [17] } };
  assert.equal(phaseGuide(state, context).focus, 'hand');
  assert.equal(phaseGuide(state, { ...context, revealed: true }).focus, 'actions');
});

test('practice guidance explains OPS rather than asking for unplayable scoring cards', () => {
  const state = createGame(1, 'PRACTICE');
  state.phase = { kind: 'ACTION_ROUND', side: 'USSR', round: 1 };
  assert.match(phaseGuide(state, { ...context, revealed: true }).detail, /选择一张非计分牌/);
});
