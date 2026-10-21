import assert from 'node:assert/strict';
import test from 'node:test';
import { activeSide, apply, chooseBotAction, createGame, viewFor, type Action, type GameState } from '../src/index';

function actionState(side:'US'|'USSR'='USSR',seed=42){
  const s=createGame(seed);s.manualEnd=true;s.phase={kind:'ACTION_ROUND',side,round:1};s.phasingSide=side;return s;
}
function finishDice(state:GameState){
  let steps=0;
  while(state.phase.kind==='DICE_ROLL'){
    assert.ok(steps++<100,'roll continuation stalled');
    const action:Action={type:state.phase.values.length===state.phase.request.rollers.length?'CONTINUE_DICE':'ROLL_DICE'};
    state=apply(state,state.phase.side,action);
  }
  return state;
}
function comparable(state:GameState){
  const copy=structuredClone(state);delete copy.manualDice;delete copy.diceHistory;return copy;
}

test('coup waits for a click, exposes no future result, then waits for confirmation to change the board',()=>{
  const original=actionState();original.hands.USSR=[7];
  const ops=apply(original,'USSR',{type:'PLAY_OPS',card:7,mode:'COUP'});
  const expected=apply(ops,'USSR',{type:'TARGET',country:'iran'});
  ops.manualDice=true;
  const waiting=apply(ops,'USSR',{type:'TARGET',country:'iran'});
  assert.equal(waiting.phase.kind,'DICE_ROLL');assert.equal(waiting.rngCalls,ops.rngCalls);
  assert.deepEqual(waiting.influence,ops.influence);assert.equal(waiting.defcon,ops.defcon);assert.deepEqual(waiting.milOps,ops.milOps);
  const publicView=viewFor(waiting,'US');
  for(const privateKey of ['pendingDice','diceReplay','seed','rngCalls','deck'])assert.ok(!(privateKey in publicView));
  assert.equal(publicView.phase.kind,'DICE_ROLL');if(publicView.phase.kind==='DICE_ROLL')assert.deepEqual(publicView.phase.values,[]);
  assert.throws(()=>apply(waiting,'US',{type:'ROLL_DICE'}),/尚未轮到/);
  assert.throws(()=>apply(waiting,'USSR',{type:'CONTINUE_DICE'}),/先完成掷骰/);
  const rolled=apply(waiting,'USSR',{type:'ROLL_DICE'});
  assert.equal(rolled.rngCalls,ops.rngCalls+1);assert.deepEqual(rolled.influence,ops.influence);
  assert.throws(()=>apply(rolled,'USSR',{type:'ROLL_DICE'}),/不能重复/);
  assert.throws(()=>apply(rolled,'USSR',{type:'END_OPS'}),/先完成掷骰/);
  assert.deepEqual(comparable(finishDice(rolled)),expected);
});

test('realignment makes each side roll its own die before the initiating side confirms',()=>{
  const original=actionState();original.hands.USSR=[7];
  const ops=apply(original,'USSR',{type:'PLAY_OPS',card:7,mode:'REALIGNMENT'});
  const expected=apply(ops,'USSR',{type:'TARGET',country:'iran'});ops.manualDice=true;
  let s=apply(ops,'USSR',{type:'TARGET',country:'iran'});
  s=apply(s,'USSR',{type:'ROLL_DICE'});assert.equal(activeSide(s),'US');
  assert.throws(()=>apply(s,'USSR',{type:'ROLL_DICE'}),/尚未轮到/);
  s=apply(s,'US',{type:'ROLL_DICE'});assert.equal(activeSide(s),'USSR');
  assert.deepEqual(s.influence,ops.influence);assert.equal(s.diceHistory?.[0].values.length,2);
  assert.deepEqual(comparable(finishDice(s)),expected);
});

test('space, trap and war continuations preserve exact RNG, cards, public history and logs',()=>{
  const cases:{state:GameState;action:Action}[]=[];
  const space=actionState('US');space.hands.US=[23];cases.push({state:space,action:{type:'SPACE',card:23}});
  const trap=actionState();trap.hands.USSR=[7];trap.effects.bearTrap=true;cases.push({state:trap,action:{type:'TRAP_DISCARD',card:7}});
  const war=actionState();war.hands.USSR=[11];cases.push({state:war,action:{type:'PLAY_EVENT',card:11}});
  for(const {state,action} of cases){
    const side=activeSide(state)!,expected=apply(state,side,action);state.manualDice=true;
    const waiting=apply(state,side,action);assert.equal(waiting.phase.kind,'DICE_ROLL');
    const restored=JSON.parse(JSON.stringify(waiting)) as GameState;
    const actual=finishDice(restored);
    assert.deepEqual(comparable(actual),expected);
    assert.equal(actual.publicPlays?.length,1,'card must only be recorded once');
    assert.ok(!actual.pendingDice);assert.ok(!actual.diceReplay);
  }
});

test('Olympics ties request a fresh pair, with no duplicated effects from replay',()=>{
  let foundTie=false;
  for(let seed=1;seed<=80&&!foundTie;seed++){
    const s=actionState('USSR',seed);
    s.phase={kind:'DECISION',side:'US',decision:{kind:'CHOICE',prompt:'奥运会',options:[{id:'participate',label:'参加'}],event:20,actor:'USSR',phasing:'USSR'}};
    const expected=apply(s,'US',{type:'CHOOSE',value:'participate'});
    if(expected.rngCalls-s.rngCalls<=2)continue;
    foundTie=true;s.manualDice=true;
    const actual=finishDice(apply(s,'US',{type:'CHOOSE',value:'participate'}));
    assert.ok((actual.diceHistory?.length??0)>1);
    assert.deepEqual(comparable(actual),expected);
  }
  assert.ok(foundTie);
});

test('full seeded games remain identical with manual dice, including headlines and chained events',()=>{
  for(const seed of [1,11]){
    let automatic:GameState={...createGame(seed),manualEnd:true};
    let manual:GameState={...structuredClone(automatic),manualDice:true};
    let rolls=0;
    for(let step=0;step<2000&&automatic.phase.kind!=='GAME_OVER';step++){
      const side=activeSide(automatic)!,action=chooseBotAction(automatic)!;
      assert.ok(action);automatic=apply(automatic,side,action);
      manual=apply(manual,side,action);if(manual.phase.kind==='DICE_ROLL')rolls++;
      manual=finishDice(manual);
      assert.deepEqual(comparable(manual),automatic,`seed ${seed}, step ${step}, ${action.type}`);
    }
    assert.equal(automatic.phase.kind,'GAME_OVER');assert.ok(rolls>10);
  }
});
