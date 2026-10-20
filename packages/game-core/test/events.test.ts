import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeSide, apply, CARD_BY_ID, CARDS, COUNTRIES, createGame, legalTargets, scoreRegion, type GameState } from '../src/index';
import { beginAction, beginHeadline, modifiedOps } from '../src/engine';
import type { Side } from '@ts/shared';
function ready(side:Side='USSR'):GameState {const s=createGame(42);beginAction(s,side,1);return s;}
function play(id:number,side:Side='USSR',configure?:(s:GameState)=>void) {
  const s=ready(side);s.hands[side]=[id];configure?.(s);return apply(s,side,{type:'PLAY_EVENT',card:id});
}
function choose(s:GameState,value:string){return apply(s,activeSide(s)!,{type:'CHOOSE',value});}
function auto(s:GameState):GameState {
  for(let i=0;i<80&&(s.phase.kind==='DECISION'||s.phase.kind==='OPS');i++) {
    if(s.phase.kind==='OPS')s=apply(s,activeSide(s)!,{type:'END_OPS'});
    else {const d=s.phase.decision;s=choose(s,d.kind==='REVEAL'?'confirm':d.kind==='OPS_MODE'?'skip':d.kind==='CHOICE'?d.options[0].id:legalTargets(s)[0]??'done');}
  }return s;
}
test('all 38 early-war event cards resolve without a stuck continuation',()=>{
  for(const card of CARDS.filter(c=>c.id!==6&&c.period==='EARLY')){
    const side=card.side==='US'?'US':'USSR';
    const s=auto(play(card.id,side,s=>{s.effects.marshall=true;s.influence.uk.US=5;s.hands[side]=[card.id,4,8,1];}));
    assert.equal(s.phase.kind,'ACTION_ROUND',card.nameZh+' should finish');
    assert.equal(activeSide(s),side==='US'?'USSR':'US');
    assert.ok(s.removed.includes(card.id)||s.discard.includes(card.id),card.nameZh+' disposition');
  }
});
test('headline selection stays secret until both commit; ties resolve US first',()=>{
  let s=ready();beginHeadline(s);s.hands.USSR=[25];s.hands.US=[7];
  s=apply(s,'USSR',{type:'SELECT_HEADLINE',card:25});
  assert.equal(s.phase.kind,'HEADLINE');assert.ok(!s.log.some(l=>l.includes('遏制政策')));
  s=apply(s,'US',{type:'SELECT_HEADLINE',card:7});
  assert.equal(s.phase.kind,'DECISION'); // Socialist Governments resolves first (3 vs 3, US selected it).
  assert.equal(s.effects.containment,undefined);
  s=auto(s);assert.equal(s.effects.containment,true);assert.equal(s.phase.kind,'ACTION_ROUND');
});
test('Defectors cancels a scoring headline and UN cannot headline',()=>{
  let s=ready();beginHeadline(s);s.hands.USSR=[1,32];s.hands.US=[103];
  assert.throws(()=>apply(s,'USSR',{type:'SELECT_HEADLINE',card:32}));
  s=apply(s,'USSR',{type:'SELECT_HEADLINE',card:1});s=apply(s,'US',{type:'SELECT_HEADLINE',card:103});
  assert.equal(s.vp,0);assert.ok(s.discard.includes(1));assert.equal(s.phase.kind,'ACTION_ROUND');
});
test('opponent event resolves before or after OPS, with starred removal only when triggered',()=>{
  for(const order of ['BEFORE','AFTER'] as const){
    const initial=ready('US');initial.hands.US=[8];
    let s=apply(initial,'US',{type:'PLAY_OPS',card:8,mode:'INFLUENCE',order});
    assert.equal(s.influence.cuba.USSR,order==='BEFORE'?3:0);
    s=apply(s,'US',{type:'END_OPS'});assert.equal(s.influence.cuba.USSR,3);assert.ok(s.removed.includes(8));
  }
  const s=ready();s.hands.USSR=[8];const next=apply(apply(s,'USSR',{type:'PLAY_OPS',card:8,mode:'INFLUENCE'}),'USSR',{type:'END_OPS'});
  assert.equal(next.influence.cuba.USSR,0);assert.ok(next.discard.includes(8));
});
test('Duck and Cover and CIA nuclear defeat belongs to phasing player',()=>{
  let s=ready();s.hands.USSR=[4];s.defcon=2;
  s=apply(s,'USSR',{type:'PLAY_OPS',card:4,mode:'INFLUENCE'});assert.equal(s.phase.kind==='GAME_OVER'&&s.phase.winner,'US');
  s=ready();s.hands.USSR=[26];s.defcon=2;s.influence.nigeria.USSR=1;
  s=apply(s,'USSR',{type:'PLAY_OPS',card:26,mode:'INFLUENCE'});
  s=choose(s,'confirm');s=choose(s,'COUP');s=apply(s,'US',{type:'TARGET',country:'nigeria'});
  assert.equal(s.phase.kind==='GAME_OVER'&&s.phase.winner,'US');
});
test('Blockade applies modified discard OPS and US chooses the response',()=>{
  let s=play(10,'USSR',s=>{s.hands.US=[25,21];s.effects.purge.US=true;s.influence.west_germany.US=4;});
  assert.equal(activeSide(s),'US');assert.equal(s.phase.kind==='DECISION'&&s.phase.decision.kind==='CHOICE'&&s.phase.decision.options.length,2);
  assert.throws(()=>choose(s,'25'));s=choose(s,'21');assert.equal(s.influence.west_germany.US,4);assert.ok(s.discard.includes(21));
});
test('per-country limits, optional relocation and exact redistribution',()=>{
  let s=play(7);s=choose(s,'uk');s=choose(s,'uk');assert.throws(()=>choose(s,'uk'));s=choose(s,'canada');assert.equal(s.influence.uk.US,3);
  s=play(33);s=choose(s,'north_korea');s=choose(s,'north_korea');s=choose(s,'done');
  assert.equal(s.phase.kind==='DECISION'&&s.phase.decision.kind==='INFLUENCE'&&s.phase.decision.remaining,2);
  s=choose(s,'chile');s=choose(s,'chile');assert.equal(s.influence.chile.USSR,2);assert.equal(s.influence.north_korea.USSR,1);
});
test('Warsaw Pact choices, NATO prerequisite and France/Japan protections',()=>{
  let s=play(21,'US');assert.equal(s.effects.nato,undefined);assert.ok(s.discard.includes(21));assert.ok(!s.removed.includes(21));
  s=play(16);s=choose(s,'add');for(const id of ['poland','poland','east_germany','east_germany','hungary'])s=choose(s,id);
  assert.equal(s.effects.warsaw,true);s.hands.US=[21];s=apply(s,'US',{type:'PLAY_EVENT',card:21});assert.equal(s.effects.nato,true);
  beginAction(s,'USSR',2);s.defcon=5;s.hands.USSR=[31];s.influence.france.US=3;s.influence.japan.US=4;s.effects.japan=true;
  s=apply(s,'USSR',{type:'PLAY_OPS',card:31,mode:'COUP'});assert.ok(!legalTargets(s).includes('france'));assert.ok(!legalTargets(s).includes('japan'));
  s.effects.deGaulle=true;assert.ok(legalTargets(s).includes('france'));
});
test('regional scoring requires non-battleground for domination, counts adjacency, and Europe control wins',()=>{
  const s=ready();for(const c of COUNTRIES)s.influence[c.id]={US:0,USSR:0};
  s.influence.japan.US=4;s.influence.south_korea.US=3;
  assert.equal(scoreRegion(s,'ASIA').US.status,'PRESENCE');s.influence.taiwan.US=3;assert.equal(scoreRegion(s,'ASIA').US.status,'DOMINATION');
  for(const c of COUNTRIES.filter(c=>c.region==='EUROPE'&&c.battleground))s.influence[c.id].US=c.stability;
  assert.equal(scoreRegion(s,'EUROPE').winner,'US');s.hands.USSR=[2];const next=apply(s,'USSR',{type:'PLAY_EVENT',card:2});assert.equal(next.phase.kind==='GAME_OVER'&&next.phase.winner,'US');
});
test('Formosan affects scoring only and US China play cancels it; China passes face down',()=>{
  let s=ready('US');s.effects.formosan=true;s.influence.taiwan.US=3;
  assert.equal(scoreRegion(s,'ASIA').US.battlegrounds,1);s.chinaCard={holder:'US',faceUp:true};
  s=apply(s,'US',{type:'PLAY_OPS',card:6,mode:'INFLUENCE',asiaOnly:true});
  assert.deepEqual(s.chinaCard,{holder:'USSR',faceUp:false});assert.equal(s.effects.formosan,undefined);assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,5);
  assert.ok(legalTargets(s).every(id=>COUNTRIES.find(c=>c.id===id)!.region==='ASIA'));
});
test('NORAD resolves at end of action; Special Relationship places both points in one country',()=>{
  let s=ready();s.effects.norad=true;s.influence.canada.US=4;s.defcon=3;s.hands.USSR=[4];
  s=apply(s,'USSR',{type:'PLAY_OPS',card:4,mode:'INFLUENCE'});s=apply(s,'USSR',{type:'END_OPS'});
  assert.equal(s.phase.kind,'DECISION');assert.equal(activeSide(s),'US');s=choose(s,'iran');assert.equal(s.influence.iran.US,2);assert.equal(s.phase.kind,'ACTION_ROUND');
  s=play(105,'US',s=>{s.effects.nato=true;});s=choose(s,'italy');assert.throws(()=>choose(s,'france'));s=choose(s,'italy');assert.equal(s.influence.italy.US,2);assert.equal(s.vp,2);
});
test('space discards opposing event without firing, scientists score first/second arrival',()=>{
  let s=ready();s.hands.USSR=[27];s=apply(s,'USSR',{type:'SPACE',card:27});assert.equal(s.effects.japan,undefined);assert.ok(s.discard.includes(27));
  s=play(18,'US');assert.equal(s.space.US,1);assert.equal(s.vp,2);
  s=play(18,'USSR',s=>{s.space.US=1;});assert.equal(s.vp,-1);
});
test('UN Intervention spends two cards and suppresses the paired event',()=>{
  let s=ready();s.hands.USSR=[32,27];s=apply(s,'USSR',{type:'PLAY_EVENT',card:32});s=choose(s,'27');s=choose(s,'INFLUENCE');
  assert.equal(s.effects.japan,undefined);assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,4);
  s=apply(s,'USSR',{type:'END_OPS'});assert.ok(s.discard.includes(32)&&s.discard.includes(27));assert.ok(!s.removed.includes(27));
});
test('end of turn catches held scoring, flips China, resets temporary effects, refills and improves DEFCON',()=>{
  let s=ready('US');beginAction(s,'US',6);s.hands.US=[35,1];s.hands.USSR=[];s=apply(s,'US',{type:'PLAY_EVENT',card:35});assert.equal(s.phase.kind==='GAME_OVER'&&s.phase.winner,'USSR');
  s=ready('US');beginAction(s,'US',6);s.hands.US=[35];s.hands.USSR=[];s.defcon=3;s.chinaCard.faceUp=false;s.effects.containment=true;s.effects.vietnam=true;s.effects.purge.US=true;
  s=apply(s,'US',{type:'PLAY_EVENT',card:35});assert.equal(s.turn,2);assert.equal(s.phase.kind,'HEADLINE');assert.equal(s.hands.US.length,8);assert.equal(s.defcon,4);assert.equal(s.effects.containment,undefined);assert.equal(s.effects.formosan,true);assert.equal(s.chinaCard.faceUp,true);
});
test('turn 4 shuffles the Mid War cards into the draw deck and hands grow to nine',()=>{
  let s=ready('US');s.turn=3;beginAction(s,'US',6);s.hands.US=[35];s.hands.USSR=[];s=apply(s,'US',{type:'PLAY_EVENT',card:35});
  assert.equal(s.turn,4);assert.equal(s.phase.kind,'HEADLINE');assert.equal(s.hands.US.length,9);assert.equal(s.hands.USSR.length,9);
  assert.ok([...s.deck,...s.hands.US,...s.hands.USSR].some(id=>CARD_BY_ID.get(id)!.period==='MID'));
});
test('modifiers are aggregated and expire separately from permanent events',()=>{
  const s=ready('US');s.effects.containment=true;s.effects.purge.US=true;
  assert.equal(modifiedOps(s,'US',1),1);assert.equal(modifiedOps(s,'US',4),4);
});
test('seeded three-turn playthroughs conserve cards, keep finite state, and never stall',()=>{
  let completed=0;
  for(let seed=1;seed<=20;seed++){
    let s=createGame(seed);
    for(let i=0;i<6;i++)s=apply(s,'USSR',{type:'PLACE_SETUP',country:'poland'});
    for(let i=0;i<7;i++)s=apply(s,'US',{type:'PLACE_SETUP',country:'west_germany'});
    for(let step=0;step<400;step++){
      if(s.phase.kind==='GAME_OVER'||s.turn>=4)break;
      const side=activeSide(s)!;
      if(s.phase.kind==='HEADLINE'){
        const id=s.hands[side].find(id=>CARD_BY_ID.get(id)!.scoring)??s.hands[side].find(id=>id!==32)!;
        s=apply(s,side,{type:'SELECT_HEADLINE',card:id});
      }else if(s.phase.kind==='ACTION_ROUND'){
        const id=s.hands[side].find(id=>CARD_BY_ID.get(id)!.scoring)??s.hands[side][0];
        s=id===undefined?apply(s,side,{type:'PASS_EMPTY'}):apply(s,side,CARD_BY_ID.get(id)!.scoring?{type:'PLAY_EVENT',card:id}:{type:'PLAY_OPS',card:id,mode:'INFLUENCE',order:step%2?'AFTER':'BEFORE'});
      }else s=auto(s);
      assert.ok(Number.isFinite(s.vp));assert.ok(s.defcon>=1&&s.defcon<=5);
      for(const inf of Object.values(s.influence))for(const n of Object.values(inf))assert.ok(Number.isInteger(n)&&n>=0);
      if(s.phase.kind==='OPS')assert.ok(Number.isFinite(s.phase.remaining));
      const all=[...s.deck,...s.discard,...s.removed,...s.hands.US,...s.hands.USSR,...s.tasks.filter(t=>t.kind==='DISPOSE').map(t=>t.card)];
      if(s.phase.kind==='HEADLINE'&&!s.tasks.length)all.push(...Object.values(s.headlines));
      assert.equal(new Set(all).size,all.length,'duplicate cards seed '+seed);
      if(s.turn<4)assert.equal(all.length,38,'lost card seed '+seed+' phase '+s.phase.kind);
    }
    assert.ok(s.phase.kind==='GAME_OVER'||s.turn>=4,'stalled seed '+seed);
    if(s.turn>=4)completed++;
  }
  assert.ok(completed>0,'at least one full three-turn scenario');
});
test('aggregate regional bonuses cannot bypass Purge floor and China/Vietnam bonuses combine',()=>{
  let s=ready();s.effects.vietnam=true;s.effects.purge.USSR=true;s.hands.USSR=[10];
  s=apply(s,'USSR',{type:'PLAY_OPS',card:10,mode:'INFLUENCE',seaOnly:true});assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,1);
  s=ready();s.effects.vietnam=true;s.effects.purge.USSR=true;
  s=apply(s,'USSR',{type:'PLAY_OPS',card:6,mode:'COUP',seaOnly:true});assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,5);
  s=ready('US');s.effects.containment=true;s.chinaCard={holder:'US',faceUp:true};
  s=apply(s,'US',{type:'PLAY_OPS',card:6,mode:'INFLUENCE',asiaOnly:true});assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,5);
});
test('Cambridge Five reveals only scoring cards and restricts placement to their regions',()=>{
  let s=play(104,'USSR',s=>{s.hands.US=[1,3,25];});
  assert.deepEqual(s.phase.kind==='DECISION'&&s.phase.decision.kind==='REVEAL'&&s.phase.decision.cards,[1,3]);
  s=choose(s,'confirm');assert.ok(legalTargets(s).includes('iran'));assert.ok(!legalTargets(s).includes('france'));
  s=choose(s,'thailand');assert.equal(s.influence.thailand.USSR,1);assert.equal(s.phase.kind,'ACTION_ROUND');
});
test('scientist and recurring space privileges grant second attempts, late headline and held discard',()=>{
  let s=ready();s.space.USSR=2;s.hands.USSR=[31];s.spaceAttempts.USSR=1;
  s=apply(s,'USSR',{type:'SPACE',card:31});assert.equal(s.spaceAttempts.USSR,2);
  s=ready();s.space.USSR=4;beginHeadline(s);assert.equal(activeSide(s),'US');
  s=ready('US');beginAction(s,'US',6);s.space.US=6;s.space.USSR=0;s.hands.US=[35,25];s.hands.USSR=[];
  s=apply(s,'US',{type:'PLAY_EVENT',card:35});assert.equal(s.phase.kind==='DECISION'&&s.phase.decision.kind==='CHOICE'&&s.phase.decision.event,-6);
  const before=s.vp;s=choose(s,'25');assert.equal(s.turn,2);assert.equal(s.vp,before);assert.ok(!s.hands.US.includes(25)); // Removed card may later be drawn only if reshuffle needed.
});
test('empty hands may pass but scoring cards and China restrictions cannot be evaded',()=>{
  let s=ready();assert.throws(()=>apply(s,'USSR',{type:'PASS_EMPTY'}));
  s.hands.USSR=[];s=apply(s,'USSR',{type:'PASS_EMPTY'});assert.equal(activeSide(s),'US');
  s=ready();beginAction(s,'USSR',6);s.hands.USSR=[1];assert.throws(()=>apply(s,'USSR',{type:'PLAY_OPS',card:6,mode:'INFLUENCE'}));
});
test('fixed events apply exact influence changes and nuclear test ban uses pre-improvement DEFCON',()=>{
  let s=play(8,'USSR',s=>{s.influence.cuba={US:5,USSR:1};});assert.deepEqual(s.influence.cuba,{US:0,USSR:3});
  s=play(12,'USSR',s=>{s.influence.romania={US:2,USSR:4};});assert.deepEqual(s.influence.romania,{US:0,USSR:4});
  s=play(15,'USSR',s=>{s.influence.egypt={US:5,USSR:1};});assert.deepEqual(s.influence.egypt,{US:2,USSR:3});
  s=play(17,'USSR',s=>{s.influence.france={US:1,USSR:0};});assert.deepEqual(s.influence.france,{US:0,USSR:1});assert.equal(s.effects.deGaulle,true);
  s=play(27,'US',s=>{s.influence.japan={US:1,USSR:3};});assert.deepEqual(s.influence.japan,{US:7,USSR:3});
  s=play(34,'US',s=>{s.defcon=3;});assert.equal(s.vp,1);assert.equal(s.defcon,5);
});
test('Five Year Plan resolves a US event in its queue and otherwise simply discards',()=>{
  let s=play(5,'US',s=>{s.hands.USSR=[27];});assert.equal(s.effects.japan,true);assert.ok(s.removed.includes(27));assert.ok(s.discard.includes(5));
  s=play(5,'US',s=>{s.hands.USSR=[8];});assert.equal(s.influence.cuba.USSR,0);assert.ok(s.discard.includes(8));
});
test('Olympic boycott grants modified OPS and nuclear responsibility stays with sponsor',()=>{
  let s=play(20,'US',s=>{s.effects.containment=true;});s=choose(s,'boycott');assert.equal(s.defcon,4);s=choose(s,'INFLUENCE');assert.equal(s.phase.kind==='OPS'&&s.phase.remaining,4);
  s=play(20,'US',s=>{s.defcon=2;});s=choose(s,'boycott');assert.equal(s.phase.kind==='GAME_OVER'&&s.phase.winner,'USSR');
});
test('war success transfers influence and gives VP; failure still supplies military operations',()=>{
  let s=play(11,'USSR',s=>{s.seed=1;s.rngCalls=0;s.influence.south_korea.US=3;});
  assert.equal(s.vp,-2);assert.deepEqual(s.influence.south_korea,{US:0,USSR:3});assert.equal(s.milOps.USSR,2);
  s=play(11,'USSR',s=>{s.seed=7;s.rngCalls=0;s.influence.south_korea.US=3;});
  assert.equal(s.vp,0);assert.equal(s.influence.south_korea.US,3);assert.equal(s.milOps.USSR,2);
  s=play(13,'USSR',s=>{s.seed=1;s.rngCalls=0;s.influence.israel.US=4;}); // Target control itself modifies this war.
  assert.equal(s.vp,0);assert.equal(s.milOps.USSR,2);
});
