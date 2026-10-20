import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apply, createGame, viewFor, type GameState } from '../src/index';

function actionState():GameState {
  const state=createGame(17);state.manualEnd=true;
  state.phase={kind:'ACTION_ROUND',side:'US',round:1};state.phasingSide='US';state.hands.US=[25,27,6];
  return state;
}
test('public play survives OPS and manual confirmation, then archives only after ending the action',()=>{
  const initial=actionState();
  let state=apply(initial,'US',{type:'PLAY_OPS',card:25,mode:'INFLUENCE'});
  assert.deepEqual(initial.publicPlays,undefined);
  assert.deepEqual(state.publicPlays,[{id:1,card:25,side:'US',use:'INFLUENCE',turn:1,round:1,finished:false}]);
  assert.deepEqual(viewFor(state,'USSR').publicPlays,state.publicPlays);
  state=apply(state,'US',{type:'END_OPS'});
  assert.equal(state.phase.kind,'CONFIRM_END');assert.equal(state.publicPlays![0].finished,false);
  state=apply(state,'US',{type:'END_ACTION'});
  assert.equal(state.publicPlays![0].finished,true);
  assert.equal(state.phase.kind,'ACTION_ROUND');
});
test('secret and pending headlines never enter public history; reveal publishes both cards once',()=>{
  let state=actionState();state.phase={kind:'HEADLINE',side:'USSR'};state.hands.USSR=[8];state.hands.US=[25];
  state=apply(state,'USSR',{type:'SELECT_HEADLINE',card:8});
  assert.deepEqual(viewFor(state,'US').publicPlays,[]);
  state=apply(state,'USSR',{type:'END_ACTION'});
  assert.deepEqual(viewFor(state,'US').publicPlays,[]);
  state=apply(state,'US',{type:'SELECT_HEADLINE',card:25});
  assert.deepEqual(viewFor(state,'USSR').publicPlays,[]);
  state=apply(state,'US',{type:'END_ACTION'});
  assert.deepEqual(state.publicPlays?.map(play=>[play.card,play.side,play.use,play.finished]),[[25,'US','HEADLINE',true],[8,'USSR','HEADLINE',true]]);
  const next=apply(state,'USSR',{type:'PLAY_OPS',card:6,mode:'INFLUENCE'});
  assert.equal(next.publicPlays?.length,3);
  assert.equal(next.publicPlays?.at(-1)?.side,'USSR');
});
test('event, space, China card and trap discard publish the actual player and purpose',()=>{
  const event=apply(actionState(),'US',{type:'PLAY_EVENT',card:27});
  assert.equal(event.publicPlays?.[0].use,'EVENT');assert.equal(event.publicPlays?.[0].finished,false);
  const space=apply(actionState(),'US',{type:'SPACE',card:25});
  assert.equal(space.publicPlays?.[0].use,'SPACE');assert.equal(space.publicPlays?.[0].finished,false);
  const china=actionState();china.chinaCard={holder:'US',faceUp:true};
  assert.equal(apply(china,'US',{type:'PLAY_OPS',card:6,mode:'INFLUENCE'}).publicPlays?.[0].card,6);
  const trap=actionState();trap.effects.quagmire=true;
  assert.equal(apply(trap,'US',{type:'TRAP_DISCARD',card:25}).publicPlays?.[0].use,'DISCARD');
});
test('opponent event choices and Grain Sales subplays do not prematurely archive the original card',()=>{
  const state=actionState();state.phase={kind:'ACTION_ROUND',side:'USSR',round:1};state.phasingSide='USSR';state.hands.USSR=[26];
  const reveal=apply(state,'USSR',{type:'PLAY_OPS',card:26,mode:'INFLUENCE'});
  assert.equal(reveal.phase.kind,'DECISION');
  assert.equal(reveal.publicPlays?.[0].side,'USSR');assert.equal(reveal.publicPlays?.[0].finished,false);
  const sub=actionState();sub.phase={kind:'SUBPLAY',side:'US',card:25};sub.phasingSide='USSR';
  sub.tasks=[{kind:'FINISH_ACTION',side:'USSR',round:1}];
  sub.publicPlays=[{id:1,card:67,side:'USSR',use:'INFLUENCE',turn:1,round:1,finished:false}];
  const resolved=apply(sub,'US',{type:'PLAY_EVENT',card:25});
  assert.equal(resolved.publicPlays?.length,2);
  assert.ok(resolved.publicPlays?.every(play=>!play.finished));
});
test('automatic actions and game-ending events archive; rejected actions and pre-play defeat reveal no new card',()=>{
  const auto=actionState();auto.manualEnd=false;
  assert.equal(apply(auto,'US',{type:'PLAY_EVENT',card:27}).publicPlays?.[0].finished,true);
  const defeat=actionState();defeat.effects.buryYou=true;defeat.vp=-19;
  const ended=apply(defeat,'US',{type:'PLAY_EVENT',card:27});
  assert.equal(ended.phase.kind,'GAME_OVER');assert.equal(ended.publicPlays,undefined);
  const invalid=actionState();assert.throws(()=>apply(invalid,'US',{type:'PLAY_EVENT',card:8}));assert.equal(invalid.publicPlays,undefined);
});
