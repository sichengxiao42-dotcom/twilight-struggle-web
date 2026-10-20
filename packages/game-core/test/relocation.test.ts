import assert from 'node:assert/strict';
import test from 'node:test';
import { apply, createGame, type GameState } from '../src/index';

function relocation():GameState {
  const state=createGame(42);
  state.phase={kind:'ACTION_ROUND',side:'USSR',round:1};state.hands.USSR=[33];
  return apply(state,'USSR',{type:'PLAY_EVENT',card:33});
}
const total=(s:GameState)=>Object.values(s.influence).reduce((n,v)=>n+v.USSR,0);
const move=(s:GameState,from:string,to:string)=>apply(s,'USSR',{type:'RELOCATE_INFLUENCE',from,to});
test('four atomic drags conserve influence and finish relocation without placing it twice',()=>{
  let s=relocation();const n=total(s);
  s=move(s,'syria','angola');s=move(s,'east_germany','angola');
  const snapshot=structuredClone(s);
  assert.throws(()=>move(s,'east_germany','angola'),/落点/);assert.deepEqual(s,snapshot);
  s=move(s,'east_germany','thailand');s=move(s,'east_germany','thailand');
  assert.equal(total(s),n);assert.equal(s.influence.angola.USSR,2);assert.equal(s.influence.thailand.USSR,2);
  assert.equal(s.phase.kind,'ACTION_ROUND');assert.ok(s.removed.includes(33));
});
test('mixed drag and sidebar removal retain destination caps and do not duplicate already placed points',()=>{
  let s=relocation();const n=total(s);
  s=move(s,'east_germany','angola');s=move(s,'east_germany','angola');
  s=apply(s,'USSR',{type:'CHOOSE',value:'syria'});
  s=apply(s,'USSR',{type:'CHOOSE',value:'done'});
  assert.equal(s.phase.kind,'DECISION');
  if(s.phase.kind!=='DECISION'||s.phase.decision.kind!=='INFLUENCE')throw new Error('placement expected');
  assert.equal(s.phase.decision.remaining,1);
  assert.throws(()=>apply(s,'USSR',{type:'CHOOSE',value:'angola'}),/目标/);
  s=apply(s,'USSR',{type:'CHOOSE',value:'thailand'});
  assert.equal(total(s),n);assert.equal(s.influence.angola.USSR,2);assert.equal(s.influence.thailand.USSR,1);
});
test('newly placed points cannot be recycled as further relocation sources',()=>{
  let s=relocation();s=move(s,'finland','syria');s=move(s,'syria','egypt');
  assert.throws(()=>move(s,'syria','egypt'),/落点|再次/);
  assert.throws(()=>move(s,'east_germany','uk'),/落点/);
  assert.throws(()=>move(s,'east_germany','east_germany'),/落点/);
});
test('ordinary deployment never permits moving an existing influence piece between countries',()=>{
  const s=createGame(1);assert.throws(()=>move(s,'east_germany','poland'),/不允许/);
});
