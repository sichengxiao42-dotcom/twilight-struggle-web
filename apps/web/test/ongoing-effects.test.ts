import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { CARD_BY_ID, EVENT_SUMMARIES, type Effects } from '@ts/game-core';
import { EFFECT_CARDS, ongoingEffects } from '../src/ongoingEffects';
import { EffectsPanel } from '../src/SidePanels';

test('every public effect links to a real event explanation', () => {
  for(const cardId of Object.values(EFFECT_CARDS)) {
    assert.ok(CARD_BY_ID.has(cardId));
    assert.ok(EVENT_SUMMARIES[cardId]?.length);
  }
  assert.deepEqual(ongoingEffects({purge:{}}),[]);
  assert.deepEqual(ongoingEffects({purge:{},nato:false}),[]);
});

test('effect details retain the affected side and region, including both purges', () => {
  const effects:Effects={purge:{US:true,USSR:true},cmc:'US',deathSquads:'USSR',chernobyl:'ASIA'};
  const entries=ongoingEffects(effects);
  assert.equal(entries.length,5);
  assert.equal(new Set(entries.map(e=>e.id)).size,5);
  for(const label of ['美国 OPS −1','苏联 OPS −1','古巴导弹危机（美国）','拉丁美洲敢死队（苏联）','切尔诺贝利（亚洲）']) {
    assert.ok(entries.some(e=>e.label.includes(label)));
  }
  const html=renderToStaticMarkup(createElement(EffectsPanel,{effects}));
  assert.equal((html.match(/<details>/g)||[]).length,5);
  assert.ok(html.includes('<summary>古巴导弹危机（美国）</summary>'));
  assert.ok(html.includes(EVENT_SUMMARIES[40]));
  assert.ok(html.includes('一次性结算不会重复执行'));
});
