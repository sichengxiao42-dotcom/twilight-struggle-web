import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CARDS } from '@ts/game-core';
import { CATALOG_GROUPS } from '../src/cardCatalogData';

test('catalog lists every card exactly once in its printed period with local art',()=>{
  assert.deepEqual(CATALOG_GROUPS.map(g=>g.id),['EARLY','MID','LATE']);
  const cards=CATALOG_GROUPS.flatMap(g=>g.cards);
  assert.equal(cards.length,CARDS.length);
  assert.equal(new Set(cards.map(c=>c.id)).size,CARDS.length);
  const manifest=JSON.parse(readFileSync(new URL('../../../assets/tts-manifest.json',import.meta.url),'utf8'));
  for(const group of CATALOG_GROUPS) {
    assert.ok(group.cards.length>0);
    assert.deepEqual(group.cards.map(c=>c.id),group.cards.map(c=>c.id).sort((a,b)=>a-b));
    for(const card of group.cards) {
      assert.equal(card.period,group.id);
      const entry=manifest.cards[String(card.id)];assert.ok(entry,'missing card art '+card.id);
      assert.ok(manifest.sheets[entry.sheet]?.url,'missing original sheet '+card.id);
    }
  }
});
