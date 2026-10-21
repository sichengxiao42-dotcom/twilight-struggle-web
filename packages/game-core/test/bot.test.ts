import assert from 'node:assert/strict';
import test from 'node:test';
import { activeSide, apply, CARDS, chooseBotAction, createGame, type GameState } from '../src/index';
import { drain } from '../src/engine';

test('basic bots finish seeded standard games without stalls or held scoring cards',()=>{
  for(let seed=1;seed<=16;seed++){
    let state:GameState={...createGame(seed),manualEnd:true,manualDice:true};
    for(let step=0;step<2500&&state.phase.kind!=='GAME_OVER';step++){
      const before=JSON.stringify(state),action=chooseBotAction(state);
      assert.ok(action,`seed ${seed}, turn ${state.turn}: ${JSON.stringify(state.phase)}`);
      assert.equal(JSON.stringify(state),before,'decision must not mutate authority');
      const next=apply(state,activeSide(state)!,action);
      assert.notDeepEqual(next,state,'each step must advance');state=next;
    }
    assert.equal(state.phase.kind,'GAME_OVER',`seed ${seed}`);
    // Random discards can still trigger a nuclear event: do not inspect future dice to avoid it.
    if(state.phase.kind==='GAME_OVER')assert.doesNotMatch(state.phase.reason,/仍持有计分牌|古巴导弹危机期间/);
  }
});

test('bots resolve every card event including opponent decisions and follow-up plays',()=>{
  const covered=new Set<string>();
  for(const card of CARDS.filter(c=>c.id!==6)){
    const actor=card.side==='NEUTRAL'?'US':card.side;
    let state=createGame(card.id);state.manualEnd=true;state.turn=8;state.phasingSide=actor;state.defcon=3;
    // Publicly varied board gives event target selectors meaningful choices.
    for(const [index,inf] of Object.values(state.influence).entries()){inf.US=index%4;inf.USSR=(index+1)%4;}
    state.hands={US:[4,10,18,32,49,67,77],USSR:[5,7,16,30,33,44,50]};
    state.tasks=[{kind:'EVENT',card:card.id,actor,phasing:actor},{kind:'FINISH_ACTION',side:actor,round:1}];
    drain(state);
    let steps=0;
    while(!['ACTION_ROUND','GAME_OVER','HEADLINE'].includes(state.phase.kind)&&steps++<100){
      if(state.phase.kind==='DECISION')covered.add(state.phase.decision.kind);
      const action=chooseBotAction(state);assert.ok(action,`card ${card.id}: ${JSON.stringify(state.phase)}`);
      state=apply(state,activeSide(state)!,action);
    }
    assert.ok(steps<100,`event ${card.id} did not finish`);
  }
  for(const kind of ['INFLUENCE','COUNTRY','CHOICE','OPS_MODE','REVEAL'])assert.ok(covered.has(kind),kind);
});

test('ranking does not inspect deck order, RNG results, enemy hand or secret headline',()=>{
  for(const phase of ['ACTION_ROUND','HEADLINE'] as const){
    const state=createGame(42);state.phase=phase==='HEADLINE'?{kind:phase,side:'USSR'}:{kind:phase,side:'USSR',round:1};
    const changed=structuredClone(state);changed.deck.reverse();changed.seed=999;changed.rngCalls=150;
    changed.hands.US=[100,89,4];changed.headlines.US=100;
    assert.deepEqual(chooseBotAction(changed),chooseBotAction(state));
  }
});

test('bot declines nuclear coups and losing war-games choices',()=>{
  const state=createGame(1);state.defcon=2;state.effects.cmc='USSR';
  state.phase={kind:'OPS',side:'USSR',round:1,mode:'COUP',remaining:3,ops:3,eligible:[]};
  assert.deepEqual(chooseBotAction(state),{type:'END_OPS'});
  state.phase={kind:'DECISION',side:'USSR',decision:{kind:'CHOICE',event:100,actor:'USSR',phasing:'USSR',prompt:'',options:[{id:'end',label:''},{id:'continue',label:''}]}};
  state.vp=-5;assert.deepEqual(chooseBotAction(state),{type:'CHOOSE',value:'continue'});
  state.vp=-7;assert.deepEqual(chooseBotAction(state),{type:'CHOOSE',value:'end'});
});

test('a coup card that triggers a DEFCON event resolves the event before selecting a safe target',()=>{
  const state=createGame(1);state.defcon=3;state.hands.USSR=[4];
  state.phase={kind:'ACTION_ROUND',side:'USSR',round:1};state.phasingSide='USSR';
  const action=chooseBotAction(state)!;
  assert.equal(action.type,'PLAY_OPS');
  if(action.type==='PLAY_OPS'){assert.equal(action.mode,'COUP');assert.equal(action.order,'BEFORE');}
  const next=apply(state,'USSR',action);assert.equal(next.defcon,2);
  const target=chooseBotAction(next)!;
  const resolved=apply(next,'USSR',target);
  assert.ok(resolved.phase.kind!=='GAME_OVER'||!resolved.phase.reason.includes('核战争'));
});
